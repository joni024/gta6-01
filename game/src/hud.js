// The HUD: health and armour bars, money, wanted stars, clock, district,
// a live minimap, the mission objective, banners, dialogs and menus. All
// DOM, so it stays crisp at any resolution and reads well in screenshots.
import { GAME_TITLE, GAME_SUBTITLE, WEAPONS } from './config.js';
import { wantedStars } from './police.js';
import { districtAt, streetAt } from './city.js';
import { currentObjective } from './missions.js';

export function createHud() {
  const $ = (id) => document.getElementById(id);
  const hud = {
    el: {
      hud: $('hud'),
      healthFill: $('health-fill'),
      armorFill: $('armor-fill'),
      armorRow: $('armor-row'),
      money: $('money'),
      stars: $('stars'),
      clock: $('clock'),
      district: $('district'),
      street: $('street'),
      speed: $('speed'),
      weapon: $('weapon'),
      objective: $('objective'),
      objectiveText: $('objective-text'),
      banner: $('banner'),
      bannerTitle: $('banner-title'),
      bannerSub: $('banner-sub'),
      flash: $('flash'),
      notifyBox: $('notify'),
      dialog: $('dialog'),
      dialogTitle: $('dialog-title'),
      dialogLines: $('dialog-lines'),
      interact: $('interact'),
      minimap: $('minimap'),
      menu: $('menu'),
      menuTitle: $('menu-title'),
      pause: $('pause'),
      gameover: $('gameover'),
      gameoverTitle: $('gameover-title'),
      gameoverSub: $('gameover-sub'),
      help: $('help'),
    },
    minimapCtx: $('minimap') ? $('minimap').getContext('2d') : null,
    flashTimer: 0,
    bannerTimer: 0,
    notifications: [],
    dialogOpen: false,
  };

  hud.flash = (text, color = '#ffffff') => {
    hud.el.flash.textContent = text;
    hud.el.flash.style.color = color;
    hud.el.flash.classList.add('show');
    hud.flashTimer = 2.2;
  };

  hud.notify = (text, color = '#ffffff') => {
    const box = hud.el.notifyBox;
    if (!box) return;
    const div = document.createElement('div');
    div.className = 'note';
    div.textContent = text;
    div.style.color = color;
    box.appendChild(div);
    hud.notifications.push(div);
    window.setTimeout(() => {
      div.classList.add('fade');
      window.setTimeout(() => div.remove(), 600);
    }, 4200);
    while (hud.notifications.length > 4) {
      const old = hud.notifications.shift();
      if (old && old.parentNode) old.remove();
    }
  };

  hud.showBanner = (title, sub = '') => {
    hud.el.bannerTitle.textContent = title;
    hud.el.bannerSub.textContent = sub;
    hud.el.banner.classList.add('show');
    hud.bannerTimer = 3.2;
  };

  hud.showBriefing = (mission) => {
    hud.el.dialogTitle.textContent = `${mission.title} — $${mission.reward}`;
    hud.el.dialogLines.innerHTML = '';
    for (const line of mission.briefing) {
      const p = document.createElement('p');
      p.textContent = line;
      hud.el.dialogLines.appendChild(p);
    }
    hud.el.dialog.classList.add('show');
    hud.dialogOpen = true;
  };

  hud.closeDialog = () => {
    hud.el.dialog.classList.remove('show');
    hud.dialogOpen = false;
  };

  hud.setInteract = (text) => {
    if (!text) {
      hud.el.interact.classList.remove('show');
      return;
    }
    hud.el.interact.textContent = text;
    hud.el.interact.classList.add('show');
  };

  hud.showMenu = (mode) => {
    // mode: 'title' | 'pause' | 'gameover'
    hud.el.menu.classList.toggle('show', mode === 'title');
    hud.el.pause.classList.toggle('show', mode === 'pause');
    hud.el.gameover.classList.toggle('show', mode === 'gameover');
    hud.el.hud.classList.toggle('dim', mode !== null);
  };

  hud.hideMenus = () => {
    hud.el.menu.classList.remove('show');
    hud.el.pause.classList.remove('show');
    hud.el.gameover.classList.remove('show');
    hud.el.hud.classList.remove('dim');
  };

  hud.gameOver = (kind) => {
    hud.el.gameoverTitle.textContent = kind === 'busted' ? 'BUSTED' : 'WASTED';
    hud.el.gameoverSub.textContent = kind === 'busted'
      ? 'The SPPD caught up with you. Bail is $200 — the city keeps your cash.'
      : 'Luna went down. Solhaven General patched her up — for $200.';
    hud.showMenu('gameover');
  };

  hud.update = (world, dt) => {
    const player = world.player;
    hud.el.healthFill.style.width = `${Math.max(0, player.health)}%`;
    hud.el.healthFill.style.background = player.health < 30 ? '#e84a3c' : '#7ee787';
    hud.el.armorRow.style.display = player.armor > 0 ? 'flex' : 'none';
    hud.el.armorFill.style.width = `${Math.max(0, player.armor)}%`;
    hud.el.money.textContent = `$${Math.floor(player.money).toLocaleString('en-US')}`;
    const stars = wantedStars(world.police);
    hud.el.stars.textContent = '★'.repeat(stars) + '☆'.repeat(5 - stars);
    hud.el.stars.classList.toggle('hot', stars > 0);
    const hours = Math.floor(world.clockHours) % 24;
    const minutes = Math.floor((world.clockHours % 1) * 60);
    hud.el.clock.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    hud.el.district.textContent = districtAt(player.x, player.y);
    hud.el.street.textContent = streetAt(player.x, player.y, world.city);
    const speed = player.inCar ? Math.hypot(player.inCar.vx, player.inCar.vy) : Math.hypot(player.vx, player.vy);
    hud.el.speed.textContent = player.inCar
      ? `${Math.round(speed * 0.14)} mph · ${player.inCar.model.name}`
      : 'On foot';
    const weapon = WEAPONS[player.weapon];
    hud.el.weapon.textContent = player.weapon === 'fists'
      ? 'FISTS'
      : `${weapon.name.toUpperCase()} · ${player.ammo[player.weapon]}`;
    const objective = currentObjective(world);
    if (objective) {
      hud.el.objective.classList.add('show');
      hud.el.objectiveText.textContent = objective.text;
    } else {
      hud.el.objective.classList.remove('show');
    }
    if (hud.flashTimer > 0) {
      hud.flashTimer -= dt;
      if (hud.flashTimer <= 0) hud.el.flash.classList.remove('show');
    }
    if (hud.bannerTimer > 0) {
      hud.bannerTimer -= dt;
      if (hud.bannerTimer <= 0) hud.el.banner.classList.remove('show');
    }
    renderMinimap(hud, world);
  };

  return hud;
}

