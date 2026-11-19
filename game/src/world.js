// The world: everything alive in Solhaven, updated in one place. main.js
// owns the screen state; this module owns the simulation and the rules that
// tie the systems together (shops, mission triggers, busted/wasted).
import { WORLD, WORLD_SEED, DAY } from './config.js';
import { buildCity } from './city.js';
import { createPlayer, updatePlayer, exitCar } from './player.js';
import { createCar, updateCars, maintainTraffic, spawnParkedCars, spawnTrafficNear } from './vehicles.js';
import { createPed, updatePeds } from './pedestrians.js';
import { createPolice, updatePolice, wantedStars, addHeat as policeAddHeat, clearWanted } from './police.js';
import { createCombat, updateCombat, spawnPickup, enemyShoot as combatEnemyShoot } from './combat.js';
import { createMissions, updateMissions, startMission, nextMissionIndex, failMission, onGangKilled as missionsOnGangKilled } from './missions.js';
import { createEffects, updateEffects } from './effects.js';
import { createCamera, updateCamera, addShake } from './camera.js';
import { createRng, range } from './random.js';
import { saveGame } from './save.js';

export function createWorld(deps) {
  const { input, audio, hud, camera } = deps;
  const city = buildCity(WORLD_SEED);
  const world = {
    input, audio, hud, camera,
    city,
    screen: 'title',
    time: 0,
    clockHours: DAY.startHour,
    player: createPlayer(1560, 2680),
    cars: [],
    peds: [],
    police: createPolice(),
    combat: createCombat(),
    missions: createMissions(),
    effects: createEffects(),
    stats: { missionsDone: 0, carsStolen: 0, pedsHarmed: 0, pickups: 0, shotsFired: 0 },
    alarmTimer: 0,
    cameraShake: 0,
    trafficTimer: 0,
    pedTimer: 0,
    interactTarget: null,
    runEnded: null,
  };
  // Method shims so systems can call each other through the world object.
  world.police.addHeat = (amount) => policeAddHeat(world, amount);
  world.combat.enemyShoot = (shooter, target) => combatEnemyShoot(world, shooter, target);
  world.missions.onGangKilled = (ped) => missionsOnGangKilled(world, ped);
  world.endRun = (kind) => endRun(world, kind);
  world.interact = () => interact(world);

  // Seed the city with life.
  const rng = createRng(WORLD_SEED + 5);
  spawnParkedCars(world, rng, 22);
  spawnTrafficNear(world, rng, 14);
  for (let i = 0; i < 24; i += 1) {
    const a = rng() * Math.PI * 2;
    const d = range(rng, 200, 1400);
    const x = Math.max(40, Math.min(WORLD.width - 40, world.player.x + Math.cos(a) * d));
    const y = Math.max(40, Math.min(WORLD.height - 60, world.player.y + Math.sin(a) * d));
    world.peds.push(createPed(x, y));
  }
  // Scattered pickups.
  spawnPickup(world, 4384, 2850, 'health');
  spawnPickup(world, 2464, 4320, 'ammo');
  spawnPickup(world, 2912, 900, 'cash');
  spawnPickup(world, 1000, 1000, 'cash');
  spawnPickup(world, 5200, 5400, 'cash');
  spawnPickup(world, 1500, 5600, 'armor');
  // The player's own car waits at the hideout.
  const homeCar = createCar('comet', 980, 5360, 0, 'parked');
  homeCar.color = '#e8b13c';
  world.cars.push(homeCar);
  return world;
}

function interact(world) {
  const player = world.player;
  const lm = world.city.landmarks;
  const near = (landmark, radius) => Math.hypot(player.x - lm[landmark].x, player.y - lm[landmark].y) < radius;
  if (near('garage', 120) && !world.missions.active) {
    const idx = nextMissionIndex(world.missions);
    if (idx < 6) {
      startMission(world, idx);
      return;
    }
    world.hud.notify('No more jobs — the city is yours, Luna.', '#7ee787');
    return;
  }
  if (near('spray', 110)) {
    const stars = wantedStars(world.police);
    if (stars === 0) {
      world.hud.notify('QuickFix Auto: no heat on you. Come back when the SPPD is after you.', '#cccccc');
    } else if (player.money >= 150) {
      player.money -= 150;
      clearWanted(world);
      if (player.inCar) player.inCar.health = 100;
      world.audio.cash();
      world.hud.notify('QuickFix Auto: fresh paint, clean plates. Heat gone. -$150', '#7ee787');
    } else {
      world.hud.notify('QuickFix Auto: a respray costs $150.', '#ff5a3c');
    }
    return;
  }
  if (near('gunshop', 110)) {
    if (player.money >= 100) {
      player.money -= 100;
      player.ammo.pistol += 48;
      player.ammo.smg += 60;
      player.weapons.smg = true;
      world.audio.cash();
      world.hud.notify('Ironworks Supply: stocked up. Pistol + SMG ammo. -$100', '#7ee787');
    } else {
      world.hud.notify('Ironworks Supply: ammo costs $100.', '#ff5a3c');
    }
    return;
  }
  if (near('hideout', 120)) {
    if (saveGame(world)) world.hud.notify('Game saved at the hideout.', '#7ee787');
    else world.hud.notify('Could not save.', '#ff5a3c');
    return;
  }
  if (near('hospital', 110)) {
    player.health = 100;
    world.hud.notify('Solhaven General: patched up, free of charge.', '#7ee787');
  }
}

