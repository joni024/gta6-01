// The story: six missions that take Luna from a homecoming to the biggest
// job in Solhaven. Each mission is a list of steps; the engine advances
// them, spawns what they need, and pays out on completion.
import { CAST } from './config.js';
import { createCar, driveCar, moveCar, carSpeed } from './vehicles.js';
import { createPed } from './pedestrians.js';
import { spawnPickup } from './combat.js';
import { spawnParticles, addFloat } from './effects.js';

export const MISSIONS = [
  {
    id: 'welcome-home',
    title: 'Welcome Home',
    giver: 'sal',
    reward: 200,
    briefing: [
      `${CAST.sal.name}: Luna Vega! Back in Solhaven at last.`,
      `${CAST.sal.name}: The city's the same as ever — sun, salt, and trouble.`,
      `${CAST.sal.name}: Come by the garage. I've got work that pays.`,
    ],
    steps: [
      { type: 'goto', landmark: 'garage', radius: 90, text: 'Drive to Sal’s Auto Works' },
    ],
  },
  {
    id: 'hot-property',
    title: 'Hot Property',
    giver: 'sal',
    reward: 400,
    briefing: [
      `${CAST.sal.name}: A Falcon GT is sitting at the marina, keys in it.`,
      `${CAST.sal.name}: Bring it to the garage. Try not to bring the whole SPPD with you.`,
    ],
    steps: [
      { type: 'goto', landmark: 'marina', radius: 110, text: 'Get to the marina' },
      { type: 'steal', text: 'Steal the Falcon GT' },
      { type: 'deliver', landmark: 'garage', radius: 110, needCar: true, text: 'Bring the Falcon to the garage' },
    ],
  },
  {
    id: 'package-deal',
    title: 'Package Deal',
    giver: 'maya',
    reward: 500,
    briefing: [
      `${CAST.maya.name}: A package is waiting in Meridian Park.`,
      `${CAST.maya.name}: The harbour buyer leaves in 90 seconds. Do not be late.`,
    ],
    steps: [
      { type: 'pickup', landmark: 'park', radius: 80, text: 'Pick up the package in Meridian Park' },
      { type: 'deliver', landmark: 'harbor', radius: 110, timeLimit: 90, text: 'Deliver the package to Port Solhaven — 90 seconds!' },
    ],
  },
  {
    id: 'heat-wave',
    title: 'Heat Wave',
    giver: 'sal',
    reward: 600,
    briefing: [
      `${CAST.sal.name}: The Vipers tipped off the SPPD. You are hot — three stars hot.`,
      `${CAST.sal.name}: Lose them, then get to your hideout. Lay low.`,
    ],
    steps: [
      { type: 'loseHeat', startHeat: 3, text: 'Lose the cops' },
      { type: 'goto', landmark: 'hideout', radius: 90, text: 'Reach your hideout' },
    ],
  },
  {
    id: 'dockside',
    title: 'Dockside',
    giver: 'maya',
    reward: 800,
    briefing: [
      `${CAST.maya.name}: The Vipers are moving cash through the docks tonight.`,
      `${CAST.maya.name}: Take their crew down and take the cash. You keep half.`,
    ],
    steps: [
      { type: 'goto', landmark: 'harbor', radius: 140, text: 'Get to Port Solhaven' },
      { type: 'eliminate', count: 5, landmark: 'harbor', radius: 260, text: 'Take down the Viper crew (0/5)' },
      { type: 'pickup', landmark: 'harbor', radius: 90, kind: 'cash', text: 'Grab the cash' },
    ],
  },
  {
    id: 'long-goodbye',
    title: 'The Long Goodbye',
    giver: 'sal',
    reward: 1500,
    briefing: [
      `${CAST.sal.name}: Rex Marlow is leaving town — and taking the Viper money with him.`,
      `${CAST.sal.name}: Run him down, then get yourself to the marina. End of the road.`,
    ],
    steps: [
      { type: 'chase', text: 'Run Rex Marlow’s car off the road' },
      { type: 'loseHeat', startHeat: 4, text: 'Lose the cops' },
      { type: 'goto', landmark: 'marina', radius: 110, text: 'Escape to the marina' },
    ],
  },
];

export function createMissions() {
  return {
    completed: [],
    active: null, // { mission, stepIndex, timer, data }
    gangLeft: 0,
    fleeCar: null,
    missionCar: null,
    packageTaken: false,
  };
}

