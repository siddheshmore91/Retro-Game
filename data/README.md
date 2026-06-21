# data/ — reference-only JSON mirrors

`games.json` and `cheats.json` in this folder are **human-readable mirrors**
of the catalog data, generated from `js/data.js`. They are provided purely
for convenience (e.g. quickly scanning/editing values in a spreadsheet-like
tool) and are **not loaded by the app at runtime**.

## Why the app doesn't `fetch()` these files

RetroPlay's #1 requirement is that it must run by double-clicking
`index.html` — no local server, no build step. Chrome, Edge, and most
other browsers block `fetch()` / `XMLHttpRequest` against `file://` URLs
for security reasons (CORS), so loading data via `fetch('data/games.json')`
would throw a console error and silently break the site for anyone who
just opens the file directly.

To guarantee the site works offline with zero setup, the real catalog data
lives as plain JavaScript objects directly inside `js/data.js`
(`RP.Data.GAMES` / `RP.Data.CHEATS` / `RP.Data.ACHIEVEMENTS`), which is
simply parsed as part of loading the script — no network request involved.

## If you want a single source of truth

If you deploy RetroPlay on a real web server (see `DEPLOYMENT.md`), `file://`
restrictions no longer apply, and you're welcome to refactor `js/data.js`
to `fetch()` these JSON files instead, so you only have to edit catalog
data in one place. That refactor is intentionally **not** done by default,
since it would break the "just open index.html" requirement for anyone
running RetroPlay locally or offline.

**Until then: always edit `js/data.js` first, and update these JSON files
to match if you want them to stay accurate.**
