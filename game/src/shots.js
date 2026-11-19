// The screenshot scenes behind ?shot=chase|downtown|mission|beach. Each one
// sets the world to a real moment of play — a police chase, a drive through
// downtown, a mission firefight, a sunset on the beach — then runs the real
// simulation forward, steered by a small autopilot that keeps driving the
// car after staging, so the frame the browser captures is the game itself,
// alive, not a still life.
import { createCar } from './vehicles.js';
import { createPed } from './pedestrians.js';
import { MISSIONS } from './missions.js';
import { nearestRoadPoint } from './city.js';
import { updateWorld } from './world.js';

const STEP = 1 / 60;

function setMission(world, index, stepIndex) {
  const mission = MISSIONS[index];
  world.missions.active = { mission, stepIndex, timer: null, data: {} };
}

function spawnCopAt(world, x, y, angle) {
  const car = createCar('police', x, y, angle, 'police');
  car.driver = 'ai';
  world.cars.push(car);
  return car;
}

// An autopilot that keeps the staged scene alive after staging: it drives
// the player's car along the roads and, on foot in the mission scene, aims
// and fires at the nearest Viper.
function installShotDriver(world, name) {
  const input = world.input;
  const originalAxis = input.axis;
  const originalDown = input.down;
  const originalPressed = input.wasPressed;
  void originalAxis;
  void originalDown;
  void originalPressed;

  input.axis = () => {
    const player = world.player;
    if (player.inCar) {
      const car = player.inCar;
      // Look ahead along the heading, snap to the road, steer there.
      const aheadX = car.x + Math.cos(car.angle) * 280;
      const aheadY = car.y + Math.sin(car.angle) * 280;
      const near = nearestRoadPoint(aheadX, aheadY, world.city);
      const tx = near.axis === 'v' ? near.x : aheadX;
      const ty = near.axis === 'h' ? near.y : aheadY;
      const want = Math.atan2(ty - car.y, tx - car.x);
      let diff = want - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      let throttle = -1;
      if (name === 'downtown') {
        // A calm cruise: brake for pedestrians ahead instead of running
        // them down (a hit would put a wanted flash across the frame).
        const fx = Math.cos(car.angle);
        const fy = Math.sin(car.angle);
        for (const ped of world.peds) {
          if (ped.state === 'down') continue;
          const dx = ped.x - car.x;
          const dy = ped.y - car.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 170 && dist > 0.01 && (dx * fx + dy * fy) / dist > 0.6) {
            throttle = 1; // brake
            break;
          }
        }
      }
      return { x: Math.max(-1, Math.min(1, diff * 2.4)), y: throttle };
    }
    if (name === 'mission') {
      // Aim at the nearest Viper and keep firing. The aim goes through the
      // mouse position (the normal aim code reads it every frame) and the
      // trigger through mouse.down, which is what automatic weapons read.
      let best = null;
      let bestD = Infinity;
      for (const ped of world.peds) {
        if (!ped.gang || ped.state === 'down') continue;
        const d = Math.hypot(ped.x - player.x, ped.y - player.y);
        if (d < bestD) {
          bestD = d;
          best = ped;
        }
      }
      if (best) {
        const cam = world.camera;
        input.mouse.x = (best.x - cam.x) * cam.zoom + cam.viewWidth / 2;
        input.mouse.y = (best.y - cam.y) * cam.zoom + cam.viewHeight / 2;
        input.mouse.down = true;
        input.mouse.clicked = true;
      }
      // Keep moving: strafe around the target and break away from any cop
      // closing in — a player who stands still gets busted mid-shot.
      let mx = 0;
      let my = 0;
      if (best) {
        const ax = (best.x - player.x) / Math.max(1, bestD);
        const ay = (best.y - player.y) / Math.max(1, bestD);
        mx = -ay * 0.7;
        my = ax * 0.7;
      }
      for (const ped of world.peds) {
        if (!ped.isCop || ped.state === 'down') continue;
        const dx = player.x - ped.x;
        const dy = player.y - ped.y;
        const d = Math.hypot(dx, dy);
        if (d < 220 && d > 0.01) {
          mx += (dx / d) * 1.2;
          my += (dy / d) * 1.2;
        }
      }
      const ml = Math.hypot(mx, my);
      if (ml > 1) {
        mx /= ml;
        my /= ml;
      }
      return { x: mx, y: my };
    }
    return { x: 0, y: 0 };
  };
  input.down = () => false;
  input.wasPressed = () => false;
  input.mouse.x = window.innerWidth / 2 + 120;
  input.mouse.y = window.innerHeight / 2 - 60;
}

function stepForward(world, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    updateWorld(world, STEP);
  }
}