export function nextMissionIndex(missions) {
  return missions.completed.length;
}

export function currentObjective(world) {
  const active = world.missions.active;
  if (!active) return null;
  const step = active.mission.steps[active.stepIndex];
  if (!step) return null;
  let x = null;
  let y = null;
  if (step.landmark) {
    const lm = world.city.landmarks[step.landmark];
    x = lm.x;
    y = lm.y;
  }
  if (step.type === 'chase' && world.missions.fleeCar) {
    x = world.missions.fleeCar.x;
    y = world.missions.fleeCar.y;
  }
  if (step.type === 'steal' && world.missions.missionCar) {
    x = world.missions.missionCar.x;
    y = world.missions.missionCar.y;
  }
  let text = step.text;
  if (step.type === 'eliminate') text = `Take down the Viper crew (${active.mission.steps[active.stepIndex].count - world.missions.gangLeft}/${step.count})`;
  if (step.timeLimit && active.timer !== null) text += ` — ${Math.max(0, Math.ceil(active.timer))}s`;
  return { text, x, y, mission: active.mission.title };
}

function setupStep(world, step) {
  const missions = world.missions;
  if (step.type === 'steal') {
    const lm = world.city.landmarks.marina;
    const car = createCar('falcon', lm.x + 40, lm.y - 30, 0, 'mission');
    car.color = '#e8b13c';
    world.cars.push(car);
    missions.missionCar = car;
  }
  if (step.type === 'pickup' && step.kind !== 'cash') {
    const lm = world.city.landmarks[step.landmark];
    spawnPickup(world, lm.x, lm.y, 'cash');
    missions.packageTaken = false;
  }
  if (step.type === 'eliminate') {
    const lm = world.city.landmarks[step.landmark];
    missions.gangLeft = step.count;
    for (let i = 0; i < step.count; i += 1) {
      const ped = createPed(lm.x + (Math.random() - 0.5) * 300, lm.y + (Math.random() - 0.5) * 300, {
        gang: true, shirt: '#2f3a2f', health: 60,
      });
      world.peds.push(ped);
    }
    spawnPickup(world, lm.x + 60, lm.y + 40, 'smg');
  }
  if (step.type === 'chase') {
    const player = world.player;
    const car = createCar('falcon', player.x + 400, player.y - 200, Math.PI / 2, 'mission');
    car.color = '#222831';
    car.driver = 'ai';
    car.cruise = 420;
    world.cars.push(car);
    missions.fleeCar = car;
  }
  if (step.type === 'loseHeat' && step.startHeat) {
    world.police.heat = step.startHeat;
    world.police.unseenTimer = 0;
    world.hud.flash(`WANTED LEVEL ${step.startHeat}`, '#ff5a3c');
  }
}

export function startMission(world, index) {
  const mission = MISSIONS[index];
  if (!mission) return false;
  world.missions.active = { mission, stepIndex: 0, timer: null, data: {} };
  world.hud.showBriefing(mission);
  setupStep(world, mission.steps[0]);
  world.hud.notify(`Mission started: ${mission.title}`, '#f2c531');
  return true;
}

function completeMission(world) {
  const active = world.missions.active;
  const mission = active.mission;
  world.missions.completed.push(mission.id);
  world.missions.active = null;
  world.missions.fleeCar = null;
  world.missions.missionCar = null;
  world.player.money += mission.reward;
  world.stats.missionsDone += 1;
  world.audio.missionDone();
  world.hud.showBanner(`MISSION PASSED — ${mission.title}`, `+$${mission.reward}`);
  addFloat(world.effects, world.player.x, world.player.y - 30, `+$${mission.reward}`, '#7ee787');
  if (world.missions.completed.length >= MISSIONS.length) {
    world.hud.showBanner('STORY COMPLETE', 'You own this city now, Luna.');
  } else {
    world.hud.notify('New work is waiting at Sal’s garage.', '#7fb3a3');
  }
}

export function failMission(world, reason) {
  const active = world.missions.active;
  if (!active) return;
  world.missions.active = null;
  world.missions.fleeCar = null;
  world.missions.missionCar = null;
  world.audio.missionFail();
  world.hud.showBanner('MISSION FAILED', reason);
  world.hud.notify('Talk to Sal at the garage to try again.', '#cccccc');
}

