# RetroPlay — Project Report

This document covers: what the original uploaded codebase actually was,
why it couldn't simply be "fixed," every major engineering decision made
in the rewrite, a full asset list, and the testing that was done before
delivery.

---

## 1. Analysis of the original codebase

The uploaded `RetroPlay.zip` was **not** a static site with a few bugs —
it was a full client/server web application:

| Layer | Stack used |
|---|---|
| Client | React 18 + Vite, `react-router-dom`, Tailwind CSS, `@react-oauth/google` |
| Server | Node.js + Express, MongoDB (via Mongoose), Helmet, CORS, JWT auth |
| Auth | Google OAuth + One-Time-Password flow, JWT sessions |
| Deployment | `Dockerfile` + `docker-compose.yml` (separate client/server containers) |

Full original file inventory (58 files):

```
retroplay/
├── docker-compose.yml, Dockerfile, package.json, DEPLOYMENT.md
├── client/
│   ├── vite.config.js, tailwind.config.js, postcss.config.js
│   └── src/
│       ├── App.jsx, main.jsx
│       ├── context/store.js                  (global React state)
│       ├── components/StarField.jsx
│       ├── pages/  LandingPage.jsx, Dashboard.jsx, GamesPage.jsx,
│       │           GamePlayer.jsx, CheatStore.jsx, Leaderboard.jsx,
│       │           ReferralCenter.jsx, Achievements.jsx, SpinWheel.jsx,
│       │           AdminPanel.jsx
│       ├── games/   SnakeGame.js, DinoGame.js, FlappyGame.js, MarioGame.js,
│       │            PacmanGame.js, BreakoutGame.js, TetrisGame.js,
│       │            BossGame.js, SpaceInvadersGame.js
│       └── utils/api.js                       (fetch wrapper -> Express API)
└── server/
    ├── index.js                                (Express app entry)
    ├── config/db.js                             (MongoDB connection)
    ├── controllers/  authController.js, scoreController.js,
    │                 cheatController.js, spinController.js,
    │                 achievementController.js, adminController.js
    ├── middleware/   auth.js (JWT verify), rateLimiter.js
    ├── models/       User.js, Score.js, Cheat.js, Extra.js   (Mongoose schemas)
    └── routes/index.js
```

### Verdict: 100% incompatible with the target stack

The brief required a finished product that is plain HTML5/CSS3/vanilla
JS — no React, no Vue, no Node runtime, no PHP, no Docker, no npm, no
build step, runnable by double-clicking `index.html`. Every layer of the
original app conflicts with that:

- **React** compiles JSX and needs a bundler (Vite) — there is no way to
  "just open" a Vite React app's source files in a browser; it has to be
  built first, and even the build output expects to be served (client
  routing, asset hashing) rather than opened via `file://`.
- **Express + MongoDB** is a server and a database. A static site has
  nowhere to run either.
- **Google OAuth + JWT** auth requires a registered OAuth client, a
  server to verify tokens, and (per the brief) was explicitly to be
  replaced with a simple local Player Name / Guest flow anyway.
- **Docker** packages the above two runtimes into containers — irrelevant
  once there's no server or database to containerize.

So this wasn't a "migrate a few files" job — it required a **full
rewrite** of every interactive piece, while deliberately preserving the
*design* and *feature set* the brief asked for. Nothing from
`client/src` or `server/` was reused as code (different language
paradigm entirely — React components and Express controllers don't
translate line-by-line into vanilla DOM/canvas code) but every page,
game, and system was reimplemented to match the same user-facing
behavior wherever the brief specified it.

### What was kept as-is

**`RetroPlay-Landing.html`** (the separately-uploaded marketing page) was
kept close to its original design, per the brief's explicit instruction
to preserve the existing look. It's folded into `index.html` as the
`#marketing-root` section, with only the following changes:

- Nav/CTA buttons given element IDs so the app's router can hook into them.
- Marketing copy adjusted where it referenced numbers that no longer
  match what was actually built (see §3, "Cheats — 9 total, not 21").
- The 9 game cards in the "lineup" section were made clickable, routing
  straight into that game.

---

## 2. Architecture of the rewrite

### Single-page app behind a marketing page

`index.html` contains two top-level containers:

- `#marketing-root` — the original landing page content, shown by default.
- `#app-root` — an empty container that `js/app.js` renders into, shown
  once a player signs in.

Once signed in, the whole app is **one HTML file** using **hash-based
routing** (`#/hub`, `#/game/<id>`, `#/cheats`, `#/leaderboard`,
`#/achievements`, `#/rewards`, `#/profile`). This was chosen over
multiple physical HTML files for two reasons:

1. **`file://` consistency.** Some browsers scope `localStorage` slightly
   differently across separate files opened directly from disk in edge
   cases; a single document sidesteps any ambiguity entirely.
2. **WordPress iframe embedding.** One file, one `<iframe src="...">` —
   no need to manage multiple page URLs inside the embed.

