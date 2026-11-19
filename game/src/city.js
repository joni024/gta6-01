// Solhaven itself: a seeded grid city with districts, buildings, parks, a
// beach, a harbour, traffic lights and landmarks. The same seed always
// builds the same city, so screenshots and saves stay consistent.
import { WORLD, BUILDING_COLORS, DISTRICTS, STREET_NAMES_V, STREET_NAMES_H } from './config.js';
import { createRng, range, rangeInt, pick, chance, hashString } from './random.js';

const ROAD_COUNT = 10;

export function roadLines() {
  const lines = [];
  for (let i = 0; i < ROAD_COUNT; i += 1) lines.push(320 + i * WORLD.roadSpacing);
  return lines;
}

// Block column/row boundaries: gaps between the roads, plus the edge strips.
function blockBounds() {
  const lines = roadLines();
  const bounds = [];
  let start = 0;
  for (const line of lines) {
    bounds.push([start, line - WORLD.roadWidth / 2]);
    start = line + WORLD.roadWidth / 2;
  }
  bounds.push([start, WORLD.width]);
  return bounds; // 11 spans
}

function zoneForBlock(cx, cy) {
  if (cy > WORLD.beachTop) return 'beach';
  if (cx > 6144) return 'harbor';
  if (cy < 256) return 'industrial';
  // Downtown core.
  if (cx > 2240 && cx < 4160 && cy > 1920 && cy < 3840) return 'downtown';
  // Marina quarter, south-east.
  if (cx > 4480 && cy > 3840) return 'marina';
  // Parks: two fixed green blocks.
  if ((cx > 2560 && cx < 3200 && cy > 640 && cy < 1280) ||
      (cx > 640 && cx < 1280 && cy > 3840 && cy < 4480)) return 'park';
  // Commercial ring around downtown.
  if (cx > 1600 && cx < 4800 && cy > 1280 && cy < 4480) return 'commercial';
  return 'residential';
}

