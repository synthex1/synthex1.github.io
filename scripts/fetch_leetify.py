#!/usr/bin/env python3
"""Sync CS2 match data from the Leetify public API into cs2/data/.

Stdlib only. Reads LEETIFY_API_KEY (optional) from the environment.
Safe to re-run: matches are deduped by id, profile snapshots by UTC date.

Players are configured in cs2/data/players.json:
  [{"steam64_id": "...", "name": "...", "path": "."}, ...]
`path` is relative to cs2/data/ and holds that player's matches.json and
profile_history.json. Names are refreshed from the API on each sync. A player
whose Leetify privacy settings block the public API is skipped with a note.

Outputs per player:
  <path>/matches.json          - enriched per-match records, oldest first
  <path>/profile_history.json  - daily snapshots of ranks/ratings
Shared:
  cs2/data/match_details/<id>.json - raw full-lobby match details
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request

API_BASE = "https://api-public.cs-prod.leetify.com"
API_KEY = os.environ.get("LEETIFY_API_KEY", "")
MAIN_STEAM64_ID = os.environ.get("STEAM64_ID", "76561198060924319")

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(REPO_ROOT, "cs2", "data")
DETAILS_DIR = os.path.join(DATA_DIR, "match_details")
PLAYERS_PATH = os.path.join(DATA_DIR, "players.json")

DETAIL_REQUEST_DELAY_S = 0.5


def api_get(path, retries=4):
    url = API_BASE + path
    headers = {"User-Agent": "synthex1.github.io stats sync"}
    if API_KEY:
        headers["Authorization"] = "Bearer " + API_KEY
    delay = 2
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.load(resp)
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504) and attempt < retries:
                time.sleep(delay)
                delay *= 2
                continue
            raise
        except urllib.error.URLError:
            if attempt < retries:
                time.sleep(delay)
                delay *= 2
                continue
            raise


def load_json(path, default):
    try:
        with open(path) as f:
            return json.load(f)
    except FileNotFoundError:
        return default


def save_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=1, sort_keys=True)
        f.write("\n")


def mean(values):
    values = [v for v in values if isinstance(v, (int, float))]
    return round(sum(values) / len(values), 4) if values else None


def side_aggregate(players):
    return {
        "n": len(players),
        "avg_leetify_rating": mean([p.get("leetify_rating") for p in players]),
        "avg_preaim": mean([p.get("preaim") for p in players]),
        "avg_reaction_time": mean([p.get("reaction_time") for p in players]),
        "avg_counter_strafing_ratio": mean(
            [p.get("counter_strafing_shots_good_ratio") for p in players]
        ),
        "avg_accuracy_head": mean([p.get("accuracy_head") for p in players]),
        "avg_kd_ratio": mean([p.get("kd_ratio") for p in players]),
        "avg_dpr": mean([p.get("dpr") for p in players]),
    }


def build_record(steam_id, summary, detail):
    me = next(
        (s for s in detail.get("stats", []) if s.get("steam64_id") == steam_id),
        None,
    )
    if me is None:
        me = next(
            (s for s in summary.get("stats", []) if s.get("steam64_id") == steam_id),
            None,
        )
    if me is None:
        return None

    my_team = me.get("initial_team_number")
    scores = {t["team_number"]: t["score"] for t in summary.get("team_scores", [])}
    my_score = scores.get(my_team)
    opp_score = next((s for t, s in scores.items() if t != my_team), None)
    if my_score is None or opp_score is None:
        outcome = None
    elif my_score > opp_score:
        outcome = "win"
    elif my_score < opp_score:
        outcome = "loss"
    else:
        outcome = "tie"

    lobby = None
    if detail.get("stats"):
        teammates = [
            p
            for p in detail["stats"]
            if p.get("initial_team_number") == my_team
            and p.get("steam64_id") != steam_id
        ]
        opponents = [
            p for p in detail["stats"] if p.get("initial_team_number") != my_team
        ]
        lobby = {
            "teammates": side_aggregate(teammates),
            "opponents": side_aggregate(opponents),
        }

    return {
        "id": summary["id"],
        "finished_at": summary["finished_at"],
        "data_source": summary.get("data_source"),
        "data_source_match_id": summary.get("data_source_match_id"),
        "map_name": summary.get("map_name"),
        "has_banned_player": summary.get("has_banned_player"),
        "score": [my_score, opp_score],
        "outcome": outcome,
        "me": me,
        "lobby": lobby,
    }


def get_match_detail(match_id):
    detail_path = os.path.join(DETAILS_DIR, match_id + ".json")
    detail = load_json(detail_path, None)
    if detail is not None:
        return detail
    try:
        detail = api_get("/v2/matches/" + match_id)
    except urllib.error.HTTPError as e:
        print(f"  detail fetch failed for {match_id}: HTTP {e.code}")
        return {}
    time.sleep(DETAIL_REQUEST_DELAY_S)
    if detail:
        save_json(detail_path, detail)
    return detail


def sync_matches(steam_id, matches_path):
    archive = load_json(matches_path, [])
    known_ids = {m["id"] for m in archive}
    summaries = api_get(f"/v3/profile/matches?steam64_id={steam_id}")
    new_matches = [m for m in summaries if m["id"] not in known_ids]
    print(f"  {len(summaries)} matches in API window, {len(new_matches)} new")

    added = 0
    for summary in new_matches:
        detail = get_match_detail(summary["id"])
        record = build_record(steam_id, summary, detail)
        if record is None:
            print(f"  skipping {summary['id']}: player stats not present")
            continue
        archive.append(record)
        added += 1

    archive.sort(key=lambda m: m["finished_at"])
    save_json(matches_path, archive)
    print(f"  archive now has {len(archive)} matches ({added} added)")


def sync_profile(steam_id, history_path):
    profile = api_get(f"/v3/profile?steam64_id={steam_id}")
    snapshot = {
        "date": time.strftime("%Y-%m-%d", time.gmtime()),
        "name": profile.get("name"),
        "total_matches": profile.get("total_matches"),
        "winrate": profile.get("winrate"),
        "ranks": profile.get("ranks"),
        "rating": profile.get("rating"),
        "stats": profile.get("stats"),
    }
    history = load_json(history_path, [])
    history = [h for h in history if h.get("date") != snapshot["date"]]
    history.append(snapshot)
    history.sort(key=lambda h: h["date"])
    save_json(history_path, history)
    return profile


def sync_player(entry):
    steam_id = entry["steam64_id"]
    pdir = os.path.normpath(os.path.join(DATA_DIR, entry.get("path", ".")))
    print(f"syncing {entry.get('name') or steam_id}")
    try:
        profile = sync_profile(steam_id, os.path.join(pdir, "profile_history.json"))
        if profile.get("name"):
            entry["name"] = profile["name"]
        sync_matches(steam_id, os.path.join(pdir, "matches.json"))
        entry.pop("unavailable", None)
    except urllib.error.HTTPError as e:
        print(f"  unavailable (HTTP {e.code}) — private profile or unknown id, skipping")
        entry["unavailable"] = True


def main():
    if not API_KEY:
        print("note: LEETIFY_API_KEY not set, using unauthenticated rate limits")
    players = load_json(PLAYERS_PATH, None)
    if players is None:
        players = [{"steam64_id": MAIN_STEAM64_ID, "name": "", "path": "."}]
    for entry in players:
        sync_player(entry)
    save_json(PLAYERS_PATH, players)


if __name__ == "__main__":
    sys.exit(main())
