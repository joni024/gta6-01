// The renderer: draws Solhaven from above — roads and lane paint, blocks
// and pseudo-3D buildings with sun shadows, palms and parks, the sea,
// traffic, people, effects and the time-of-day light.
import { WORLD, PALETTE } from './config.js';
import { applyCameraTransform, visibleRect } from './camera.js';
import { lightState } from './city.js';
import { currentObjective } from './missions.js';

// Sun direction and shadow length from the game clock.
export function sunVector(clockHours) {
  const t = ((clockHours - 6) / 12) * Math.PI; // 0 at dawn, PI at dusk
  const elevation = Math.sin(t); // 0 at dawn/dusk, 1 at noon
  const shadowLen = 0.35 + (1 - Math.max(0.08, elevation)) * 1.1;
  return {
    dx: Math.cos(t) * shadowLen,
    dy: 0.6 * shadowLen + 0.25,
    elevation,
    night: clockHours >= 20 || clockHours < 6,
    sunset: clockHours >= 17.5 && clockHours < 20,
  };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawGround(ctx, world, view) {
  // Base grass.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(view.x, view.y, view.w, view.h);
  // Beach sand.
  if (view.y + view.h > WORLD.beachTop) {
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(view.x, Math.max(view.y, WORLD.beachTop), view.w, Math.min(view.y + view.h, WORLD.waterTop) - Math.max(view.y, WORLD.beachTop));
    // Sand speckles.
    ctx.fillStyle = PALETTE.sandDark;
    for (let i = 0; i < 40; i += 1) {
      const sx = view.x + ((i * 173) % Math.max(1, Math.floor(view.w)));
      const sy = WORLD.beachTop + ((i * 97) % (WORLD.waterTop - WORLD.beachTop));
      ctx.fillRect(sx, sy, 6, 3);
    }
  }
  // Water with animated waves.
  if (view.y + view.h > WORLD.waterTop) {
    const grad = ctx.createLinearGradient(0, WORLD.waterTop, 0, WORLD.height);
    grad.addColorStop(0, PALETTE.water);
    grad.addColorStop(1, PALETTE.waterDeep);
    ctx.fillStyle = grad;
    ctx.fillRect(view.x, Math.max(view.y, WORLD.waterTop), view.w, view.y + view.h - Math.max(view.y, WORLD.waterTop));
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    const t = world.time;
    for (let row = 0; row < 4; row += 1) {
      const wy = WORLD.waterTop + 24 + row * 26;
      ctx.beginPath();
      for (let x = Math.max(0, view.x); x < view.x + view.w; x += 24) {
        const wave = Math.sin(x * 0.01 + t * 1.4 + row * 1.7) * 4;
        if (x === Math.max(0, view.x)) ctx.moveTo(x, wy + wave);
        else ctx.lineTo(x, wy + wave);
      }
      ctx.stroke();
    }
    // Foam at the shoreline.
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(view.x, WORLD.waterTop - 3 + Math.sin(t * 1.2) * 2, view.w, 5);
  }
}

function drawRoads(ctx, world, view) {
  const half = WORLD.roadWidth / 2;
  const sw = WORLD.sidewalk;
  // Roads run to the water's edge, never into the sea.
  const landBottom = Math.min(WORLD.waterTop, view.y + view.h);
  // Sidewalks (under the asphalt, slightly wider).
  ctx.fillStyle = PALETTE.sidewalk;
  for (const line of world.city.lines) {
    ctx.fillRect(line - half - sw, Math.max(0, view.y), WORLD.roadWidth + sw * 2, Math.max(0, landBottom - Math.max(0, view.y)));
    ctx.fillRect(Math.max(0, view.x), line - half - sw, Math.min(view.w, WORLD.width - Math.max(0, view.x)), WORLD.roadWidth + sw * 2);
  }
  // Asphalt.
  ctx.fillStyle = PALETTE.asphalt;
  for (const line of world.city.lines) {
    if (line + half >= view.x && line - half <= view.x + view.w) {
      ctx.fillRect(line - half, Math.max(0, view.y), WORLD.roadWidth, Math.max(0, landBottom - Math.max(0, view.y)));
    }
    if (line + half >= view.y && line - half <= view.y + view.h) {
      ctx.fillRect(Math.max(0, view.x), line - half, Math.min(view.w, WORLD.width - Math.max(0, view.x)), WORLD.roadWidth);
    }
  }
  // Lane markings: dashed centre lines, skipping intersections.
  ctx.fillStyle = PALETTE.lane;
  const dash = 28;
  const gap = 34;
  for (const line of world.city.lines) {
    // Vertical road centre line.
    if (line >= view.x && line <= view.x + view.w) {
      for (let y = Math.max(0, view.y - gap); y < Math.min(view.y + view.h, WORLD.waterTop); y += dash + gap) {
        const onCrossing = world.city.lines.some((h) => Math.abs(h - (y + dash / 2)) < half + 10);
        if (!onCrossing) ctx.fillRect(line - 2, y, 4, dash);
      }
    }
    if (line >= view.y && line <= view.y + view.h) {
      for (let x = Math.max(0, view.x - gap); x < view.x + view.w; x += dash + gap) {
        const onCrossing = world.city.lines.some((v) => Math.abs(v - (x + dash / 2)) < half + 10);
        if (!onCrossing) ctx.fillRect(x, line - 2, dash, 4);
      }
    }
  }
  // Crosswalks at intersections.
  ctx.fillStyle = PALETTE.crosswalk;
  for (const light of world.city.lights) {
    if (light.x < view.x - 100 || light.x > view.x + view.w + 100 || light.y < view.y - 100 || light.y > view.y + view.h + 100) continue;
    for (let i = -2; i <= 2; i += 1) {
      ctx.fillRect(light.x + i * 14 - 4, light.y - half - 14, 8, 22);
      ctx.fillRect(light.x + i * 14 - 4, light.y + half - 8, 8, 22);
      ctx.fillRect(light.x - half - 14, light.y + i * 14 - 4, 22, 8);
      ctx.fillRect(light.x + half - 8, light.y + i * 14 - 4, 22, 8);
    }
  }
}

function drawBlocks(ctx, world, view, sun) {
  for (const block of world.city.blocks) {
    if (block.x + block.w < view.x || block.y + block.h < view.y || block.x > view.x + view.w || block.y > view.y + view.h) continue;
    // Block ground: plaza / lawn / sand handled by the ground pass.
    if (block.zone === 'park') {
      ctx.fillStyle = PALETTE.grassDark;
      ctx.fillRect(block.x, block.y, block.w, block.h);
      ctx.fillStyle = PALETTE.plaza;
      ctx.beginPath();
      ctx.ellipse(block.x + block.w / 2, block.y + block.h / 2, block.w * 0.22, block.h * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (block.zone === 'harbor') {
      ctx.fillStyle = '#8f9296';
      ctx.fillRect(block.x, block.y, block.w, block.h);
    } else if (block.zone === 'beach') {
      // Sand is drawn by the ground pass.
    } else {
      // Each block gets a slightly different plaza tone so the city does not
      // read as one flat sheet of beige.
      const tint = [0, -10, 10][(block.i * 7 + block.j * 13) % 3];
      ctx.fillStyle = shade(PALETTE.plaza, tint);
      ctx.fillRect(block.x, block.y, block.w, block.h);
    }
    for (const b of block.buildings) {
      drawBuilding(ctx, b, sun);
    }
  }
}

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amount));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amount));
  return `rgb(${r},${g},${b})`;
}

