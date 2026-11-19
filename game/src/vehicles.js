// Cars: arcade physics with drift, traffic that follows the roads and stops
// for lights, parked cars to steal, and police interceptors that hunt you.
import { CAR_MODELS, WORLD, WANTED } from './config.js';
import { createRng, pick, range, chance } from './random.js';
import { collideBuildings, nearestRoadPoint, nearestLight, lightState, randomRoadPoint, isRoad, isWater } from './city.js';
import { addSkid, spawnParticles, spawnSmoke, spawnExplosion } from './effects.js';

let nextCarId = 1;

export function createCar(modelId, x, y, angle, kind = 'traffic') {
  const model = CAR_MODELS.find((m) => m.id === modelId) || CAR_MODELS[0];
  return {
    id: nextCarId,
    model,
    kind, // 'traffic' | 'parked' | 'police' | 'mission'
    x, y, angle,
    vx: 0, vy: 0,
    speed: 0,
    color: kind === 'police' ? '#1d2733' : pick(createRng(nextCarId * 7919 + 13), model.colors),
    health: 100,
    burning: 0,
    driver: null, // 'player' | 'ai' | null
    // Traffic AI state.
    axis: 'v',
    dir: 1,
    cruise: range(createRng(nextCarId * 104729 + 7), 170, 250),
    stuckTimer: 0,
    reverseTimer: 0,
    turnTimer: 0,
    sirenPhase: Math.random() * Math.PI * 2,
    hornTimer: 0,
  };
}

export function carSpeed(car) {
  return Math.hypot(car.vx, car.vy);
}

export function forwardSpeed(car) {
  return car.vx * Math.cos(car.angle) + car.vy * Math.sin(car.angle);
}

// Arcade velocity model: forward drive + lateral grip; handbrake kills grip.
export function driveCar(car, throttle, steer, handbrake, dt) {
  const model = car.model;
  const fwdX = Math.cos(car.angle);
  const fwdY = Math.sin(car.angle);
  let fSpeed = forwardSpeed(car);
  // Engine / brake.
  if (throttle > 0) fSpeed += model.accel * throttle * dt;
  else if (throttle < 0) {
    if (fSpeed > 30) fSpeed += model.accel * 1.6 * throttle * dt; // brake
    else fSpeed = Math.max(-model.topSpeed * 0.35, fSpeed + model.accel * 0.6 * throttle * dt); // reverse
  }
  // Drag and rolling resistance.
  fSpeed -= fSpeed * 0.55 * dt;
  if (handbrake) fSpeed -= fSpeed * 1.8 * dt;
  fSpeed = Math.max(-model.topSpeed * 0.4, Math.min(model.topSpeed, fSpeed));
  // Steering: sharper at low speed, gentler at full speed.
  const steerAuthority = 2.6 * (1 - Math.min(1, Math.abs(fSpeed) / model.topSpeed) * 0.55);
  car.angle += steer * steerAuthority * (fSpeed / model.topSpeed) * dt * 2.4;
  // Rebuild velocity: forward component + lateral component kept by grip.
  const latX = car.vx - fwdX * forwardSpeed(car);
  const latY = car.vy - fwdY * forwardSpeed(car);
  const grip = handbrake ? 1.2 : model.grip;
  const latKeep = Math.max(0, 1 - grip * dt);
  const nFwdX = Math.cos(car.angle);
  const nFwdY = Math.sin(car.angle);
  car.vx = nFwdX * fSpeed + latX * latKeep;
  car.vy = nFwdY * fSpeed + latY * latKeep;
  car.speed = Math.hypot(car.vx, car.vy);
  return Math.abs(latX) + Math.abs(latY) > 60 && car.speed > 120; // drifting?
}

