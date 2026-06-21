# RetroPlay — Static Arcade Portal

A 100% static HTML/CSS/vanilla-JS rebuild of RetroPlay: 9 playable arcade
games, a points/cheats/achievements/leaderboard economy, and a daily spin
wheel — all running entirely in the browser with **no server, no build
step, no database, and no external dependencies.**

For the full engineering writeup (what changed from the original React
app and why), see **`PROJECT_REPORT.md`**.

---

## 1. Local usage guide (the simplest way to run it)

There is nothing to install and nothing to build.

1. Unzip the project anywhere on your computer.
2. Double-click **`index.html`**.
3. It opens in your default browser and just works — landing page,
   games, points, everything.

That's it. Tested directly via the `file://` protocol (i.e. literally
opening the file, not through a local server) in a Chromium-based
browser with zero console errors. All 9 games, the cheat shop, the
leaderboard, achievements, the daily spin wheel, and the profile/save
tools all work this way.

**Optional — running it through a tiny local server instead.** This is
not required, but if you prefer it (e.g. so relative paths behave
exactly like they will once deployed), any static file server works:

```bash
# Option A — Python (already installed on most systems)
cd RetroPlay
python3 -m http.server 8080
# then open http://localhost:8080

# Option B — Node (if you have npx available)
cd RetroPlay
npx serve .
```

### Where your progress is saved

Everything — your player name, points, owned cheats, achievements, high
scores, and login streak — is saved in **`localStorage`** under a single
key, `retroplay_save_v1`, scoped to whichever browser + origin you opened
the site from. That means:

- Progress persists across browser restarts and computer restarts.
- Progress does **not** sync between different browsers or devices —
  there's no backend to sync through (see `PROJECT_REPORT.md` for why).
- Opening `index.html` straight from disk (`file://...`) and opening it
  through a local server (`http://localhost:8080`) count as **different
  origins** to the browser, so they'll have *separate* save data. Pick
  one approach and stick with it for a given "save."
- Use the **Export Save** button on the Profile screen any time to
  download a `.json` backup, and **Import Save** to restore it (handy for
  moving progress to another browser/computer, or just backing it up).

### Browser support

Built and tested against current Chromium (Chrome/Edge). It uses only
standard HTML5 Canvas, WebAudio, and `localStorage` APIs, so it should
work unmodified in current Firefox and Safari as well — there's nothing
browser-specific in the code.

---

## 2. Deployment guide (hosting it for real)

Because RetroPlay is fully static, you can host it on **literally any**
static file host — there's no server-side code, environment variables,
or database to configure.

### Any static host (recommended)

Upload the contents of the `RetroPlay/` folder (keeping the folder
structure intact) to any of:

- **Netlify / Vercel / Cloudflare Pages** — drag-and-drop the folder, or
  connect a Git repo. No build command needed; the publish directory is
  the project root (where `index.html` lives).
- **GitHub Pages** — push the folder to a repo and enable Pages, pointing
  at the root (or `/docs` if you move it there).
- **Any plain web server** (Apache, Nginx, S3 + CloudFront, etc.) — just
  copy the files into the public web root. No special server config
  required; everything is a static file with a relative path.

There is no `.env`, no API keys, no database connection string — if it
serves static files over HTTP(S), it can host RetroPlay.

### A note on HTTPS

Browsers restrict some APIs (like WebAudio autoplay and clipboard
access) more strictly on plain HTTP. Every host listed above serves
HTTPS by default, so this isn't something you need to configure — just
worth knowing if you roll your own server.

---

## 3. WordPress installation guide (iframe embed)

RetroPlay is designed to drop into any WordPress site as an embedded
iframe — it doesn't need to be a WordPress plugin or theme integration.

### Steps

1. **Upload the files.** Using your hosting provider's file manager, FTP,
   or the WordPress Media/File manager plugin of your choice, upload the
   entire `RetroPlay/` folder into:

   ```
   wp-content/uploads/retroplay/
   ```

   so that `wp-content/uploads/retroplay/index.html` exists (along with
   its `css/`, `js/`, `games/`, etc. subfolders right next to it).

   > Most WordPress hosts block `.html` and `.js` uploads through the
   > built-in Media Library. Use SFTP/FTP, your host's File Manager, or a
   > plugin like **WP File Manager** instead — the built-in uploader is
   > only meant for media files.

