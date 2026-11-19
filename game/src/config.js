// SOLHAVEN — an original open-world crime game.
// Central tuning, palette and names. Everything here is invented for this
// game: the city, its districts, its people and its story are original.
export const GAME_TITLE = 'SOLHAVEN';
export const GAME_SUBTITLE = 'Heat on the Coast';

// World geometry (pixels). The city is a road grid with a beach and sea on
// its southern edge and a harbour on its eastern edge.
export const WORLD = {
  width: 6400,
  height: 6400,
  roadSpacing: 640,
  roadWidth: 128,
  sidewalk: 26,
  beachTop: 5880,
  waterTop: 6260,
};

// Seeded world: the same seed always builds the same city.
export const WORLD_SEED = 20261119;

// Sun-soaked coastal palette.
export const PALETTE = {
  asphalt: '#3b4048',
  asphaltLight: '#454b56',
  sidewalk: '#b9b1a1',
  curb: '#8f887a',
  grass: '#79a85c',
  grassDark: '#6b9a4e',
  sand: '#ecd9a4',
  sandDark: '#e0c98d',
  water: '#2f7fa6',
  waterDeep: '#256b8f',
  waterFoam: '#bfe3ec',
  lane: '#e8e3d3',
  crosswalk: '#ddd6c2',
  plaza: '#c9bfa9',
  roofEdge: 'rgba(0,0,0,0.25)',
  shadow: 'rgba(20,16,8,0.28)',
  nightTint: 'rgba(24,32,72,0.35)',
  sunsetTint: 'rgba(255,150,60,0.10)',
};

// Building colours by zone: pastel stucco, glass towers, brick, warehouses.
export const BUILDING_COLORS = {
  downtown: ['#5d7f9c', '#6d8fae', '#7d9cb5', '#54687e', '#8fa8bc', '#4f6a84'],
  residential: ['#e8dcc4', '#dfc39a', '#d9a066', '#c98d5f', '#e6c98f', '#c4b49a'],
  commercial: ['#d66a5e', '#e0a458', '#7fb3a3', '#c97b4a', '#a8b06a', '#b08968'],
  industrial: ['#9aa0a6', '#8b9096', '#7d838a', '#a89f92', '#6e7b85'],
  marina: ['#f0e6cc', '#e8d5a3', '#d9c08a', '#c9b18a'],
};

// Car models: name, colours, top speed (px/s), acceleration, handling.
export const CAR_MODELS = [
  { id: 'comet', name: 'Comet Sedan', colors: ['#c94f43', '#4a7fb5', '#d8d8d8', '#3f6b4f', '#8a5f9e'], topSpeed: 430, accel: 260, grip: 3.2, length: 46, width: 22 },
  { id: 'falcon', name: 'Falcon GT', colors: ['#e8b13c', '#222831', '#c22f2f', '#2f7fc2'], topSpeed: 560, accel: 340, grip: 3.8, length: 48, width: 22 },
  { id: 'bison', name: 'Bison Pickup', colors: ['#7a5a3a', '#5a6b7a', '#9e2b25', '#d8cdb4'], topSpeed: 400, accel: 230, grip: 2.9, length: 52, width: 24 },
  { id: 'taxi', name: 'Sol Cab', colors: ['#f2c531'], topSpeed: 440, accel: 270, grip: 3.2, length: 46, width: 22 },
  { id: 'van', name: 'Courier Van', colors: ['#e8e8e8', '#7a8a99', '#b56a2f'], topSpeed: 360, accel: 200, grip: 2.7, length: 54, width: 24 },
  { id: 'police', name: 'SPPD Interceptor', colors: ['#1d2733'], topSpeed: 520, accel: 330, grip: 3.9, length: 48, width: 22 },
];

