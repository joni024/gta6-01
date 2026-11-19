// Combat: bullets, muzzle flashes, melee, pickups (health, armour, ammo,
// cash) and the damage that ties it all to the wanted system.
import { WEAPONS } from './config.js';
import { buildingAt } from './city.js';
import { spawnParticles, addFloat } from './effects.js';
import { knockDownPed } from './pedestrians.js';
import { damageCar } from './vehicles.js';

export function createCombat() {
  return {
    bullets: [],
    pickups: [],
    alarmTimer: 0,
  };
}

export function fireBullet(world, x, y, angle, opts = {}) {
  const weapon = WEAPONS[opts.weapon || 'pistol'];
  world.combat.bullets.push({
    x, y,
    vx: Math.cos(angle) * 900,
    vy: Math.sin(angle) * 900,
    damage: weapon.damage,
    range: weapon.range,
    travelled: 0,
    fromPlayer: opts.fromPlayer !== false,
    fromGang: opts.fromGang || false,
  });
  spawnParticles(world.effects, x + Math.cos(angle) * 18, y + Math.sin(angle) * 18, {
    count: 3, colors: ['#f2c531', '#fff2a0'], speed: 90, life: 0.12, size: 3,
  });
  world.audio.shot();
  if (opts.fromPlayer) {
    world.police.addHeat(0.3);
    world.combat.alarmTimer = 3;
    world.alarmTimer = 3;
  }
}

export function enemyShoot(world, shooter, target) {
  const angle = Math.atan2(target.y - shooter.y, target.x - shooter.x) + (Math.random() - 0.5) * 0.35;
  fireBullet(world, shooter.x, shooter.y, angle, { weapon: 'pistol', fromPlayer: false, fromGang: !!shooter.gang });
}

function bulletHits(world, bullet) {
  // Buildings stop bullets.
  if (buildingAt(bullet.x, bullet.y, world.city)) {
    spawnParticles(world.effects, bullet.x, bullet.y, { count: 3, colors: ['#cccccc', '#999999'], speed: 80, life: 0.25, size: 2 });
    return true;
  }
  if (bullet.fromPlayer) {
    // Peds.
    for (const ped of world.peds) {
      if (ped.state === 'down') continue;
      if (Math.hypot(ped.x - bullet.x, ped.y - bullet.y) < 14) {
        const killed = knockDownPed(world, ped, bullet.damage, true);
        if (killed && ped.gang) {
          world.missions.onGangKilled(world, ped);
          addFloat(world.effects, ped.x, ped.y, '+$50', '#7ee787');
          world.player.money += 50;
        }
        return true;
      }
    }
    // Cars.
    for (const car of world.cars) {
      if (car.driver === 'player') continue;
      if (Math.hypot(car.x - bullet.x, car.y - bullet.y) < 24) {
        damageCar(world, car, bullet.damage, true);
        if (car.kind === 'police') world.police.addHeat(0.3);
        return true;
      }
    }
  } else {
    // Enemy bullets vs the player.
    const player = world.player;
    if (!player.inCar && Math.hypot(player.x - bullet.x, player.y - bullet.y) < 14) {
      damagePlayer(world, bullet.damage);
      return true;
    }
    if (player.inCar && Math.hypot(player.inCar.x - bullet.x, player.inCar.y - bullet.y) < 24) {
      damageCar(world, player.inCar, bullet.damage, false);
      return true;
    }
    // Gang bullets can also hit cops.
    if (bullet.fromGang) {
      for (const ped of world.peds) {
        if (!ped.isCop || ped.state === 'down') continue;
        if (Math.hypot(ped.x - bullet.x, ped.y - bullet.y) < 14) {
          knockDownPed(world, ped, bullet.damage, false);
          return true;
        }
      }
    }
  }
  return false;
}

export function damagePlayer(world, amount) {
  const player = world.player;
  if (player.dead) return;
  let rest = amount;
  if (player.armor > 0) {
    const absorbed = Math.min(player.armor, rest * 0.6);
    player.armor -= absorbed;
    rest -= absorbed;
  }
  player.health -= rest;
  world.cameraShake = Math.min(12, (world.cameraShake || 0) + 3);
  spawnParticles(world.effects, player.x, player.y, { count: 5, colors: ['#c94f43'], speed: 80, life: 0.4, size: 3 });
  if (player.health <= 0) {
    player.health = 0;
    world.endRun('wasted');
  }
}

export function meleeAttack(world, attacker, targetAngle) {
  const weapon = WEAPONS.fists;
  const ax = attacker.x + Math.cos(targetAngle) * weapon.range;
  const ay = attacker.y + Math.sin(targetAngle) * weapon.range;
  world.audio.punch();
  for (const ped of world.peds) {
    if (ped.state === 'down') continue;
    if (Math.hypot(ped.x - ax, ped.y - ay) < 30) {
      const killed = knockDownPed(world, ped, weapon.damage, attacker === world.player);
      if (killed && ped.gang) world.missions.onGangKilled(world, ped);
      return true;
    }
  }
  return false;
}

export function spawnPickup(world, x, y, kind) {
  world.combat.pickups.push({ x, y, kind, bob: Math.random() * Math.PI * 2 });
}

export function updateCombat(world, dt) {
  const combat = world.combat;
  combat.alarmTimer = Math.max(0, combat.alarmTimer - dt);
  world.alarmTimer = Math.max(0, (world.alarmTimer || 0) - dt);
  for (let i = combat.bullets.length - 1; i >= 0; i -= 1) {
    const b = combat.bullets[i];
    const step = 900 * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.travelled += step;
    if (b.travelled > b.range || bulletHits(world, b)) {
      combat.bullets.splice(i, 1);
    }
  }
  // Pickups bob and get collected.
  const player = world.player;
  for (let i = combat.pickups.length - 1; i >= 0; i -= 1) {
    const p = combat.pickups[i];
    p.bob += dt * 3;
    if (!player.inCar && Math.hypot(player.x - p.x, player.y - p.y) < 26) {
      collectPickup(world, p);
      combat.pickups.splice(i, 1);
    }
  }
}

function collectPickup(world, p) {
  const player = world.player;
  if (p.kind === 'health') {
    player.health = Math.min(100, player.health + 50);
    addFloat(world.effects, p.x, p.y, '+50 HEALTH', '#7ee787');
  } else if (p.kind === 'armor') {
    player.armor = Math.min(100, player.armor + 50);
    addFloat(world.effects, p.x, p.y, '+50 ARMOR', '#7eb8e8');
  } else if (p.kind === 'ammo') {
    player.ammo.pistol += 24;
    player.ammo.smg += 60;
    addFloat(world.effects, p.x, p.y, '+AMMO', '#f2c531');
  } else if (p.kind === 'cash') {
    const amount = 100 + Math.floor(Math.random() * 150);
    player.money += amount;
    addFloat(world.effects, p.x, p.y, `+$${amount}`, '#7ee787');
    world.audio.cash();
  } else if (p.kind === 'smg') {
    player.weapons.smg = true;
    player.weapon = 'smg';
    addFloat(world.effects, p.x, p.y, 'SMG!', '#f2c531');
  }
  world.audio.pickup();
  world.stats.pickups += 1;
}
