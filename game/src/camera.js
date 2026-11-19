// The camera: follows the player with a velocity lookahead, pulls back at
// speed, and shakes on impacts. All world drawing goes through its transform.
import { WORLD } from './config.js';

export function createCamera(viewWidth, viewHeight) {
  return {
    x: WORLD.width / 2,
    y: WORLD.height / 2,
    zoom: 1,
    shake: 0,
    viewWidth,
    viewHeight,
  };
}

export function updateCamera(camera, target, dt) {
  // Look ahead in the direction of travel.
  const lookX = target.x + (target.vx || 0) * 0.35;
  const lookY = target.y + (target.vy || 0) * 0.35;
  const speed = Math.hypot(target.vx || 0, target.vy || 0);
  const wantZoom = target.inCar ? Math.max(0.72, 1.05 - speed / 2400) : 1.0;
  const ease = 1 - Math.exp(-6 * dt);
  camera.x += (lookX - camera.x) * ease;
  camera.y += (lookY - camera.y) * ease;
  camera.zoom += (wantZoom - camera.zoom) * (1 - Math.exp(-2 * dt));
  camera.shake = Math.max(0, camera.shake - dt * 26);
  // Keep the view inside the world: never show the void past the edge.
  const vw = camera.viewWidth / camera.zoom;
  const vh = camera.viewHeight / camera.zoom;
  camera.x = Math.max(vw / 2, Math.min(WORLD.width - vw / 2, camera.x));
  camera.y = Math.max(vh / 2, Math.min(WORLD.height - vh / 2, camera.y));
}

export function addShake(camera, amount) {
  camera.shake = Math.min(18, camera.shake + amount);
}

// World point of a screen point (for mouse aim).
export function screenToWorld(camera, sx, sy) {
  const shakeX = camera.shake > 0 ? (Math.random() - 0.5) * camera.shake : 0;
  const shakeY = camera.shake > 0 ? (Math.random() - 0.5) * camera.shake : 0;
  return {
    x: camera.x + (sx - camera.viewWidth / 2) / camera.zoom + shakeX,
    y: camera.y + (sy - camera.viewHeight / 2) / camera.zoom + shakeY,
  };
}

export function applyCameraTransform(ctx, camera) {
  const shakeX = camera.shake > 0 ? (Math.random() - 0.5) * camera.shake : 0;
  const shakeY = camera.shake > 0 ? (Math.random() - 0.5) * camera.shake : 0;
  ctx.setTransform(camera.zoom, 0, 0, camera.zoom, 0, 0);
  ctx.translate(
    camera.viewWidth / 2 / camera.zoom - camera.x + shakeX,
    camera.viewHeight / 2 / camera.zoom - camera.y + shakeY,
  );
}

// The world rect currently visible (for culling).
export function visibleRect(camera) {
  const w = camera.viewWidth / camera.zoom;
  const h = camera.viewHeight / camera.zoom;
  return { x: camera.x - w / 2 - 80, y: camera.y - h / 2 - 80, w: w + 160, h: h + 160 };
}
