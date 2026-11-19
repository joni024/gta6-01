// Save games live in localStorage: money, health, position, mission
// progress and lifetime stats. Saving happens at the hideout, from the
// pause menu, and automatically when a mission is passed.
import { SAVE_KEY } from './config.js';

export function hasSave() {
  try {
    return !!localStorage.getItem(SAVE_KEY);
  } catch {
    return false;
  }
}

export function saveGame(world) {
  const player = world.player;
  const data = {
    version: 1,
    savedAt: Date.now(),
    money: player.money,
    health: player.health,
    armor: player.armor,
    x: player.x,
    y: player.y,
    weapon: player.weapon,
    weapons: player.weapons,
    ammo: player.ammo,
    missionsCompleted: world.missions.completed,
    clockHours: world.clockHours,
    stats: world.stats,
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function applySave(world, data) {
  const player = world.player;
  player.money = data.money;
  player.health = data.health;
  player.armor = data.armor;
  player.x = data.x;
  player.y = data.y;
  player.weapon = data.weapon;
  player.weapons = data.weapons;
  player.ammo = data.ammo;
  world.missions.completed = data.missionsCompleted || [];
  world.clockHours = data.clockHours || 15.5;
  world.stats = { ...world.stats, ...(data.stats || {}) };
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch { /* ignore */ }
}