function buildBlockBuildings(block, zone, rng) {
  const buildings = [];
  const { x, y, w, h } = block;
  const pad = 24;
  const colors = BUILDING_COLORS[zone] || BUILDING_COLORS.residential;
  if (zone === 'park' || zone === 'beach') return buildings;
  if (zone === 'harbor') {
    // Shipping containers and a warehouse.
    const n = rangeInt(rng, 4, 8);
    for (let i = 0; i < n; i += 1) {
      const bw = range(rng, 50, 90);
      const bh = range(rng, 26, 40);
      buildings.push({
        x: range(rng, x + pad, x + w - pad - bw),
        y: range(rng, y + pad, y + h - pad - bh),
        w: bw, h: bh, height: range(rng, 10, 16),
        color: pick(rng, ['#b5502f', '#3f6b8f', '#7a8a3f', '#c9a13f', '#8a4a6a']),
        kind: 'container',
      });
    }
    return buildings;
  }
  if (zone === 'downtown') {
    const tall = chance(rng, 0.55);
    const bw = tall ? range(rng, 200, 300) : range(rng, 140, 200);
    const bh = tall ? range(rng, 200, 300) : range(rng, 140, 200);
    buildings.push({
      x: x + (w - bw) / 2 + range(rng, -20, 20),
      y: y + (h - bh) / 2 + range(rng, -20, 20),
      w: bw, h: bh, height: tall ? range(rng, 90, 170) : range(rng, 40, 80),
      color: pick(rng, colors), kind: 'tower',
    });
    if (!tall && chance(rng, 0.85)) {
      const bw2 = range(rng, 90, 140);
      const bh2 = range(rng, 90, 140);
      buildings.push({
        x: range(rng, x + pad, x + w - pad - bw2),
        y: range(rng, y + pad, y + h - pad - bh2),
        w: bw2, h: bh2, height: range(rng, 30, 55),
        color: pick(rng, colors), kind: 'tower',
      });
    }
    if (tall && chance(rng, 0.5)) {
      const bw3 = range(rng, 80, 120);
      const bh3 = range(rng, 80, 120);
      buildings.push({
        x: range(rng, x + pad, x + w - pad - bw3),
        y: range(rng, y + pad, y + h - pad - bh3),
        w: bw3, h: bh3, height: range(rng, 24, 40),
        color: pick(rng, colors), kind: 'tower',
      });
    }
    return buildings;
  }
  if (zone === 'industrial') {
    buildings.push({
      x: x + pad + range(rng, 0, 60), y: y + pad + range(rng, 0, 60),
      w: range(rng, 200, Math.min(320, w - pad * 2)),
      h: range(rng, 120, Math.min(200, h - pad * 2)),
      height: range(rng, 18, 30), color: pick(rng, colors), kind: 'warehouse',
    });
    return buildings;
  }
  // Residential / commercial / marina: a few smaller buildings. Retry each
  // placement a few times so blocks actually fill up instead of staying bare.
  const count = zone === 'commercial' ? rangeInt(rng, 2, 3) : rangeInt(rng, 3, 5);
  for (let i = 0; i < count; i += 1) {
    const bw = range(rng, 90, zone === 'commercial' ? 220 : 150);
    const bh = range(rng, 80, zone === 'commercial' ? 160 : 130);
    let placed = false;
    for (let attempt = 0; attempt < 6 && !placed; attempt += 1) {
      const bx = range(rng, x + pad, Math.max(x + pad + 1, x + w - pad - bw));
      const by = range(rng, y + pad, Math.max(y + pad + 1, y + h - pad - bh));
      if (buildings.some((b) => bx < b.x + b.w + 16 && bx + bw + 16 > b.x && by < b.y + b.h + 16 && by + bh + 16 > b.y)) continue;
      buildings.push({
        x: bx, y: by, w: bw, h: bh,
        height: zone === 'commercial' ? range(rng, 24, 48) : range(rng, 14, 26),
        color: pick(rng, colors), kind: zone === 'commercial' ? 'shop' : 'house',
      });
      placed = true;
    }
  }
  return buildings;
}

function buildProps(block, zone, rng) {
  const props = [];
  const { x, y, w, h } = block;
  if (zone === 'beach') {
    const n = rangeInt(rng, 6, 12);
    for (let i = 0; i < n; i += 1) {
      props.push({ x: range(rng, x + 10, x + w - 10), y: range(rng, y + 10, Math.min(y + h - 10, WORLD.waterTop - 30)), kind: 'palm' });
    }
    return props;
  }
  if (zone === 'park') {
    const n = rangeInt(rng, 10, 18);
    for (let i = 0; i < n; i += 1) {
      props.push({ x: range(rng, x + 16, x + w - 16), y: range(rng, y + 16, y + h - 16), kind: 'tree' });
    }
    const benches = rangeInt(rng, 2, 4);
    for (let i = 0; i < benches; i += 1) {
      props.push({ x: range(rng, x + 30, x + w - 30), y: range(rng, y + 30, y + h - 30), kind: 'bench' });
    }
    return props;
  }
  if (zone === 'harbor') {
    props.push({ x: x + w / 2, y: y + h / 2, kind: 'crane' });
    return props;
  }
  const trees = zone === 'residential' ? rangeInt(rng, 3, 6) : rangeInt(rng, 1, 3);
  for (let i = 0; i < trees; i += 1) {
    props.push({ x: range(rng, x + 14, x + w - 14), y: range(rng, y + 14, y + h - 14), kind: 'tree' });
  }
  return props;
}