2. **Create or edit a page/post** where you want the games to appear.

3. **Add a Custom HTML block** (Gutenberg) or a "Text" widget (Classic
   Editor) and paste:

   ```html
   <iframe
     src="/wp-content/uploads/retroplay/index.html"
     style="width:100%; height:900px; border:0; border-radius:12px;"
     loading="lazy"
     title="RetroPlay Arcade">
   </iframe>
   ```

   Adjust `height` to taste — 900px comfortably fits the hub and most
   in-game canvases without internal scrolling on a typical desktop
   viewport. On mobile, consider a slightly taller value (or a responsive
   height via a wrapper `<div>` with `aspect-ratio` CSS) since the touch
   controls overlay the canvas.

4. **Publish the page.** RetroPlay loads inside the iframe completely
   independently of WordPress — no shared cookies, no shared login, no
   WordPress JS/CSS conflicts, because everything is sandboxed inside
   the iframe's own document.

### Why an iframe (and not a deeper WordPress integration)

- **Zero conflict risk.** WordPress themes and plugins often load jQuery,
  global CSS resets, or other scripts that can silently break a
  hand-rolled JS app if it's embedded directly into the page DOM. An
  iframe keeps RetroPlay's CSS/JS completely isolated.
- **No PHP/plugin development needed.** You don't need to package this as
  a WordPress plugin, register shortcodes, or touch `functions.php` —
  just upload static files and paste one iframe tag.
- **localStorage still works.** Because the iframe's `src` is same-origin
  with the rest of your WordPress site (same domain, just a different
  path), `localStorage` works normally inside it — no third-party-cookie
  restrictions to worry about.

### Optional: a dedicated `/play/` URL instead of an iframe

If you'd rather have RetroPlay live at its own clean URL (e.g.
`yoursite.com/play/`) instead of embedded in a page, just upload the
folder to `wp-content/retroplay/` (or anywhere in your web root your host
allows direct static serving from) and set up a redirect or rewrite rule
pointing `/play/` at `index.html` there. This is optional — the iframe
approach above is simpler and works on virtually any WordPress host
without server config access.

---

## 4. Project structure

```
RetroPlay/
├── index.html              ← open this file to run everything
├── manifest.json
├── css/
│   ├── style.css            ← landing page + app shell (buttons, modals, cards, etc.)
│   └── games.css            ← canvas scaling, touch controls, in-game HUD/overlay
├── js/
│   ├── storage.js           ← all localStorage persistence (single source of truth)
│   ├── data.js               ← games/cheats/achievements catalog data
│   ├── sound.js               ← WebAudio-synthesized sound effects (no audio files)
│   ├── particles.js          ← shared particle effects system
│   ├── engine.js              ← canvas/input/touch/game-loop helpers + game registry
│   ├── achievements.js       ← achievement unlock rules engine
│   ├── leaderboard.js        ← local/seeded leaderboard generation
│   ├── cheats.js               ← cheat shop business logic
│   ├── dailyspin.js            ← daily spin wheel logic
│   └── app.js                   ← the SPA itself (routing, all screens)
├── games/                    ← one file per game, each self-contained
│   ├── snake.js, dino.js, flappy.js, mario.js, pacman.js,
│   └── breakout.js, tetris.js, invaders.js, boss.js
├── data/                     ← human-readable JSON mirrors (reference only — see data/README.md)
├── assets/
│   └── favicon.svg
├── PROJECT_REPORT.md         ← migration/analysis report + asset list + QA notes
└── README.md                 ← this file
```

## 5. Quick FAQ

**Q: Why no `npm install` / build step?**
A: The brief required the finished site to run by simply opening
`index.html`, with no Node/React/build tooling at all. Everything here is
plain ES5-compatible JavaScript, loaded via `<script>` tags in dependency
order — no bundler needed.

**Q: Can I edit the games/cheats/achievements?**
A: Yes — edit `js/data.js`. It's the single source of truth (see the
comment at the top of that file for why it isn't loaded from JSON via
`fetch()`).

**Q: Is the leaderboard real?**
A: It's clearly labeled in the UI as a local/on-device leaderboard. Since
this is a static site with no backend, there's no way to show real scores
from other real players on other devices — see `PROJECT_REPORT.md` for
the full reasoning.
