// The Solhaven Police Department: a wanted level that rises with every
// crime, cops who chase on foot and in interceptors, roadblocks at high
// heat, and the busted / evade loop.
import { WANTED, WORLD } from './config.js';
import { createRng, range, chance } from './random.js';
import { createCar } from './vehicles.js';
import { createPed } from './pedestrians.js';
import { randomRoadPoint, collideBuildings } from './city.js';

export function createPolice() {
  return {
    heat: 0, // continuous; stars = ceil(heat)
    unseenTimer: 0,
    bustedTimer: 0,
    spawnTimer: 0,
    sirenTimer: 0,
  };
}

export function wantedStars(police) {
  return Math.min(WANTED.maxStars, Math.ceil(police.heat - 0.001));
}

export function addHeat(world, amount) {
  const police = world.police;
  const before = wantedStars(police);
  police.heat = Math.min(WANTED.maxStars, police.heat + amount);
  police.unseenTimer = 0;
  const after = wantedStars(police);
  if (after > before && after > 0) {
    world.hud.flash(`WANTED LEVEL ${after}`, '#ff5a3c');
    world.audio.sirenBlip();
  }
  if (after >= 3 && before < 3) {
    world.hud.notify('SPPD: all units, suspect is armed and dangerous', '#ff5a3c');
  }
}

export function clearWanted(world) {
  world.police.heat = 0;
  world.police.unseenTimer = 0;
  world.police.bustedTimer = 0;
  // Cops already on scene give up and drive off.
  for (const car of world.cars) {
    if (car.kind === 'police') car.kind = 'traffic';
  }
  for (let i = world.peds.length - 1; i >= 0; i -= 1) {
    if (world.peds[i].isCop) world.peds.splice(i, 1);
  }
}

// Is any cop close enough to see the player?
function copSeesPlayer(world) {
  const player = world.player;
  for (const car of world.cars) {
    if (car.kind === 'police' && Math.hypot(car.x - player.x, car.y - player.y) < 620) return true;
  }
  for (const ped of world.peds) {
    if (ped.isCop && Math.hypot(ped.x - player.x, ped.y - player.y) < 420) return true;
  }
  return false;
}

function spawnCopCar(world, rng) {
  const player = world.player;
  const p = randomRoadPoint(rng, world.city, player.x, player.y, 650, 1100);
  const car = createCar('police', p.x, p.y, p.axis === 'v' ? Math.PI / 2 : 0, 'police');
  car.axis = p.axis;
  car.dir = 1;
  car.driver = 'ai';
  world.cars.push(car);
}

function spawnCopPed(world, rng) {
  const player = world.player;
  const a = rng() * Math.PI * 2;
  const d = range(rng, 260, 420);
  const x = Math.max(40, Math.min(WORLD.width - 40, player.x + Math.cos(a) * d));
  const y = Math.max(40, Math.min(WORLD.height - 40, player.y + Math.sin(a) * d));
  const ped = createPed(x, y, { isCop: true, shirt: '#2e4a6b', state: 'walk', health: 100 });
  world.peds.push(ped);
}

function updateCopPed(world, ped, dt) {
  const player = world.player;
  const dist = Math.hypot(player.x - ped.x, player.y - ped.y);
  const speed = player.inCar ? 260 : 210;
  ped.angle = Math.atan2(player.y - ped.y, player.x - ped.x);
  ped.x += Math.cos(ped.angle) * speed * dt;
  ped.y += Math.sin(ped.angle) * speed * dt;
  ped.walkPhase += dt * 14;
  const fixed = collideBuildings(ped.x, ped.y, 10, world.city);
  ped.x = fixed.x;
  ped.y = fixed.y;
  // Cops shoot at a fleeing player from range at 2+ stars.
  if (wantedStars(world.police) >= 2 && dist < 420 && !player.inCar && Math.random() < dt * 0.8) {
    world.combat.enemyShoot(world, ped, player);
  }
  // Busted: a cop holds you while you are slow and on foot.
  if (!player.inCar && dist < 34 && Math.hypot(player.vx, player.vy) < 90) {
    world.police.bustedTimer += dt;
    if (world.police.bustedTimer > WANTED.bustedHold) {
      world.endRun('busted');
    }
  } else {
    world.police.bustedTimer = Math.max(0, world.police.bustedTimer - dt * 2);
  }
}

export function updatePolice(world, dt) {
  const police = world.police;
  const stars = wantedStars(police);
  police.spawnTimer -= dt;
  police.sirenTimer -= dt;

  // Heat decays only while no cop can see you.
  if (stars > 0) {
    if (copSeesPlayer(world)) {
      police.unseenTimer = 0;
    } else {
      police.unseenTimer += dt;
      if (police.unseenTimer > WANTED.decayDelay) {
        police.heat = Math.max(0, police.heat - WANTED.decayRate * dt);
        if (police.heat <= 0) {
          clearWanted(world);
          world.hud.notify('You lost them. Stay low.', '#7fb3a3');
        }
      }
    }
  }

  // Keep the right number of units on the street.
  if (stars > 0 && police.spawnTimer <= 0) {
    police.spawnTimer = 1.2;
    const rng = createRng((Date.now() % 100000) + stars * 101 + world.cars.length);
    const wantCars = WANTED.copCars[stars];
    const haveCars = world.cars.filter((c) => c.kind === 'police').length;
    if (haveCars < wantCars && chance(rng, 0.8)) spawnCopCar(world, rng);
    const wantPeds = WANTED.copPeds[stars];
    const havePeds = world.peds.filter((p) => p.isCop).length;
    if (havePeds < wantPeds && !world.player.inCar && chance(rng, 0.6)) spawnCopPed(world, rng);
    if (police.sirenTimer <= 0) {
      police.sirenTimer = 7;
      world.audio.siren(true);
    }
  }
  if (stars === 0) world.audio.siren(false);

  // Drive the cop pedestrians.
  for (const ped of world.peds) {
    if (ped.isCop && ped.state !== 'down') updateCopPed(world, ped, dt);
  }
}