export function buildCity(seed) {
  const rng = createRng(seed);
  const bounds = blockBounds();
  const blocks = [];
  const props = [];
  const lights = [];
  const lines = roadLines();

  for (let i = 0; i < bounds.length; i += 1) {
    for (let j = 0; j < bounds.length; j += 1) {
      const [x0, x1] = bounds[i];
      const [y0, y1] = bounds[j];
      const w = x1 - x0;
      const h = y1 - y0;
      if (w < 40 || h < 40) continue;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const zone = zoneForBlock(cx, cy);
      const blockRng = createRng(hashString(`block-${i}-${j}-${seed}`));
      const block = { x: x0, y: y0, w, h, zone, i, j };
      block.buildings = buildBlockBuildings(block, zone, blockRng);
      blocks.push(block);
      props.push(...buildProps(block, zone, blockRng));
    }
  }

  // Traffic lights at every intersection, each with its own phase offset.
  for (const vx of lines) {
    for (const hy of lines) {
      lights.push({ x: vx, y: hy, offset: rng() * 30 });
    }
  }

  // Street lamps along the roads.
  for (const line of lines) {
    for (let t = 200; t < WORLD.width; t += 420) {
      if (chance(rng, 0.7)) props.push({ x: line + WORLD.roadWidth / 2 + 12, y: t, kind: 'lamp' });
      if (chance(rng, 0.7)) props.push({ x: t, y: line + WORLD.roadWidth / 2 + 12, kind: 'lamp' });
    }
  }

  // Boats in the water near the marina.
  for (let i = 0; i < 7; i += 1) {
    props.push({ x: range(rng, 4600, 6200), y: range(rng, WORLD.waterTop + 20, WORLD.height - 30), kind: 'boat', angle: range(rng, -0.4, 0.4) });
  }

  // Parked-car spots along road edges.
  const parking = [];
  for (const line of lines) {
    for (let t = 200; t < WORLD.width - 100; t += rangeInt(rng, 260, 520)) {
      if (chance(rng, 0.5)) parking.push({ x: line - WORLD.roadWidth / 2 + 16, y: t, angle: -Math.PI / 2 });
      if (chance(rng, 0.5)) parking.push({ x: t, y: line - WORLD.roadWidth / 2 + 16, angle: 0 });
    }
  }

  const city = {
    seed, blocks, props, lights, parking,
    lines,
    landmarks: {
      garage: { name: "Sal's Auto Works", x: 1472, y: 2912, kind: 'garage' },
      hideout: { name: 'Luna’s Hideout', x: 928, y: 5408, kind: 'hideout' },
      marina: { name: 'Solhaven Marina', x: 5216, y: 5664, kind: 'marina' },
      harbor: { name: 'Port Solhaven', x: 6016, y: 1472, kind: 'harbor' },
      park: { name: 'Meridian Park', x: 2912, y: 928, kind: 'park' },
      spray: { name: 'QuickFix Auto', x: 3616, y: 1472, kind: 'spray' },
      gunshop: { name: 'Ironworks Supply', x: 2464, y: 4384, kind: 'gunshop' },
      hospital: { name: 'Solhaven General', x: 4384, y: 2912, kind: 'hospital' },
    },
  };
  return city;
}

// --- Queries ---------------------------------------------------------------

export function isWater(x, y) {
  return y >= WORLD.waterTop && x >= 0 && x <= WORLD.width;
}

export function isBeach(x, y) {
  return y >= WORLD.beachTop && y < WORLD.waterTop;
}

export function isRoad(x, y, city) {
  const half = WORLD.roadWidth / 2;
  for (const line of city.lines) {
    if (Math.abs(x - line) <= half) return true;
    if (Math.abs(y - line) <= half) return true;
  }
  return false;
}

// Nearest road centreline point (snaps to the closest vertical or horizontal
// road); also returns which axis won.
export function nearestRoadPoint(x, y, city) {
  let best = null;
  for (const line of city.lines) {
    const dv = Math.abs(x - line);
    const dh = Math.abs(y - line);
    if (!best || dv < best.d) best = { x: line, y, axis: 'v', d: dv };
    if (dh < best.d) best = { x, y: line, axis: 'h', d: dh };
  }
  return best;
}

