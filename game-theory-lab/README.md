# Game Theory Lab

Single-file web app: decision-tree EV rollback with one-way sensitivity
analysis, and a two-player Nash equilibrium solver, with named scenarios
and an AI scenario-drafting box.

- `app.jsx` — the React component (ported from the claude.ai artifact;
  the Google Fonts `@import` was removed in favor of embedded fonts, and
  the AI draft call falls back to `window.claude.complete` when the
  Anthropic API fetch is unavailable).
- `entry.jsx` — mount point plus a `window.storage` shim backed by
  localStorage, with an in-memory fallback when storage is blocked.
- `mkfonts.mjs` — downloads Space Grotesk / IBM Plex Mono (latin subset)
  and inlines them as data-URI `@font-face` rules into `fonts-inline.css`.
- `mkhtml.mjs` — assembles the final self-contained `game-theory-lab.html`.
- `game-theory-lab.html` — the built single-file app.

Build:

```sh
npm i react@18 react-dom@18 esbuild
node mkfonts.mjs   # needs fonts.css from Google Fonts (see script)
npx esbuild entry.jsx --bundle --minify --jsx=automatic \
  --define:process.env.NODE_ENV='"production"' --outfile=bundle.js
node mkhtml.mjs
```