// Pedestrian shirt / skin variety (top-down figures).
export const PED_COLORS = {
  shirts: ['#d95f4b', '#4b8fd9', '#e8c53a', '#63b06a', '#b06ab8', '#e8e8e8', '#3a3f4a', '#e07b39', '#39b8b2', '#c94f7c'],
  skins: ['#f2c9a0', '#d9a066', '#a8763e', '#8a5a2b', '#f7d7b0', '#c98d5f'],
  pants: ['#2e3a4a', '#4a3a2e', '#5a6b7a', '#3a3f4a', '#7a6a8a'],
};

// Player tuning.
export const PLAYER = {
  walkSpeed: 175,
  sprintSpeed: 275,
  radius: 13,
  maxHealth: 100,
  maxArmor: 100,
  enterCarRange: 60,
  punchDamage: 12,
  punchRange: 34,
  punchCooldown: 0.45,
};

// Weapon tuning.
export const WEAPONS = {
  fists: { name: 'Fists', damage: 12, range: 34, cooldown: 0.45, auto: false },
  pistol: { name: 'Pistol', damage: 25, range: 520, cooldown: 0.28, auto: false, ammo: 24, magSize: 12 },
  smg: { name: 'SMG', damage: 14, range: 460, cooldown: 0.09, auto: true, ammo: 60, magSize: 30 },
};

// Wanted levels: stars, cop budget, aggression, how fast heat decays.
export const WANTED = {
  maxStars: 5,
  decayDelay: 6, // seconds unseen before heat starts to fall
  decayRate: 0.25, // stars per second once hidden
  copCars: [0, 0, 2, 3, 4, 5], // police cars by star
  copPeds: [0, 1, 1, 2, 3, 4], // police on foot by star
  bustedHold: 1.6, // seconds a cop must hold you to bust
  heatPerCrime: { stealCar: 0.5, hitPed: 0.4, killPed: 1.0, shoot: 0.3, killCop: 1.5, hitCopCar: 0.3 },
};

// The day: 24 game-minutes per real second at noon start; golden hour look.
export const DAY = {
  startHour: 15.5,
  minutesPerSecond: 0.5,
  sunsetHour: 18.5,
  nightHour: 20.0,
  dawnHour: 6.0,
};

// Districts of Solhaven (names shown on the HUD when you enter them).
export const DISTRICTS = [
  { name: 'Downtown Solhaven', x: 1920, y: 1920, w: 2560, h: 1920 },
  { name: 'Old Town', x: 0, y: 1920, w: 1920, h: 1920 },
  { name: 'Palm Heights', x: 0, y: 0, w: 3200, h: 1920 },
  { name: 'Harbor', x: 4480, y: 0, w: 1920, h: 3200 },
  { name: 'Marina District', x: 3200, y: 3840, w: 3200, h: 2040 },
  { name: 'Beachfront', x: 0, y: 5120, w: 3200, h: 1280 },
  { name: 'North Industrial', x: 3200, y: 0, w: 1280, h: 1920 },
];

// Street names for the HUD's location readout.
export const STREET_NAMES_V = ['Lighthouse Way', 'Coral St', 'Flamingo St', 'Meridian Ave', 'Avenida del Sol', 'Cactus Rd', 'Harbor Blvd', 'Bayview Ave', 'Palm Row', 'Sunset Dr'];
export const STREET_NAMES_H = ['Northgate Rd', 'Juniper St', 'Vista Ave', 'Mercado St', 'Central Ave', 'Ocean View Dr', 'Seabreeze Ln', 'Marina Pkwy', 'Boardwalk', 'Shoreline Dr'];

// Story cast (all original characters).
export const CAST = {
  player: { name: 'Luna Vega', role: 'Wheelwoman', color: '#e8b13c' },
  sal: { name: 'Sal Delgado', role: 'Garage owner', color: '#7fb3a3' },
  maya: { name: 'Maya Chen', role: 'Fixer', color: '#b06ab8' },
  rex: { name: 'Rex Marlow', role: 'Viper crew boss', color: '#c94f43' },
  officer: { name: 'Officer Kane', role: 'SPPD', color: '#4a7fb5' },
};

export const SAVE_KEY = 'solhaven-save-v1';