function advanceStep(world) {
  const active = world.missions.active;
  active.stepIndex += 1;
  active.timer = null;
  if (active.stepIndex >= active.mission.steps.length) {
    completeMission(world);
    return;
  }
  const step = active.mission.steps[active.stepIndex];
  if (step.timeLimit) active.timer = step.timeLimit;
  setupStep(world, step);
  world.hud.notify(step.text, '#f2c531');
}

export function onGangKilled(world, ped) {
  if (!world.missions.active) return;
  const step = world.missions.active.mission.steps[world.missions.active.stepIndex];
  if (step && step.type === 'eliminate') {
    world.missions.gangLeft = Math.max(0, world.missions.gangLeft - 1);
  }
}

function updateFleeCar(world, dt) {
  const car = world.missions.fleeCar;
  if (!car || car.exploded) return;
  const player = world.player;
  // Flee: aim away from the player, prefer staying on roads.
  const awayX = car.x + (car.x - player.x);
  const awayY = car.y + (car.y - player.y);
  const wantAngle = Math.atan2(awayY - car.y, awayX - car.x);
  let diff = wantAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 2.2));
  const throttle = carSpeed(car) < 470 ? 1 : 0.4;
  driveCar(car, throttle, steer, false, dt);
  moveCar(car, dt, world);
  // Stopped or wrecked = caught.
  car.stopTimer = carSpeed(car) < 40 ? (car.stopTimer || 0) + dt : 0;
  if (car.health <= 25 || car.stopTimer > 2.5) {
    spawnParticles(world.effects, car.x, car.y, { count: 16, colors: ['#f2c531', '#e07b39'], speed: 160, life: 0.6, size: 4 });
    world.hud.notify('Rex is down. The Vipers are finished.', '#7ee787');
    car.driver = null;
    world.missions.fleeCar = null;
    advanceStep(world);
  }
}

function updateGang(world, dt) {
  const player = world.player;
  for (const ped of world.peds) {
    if (!ped.gang || ped.state === 'down') continue;
    const dist = Math.hypot(player.x - ped.x, player.y - ped.y);
    if (dist < 560) {
      ped.angle = Math.atan2(player.y - ped.y, player.x - ped.x);
      if (dist > 240) {
        ped.x += Math.cos(ped.angle) * 150 * dt;
        ped.y += Math.sin(ped.angle) * 150 * dt;
        ped.walkPhase += dt * 12;
      }
      if (Math.random() < dt * 1.1 && dist < 480) {
        world.combat.enemyShoot(world, ped, player);
      }
    }
  }
}

export function updateMissions(world, dt) {
  const active = world.missions.active;
  updateGang(world, dt);
  if (!active) return;
  const step = active.mission.steps[active.stepIndex];
  if (!step) return;
  const player = world.player;

  if (active.timer !== null) {
    active.timer -= dt;
    if (active.timer <= 0) {
      failMission(world, 'Out of time.');
      return;
    }
  }
  if (step.type === 'chase' && world.missions.fleeCar) updateFleeCar(world, dt);

  const at = (landmark, radius) => {
    const lm = world.city.landmarks[landmark];
    return Math.hypot(player.x - lm.x, player.y - lm.y) < radius;
  };

  switch (step.type) {
    case 'goto':
      if (at(step.landmark, step.radius)) advanceStep(world);
      break;
    case 'steal':
      if (player.inCar === world.missions.missionCar) advanceStep(world);
      break;
    case 'pickup': {
      if (step.kind === 'cash') {
        if (at(step.landmark, step.radius)) {
          player.money += 400;
          addFloat(world.effects, player.x, player.y - 30, '+$400', '#7ee787');
          world.audio.cash();
          advanceStep(world);
        }
      } else if (!world.missions.packageTaken) {
        // The package pickup is collected by walking over it; the combat
        // pickup grants cash, so track it by proximity instead.
        if (at(step.landmark, step.radius)) {
          world.missions.packageTaken = true;
          world.hud.notify('Package secured. Move!', '#7ee787');
          advanceStep(world);
        }
      }
      break;
    }
    case 'deliver': {
      if (step.needCar && player.inCar !== world.missions.missionCar) break;
      if (at(step.landmark, step.radius)) advanceStep(world);
      break;
    }
    case 'loseHeat':
      if (world.police.heat <= 0) advanceStep(world);
      break;
    case 'eliminate':
      if (world.missions.gangLeft <= 0) advanceStep(world);
      break;
    default:
      break;
  }
}