export function moveCar(car, dt, world) {
  const px = car.x;
  const py = car.y;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  car.x = Math.max(30, Math.min(WORLD.width - 30, car.x));
  car.y = Math.max(30, Math.min(WORLD.height - 30, car.y));
  // Cars do not drive into the sea: treat the waterline as a wall.
  if (isWater(car.x, car.y)) {
    car.x = px;
    car.y = py;
    car.vx *= -0.25;
    car.vy *= -0.25;
    return;
  }
  const before = { x: car.x, y: car.y };
  const fixed = collideBuildings(car.x, car.y, 20, world.city);
  if (fixed.x !== before.x || fixed.y !== before.y) {
    const hitSpeed = carSpeed(car);
    car.x = fixed.x;
    car.y = fixed.y;
    // Kill the velocity component into the wall, keep the slide.
    const nx = before.x - fixed.x;
    const ny = before.y - fixed.y;
    const nl = Math.hypot(nx, ny) || 1;
    const dot = car.vx * (nx / nl) + car.vy * (ny / nl);
    if (dot > 0) {
      car.vx -= (nx / nl) * dot * 1.4;
      car.vy -= (ny / nl) * dot * 1.4;
    }
    if (hitSpeed > 150) {
      damageCar(world, car, hitSpeed / 60, null);
      spawnParticles(world.effects, car.x, car.y, { count: 6, colors: ['#f2c531', '#dddddd'], speed: 140, life: 0.4, size: 2 });
      if (car.driver === 'player') world.audio.crash();
    }
  }
}

export function damageCar(world, car, amount, byPlayer) {
  if (car.health <= 0) return;
  car.health -= amount;
  if (car.health <= 30 && car.health > 0 && Math.random() < 0.3) {
    spawnSmoke(world.effects, car.x, car.y, 1);
  }
  if (car.health <= 0) {
    car.health = 0;
    car.burning = 2.5;
    if (car.driver === 'player') {
      world.hud.flash('Your ride is on fire — bail out!', '#ff5a3c');
    }
  }
}

function explodeCar(world, car) {
  spawnExplosion(world.effects, car.x, car.y);
  world.audio.explosion();
  world.cameraShake = Math.min(18, (world.cameraShake || 0) + 10);
  // Damage everything nearby.
  const hurt = (e, amount) => {
    if (Math.hypot(e.x - car.x, e.y - car.y) < 120) {
      if (e.health !== undefined) e.health -= amount;
    }
  };
  hurt(world.player, 40);
  for (const ped of world.peds) hurt(ped, 100);
  for (const other of world.cars) {
    if (other !== car && Math.hypot(other.x - car.x, other.y - car.y) < 120) {
      damageCar(world, other, 60, false);
    }
  }
  car.exploded = true;
}

// --- Traffic AI ------------------------------------------------------------

function laneTarget(car, city) {
  // Right-hand traffic: the lane offset depends on the direction of travel.
  const off = WORLD.roadWidth / 4;
  const near = nearestRoadPoint(car.x, car.y, city);
  if (car.axis === 'v') {
    return { x: near.x + (car.dir > 0 ? off : -off), y: car.y + car.dir * 200, angle: car.dir > 0 ? Math.PI / 2 : -Math.PI / 2 };
  }
  return { x: car.x + car.dir * 200, y: near.y + (car.dir > 0 ? off : -off), angle: car.dir > 0 ? 0 : Math.PI };
}

function carAhead(world, car, dist) {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  for (const other of world.cars) {
    if (other === car) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const along = dx * fx + dy * fy;
    if (along < 0 || along > dist) continue;
    const side = Math.abs(-dx * fy + dy * fx);
    if (side < 26) return other;
  }
  return null;
}

function redLightAhead(world, car) {
  const light = nearestLight(car.x, car.y, world.city);
  if (!light) return false;
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  const dx = light.x - car.x;
  const dy = light.y - car.y;
  const along = dx * fx + dy * fy;
  if (along < 30 || along > 110) return false;
  const side = Math.abs(-dx * fy + dy * fx);
  if (side > 60) return false;
  const state = lightState(light, world.time);
  const nsGreen = state === 'ns' || state === 'ns-amber';
  const myAxisNs = car.axis === 'v';
  return nsGreen !== myAxisNs;
}