function drawBuilding(ctx, b, sun) {
  const h = b.height;
  const sx = sun.dx * h * 0.55;
  const sy = sun.dy * h * 0.55;
  // Ground shadow.
  ctx.fillStyle = PALETTE.shadow;
  ctx.fillRect(b.x + sx, b.y + sy, b.w, b.h);
  // Side faces (the "walls" seen from above at an angle).
  ctx.fillStyle = shade(b.color, -34);
  ctx.beginPath();
  ctx.moveTo(b.x, b.y + b.h);
  ctx.lineTo(b.x + sx * 0.4, b.y + b.h + sy * 0.4);
  ctx.lineTo(b.x + b.w + sx * 0.4, b.y + b.h + sy * 0.4);
  ctx.lineTo(b.x + b.w, b.y + b.h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(b.color, -22);
  ctx.beginPath();
  ctx.moveTo(b.x + b.w, b.y);
  ctx.lineTo(b.x + b.w + sx * 0.4, b.y + sy * 0.4);
  ctx.lineTo(b.x + b.w + sx * 0.4, b.y + b.h + sy * 0.4);
  ctx.lineTo(b.x + b.w, b.y + b.h);
  ctx.closePath();
  ctx.fill();
  // Roof.
  ctx.fillStyle = b.color;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.strokeStyle = PALETTE.roofEdge;
  ctx.lineWidth = 2;
  ctx.strokeRect(b.x, b.y, b.w, b.h);
  // Roof detail.
  if (b.kind === 'tower') {
    // Window grid on the roof edge + rooftop units.
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    const cols = Math.max(2, Math.floor(b.w / 26));
    const rows = Math.max(2, Math.floor(b.h / 26));
    for (let i = 0; i < cols; i += 1) {
      for (let j = 0; j < rows; j += 1) {
        if ((i + j) % 3 === 0) ctx.fillRect(b.x + 8 + i * 26, b.y + 8 + j * 26, 12, 12);
      }
    }
    ctx.fillStyle = shade(b.color, -18);
    ctx.fillRect(b.x + b.w * 0.3, b.y + b.h * 0.3, b.w * 0.18, b.h * 0.18);
  } else if (b.kind === 'house') {
    ctx.fillStyle = shade(b.color, 22);
    ctx.fillRect(b.x + b.w * 0.2, b.y + b.h * 0.2, b.w * 0.6, b.h * 0.6);
  } else if (b.kind === 'container') {
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let i = 1; i < 5; i += 1) ctx.fillRect(b.x + (b.w / 5) * i - 1, b.y + 3, 2, b.h - 6);
  }
}