// --- Minimap ---------------------------------------------------------------

function renderMinimap(hud, world) {
  const ctx = hud.minimapCtx;
  if (!ctx) return;
  const size = 180;
  const range = 1300; // world px shown across the minimap
  const scale = size / (range * 2);
  const player = world.player;
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
  ctx.clip();
  // Ground.
  ctx.fillStyle = '#20242e';
  ctx.fillRect(0, 0, size, size);
  const toMap = (x, y) => ({
    x: size / 2 + (x - player.x) * scale,
    y: size / 2 + (y - player.y) * scale,
  });
  // Water and beach.
  const waterTop = toMap(0, 6260).y;
  if (waterTop < size) {
    ctx.fillStyle = '#2f7fa6';
    ctx.fillRect(0, Math.max(0, waterTop), size, size - Math.max(0, waterTop));
  }
  const beachTop = toMap(0, 5880).y;
  if (beachTop < size) {
    ctx.fillStyle = '#c9b078';
    ctx.fillRect(0, Math.max(0, beachTop), size, Math.min(size, waterTop) - Math.max(0, beachTop));
  }
  // Roads.
  ctx.strokeStyle = '#6a707c';
  ctx.lineWidth = Math.max(2, 128 * scale);
  ctx.lineCap = 'round';
  for (const line of world.city.lines) {
    const v = toMap(line, 0);
    const h = toMap(0, line);
    if (v.x >= -10 && v.x <= size + 10) {
      ctx.beginPath();
      ctx.moveTo(v.x, 0);
      ctx.lineTo(v.x, size);
      ctx.stroke();
    }
    if (h.y >= -10 && h.y <= size + 10) {
      ctx.beginPath();
      ctx.moveTo(0, h.y);
      ctx.lineTo(size, h.y);
      ctx.stroke();
    }
  }
  // Buildings.
  ctx.fillStyle = '#4a505c';
  for (const block of world.city.blocks) {
    for (const b of block.buildings) {
      const p = toMap(b.x, b.y);
      const w = Math.max(1.5, b.w * scale);
      const h = Math.max(1.5, b.h * scale);
      if (p.x + w < 0 || p.y + h < 0 || p.x > size || p.y > size) continue;
      ctx.fillRect(p.x, p.y, w, h);
    }
  }
  // Mission waypoint.
  const objective = currentObjective(world);
  if (objective && objective.x !== null) {
    const p = toMap(objective.x, objective.y);
    const cx = Math.max(10, Math.min(size - 10, p.x));
    const cy = Math.max(10, Math.min(size - 10, p.y));
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#f2c531';
    ctx.fillRect(-5, -5, 10, 10);
    ctx.restore();
    ctx.strokeStyle = 'rgba(242,197,49,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(size / 2, size / 2);
    ctx.lineTo(cx, cy);
    ctx.stroke();
  }
  // Police.
  const blink = Math.floor(world.time * 3) % 2 === 0;
  for (const car of world.cars) {
    if (car.kind !== 'police') continue;
    const p = toMap(car.x, car.y);
    if (p.x < 0 || p.y < 0 || p.x > size || p.y > size) continue;
    ctx.fillStyle = blink ? '#4a90e2' : '#e84a3c';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const ped of world.peds) {
    if (!ped.isCop || ped.state === 'down') continue;
    const p = toMap(ped.x, ped.y);
    if (p.x < 0 || p.y < 0 || p.x > size || p.y > size) continue;
    ctx.fillStyle = '#4a90e2';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Gang members.
  for (const ped of world.peds) {
    if (!ped.gang || ped.state === 'down') continue;
    const p = toMap(ped.x, ped.y);
    if (p.x < 0 || p.y < 0 || p.x > size || p.y > size) continue;
    ctx.fillStyle = '#e84a3c';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player arrow.
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.rotate(player.angle + Math.PI / 2);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#222222';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -9);
  ctx.lineTo(6, 7);
  ctx.lineTo(0, 3);
  ctx.lineTo(-6, 7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.restore();
  // Ring.
  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
  ctx.stroke();
  // North tick.
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('N', size / 2, 14);
}