### No `fetch()` for core data — and why

Requirement #1 is "must run by double-clicking `index.html`." Chrome and
Edge block `fetch()`/`XMLHttpRequest` against `file://` origins (a CORS
restriction), so any architecture relying on `fetch('data/games.json')`
would throw a console error and silently break for anyone who didn't
serve the files through a local server. Instead:

- Catalog data (games, cheats, achievements) is embedded directly as
  plain JS objects in `js/data.js`.
- Human-readable JSON mirrors are still provided at `data/games.json`
  and `data/cheats.json` for convenience/editing — see `data/README.md`
  for the full reasoning and how to switch to `fetch()`-based loading if
  you deploy to a real server and want a single source of truth.

### No audio files — synthesized sound instead

Every sound effect (coin pickup, jump, hit, explosion, power-up, laser,
achievement fanfare, etc.) is generated live with the WebAudio API in
`js/sound.js` — oscillators and short noise bursts, not `.mp3`/`.wav`
files. This eliminates the "missing asset" risk entirely, keeps the
bundle tiny, and means there's nothing to forget to upload.

### No bitmap sprite images

Every character/object on screen — the snake, the dino, ghosts, the
Mario-clone hero, enemies, the boss fighters, etc. — is drawn
procedurally with Canvas primitives (`fillRect`, `arc`, `roundRect`, simple
paths), with `ctx.imageSmoothingEnabled = false` for crisp pixel-art
edges. This was a deliberate choice to guarantee **zero broken-image
risk** while still hitting the brief's "pixel-art style" requirement, and
it keeps the total project size at a few hundred KB rather than several
megabytes of sprite sheets.

### Single localStorage key

All persistence lives in **one** key, `retroplay_save_v1`, as a single
JSON blob (see `js/storage.js`). This keeps the storage footprint small,
makes the Profile screen's Export/Import-as-file backup feature a single
round trip, and avoids ever having to reconcile multiple keys getting out
of sync.

---

## 3. Feature-by-feature notes

### Authentication → Player Name / Guest

Replaced Google OAuth + JWT with a simple modal: type a name, or tap
"Continue as Guest." No email, no password, no server round trip —
`RP.Storage.setPlayer()` writes straight to `localStorage`.

### Leaderboard — honestly local