function drawProps(ctx, world, view, sun) {
  for (const p of world.city.props) {
    if (p.x < view.x - 60 || p.x > view.x + view.w + 60 || p.y < view.y - 60 || p.y > view.y + view.h + 60) continue;
    if (p.kind === 'tree' || p.kind === 'palm') {
      const r = p.kind === 'palm' ? 16 : 19;
      ctx.fillStyle = PALETTE.shadow;
      ctx.beginPath();
      ctx.ellipse(p.x + sun.dx * 14, p.y + sun.dy * 14, r, r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p.kind === 'palm' ? '#3f8f4f' : '#4e8f3a';
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p.kind === 'palm' ? '#57a85e' : '#63a848';
      ctx.beginPath();
      ctx.arc(p.x - r * 0.25, p.y - r * 0.25, r * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7a5a3a';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'lamp') {
      ctx.fillStyle = '#3a3f4a';
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      ctx.fillStyle = '#f2e6a0';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'bench') {
      ctx.fillStyle = '#8a6a4a';
      ctx.fillRect(p.x - 10, p.y - 4, 20, 8);
    } else if (p.kind === 'crane') {
      ctx.strokeStyle = '#c9502f';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y + 40);
      ctx.lineTo(p.x, p.y - 40);
      ctx.lineTo(p.x + 90, p.y - 40);
      ctx.stroke();
      ctx.strokeStyle = '#333333';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x + 70, p.y - 40);
      ctx.lineTo(p.x + 70, p.y - 8);
      ctx.stroke();
    } else if (p.kind === 'boat') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle || 0);
      ctx.fillStyle = '#f0f0f0';
      roundRect(ctx, -26, -9, 52, 18, 8);
      ctx.fill();
      ctx.fillStyle = '#4a90b8';
      ctx.fillRect(-8, -6, 16, 12);
      ctx.restore();
    }
  }
}

