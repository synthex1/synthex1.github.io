# CS2 stats pipeline

Aggregates match data from the [Leetify public API](https://api-public-docs.cs-prod.leetify.com)
into a permanent archive, because the API only exposes the **last 100 matches** —
anything older ages out unless it's captured. A GitHub Action syncs daily; the
dashboard at [`/cs2/`](https://synthex1.github.io/cs2/) reads the archived JSON.

## Layout

- `scripts/fetch_leetify.py` — sync script (stdlib only). Dedupes matches by id,
  snapshots profile ratings by day, and enriches every new match with the full
  10-player lobby detail from `/v2/matches/{id}` so lobby strength can be
  analyzed later. Each side of the lobby is stored as raw counters (`sums`) plus
  the stats the API only exposes pre-averaged (`avgs`), so the dashboard can pool
  the two sides into whole-server rates and know each rate's sample size.
  `python3 scripts/fetch_leetify.py --rebuild` recomputes those aggregates for
  every archived match from the cached details, offline — run it after changing
  the aggregate shape instead of re-downloading the archive.
- `cs2/data/players.json` — the tracked players. Each entry is
  `{"steam64_id", "name", "path"}`; `path` is relative to `cs2/data/` and holds
  that player's archive. Add a teammate by appending an entry with path
  `players/<steam64_id>` — the next sync backfills them. Names refresh from the
  API automatically. Players whose Leetify privacy settings block the public
  API get flagged `"unavailable": true` and are skipped (and hidden from the
  dashboard's player switcher).
- `scripts/backfill_faceit.py` — one-off historical backfill. Enumerates a
  player's complete Faceit match history via the Faceit Data API and pulls every
  match Leetify processed through the `/v2/matches/faceit/{id}` lookup (which
  serves matches far older than the 100-match listing window). Needs
  `FACEIT_API_KEY` in the environment; safe to re-run. Note: the lookup endpoint
  answers 500 for matches Leetify never processed — the script treats those as
  "not found".
- `.github/workflows/leetify-sync.yml` — daily cron (09:17 UTC) + manual trigger.
- `cs2/data/matches.json` — enriched per-match records, oldest first (main
  player; teammates live under `cs2/data/players/<steam64_id>/`).
- `cs2/data/profile_history.json` — daily snapshots of ranks and skill ratings
  (the API has no history for these, so this builds the time series).
- `cs2/data/match_details/<id>.json` — raw full-lobby match details.
- `cs2/index.html` — the dashboard (plain HTML/SVG, no dependencies). Map, queue
  and Leetify marks are inline SVG drawn for this page, not official artwork.

## Players, parties and comparison

`cs2/data/players.json` is the tracked roster. Every archived match records a
`party` list: which *other* tracked players were on that player's team, read
off the full lobby detail. That drives the "Who you queue with" section (solo
vs grouped, party size, and each metric with versus without a given player) and
the "Queued with" filter, which re-slices the whole dashboard.

The dashboard's Compare view loads every roster archive at once and puts the
players side by side under the same date and queue filters, with an option to
restrict to lobbies more than one of them was in — the same games, so the
comparison is like for like.

Note the API only serves each player's **last 100 matches**, so a newly added
player starts at 100 and grows from there. `scripts/backfill_faceit.py` reaches
further back for Faceit matches, but needs `FACEIT_API_KEY`.

## Lobby quality

The dashboard scores how strong each server was, independently of whether the
match was won, and shows it as a 0–100 rank against that player's own matches
in view (50 is a typical lobby for them, not a fixed skill level). Three things
make it behave:

- **It reads all nine other players, not the enemy five.** Measured over this
  archive, enemy-only averages are mostly a restatement of the result — enemy
  Leetify rating correlates −0.81 with winning, enemy K/D −0.79, enemy trade
  conversion −0.36. Averaging the whole server drops those to near zero, because
  teammate numbers rise by roughly as much as enemy numbers fall.
- **Sixteen signals across three areas** — aim and mechanics, utility use and
  discipline, trade structure. Raw aim stats alone do not separate lobbies:
  preaim, spray accuracy and accuracy-vs-spotted all show a flat-to-negative
  relationship with a harder game, while utility thrown per round and trade
  density show the strongest ones. The "Does each signal earn its place?" panel
  reports that measurement instead of hiding it.
- **Corrected for how long the match ran.** Every signal is regressed against
  rounds played and pulled toward the average in proportion to how thin its
  sample was, so a fast 13–3 no longer reads as a weak lobby just because it
  produced less data.

Leetify rating is deliberately not an input: it is scored relative to the lobby,
so the other nine players always average to roughly the negation of your own
rating (r = −0.99 in this archive) and carry no information about the server.

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