There is no backend, so there is no way to show real scores from real
players on other devices. Rather than fake a "live" leaderboard, the UI
in `#/leaderboard` explicitly tells the player this is a **local,
on-device leaderboard**: a deterministic set of sample competitor scores
(seeded per-save, so they don't reshuffle on every visit) merged with the
player's own real, locally-saved scores. See the header comment in
`js/leaderboard.js` for the full reasoning.

### Referral codes — honestly per-browser

Each player gets a generated code (`RP-XXXXX`). Redeeming a friend's code
in your own browser grants a one-time bonus — validated for format and
self-referral, but (since there's no server/registry) not validated
against a real database of issued codes. This still works exactly as
described to the player: if a friend manually enters your code on their
own RetroPlay, they get the bonus. The FAQ copy on the landing page was
worded to reflect this honestly rather than implying server-side fraud
detection that doesn't exist.

### Cheats — 9 total, not 21

The original landing page copy advertised "21 unlockable cheats" and "8
achievements." The actually-implemented set is **9 cheats** and **16
achievements** (see `js/data.js`). Every mention of these numbers across
the landing page (hero stat box, feature list, stats banner) was updated
to match what's really in the product, rather than leaving a claim the
app can't back up. The 9 cheats:

| Cheat | Cost | Applies to |
|---|---|---|
| God Mode | 500 pts | Dino, Mario, Boss, Invaders, Pac-Man |
| Fly Mode | 700 pts | Mario, Dino |
| Infinite Jump | 300 pts | Mario, Dino |
| Infinite Lives | 400 pts | Mario, Pac-Man, Breakout, Invaders, Boss |
| Magnet Food | 250 pts | Snake |
| Double Speed | 200 pts | Snake, Dino, Flappy, Breakout, Invaders, Tetris |
| Invincible | 350 pts | Snake, Breakout, Flappy |
| Score x2 | 600 pts | All 9 games |
| Slow-Mo | 300 pts | Dino, Flappy, Breakout, Invaders, Pac-Man |

### Beat The Boss — optional blood effects

Per the brief, blood-style hit effects are **off by default** for general
audience friendliness. A "Blood effects" checkbox appears in the
pre-game cheat bar for this game only; when off, hits show neutral
white/gold spark particles instead of red ones. The setting persists in
`localStorage` (`settings.bloodEffects`).

### Pac-Man maze — original layout

The maze is **not** a reproduction of the classic copyrighted arcade
maze. It's a custom layout built from an outer-loop corridor (the
outermost ring is fully open, guaranteeing every region is reachable by
construction) plus a regular grid of small interior pillar obstacles and
a center ghost house. See the header comment in `games/pacman.js`.

### Mario clone — original level generation

Levels are procedurally generated per level number using a seeded random
number generator (platforms, pits, coins, enemies, flagpole placement),
with an original pixel-block hero design — not a reproduction of any
copyrighted character, level layout, or art.

---

## 4. Asset list

RetroPlay intentionally ships with almost no binary assets, by design
(see §2 above for why). Everything visual is either vector (inline SVG)
or drawn procedurally on `<canvas>` at runtime; everything audible is
synthesized at runtime.

| Asset | Type | Location | Notes |
|---|---|---|---|
| Favicon | SVG (hand-coded pixel-art) | `assets/favicon.svg` | No external icon library/CDN |
| Hero illustration (arcade cabinet, coin, heart, trophy) | Inline SVG | `index.html` (hero section) | Carried over from the original landing page |
| Nav chevrons | Inline SVG | `index.html` (nav links) | Carried over from the original landing page |
| Spin wheel | SVG, generated at runtime | `js/app.js` `drawWheel()` | Built from `RP.DailySpin.SEGMENTS`, not a static image |
| All game graphics (snake, dino, ghosts, Mario-clone hero, bricks, tetrominoes, invaders, fighters, etc.) | Procedural Canvas drawing | `games/*.js` | No image files; see §2 |
| All sound effects | WebAudio synthesis | `js/sound.js` | No audio files; see §2 |
| Fonts | System font stack only | `css/style.css` `:root` (`--mono` etc.) | No Google Fonts/CDN — avoids FOIT and external network dependency |

**Total project size: ~280 KB** across 27 files (well under the 40MB
budget) — confirmed via `du -sh` on the final build directory.

There is intentionally no `assets/audio/` or `assets/images/sprites/`
content shipped — those folders were considered and deliberately left
out rather than populated with placeholder files, to avoid implying
assets exist that the code doesn't actually load.

---

## 5. Testing performed

This sandbox has no internet access, so automated tools like Lighthouse
or a full cross-browser device lab weren't available. What **was**
verified, using a headless Chromium instance (Playwright, already present
in this environment) driving the actual built files:

- **`file://` protocol test** — opened `index.html` directly via
  `file:///.../index.html` (true double-click simulation, no server) and
  confirmed: the landing page renders, sign-in works, the hub renders,
  and a game (Tetris) loads and runs — zero console errors, zero
  failed requests.
- **All 9 games load and render a canvas** when navigated to directly.
- **Full game-over pipeline**, tested end-to-end on Chrome Dino played to
  a real, organic game over (no scripted death — just let the autorunner
  hit an obstacle): score recorded, new-personal-best banner shown,
  points awarded and added to the header total, the "First Blood"
  achievement unlocked and its toast appeared, all matching what the UI
  promised.
- **Cheat purchase + activation**, tested end-to-end: bought a cheat in
  the Cheat Shop, confirmed it appeared as an active toggle chip in that
  game's player screen, toggled it on, confirmed the active-state class
  applied.
- **Touch controls**, tested with real touch-device emulation (iPhone 13
  profile: `hasTouch: true`, coarse pointer, no hover) — the on-screen
  D-pad and action buttons correctly appear (they're hidden on
  mouse/trackpad devices via a `(hover: none) and (pointer: coarse)`
  media query).
- **Every screen** — Hub, Cheat Shop, Leaderboard (all tabs), Achievements,
  Rewards (including the live spin wheel SVG and referral code box), and
  Profile (including the Export Save flow) — rendered with zero console
  errors across the whole session.
- **Static reference integrity** — every `href`/`src` referenced from
  `index.html` (42 references: stylesheets, scripts, the favicon) was
  confirmed to resolve to a real file on disk; none missing.
- **JS syntax** — every one of the 19 JavaScript files (`js/*.js` +
  `games/*.js`) passes `node --check` with zero syntax errors.
- **HTML structural sanity** — tag-balance check across `index.html`
  confirms matching open/close counts for every structural tag
  (`<div>`, `<section>`, `<header>`, `<footer>`, `<nav>`, `<script>`).

### Known limitations (by design, documented honestly in-product)

- The **leaderboard** is local/simulated, not a real multiplayer
  leaderboard — clearly labeled as such in the UI (see §3).
- **Save data does not sync** across browsers/devices — there's no
  backend to sync through. The Export/Import Save feature on the Profile
  screen is the supported way to move progress manually.
- **Performance claims are design targets**, not independently
  benchmarked against Lighthouse or real mobile hardware, since this
  sandbox has no network access to install such tooling. Every game runs
  a lightweight, fixed-step `requestAnimationFrame` loop with simple
  Canvas 2D drawing (no WebGL, no large sprite blits), which is the same
  general approach used by lightweight production HTML5 arcade games —
  treat "smooth on low-end devices" as a target met by architecture
  choice, not a number that was directly measured.