function stageChase(world) {
  const player = world.player;
  world.clockHours = 15.5;
  // Luna in a Falcon GT, northbound on Meridian Ave through downtown.
  const car = createCar('falcon', 2880, 3200, -Math.PI / 2, 'traffic');
  car.color = '#e8b13c';
  car.driver = 'player';
  world.cars.push(car);
  player.inCar = car;
  player.x = car.x;
  player.y = car.y;
  player.money = 1250;
  player.armor = 50;
  // Three stars and three interceptors closing in.
  world.police.heat = 3;
  spawnCopAt(world, 2880, 3520, -Math.PI / 2);
  spawnCopAt(world, 2912, 3720, -Math.PI / 2);
  spawnCopAt(world, 2848, 2560, Math.PI / 2);
  // Traffic to weave through.
  const t1 = createCar('comet', 2848, 2960, Math.PI / 2, 'traffic');
  t1.axis = 'v';
  t1.dir = -1;
  t1.driver = 'ai';
  world.cars.push(t1);
  const t2 = createCar('van', 3520, 2880, 0, 'traffic');
  t2.axis = 'h';
  t2.dir = 1;
  t2.driver = 'ai';
  world.cars.push(t2);
  setMission(world, 3, 0); // Heat Wave: lose the cops.
  installShotDriver(world, 'chase');
  stepForward(world, 3.2);
}

function stageDowntown(world) {
  const player = world.player;
  world.clockHours = 17.8; // golden hour
  const car = createCar('comet', 4300, 2880, Math.PI, 'traffic');
  car.color = '#4a7fb5';
  car.driver = 'player';
  world.cars.push(car);
  player.inCar = car;
  player.x = car.x;
  player.y = car.y;
  player.money = 480;
  // Rush-hour traffic on Central Ave (mixed models, both directions).
  const models = ['comet', 'taxi', 'van', 'bison', 'falcon', 'comet', 'taxi', 'van'];
  const spots = [[2200, 2848, 'h', 1], [2600, 2912, 'h', -1], [3100, 2848, 'h', 1],
    [2000, 2912, 'h', 1], [3400, 2912, 'h', -1], [3800, 2848, 'h', 1], [1500, 2848, 'h', -1],
    [2880, 2200, 'v', 1], [3520, 3400, 'v', -1]];
  spots.forEach(([x, y, axis, dir], i) => {
    const t = createCar(models[i % models.length], x, y, axis === 'h' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2), 'traffic');
    t.axis = axis;
    t.dir = dir;
    t.driver = 'ai';
    world.cars.push(t);
  });
  // Evening crowds on the sidewalks along the avenue.
  for (let i = 0; i < 8; i += 1) {
    world.peds.push(createPed(1900 + i * 220, i % 2 === 0 ? 2790 : 2970));
  }
  setMission(world, 0, 0); // Welcome Home: drive to Sal's.
  installShotDriver(world, 'downtown');
  stepForward(world, 2.4);
}

function stageMission(world) {
  const player = world.player;
  world.clockHours = 16.5;
  player.x = 5920;
  player.y = 1560;
  player.angle = 0;
  player.aimAngle = 0;
  player.money = 980;
  player.health = 100;
  player.armor = 50;
  player.weapons.smg = true;
  player.weapon = 'smg';
  player.ammo.smg = 120;
  player.ammo.pistol = 48;
  // The Viper crew holds the docks.
  const lm = world.city.landmarks.harbor;
  const spots = [
    [lm.x - 60, lm.y - 140], [lm.x + 120, lm.y - 60], [lm.x - 180, lm.y + 80],
    [lm.x + 40, lm.y + 180], [lm.x + 220, lm.y + 40],
  ];
  for (const [x, y] of spots) {
    world.peds.push(createPed(x, y, { gang: true, shirt: '#8a3030', health: 60 }));
  }
  world.missions.gangLeft = 5;
  setMission(world, 4, 1); // Dockside: eliminate the crew.
  installShotDriver(world, 'mission');
  stepForward(world, 2.2);
}

function stageBeach(world) {
  const player = world.player;
  world.clockHours = 18.4; // sunset over the water
  player.x = 1680;
  player.y = 6200; // on the sand, between Shoreline Dr and the water
  player.angle = Math.PI / 2;
  player.aimAngle = Math.PI / 2;
  player.money = 640;
  player.health = 100;
  // Evening strollers on the sand.
  for (let i = 0; i < 8; i += 1) {
    world.peds.push(createPed(1300 + i * 130, 6170 + (i % 3) * 25));
  }
  const car = createCar('falcon', 1560, 5960, Math.PI / 2, 'parked');
  car.color = '#c22f2f';
  world.cars.push(car);
  installShotDriver(world, 'beach');
  stepForward(world, 1.6);
}

const SCENES = {
  chase: stageChase,
  downtown: stageDowntown,
  mission: stageMission,
  beach: stageBeach,
};

export function stageShot(world, name, seed) {
  void seed;
  const stage = SCENES[name] || SCENES.chase;
  stage(world);
  // Keep the camera centred on the player after staging.
  world.camera.x = world.player.x;
  world.camera.y = world.player.y;
  window.__solhavenStaged = name;
}