export function buildingAt(x, y, city) {
  for (const block of city.blocks) {
    if (x < block.x || x > block.x + block.w || y < block.y || y > block.y + block.h) continue;
    for (const b of block.buildings) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
    }
  }
  return null;
}

// Push a circle out of every building it overlaps; returns corrected coords.
export function collideBuildings(x, y, r, city) {
  let cx = x;
  let cy = y;
  for (const block of city.blocks) {
    if (cx + r < block.x || cx - r > block.x + block.w || cy + r < block.y || cy - r > block.y + block.h) continue;
    for (const b of block.buildings) {
      const nx = Math.max(b.x, Math.min(cx, b.x + b.w));
      const ny = Math.max(b.y, Math.min(cy, b.y + b.h));
      const dx = cx - nx;
      const dy = cy - ny;
      const d2 = dx * dx + dy * dy;
      if (d2 >= r * r) continue;
      if (d2 < 0.0001) {
        // Centre inside the building: push out along the smallest penetration.
        const left = cx - b.x;
        const right = b.x + b.w - cx;
        const top = cy - b.y;
        const bottom = b.y + b.h - cy;
        const m = Math.min(left, right, top, bottom);
        if (m === left) cx = b.x - r;
        else if (m === right) cx = b.x + b.w + r;
        else if (m === top) cy = b.y - r;
        else cy = b.y + b.h + r;
      } else {
        const d = Math.sqrt(d2);
        cx = nx + (dx / d) * r;
        cy = ny + (dy / d) * r;
      }
    }
  }
  return { x: cx, y: cy };
}

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d.name;
  }
  return 'Solhaven';
}

export function streetAt(x, y, city) {
  const near = nearestRoadPoint(x, y, city);
  const lines = city.lines;
  if (near.axis === 'v') {
    const idx = lines.indexOf(near.x);
    return STREET_NAMES_V[idx] || 'Avenue';
  }
  const idx = lines.indexOf(near.y);
  return STREET_NAMES_H[idx] || 'Street';
}

// Traffic light state at an intersection: 'ns' (north-south green) or 'ew'.
// Cycle: 12s green, 3s amber, 12s green, 3s amber = 30s.
export function lightState(light, time) {
  const t = (time + light.offset) % 30;
  if (t < 12) return 'ns';
  if (t < 15) return 'ns-amber';
  if (t < 27) return 'ew';
  return 'ew-amber';
}

export function nearestLight(x, y, city) {
  let best = null;
  let bestD = Infinity;
  for (const light of city.lights) {
    const d = Math.abs(light.x - x) + Math.abs(light.y - y);
    if (d < bestD) {
      bestD = d;
      best = light;
    }
  }
  return best;
}

// A random point on a road, within [minDist, maxDist] of (cx, cy).
export function randomRoadPoint(rng, city, cx, cy, minDist, maxDist) {
  for (let tries = 0; tries < 24; tries += 1) {
    const vertical = chance(rng, 0.5);
    const line = city.lines[rangeInt(rng, 0, city.lines.length - 1)];
    const t = range(rng, 100, WORLD.width - 100);
    const x = vertical ? line : t;
    const y = vertical ? t : line;
    const d = Math.hypot(x - cx, y - cy);
    if (d >= minDist && d <= maxDist) return { x, y, axis: vertical ? 'v' : 'h' };
  }
  const near = nearestRoadPoint(cx + range(rng, -600, 600), cy + range(rng, -600, 600), city);
  return { x: near.x, y: near.y, axis: near.axis };
}

// A random point on a sidewalk (just off a road).
export function randomSidewalkPoint(rng, city, cx, cy, minDist, maxDist) {
  const p = randomRoadPoint(rng, city, cx, cy, minDist, maxDist);
  const off = WORLD.roadWidth / 2 + WORLD.sidewalk / 2;
  if (p.axis === 'v') return { x: p.x + (chance(rng, 0.5) ? off : -off), y: p.y };
  return { x: p.x, y: p.y + (chance(rng, 0.5) ? off : -off) };
}
