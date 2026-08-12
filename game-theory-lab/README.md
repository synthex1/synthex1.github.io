# Game Theory Lab

Self-hosted web app: decision-tree EV rollback with one-way sensitivity
analysis, a two-player Nash equilibrium solver, named scenarios persisted
in localStorage, and AI scenario drafting through a key-protected
serverless proxy. Deployable on Vercel's free tier; installable on iOS
via Add to Home Screen (full-screen, standalone).

## Layout

- `public/` — the static frontend (single-file `index.html` with React
  bundled and fonts embedded as data URIs), web app manifest, and icons.
- `api/draft.js` — Vercel serverless function. Reads `ANTHROPIC_API_KEY`
  and `DRAFT_PASSPHRASE` from environment variables, checks the
  passphrase (timing-safe), and proxies drafting requests to the
  Anthropic Messages API (`claude-sonnet-4-6`, `max_tokens` 2000). The
  drafting prompt (with a ~12-node tree cap) lives here, server-side.
- `src/` — app source (`app.jsx`, `entry.jsx`) and build scripts.
- `vercel.json` — raises the function timeout to 60 s.

The frontend never sees the API key. The passphrase is asked for once,
kept in localStorage, and cleared automatically if the server rejects it.

## Deploy

1. Import this repository in Vercel; set **Root Directory** to
   `game-theory-lab`.
2. In Project Settings → Environment Variables add:
   - `ANTHROPIC_API_KEY` — your Anthropic API key
   - `DRAFT_PASSPHRASE` — a passphrase of your choosing
3. Deploy. No build command is needed — `public/` is served as-is and
   `api/` becomes a serverless function.

## Rebuild the frontend after editing `src/app.jsx`

```sh
npm install
npm run build:app   # bundles src/entry.jsx and rewrites public/index.html
```

`src/mkfonts.mjs` regenerates `src/fonts-inline.css` from Google Fonts;
`src/mkicons.mjs` re-renders the PNG icons from `src/icon.html`.
