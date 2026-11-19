// SOLHAVEN — bootstrap, the game loop and the screen state machine.
// Title screen, play, pause, game over, and the ?shot= staging mode the
// screenshots are taken from.
import { GAME_TITLE, WORLD_SEED } from './config.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';
import { createCamera } from './camera.js';
import { createWorld, updateWorld, updateAmbient, respawnAfterRun } from './world.js';
import { renderWorld } from './render.js';
import { hasSave, loadSave, applySave, clearSave, saveGame } from './save.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const input = createInput();
const audio = createAudio();
const hud = createHud();
const camera = createCamera(window.innerWidth, window.innerHeight);
let world = createWorld({ input, audio, hud, camera });

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  camera.viewWidth = window.innerWidth;
  camera.viewHeight = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

function newGame() {
  clearSave();
  world = createWorld({ input, audio, hud, camera });
  world.screen = 'play';
  hud.hideMenus();
  hud.notify('Welcome back to Solhaven, Luna.', '#f2c531');
  hud.notify('Drive to Sal’s Auto Works (S) to start your first job.', '#ffffff');
}

function continueGame() {
  const data = loadSave();
  if (!data) return;
  world = createWorld({ input, audio, hud, camera });
  applySave(world, data);
  world.screen = 'play';
  hud.hideMenus();
  hud.notify('Welcome back, Luna.', '#f2c531');
}

function showTitle() {
  world.screen = 'title';
  hud.showMenu('title');
  document.getElementById('btn-continue').style.display = hasSave() ? 'block' : 'none';
}

// --- Menu wiring -----------------------------------------------------------
document.getElementById('btn-new').addEventListener('click', () => { audio.ensure(); newGame(); });
document.getElementById('btn-continue').addEventListener('click', () => { audio.ensure(); continueGame(); });
document.getElementById('btn-help').addEventListener('click', () => hud.el.help.classList.add('show'));
document.getElementById('btn-help-close').addEventListener('click', () => hud.el.help.classList.remove('show'));
document.getElementById('btn-resume').addEventListener('click', () => {
  world.screen = 'play';
  hud.hideMenus();
});
document.getElementById('btn-save').addEventListener('click', () => {
  if (saveGame(world)) hud.notify('Game saved.', '#7ee787');
});
document.getElementById('btn-quit').addEventListener('click', () => showTitle());
document.getElementById('btn-retry').addEventListener('click', () => { audio.ensure(); respawnAfterRun(world); });
document.getElementById('btn-over-title').addEventListener('click', () => showTitle());
document.getElementById('menu-title').textContent = GAME_TITLE;

// --- Screenshot staging ----------------------------------------------------
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const shotSeed = Number(params.get('seed') || WORLD_SEED);
if (shotName) {
  world.screen = 'play';
  hud.hideMenus();
  stageShot(world, shotName, shotSeed);
  window.__solhavenShot = shotName;
} else {
  showTitle();
}

// Expose the world for debugging and for the screenshot driver.
window.__solhaven = { world: () => world, hud, audio };

// --- Main loop ---------------------------------------------------------------
const STEP = 1 / 60;
let last = performance.now();
let accumulator = 0;

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25;
  if (input.anyKey) audio.ensure();

  // Global keys.
  if (input.wasPressed('Escape')) {
    if (world.screen === 'play') {
      world.screen = 'pause';
      hud.showMenu('pause');
    } else if (world.screen === 'pause') {
      world.screen = 'play';
      hud.hideMenus();
    }
  }
  if (input.wasPressed('KeyM')) {
    const muted = audio.toggleMute();
    hud.notify(muted ? 'Sound off.' : 'Sound on.', '#cccccc');
  }
  if (hud.dialogOpen && (input.wasPressed('KeyE') || input.mouse.clicked)) {
    hud.closeDialog();
  }

  accumulator += dt;
  let steps = 0;
  while (accumulator >= STEP && steps < 5) {
    if (world.screen === 'play') updateWorld(world, STEP);
    else if (world.screen === 'title') updateAmbient(world, STEP);
    accumulator -= STEP;
    steps += 1;
  }
  if (steps === 5) accumulator = 0;

  renderWorld(ctx, world, camera);
  input.endFrame();
}
requestAnimationFrame(frame);
