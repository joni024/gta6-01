// Pedestrians: Solhaven's residents stroll the sidewalks, chat, flee from
// gunfire and dive out of the way of speeding cars.
import { PED_COLORS, WORLD } from './config.js';
import { createRng, pick, range, chance } from './random.js';
import { collideBuildings, randomSidewalkPoint, isWater } from './city.js';
import { spawnParticles } from './effects.js';

let nextPedId = 1;

export function createPed(x, y, opts = {}) {
  const rng = createRng(nextPedId * 2654435761 + 11);
  return {
    id: nextPedId,
    x, y,
    angle: range(rng, 0, Math.PI * 2),
    speed: range(rng, 45, 75),
    state: opts.state || 'walk', // 'walk' | 'flee' | 'down' | 'cop'
    shirt: opts.shirt || pick(rng, PED_COLORS.shirts),
    skin: pick(rng, PED_COLORS.skins),
    pants: pick(rng, PED_COLORS.pants),
    walkPhase: rng() * Math.PI * 2,
    targetAngle: range(rng, 0, Math.PI * 2),
    thinkTimer: range(rng, 1, 4),
    downTimer: 0,
    scared: 0,
    isCop: opts.isCop || false,
    gang: opts.gang || false,
    health: opts.health || 100,
  };
}

function pedAvoids(ped, world) {
  // Steer away from buildings and water; keep on land.
  const lookX = ped.x + Math.cos(ped.angle) * 40;
  const lookY = ped.y + Math.sin(ped.angle) * 40;
  if (isWater(lookX, lookY)) return true;
  const fixed = collideBuildings(lookX, lookY, 10, world.city);
  return fixed.x !== lookX || fixed.y !== lookY;
}

export function updatePed(world, ped, dt) {
  if (ped.state === 'down') {
    ped.downTimer -= dt;
    if (ped.downTimer <= 0 && ped.health > 0) {
      ped.state = 'flee';
      ped.scared = 3;
    }
    return;
  }
  ped.thinkTimer -= dt;
  ped.scared = Math.max(0, ped.scared - dt);
  const player = world.player;
  const distPlayer = Math.hypot(ped.x - player.x, ped.y - player.y);

  // Flee from gunfire, explosions and nearby speeding cars.
  let fleeing = ped.scared > 0;
  if (world.alarmTimer > 0 && distPlayer < 500) fleeing = true;
  for (const car of world.cars) {
    if (car.driver === 'player' && Math.hypot(car.x - ped.x, car.y - ped.y) < 130 && Math.hypot(car.vx, car.vy) > 200) {
      fleeing = true;
      ped.scared = 2;
    }
  }
  if (ped.isCop || ped.gang) fleeing = false; // Cops and gang members stand their ground.

  if (fleeing && ped.state !== 'flee') ped.state = 'flee';
  if (!fleeing && ped.state === 'flee') ped.state = 'walk';

  if (ped.thinkTimer <= 0) {
    ped.thinkTimer = range(createRng(ped.id * 97 + Math.floor(world.time * 10)), 1.5, 4);
    if (ped.state === 'flee') {
      // Run away from the player.
      ped.targetAngle = Math.atan2(ped.y - player.y, ped.x - player.x) + range(createRng(ped.id + 5), -0.6, 0.6);
    } else {
      // Stroll: mostly keep going, sometimes turn at a corner.
      ped.targetAngle = ped.angle + range(createRng(ped.id * 13 + Math.floor(world.time)), -1.2, 1.2);
    }
  }
  if (pedAvoids(ped, world)) {
    ped.targetAngle = ped.angle + Math.PI / 2 + range(createRng(ped.id * 7 + 3), -0.5, 0.5);
    ped.thinkTimer = Math.max(ped.thinkTimer, 0.4);
  }
  let diff = ped.targetAngle - ped.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  ped.angle += Math.max(-3 * dt, Math.min(3 * dt, diff));
  const speed = ped.state === 'flee' ? ped.speed * 2.2 : ped.speed;
  ped.x += Math.cos(ped.angle) * speed * dt;
  ped.y += Math.sin(ped.angle) * speed * dt;
  ped.walkPhase += dt * speed * 0.09;
  ped.x = Math.max(16, Math.min(WORLD.width - 16, ped.x));
  ped.y = Math.max(16, Math.min(WORLD.waterTop - 20, ped.y));
  const fixed = collideBuildings(ped.x, ped.y, 10, world.city);
  ped.x = fixed.x;
  ped.y = fixed.y;
}

export function knockDownPed(world, ped, damage, byPlayer) {
  ped.health -= damage;
  spawnParticles(world.effects, ped.x, ped.y, { count: 6, colors: ['#c94f43', '#8a2f2f'], speed: 90, life: 0.5, size: 3 });
  if (ped.health <= 0) {
    ped.state = 'down';
    ped.downTimer = 999;
    if (byPlayer && !ped.gang && !ped.isCop) {
      world.police.addHeat(1.0);
      world.stats.pedsHarmed += 1;
    }
    if (byPlayer && ped.isCop) world.police.addHeat(1.5);
    return true;
  }
  ped.state = 'down';
  ped.downTimer = 1.2;
  ped.scared = 4;
  if (byPlayer && !ped.gang && !ped.isCop) world.police.addHeat(0.4);
  return false;
}

export function updatePeds(world, dt) {
  for (let i = world.peds.length - 1; i >= 0; i -= 1) {
    const ped = world.peds[i];
    if (ped.state === 'down' && ped.health <= 0) {
      ped.downTimer -= dt;
      if (ped.downTimer <= -8) {
        world.peds.splice(i, 1);
        continue;
      }
    }
    updatePed(world, ped, dt);
  }
  maintainPeds(world, dt);
}

function maintainPeds(world, dt) {
  world.pedTimer = (world.pedTimer || 0) - dt;
  const player = world.player;
  for (let i = world.peds.length - 1; i >= 0; i -= 1) {
    const ped = world.peds[i];
    if (ped.isCop || ped.gang) continue;
    if (Math.hypot(ped.x - player.x, ped.y - player.y) > 1700) world.peds.splice(i, 1);
  }
  if (world.pedTimer > 0) return;
  world.pedTimer = 1.2;
  const civilians = world.peds.filter((p) => !p.isCop && !p.gang).length;
  if (civilians >= 26) return;
  const rng = createRng((Date.now() % 100000) + world.peds.length * 17 + 3);
  for (let n = 0; n < 26 - civilians; n += 1) {
    const p = randomSidewalkPoint(rng, world.city, player.x, player.y, 500, 1500);
    if (isWater(p.x, p.y)) continue;
    world.peds.push(createPed(p.x, p.y));
  }
}