function updateInteractPrompt(world) {
  const player = world.player;
  const lm = world.city.landmarks;
  const near = (landmark, radius) => Math.hypot(player.x - lm[landmark].x, player.y - lm[landmark].y) < radius;
  if (near('garage', 120) && !world.missions.active && nextMissionIndex(world.missions) < 6) {
    world.hud.setInteract('Press E — Talk to Sal (start mission)');
  } else if (near('spray', 110)) {
    world.hud.setInteract('Press E — QuickFix Auto: clear wanted ($150)');
  } else if (near('gunshop', 110)) {
    world.hud.setInteract('Press E — Ironworks Supply: buy ammo ($100)');
  } else if (near('hideout', 120)) {
    world.hud.setInteract('Press E — Save game');
  } else if (near('hospital', 110)) {
    world.hud.setInteract('Press E — Hospital: heal up');
  } else {
    world.hud.setInteract(null);
  }
}

function endRun(world, kind) {
  if (world.runEnded) return;
  world.runEnded = kind;
  world.player.dead = true;
  if (world.player.inCar) {
    world.player.inCar.driver = 'ai';
    world.player.inCar = null;
  }
  if (world.missions.active) failMission(world, kind === 'busted' ? 'Busted by the SPPD.' : 'Luna went down.');
  world.audio.siren(false);
  world.audio.engine(0, false);
  world.hud.gameOver(kind);
  world.screen = 'gameover';
}

export function respawnAfterRun(world) {
  const player = world.player;
  const kind = world.runEnded;
  player.money = Math.max(0, player.money - 200);
  player.health = 100;
  player.armor = 0;
  player.dead = false;
  clearWanted(world);
  const lm = world.city.landmarks;
  if (kind === 'wasted') {
    player.x = lm.hospital.x;
    player.y = lm.hospital.y + 60;
  } else {
    player.x = lm.hideout.x;
    player.y = lm.hideout.y;
  }
  player.vx = 0;
  player.vy = 0;
  world.runEnded = null;
  world.screen = 'play';
  world.hud.hideMenus();
  world.hud.notify(kind === 'busted' ? 'Out on bail. $200 lighter.' : 'Back on your feet. $200 lighter.', '#f2c531');
}

export function updateWorld(world, dt) {
  world.time += dt;
  world.clockHours = (world.clockHours + (DAY.minutesPerSecond / 60) * dt) % 24;
  const player = world.player;
  updatePlayer(world, dt, world.input, world.camera);
  updateCars(world, dt);
  maintainTraffic(world, dt);
  updatePeds(world, dt);
  updatePolice(world, dt);
  updateCombat(world, dt);
  updateMissions(world, dt);
  updateEffects(world.effects, dt);
  updateInteractPrompt(world);
  // Camera follows the player (or their car).
  const target = player.inCar || player;
  updateCamera(world.camera, { x: target.x, y: target.y, vx: target.vx || 0, vy: target.vy || 0, inCar: !!player.inCar }, dt);
  if (world.cameraShake > 0) {
    addShake(world.camera, world.cameraShake);
    world.cameraShake = 0;
  }
  // Audio beds.
  const driving = !!player.inCar;
  world.audio.engine(driving ? Math.min(1, Math.hypot(player.inCar.vx, player.inCar.vy) / 500) : 0, driving);
  world.audio.musicTick(dt, true);
  world.hud.update(world, dt);
}

// Ambient mode: the city lives behind the title screen.
export function updateAmbient(world, dt) {
  world.time += dt;
  updateCars(world, dt);
  maintainTraffic(world, dt);
  updatePeds(world, dt);
  updateEffects(world.effects, dt);
  // Slow cinematic pan across downtown.
  const t = world.time * 0.02;
  world.camera.x = 3200 + Math.sin(t) * 900;
  world.camera.y = 2900 + Math.cos(t * 0.7) * 600;
  world.camera.zoom += (0.62 - world.camera.zoom) * dt * 0.5;
}