function drawTrafficLights(ctx, world, view) {
  for (const light of world.city.lights) {
    if (light.x < view.x - 40 || light.x > view.x + view.w + 40 || light.y < view.y - 40 || light.y > view.y + view.h + 40) continue;
    const state = lightState(light, world.time);
    const nsGreen = state === 'ns';
    const ewGreen = state === 'ew';
    ctx.fillStyle = '#222222';
    ctx.fillRect(light.x + 66, light.y - 74, 10, 22);
    ctx.fillRect(light.x - 76, light.y + 66, 22, 10);
    ctx.fillStyle = nsGreen ? '#3ddc54' : state === 'ns-amber' ? '#f2c531' : '#e84a3c';
    ctx.beginPath();
    ctx.arc(light.x + 71, light.y - 68, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ewGreen ? '#3ddc54' : state === 'ew-amber' ? '#f2c531' : '#e84a3c';
    ctx.beginPath();
    ctx.arc(light.x - 70, light.y + 71, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSkids(ctx, world) {
  for (const s of world.effects.skids) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);
    ctx.fillStyle = `rgba(20,20,20,${0.35 * Math.min(1, s.life / 2)})`;
    ctx.fillRect(-14, -3, 28, 6);
    ctx.restore();
  }
}

function drawPickups(ctx, world, view) {
  for (const p of world.combat.pickups) {
    if (p.x < view.x || p.x > view.x + view.w || p.y < view.y || p.y > view.y + view.h) continue;
    const bob = Math.sin(p.bob) * 3;
    const colors = { health: '#e84a3c', armor: '#4a90e2', ammo: '#f2c531', cash: '#7ee787', smg: '#b06ab8' };
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(p.x, p.y + bob, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = colors[p.kind] || '#ffffff';
    ctx.beginPath();
    ctx.arc(p.x, p.y + bob, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const glyphs = { health: '+', armor: 'A', ammo: '•', cash: '$', smg: 'S' };
    ctx.fillText(glyphs[p.kind] || '?', p.x, p.y + bob + 0.5);
  }
}

function drawCar(ctx, car, world, sun) {
  const { length, width } = car.model;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = PALETTE.shadow;
  roundRect(ctx, -length / 2 + sun.dx * 6, -width / 2 + sun.dy * 6 + 4, length, width, 8);
  ctx.fill();
  // Wheels.
  ctx.fillStyle = '#1a1a1a';
  const wy = width / 2 - 3;
  ctx.fillRect(-length / 2 + 4, -wy - 3, 12, 6);
  ctx.fillRect(-length / 2 + 4, wy - 3, 12, 6);
  ctx.fillRect(length / 2 - 16, -wy - 3, 12, 6);
  ctx.fillRect(length / 2 - 16, wy - 3, 12, 6);
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -length / 2, -width / 2, length, width, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, -length / 2, -width / 2, length, width, 8);
  ctx.stroke();
  // Police livery: white doors + light bar.
  if (car.model.id === 'police') {
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(-6, -width / 2 + 1, 14, width - 2);
    const phase = Math.sin(car.sirenPhase) > 0;
    ctx.fillStyle = phase ? '#e84a3c' : '#4a90e2';
    ctx.fillRect(-12, -width / 2 + 3, 7, 5);
    ctx.fillStyle = phase ? '#4a90e2' : '#e84a3c';
    ctx.fillRect(-12, width / 2 - 8, 7, 5);
  }
  if (car.model.id === 'taxi') {
    ctx.fillStyle = '#222222';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 3);
  }
  // Windows and roof.
  ctx.fillStyle = 'rgba(180,220,235,0.9)';
  ctx.fillRect(length / 2 - 20, -width / 2 + 4, 10, width - 8);
  ctx.fillRect(-length / 2 + 8, -width / 2 + 4, 8, width - 8);
  ctx.fillStyle = shade(car.color, 18);
  ctx.fillRect(-8, -width / 2 + 4, 22, width - 8);
  // Headlights / taillights.
  ctx.fillStyle = '#fff8c0';
  ctx.fillRect(length / 2 - 2, -width / 2 + 2, 3, 5);
  ctx.fillRect(length / 2 - 2, width / 2 - 7, 3, 5);
  ctx.fillStyle = '#e84a3c';
  ctx.fillRect(-length / 2 - 1, -width / 2 + 2, 3, 5);
  ctx.fillRect(-length / 2 - 1, width / 2 - 7, 3, 5);
  // Damage smoke is particles; a wrecked look comes from the burn state.
  if (car.health < 35) {
    ctx.fillStyle = 'rgba(30,30,30,0.45)';
    ctx.fillRect(-length / 2, -width / 2, length * 0.4, width);
  }
  ctx.restore();
  // Headlight cones at night.
  if (sun.night) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    const grad = ctx.createLinearGradient(24, 0, 170, 0);
    grad.addColorStop(0, 'rgba(255,244,180,0.28)');
    grad.addColorStop(1, 'rgba(255,244,180,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(22, -8);
    ctx.lineTo(170, -46);
    ctx.lineTo(170, 46);
    ctx.lineTo(22, 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawPed(ctx, ped, world) {
  if (ped.state === 'down') {
    // Lying on the ground.
    ctx.save();
    ctx.translate(ped.x, ped.y);
    ctx.rotate(ped.angle);
    ctx.fillStyle = PALETTE.shadow;
    ctx.beginPath();
    ctx.ellipse(2, 3, 14, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.shirt;
    roundRect(ctx, -13, -6, 26, 12, 6);
    ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(15, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  const bob = Math.sin(ped.walkPhase) * 1.5;
  ctx.fillStyle = PALETTE.shadow;
  ctx.beginPath();
  ctx.ellipse(ped.x + 2, ped.y + 4, 9, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Feet.
  const fx = Math.cos(ped.angle);
  const fy = Math.sin(ped.angle);
  ctx.fillStyle = ped.pants;
  ctx.beginPath();
  ctx.arc(ped.x - fx * 4 + -fy * 4 + bob * fx, ped.y - fy * 4 + fx * 4 + bob * fy, 3.4, 0, Math.PI * 2);
  ctx.arc(ped.x - fx * 4 + fy * 4 - bob * fx, ped.y - fy * 4 - fx * 4 - bob * fy, 3.4, 0, Math.PI * 2);
  ctx.fill();
  // Body.
  ctx.fillStyle = ped.shirt;
  ctx.beginPath();
  ctx.arc(ped.x, ped.y, 8.5, 0, Math.PI * 2);
  ctx.fill();
  // Head, offset toward the facing direction.
  ctx.fillStyle = ped.skin;
  ctx.beginPath();
  ctx.arc(ped.x + fx * 3, ped.y + fy * 3, 5.5, 0, Math.PI * 2);
  ctx.fill();
  if (ped.isCop) {
    ctx.fillStyle = '#1d2733';
    ctx.beginPath();
    ctx.arc(ped.x + fx * 3, ped.y + fy * 3 - 1, 5.5, Math.PI, 0);
    ctx.fill();
  }
  if (ped.gang) {
    ctx.fillStyle = '#e84a3c';
    ctx.fillRect(ped.x - 8, ped.y - 16, 16, 3);
  }
}

function drawPlayer(ctx, world) {
  const player = world.player;
  if (player.inCar || player.dead) return;
  const ped = {
    x: player.x, y: player.y, angle: player.angle, walkPhase: player.walkPhase,
    shirt: '#e8b13c', skin: '#c98d5f', pants: '#2e3a4a', state: 'walk',
  };
  // A white ring so the player is always findable.
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(player.x, player.y, 15, 0, Math.PI * 2);
  ctx.stroke();
  drawPed(ctx, ped, world);
  // Gun direction.
  if (player.weapon !== 'fists') {
    ctx.strokeStyle = '#222222';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(player.x + Math.cos(player.aimAngle) * 8, player.y + Math.sin(player.aimAngle) * 8);
    ctx.lineTo(player.x + Math.cos(player.aimAngle) * 18, player.y + Math.sin(player.aimAngle) * 18);
    ctx.stroke();
  }
}

function drawBullets(ctx, world) {
  ctx.strokeStyle = '#fff2a0';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (const b of world.combat.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}

function drawParticles(ctx, world) {
  for (const p of world.effects.particles) {
    const a = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (0.5 + a * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  for (const f of world.effects.floats) {
    ctx.globalAlpha = Math.min(1, f.life);
    ctx.fillStyle = f.color;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 3;
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

function drawObjectiveMarker(ctx, world) {
  const objective = currentObjective(world);
  if (!objective || objective.x === null) return;
  const pulse = 0.6 + Math.sin(world.time * 4) * 0.4;
  // Light beam.
  const grad = ctx.createLinearGradient(0, objective.y - 220, 0, objective.y);
  grad.addColorStop(0, 'rgba(242,197,49,0)');
  grad.addColorStop(1, `rgba(242,197,49,${0.25 * pulse})`);
  ctx.fillStyle = grad;
  ctx.fillRect(objective.x - 14, objective.y - 220, 28, 220);
  // Ground ring.
  ctx.strokeStyle = `rgba(242,197,49,${0.7 * pulse})`;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(objective.x, objective.y, 42, 26, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Diamond.
  ctx.save();
  ctx.translate(objective.x, objective.y - 60 + Math.sin(world.time * 2) * 6);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = '#f2c531';
  ctx.fillRect(-9, -9, 18, 18);
  ctx.restore();
}

function drawMissionStart(ctx, world) {
  if (world.missions.active) return;
  if (world.missions.completed.length >= 6) return;
  const lm = world.city.landmarks.garage;
  const pulse = 0.6 + Math.sin(world.time * 4) * 0.4;
  const grad = ctx.createLinearGradient(0, lm.y - 220, 0, lm.y);
  grad.addColorStop(0, 'rgba(127,179,163,0)');
  grad.addColorStop(1, `rgba(127,179,163,${0.25 * pulse})`);
  ctx.fillStyle = grad;
  ctx.fillRect(lm.x - 14, lm.y - 220, 28, 220);
  ctx.fillStyle = '#7fb3a3';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('S', lm.x, lm.y - 64 + Math.sin(world.time * 2) * 5);
}

function drawLighting(ctx, world, camera, sun) {
  const w = camera.viewWidth;
  const h = camera.viewHeight;
  if (sun.sunset) {
    ctx.fillStyle = PALETTE.sunsetTint;
    ctx.fillRect(0, 0, w, h);
  }
  if (sun.night) {
    ctx.fillStyle = PALETTE.nightTint;
    ctx.fillRect(0, 0, w, h);
  }
  // Vignette.
  const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.75);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(10,8,4,0.32)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

function drawEdgeArrow(ctx, world, camera) {
  const objective = currentObjective(world);
  if (!objective || objective.x === null) return;
  const player = world.player;
  const dx = objective.x - player.x;
  const dy = objective.y - player.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 260) return;
  const angle = Math.atan2(dy, dx);
  const cx = camera.viewWidth / 2;
  const cy = camera.viewHeight / 2;
  const rx = camera.viewWidth / 2 - 90;
  const ry = camera.viewHeight / 2 - 110;
  const ex = cx + Math.cos(angle) * rx;
  const ey = cy + Math.sin(angle) * ry;
  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(angle);
  ctx.fillStyle = '#f2c531';
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(-8, -10);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-8, 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(dist / 10) * 10}m`, ex, ey + 28);
}

export function renderWorld(ctx, world, camera) {
  const sun = sunVector(world.clockHours);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#1a2028';
  ctx.fillRect(0, 0, camera.viewWidth, camera.viewHeight);
  applyCameraTransform(ctx, camera);
  const view = visibleRect(camera);
  drawGround(ctx, world, view);
  drawRoads(ctx, world, view);
  drawBlocks(ctx, world, view, sun);
  drawTrafficLights(ctx, world, view);
  drawProps(ctx, world, view, sun);
  drawSkids(ctx, world);
  drawPickups(ctx, world, view);
  drawObjectiveMarker(ctx, world);
  drawMissionStart(ctx, world);
  for (const car of world.cars) {
    if (car.x < view.x - 80 || car.x > view.x + view.w + 80 || car.y < view.y - 80 || car.y > view.y + view.h + 80) continue;
    if (!car.exploded) drawCar(ctx, car, world, sun);
  }
  for (const ped of world.peds) {
    if (ped.x < view.x - 40 || ped.x > view.x + view.w + 40 || ped.y < view.y - 40 || ped.y > view.y + view.h + 40) continue;
    drawPed(ctx, ped, world);
  }
  drawPlayer(ctx, world);
  drawBullets(ctx, world);
  drawParticles(ctx, world);
  // Screen-space passes.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawLighting(ctx, world, camera, sun);
  if (world.screen === 'play') drawEdgeArrow(ctx, world, camera);
}
