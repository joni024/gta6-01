// Particles, skid marks and floating text: the juice that makes driving,
// shooting and crashing feel alive.
export function createEffects() {
  return {
    particles: [],
    skids: [],
    floats: [],
  };
}

export function spawnParticles(effects, x, y, opts = {}) {
  const count = opts.count || 8;
  const colors = opts.colors || ['#f2c531', '#e07b39', '#888888'];
  const speed = opts.speed || 120;
  const life = opts.life || 0.6;
  const size = opts.size || 3;
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.3 + Math.random() * 0.7);
    effects.particles.push({
      x, y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: life * (0.5 + Math.random() * 0.5),
      maxLife: life,
      size: size * (0.6 + Math.random() * 0.8),
      color: colors[Math.floor(Math.random() * colors.length)],
      gravity: opts.gravity || 0,
    });
  }
  if (effects.particles.length > 400) effects.particles.splice(0, effects.particles.length - 400);
}

export function spawnSmoke(effects, x, y, count = 1) {
  for (let i = 0; i < count; i += 1) {
    effects.particles.push({
      x: x + (Math.random() - 0.5) * 10,
      y: y + (Math.random() - 0.5) * 10,
      vx: (Math.random() - 0.5) * 20,
      vy: -20 - Math.random() * 20,
      life: 0.9 + Math.random() * 0.6,
      maxLife: 1.4,
      size: 5 + Math.random() * 6,
      color: 'rgba(90,90,90,0.5)',
      gravity: -12,
    });
  }
}

export function spawnExplosion(effects, x, y) {
  spawnParticles(effects, x, y, { count: 34, colors: ['#f2c531', '#e07b39', '#c94f43', '#666666'], speed: 260, life: 0.9, size: 5 });
  spawnSmoke(effects, x, y, 8);
}

export function addSkid(effects, x, y, angle) {
  effects.skids.push({ x, y, angle, life: 6 });
  if (effects.skids.length > 500) effects.skids.splice(0, effects.skids.length - 500);
}

export function addFloat(effects, x, y, text, color = '#ffffff') {
  effects.floats.push({ x, y, text, color, life: 1.4 });
  if (effects.floats.length > 24) effects.floats.shift();
}

export function updateEffects(effects, dt) {
  for (let i = effects.particles.length - 1; i >= 0; i -= 1) {
    const p = effects.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      effects.particles.splice(i, 1);
      continue;
    }
    p.vy += p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 1 - 2.2 * dt;
    p.vy *= 1 - 2.2 * dt;
  }
  for (let i = effects.skids.length - 1; i >= 0; i -= 1) {
    effects.skids[i].life -= dt;
    if (effects.skids[i].life <= 0) effects.skids.splice(i, 1);
  }
  for (let i = effects.floats.length - 1; i >= 0; i -= 1) {
    const f = effects.floats[i];
    f.life -= dt;
    f.y -= 34 * dt;
    if (f.life <= 0) effects.floats.splice(i, 1);
  }
}