function updateTrafficCar(world, car, dt) {
  // Maybe turn at an intersection.
  const near = nearestRoadPoint(car.x, car.y, world.city);
  const atCrossing = Math.abs(car.x - near.x) < 90 && Math.abs(car.y - near.y) < 90 &&
    isRoad(car.x, car.y, world.city);
  if (atCrossing && Math.random() < dt * 0.5) {
    if (Math.random() < 0.5) {
      car.axis = car.axis === 'v' ? 'h' : 'v';
      car.dir = Math.random() < 0.5 ? 1 : -1;
    }
  }
  const target = laneTarget(car, world.city);
  let wantAngle = Math.atan2(target.y - car.y, target.x - car.x);
  // Never drive into the sea: turn around before the beach road ends.
  if (car.turnTimer > 0) car.turnTimer -= dt;
  if (car.turnTimer <= 0) {
    const aheadX = car.x + Math.cos(car.angle) * 170;
    const aheadY = car.y + Math.sin(car.angle) * 170;
    if (isWater(aheadX, aheadY)) {
      car.dir = -car.dir;
      car.turnTimer = 3;
    }
  }
  // Blend the lane heading with the target heading.
  let diff = wantAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 2.2));
  let throttle = carSpeed(car) < car.cruise ? 0.7 : 0;
  if (carAhead(world, car, 90) || redLightAhead(world, car)) throttle = -1;
  // Unstick: reverse briefly if blocked for a while.
  if (carSpeed(car) < 12) car.stuckTimer += dt;
  else car.stuckTimer = 0;
  if (car.stuckTimer > 2.5) {
    car.reverseTimer = 0.9;
    car.stuckTimer = 0;
  }
  if (car.reverseTimer > 0) {
    car.reverseTimer -= dt;
    throttle = -0.8;
  }
  driveCar(car, throttle, steer, false, dt);
  moveCar(car, dt, world);
}

// --- Police pursuit --------------------------------------------------------

function updatePoliceCar(world, car, dt) {
  const player = world.player;
  const target = player.inCar || player;
  const tx = target.x + (target.vx || 0) * 0.25;
  const ty = target.y + (target.vy || 0) * 0.25;
  const wantAngle = Math.atan2(ty - car.y, tx - car.x);
  let diff = wantAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 2.4));
  const dist = Math.hypot(tx - car.x, ty - car.y);
  let throttle = dist > 60 ? 1 : 0.4;
  if (carAhead(world, car, 70)) throttle = 0.3;
  if (carSpeed(car) < 10) car.stuckTimer += dt;
  else car.stuckTimer = 0;
  if (car.stuckTimer > 1.8) {
    car.reverseTimer = 0.8;
    car.stuckTimer = 0;
  }
  if (car.reverseTimer > 0) {
    car.reverseTimer -= dt;
    throttle = -0.9;
  }
  const drifting = driveCar(car, throttle, steer, false, dt);
  moveCar(car, dt, world);
  if (drifting && Math.random() < 0.5) addSkid(world.effects, car.x, car.y, car.angle);
  car.sirenPhase += dt * 9;
}

export function updateCars(world, dt) {
  for (let i = world.cars.length - 1; i >= 0; i -= 1) {
    const car = world.cars[i];
    if (car.exploded) {
      world.cars.splice(i, 1);
      continue;
    }
    if (car.burning > 0) {
      car.burning -= dt;
      spawnSmoke(world.effects, car.x, car.y, 1);
      if (car.burning <= 0) {
        explodeCar(world, car);
        if (car.driver === 'player') world.player.inCar = null;
        continue;
      }
    }
    if (car.driver === 'player') continue; // driven from player.js
    if (car.kind === 'police') updatePoliceCar(world, car, dt);
    else if (car.kind === 'traffic') updateTrafficCar(world, car, dt);
    // Parked cars sit still.
  }
  resolveCarCollisions(world);
}

