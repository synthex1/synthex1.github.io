# CS2 stats pipeline

Aggregates match data from the [Leetify public API](https://api-public-docs.cs-prod.leetify.com)
into a permanent archive, because the API only exposes the **last 100 matches** —
anything older ages out unless it's captured. A GitHub Action syncs daily; the
dashboard at [`/cs2/`](https://synthex1.github.io/cs2/) reads the archived JSON.

## Layout

- `scripts/fetch_leetify.py` — sync script (stdlib only). Dedupes matches by id,
  snapshots profile ratings by day, and enriches every new match with the full
  10-player lobby detail from `/v2/matches/{id}` so opponent strength can be
  analyzed later.
- `cs2/data/players.json` — the tracked players. Each entry is
  `{"steam64_id", "name", "path"}`; `path` is relative to `cs2/data/` and holds
  that player's archive. Add a teammate by appending an entry with path
  `players/<steam64_id>` — the next sync backfills them. Names refresh from the
  API automatically. Players whose Leetify privacy settings block the public
  API get flagged `"unavailable": true` and are skipped (and hidden from the
  dashboard's player switcher).
- `.github/workflows/leetify-sync.yml` — daily cron (09:17 UTC) + manual trigger.
- `cs2/data/matches.json` — enriched per-match records, oldest first (main
  player; teammates live under `cs2/data/players/<steam64_id>/`).
- `cs2/data/profile_history.json` — daily snapshots of ranks and skill ratings
  (the API has no history for these, so this builds the time series).
- `cs2/data/match_details/<id>.json` — raw full-lobby match details.
- `cs2/index.html` — the dashboard (plain HTML/SVG, no dependencies).

## Setup

1. Add the Leetify API key as a repository secret named `LEETIFY_API_KEY`
   (Settings → Secrets and variables → Actions → New repository secret).
   The key comes from [leetify.com/app/developer](https://leetify.com/app/developer).
   Without it the script still works but hits stricter rate limits.
2. That's it — the workflow commits new data to the default branch daily.

## Running locally

```sh
LEETIFY_API_KEY=<key> python3 scripts/fetch_leetify.py
python3 -m http.server -d .   # then open http://localhost:8000/cs2/
```
