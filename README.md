# SOLHAVEN — Heat on the Coast

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/joni024/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/joni024/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game, built for the [make.fun](https://make.fun/bounty/gta6-01)
gta6-01 bounty. Luna Vega is back in Solhaven — a sun-soaked coastal city of
grid streets, downtown towers, a marina, a harbour and a beach — and the city
is hers to take.

## The game

- **A city to explore** on foot and by car: 10×10 blocks of roads, parks,
  beaches and docks, all procedurally built from one seed, with traffic
  lights, rush-hour traffic and pedestrians on the sidewalks.
- **Cars to steal and drive**: sedans, sports cars, pickups, taxis and vans,
  with arcade physics, drifting, handbrake turns and skid marks.
- **A wanted level** (1–5 stars) with police who respond: interceptors that
  chase and ram, officers on foot who arrest you, and heat that only fades
  once you break line of sight — or pay QuickFix Auto for a respray.
- **Missions and a story**: six jobs for Sal Delgado and Maya Chen — car
  theft, a timed package run, losing a 3-star tail, a dockside shootout and
  a finale chase against the Viper crew's boss.
- **Combat**: fists, pistol and SMG, drive-by shooting, health and armour
  pickups, and a day that runs from afternoon gold to neon night.
- **HUD with a live minimap**, mission objectives with a waypoint arrow,
  a start screen, a pause menu and saves at the hideout (localStorage).
- **Synthesised sound**: engine hum, sirens, gunfire and a laid-back synth
  loop, all generated with WebAudio — no audio files, no network requests.

Everything is original: the city, the characters, the story, the art and the
music are invented for this game. Nothing is taken from any commercial game.

## Play it

Serve `game/` with any static server and open `game/index.html` in desktop
Chrome — for example:

```sh
cd game && python3 -m http.server 8080
# open http://localhost:8080
```

| Key | Action |
| --- | ------ |
| WASD / Arrows | Move on foot · drive |
| Shift | Sprint |
| Mouse | Aim · click to shoot |
| F | Enter / exit a car |
| E | Talk · shops · save |
| Space | Handbrake |
| 1 / 2 / 3 / Q | Switch weapon |
| Esc | Pause |
| M | Mute |

## Layout

- `game/` — the game itself: `index.html`, `style.css` and `src/` (one
  module per system: `city`, `vehicles`, `pedestrians`, `police`, `combat`,
  `missions`, `render`, `hud`, `audio`, `save`, `shots`, …).
- `game/src/shots.js` — the staged screenshot scenes (`?shot=chase`,
  `?shot=downtown`, `?shot=mission`, `?shot=beach`).
- `main.ts` — the entrypoint: copies `game/` to `/output`, decodes the
  screenshots from `screenshots_b64/` into `/output/screenshots/`, and
  writes `/output/dossier.json`.
- `screenshots_b64/` — the 4 screenshots as single-line base64 text (this
  repository holds text files only; the images are decoded at run time).
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.

## Build the submission

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## License

MIT — see [LICENSE](LICENSE).