function resolveCarCollisions(world) {
  const cars = world.cars;
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = 34;
      if (d >= min || d < 0.001) continue;
      const nx = dx / d;
      const ny = dy / d;
      const overlap = (min - d) / 2;
      const aMovable = a.driver !== null || a.kind !== 'parked';
      const bMovable = b.driver !== null || b.kind !== 'parked';
      if (aMovable) { a.x -= nx * overlap; a.y -= ny * overlap; }
      if (bMovable) { b.x += nx * overlap; b.y += ny * overlap; }
      const relSpeed = Math.abs((a.vx - b.vx) * nx + (a.vy - b.vy) * ny);
      if (relSpeed > 60) {
        const push = relSpeed * 0.4;
        a.vx -= nx * push * 0.5;
        a.vy -= ny * push * 0.5;
        b.vx += nx * push * 0.5;
        b.vy += ny * push * 0.5;
        damageCar(world, a, relSpeed / 90, b.driver === 'player');
        damageCar(world, b, relSpeed / 90, a.driver === 'player');
        if ((a.driver === 'player' || b.driver === 'player') && relSpeed > 140) {
          world.audio.crash();
          world.cameraShake = Math.min(14, (world.cameraShake || 0) + 4);
          if (a.kind === 'police' || b.kind === 'police') world.police.addHeat(WANTED.heatPerCrime.hitCopCar);
        }
        spawnParticles(world.effects, (a.x + b.x) / 2, (a.y + b.y) / 2, { count: 4, colors: ['#f2c531', '#dddddd'], speed: 100, life: 0.3, size: 2 });
      }
    }
  }
}

// --- Spawning ---------------------------------------------------------------

export function spawnTrafficNear(world, rng, count) {
  const player = world.player;
  for (let n = 0; n < count; n += 1) {
    const p = randomRoadPoint(rng, world.city, player.x, player.y, 700, 1500);
    const model = pick(rng, CAR_MODELS.filter((m) => m.id !== 'police'));
    const car = createCar(model.id, p.x, p.y, p.axis === 'v' ? Math.PI / 2 : 0, 'traffic');
    car.axis = p.axis;
    car.dir = chance(rng, 0.5) ? 1 : -1;
    car.angle = car.axis === 'v' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
    car.driver = 'ai';
    world.cars.push(car);
  }
}

export function spawnParkedCars(world, rng, count) {
  const spots = [...world.city.parking];
  for (let n = 0; n < count && spots.length; n += 1) {
    const idx = Math.floor(rng() * spots.length);
    const spot = spots.splice(idx, 1)[0];
    const model = pick(rng, CAR_MODELS.filter((m) => m.id !== 'police'));
    const car = createCar(model.id, spot.x, spot.y, spot.angle, 'parked');
    world.cars.push(car);
  }
}

export function maintainTraffic(world, dt) {
  world.trafficTimer = (world.trafficTimer || 0) - dt;
  const player = world.player;
  // Despawn far traffic and police that lost the player.
  for (let i = world.cars.length - 1; i >= 0; i -= 1) {
    const car = world.cars[i];
    if (car.driver === 'player') continue;
    const d = Math.hypot(car.x - player.x, car.y - player.y);
    if (car.kind === 'traffic' && d > 1900) world.cars.splice(i, 1);
    if (car.kind === 'parked' && d > 2400) world.cars.splice(i, 1);
  }
  if (world.trafficTimer > 0) return;
  world.trafficTimer = 1.5;
  const rng = createRng((Date.now() % 100000) + world.cars.length * 31 + 7);
  const trafficCount = world.cars.filter((c) => c.kind === 'traffic').length;
  if (trafficCount < 14) spawnTrafficNear(world, rng, 14 - trafficCount);
  const parkedCount = world.cars.filter((c) => c.kind === 'parked').length;
  if (parkedCount < 18) spawnParkedCars(world, rng, Math.min(6, 18 - parkedCount));
}
