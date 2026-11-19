// Luna Vega: on-foot movement, stealing and driving cars, shooting, and
// interacting with the city's shops and mission givers.
import { PLAYER, WEAPONS, WANTED, WORLD } from './config.js';
import { collideBuildings, isWater, isRoad } from './city.js';
import { driveCar, moveCar, carSpeed, damageCar } from './vehicles.js';
import { addSkid, spawnParticles, addFloat } from './effects.js';
import { fireBullet, meleeAttack } from './combat.js';
import { knockDownPed } from './pedestrians.js';
import { screenToWorld } from './camera.js';

export function createPlayer(x, y) {
  return {
    x, y,
    vx: 0, vy: 0,
    angle: -Math.PI / 2,
    aimAngle: -Math.PI / 2,
    health: PLAYER.maxHealth,
    armor: 0,
    money: 250,
    inCar: null,
    weapon: 'pistol',
    weapons: { fists: true, pistol: true, smg: false },
    ammo: { pistol: 48, smg: 0 },
    cooldown: 0,
    dead: false,
    sprinting: false,
    walking: false,
    walkPhase: 0,
    lastDamageAt: 0,
  };
}

function nearestCar(world, range) {
  let best = null;
  let bestD = range;
  for (const car of world.cars) {
    if (car.exploded || car.burning > 0) continue;
    const d = Math.hypot(car.x - world.player.x, car.y - world.player.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

export function enterCar(world, car) {
  const player = world.player;
  if (!car || car.driver === 'player') return;
  const wasParked = car.kind === 'parked';
  const wasTraffic = car.kind === 'traffic';
  car.driver = 'player';
  car.kind = car.kind === 'police' ? 'police' : 'traffic';
  player.inCar = car;
  player.x = car.x;
  player.y = car.y;
  world.audio.door();
  if (wasTraffic) {
    // Jacking a moving car: the driver bails out.
    world.police.addHeat(WANTED.heatPerCrime.stealCar);
    world.hud.notify('Car jacked! The driver ran for it.', '#f2c531');
    world.stats.carsStolen += 1;
  } else if (wasParked) {
    world.police.addHeat(WANTED.heatPerCrime.stealCar * 0.5);
    world.stats.carsStolen += 1;
  }
  if (car.kind === 'police') {
    world.police.addHeat(1.0);
    world.hud.notify('You stole a police interceptor!', '#ff5a3c');
  }
}

export function exitCar(world) {
  const player = world.player;
  const car = player.inCar;
  if (!car) return;
  car.driver = 'ai';
  car.kind = car.model.id === 'police' ? 'police' : 'traffic';
  // Step out to the side of the car.
  const side = car.angle + Math.PI / 2;
  player.x = car.x + Math.cos(side) * 30;
  player.y = car.y + Math.sin(side) * 30;
  player.vx = 0;
  player.vy = 0;
  player.inCar = null;
  world.audio.door();
}

function updateOnFoot(world, dt, input, camera) {
  const player = world.player;
  const axis = input.axis();
  const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
  const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  const len = Math.hypot(axis.x, axis.y) || 1;
  const tx = len > 0 ? (axis.x / len) * speed : 0;
  const ty = len > 0 ? (axis.y / len) * speed : 0;
  const moving = axis.x !== 0 || axis.y !== 0;
  player.vx += (tx - player.vx) * Math.min(1, 12 * dt);
  player.vy += (ty - player.vy) * Math.min(1, 12 * dt);
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  player.walking = moving;
  player.sprinting = moving && sprint;
  if (moving) {
    player.walkPhase += dt * (sprint ? 16 : 11);
    player.angle = Math.atan2(player.vy, player.vx);
  }
  // Aim at the mouse.
  const aim = screenToWorld(camera, input.mouse.x, input.mouse.y);
  player.aimAngle = Math.atan2(aim.y - player.y, aim.x - player.x);
  player.x = Math.max(16, Math.min(WORLD.width - 16, player.x));
  player.y = Math.max(16, Math.min(WORLD.waterTop - 16, player.y));
  const fixed = collideBuildings(player.x, player.y, PLAYER.radius, world.city);
  player.x = fixed.x;
  player.y = fixed.y;

  // Enter a nearby car.
  if (input.wasPressed('KeyF')) {
    const car = nearestCar(world, PLAYER.enterCarRange);
    if (car) enterCar(world, car);
    else world.hud.notify('No car in reach — get closer.', '#cccccc');
  }
  // Interact (shops, mission givers).
  if (input.wasPressed('KeyE')) world.interact();
  // Switch weapon.
  if (input.wasPressed('Digit1')) player.weapon = 'fists';
  if (input.wasPressed('Digit2') && player.weapons.pistol) player.weapon = 'pistol';
  if (input.wasPressed('Digit3') && player.weapons.smg) player.weapon = 'smg';
  if (input.wasPressed('KeyQ')) {
    const order = ['fists', 'pistol', 'smg'].filter((w) => player.weapons[w]);
    player.weapon = order[(order.indexOf(player.weapon) + 1) % order.length];
  }
  // Attack.
  player.cooldown -= dt;
  const weapon = WEAPONS[player.weapon];
  const wantFire = weapon.auto ? input.mouse.down : input.mouse.clicked;
  if (wantFire && player.cooldown <= 0) {
    player.cooldown = weapon.cooldown;
    if (player.weapon === 'fists') {
      meleeAttack(world, player, player.aimAngle);
    } else if (player.ammo[player.weapon] > 0) {
      player.ammo[player.weapon] -= 1;
      fireBullet(world, player.x, player.y, player.aimAngle, { weapon: player.weapon, fromPlayer: true });
    } else {
      world.hud.notify('Out of ammo — find a pickup or visit Ironworks Supply.', '#ff5a3c');
      player.weapon = 'fists';
    }
  }
}

function updateDriving(world, dt, input) {
  const player = world.player;
  const car = player.inCar;
  const axis = input.axis();
  const throttle = axis.y < 0 ? 1 : axis.y > 0 ? -1 : 0;
  const steer = axis.x;
  const handbrake = input.down('Space');
  const drifting = driveCar(car, throttle, steer, handbrake, dt);
  moveCar(car, dt, world);
  player.x = car.x;
  player.y = car.y;
  player.vx = car.vx;
  player.vy = car.vy;
  player.angle = car.angle;
  if (drifting) {
    addSkid(world.effects, car.x - Math.cos(car.angle) * 18, car.y - Math.sin(car.angle) * 18, car.angle);
    if (Math.random() < 0.3) spawnParticles(world.effects, car.x, car.y, { count: 1, colors: ['#cccccc'], speed: 30, life: 0.4, size: 4 });
  }
  // Car vs pedestrian.
  for (const ped of world.peds) {
    if (ped.state === 'down') continue;
    if (Math.hypot(ped.x - car.x, ped.y - car.y) < 26 && carSpeed(car) > 60) {
      knockDownPed(world, ped, 100, true);
      world.stats.pedsHarmed += 1;
    }
  }
  if (input.wasPressed('KeyF')) exitCar(world);
  // Drive-by: shoot from the car with the mouse.
  player.cooldown -= dt;
  if (input.mouse.clicked && player.cooldown <= 0 && player.weapons.pistol && player.ammo.pistol > 0) {
    player.cooldown = WEAPONS.pistol.cooldown;
    player.ammo.pistol -= 1;
    const aim = screenToWorld(world.camera, input.mouse.x, input.mouse.y);
    const angle = Math.atan2(aim.y - car.y, aim.x - car.x);
    fireBullet(world, car.x, car.y, angle, { weapon: 'pistol', fromPlayer: true });
  }
}

export function updatePlayer(world, dt, input, camera) {
  const player = world.player;
  if (player.dead) return;
  if (player.inCar) {
    updateDriving(world, dt, input);
  } else {
    updateOnFoot(world, dt, input, camera);
  }
  // Slow health regen out of combat.
  if (world.time - player.lastDamageAt > 12 && player.health > 0 && player.health < PLAYER.maxHealth) {
    player.health = Math.min(PLAYER.maxHealth, player.health + 2 * dt);
  }
  // Falling in the water is not allowed: the beach pushes you back.
  if (isWater(player.x, player.y)) {
    player.y = WORLD.waterTop - 20;
    if (player.inCar) {
      player.inCar.y = WORLD.waterTop - 20;
      player.inCar.vy = -Math.abs(player.inCar.vy) * 0.5;
    }
  }
  // Road bonus: driving fast on roads feels right; off-road is slower.
  if (player.inCar && !isRoad(player.x, player.y, world.city)) {
    player.inCar.vx *= 1 - 0.4 * dt;
    player.inCar.vy *= 1 - 0.4 * dt;
  }
}
