#!/usr/bin/env python3
"""Backfill historical Faceit matches into the Leetify archives.

Leetify's listing endpoint only returns the last 100 matches, but its lookup
endpoint (/v2/matches/faceit/{matchId}) serves any match it ever processed.
The Faceit Data API can enumerate a player's complete match history, so this
walks that history and pulls every match Leetify knows about.

Requires FACEIT_API_KEY (from https://developers.faceit.com) and optionally
LEETIFY_API_KEY in the environment. Safe to re-run: already-archived matches
are skipped. Run for every player in players.json, or one via --steam64-id.
"""
import argparse
import glob
import json
import os
import sys
import time
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch_leetify import (  # noqa: E402
    DATA_DIR,
    DETAILS_DIR,
    PLAYERS_PATH,
    api_get,
    build_record,
    load_json,
    save_json,
)

FACEIT_BASE = "https://open.faceit.com/data/v4"
FACEIT_KEY = os.environ.get("FACEIT_API_KEY", "")
LEETIFY_REQUEST_DELAY_S = 0.5


def faceit_get(path, retries=4):
    delay = 2
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(
                FACEIT_BASE + path,
                headers={"Authorization": "Bearer " + FACEIT_KEY},
            )
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


def faceit_player_id(steam64_id):
    for game in ("cs2", "csgo"):
        try:
            player = faceit_get(f"/players?game={game}&game_player_id={steam64_id}")
            return player["player_id"]
        except urllib.error.HTTPError as e:
            if e.code != 404:
                raise
    return None


def faceit_history_ids(player_id):
    """All Faceit match ids for a player, newest first, across cs2 and csgo.

    Paginates backwards with a `to` timestamp cursor to avoid the history
    endpoint's offset cap.
    """
    ids = []
    seen = set()
    for game in ("cs2", "csgo"):
        cursor = int(time.time())
        while True:
            page = faceit_get(
                f"/players/{player_id}/history?game={game}"
                f"&from=0&to={cursor}&offset=0&limit=100"
            )
            items = page.get("items", [])
            fresh = [i for i in items if i["match_id"] not in seen]
            if not fresh:
                break
            for item in fresh:
                seen.add(item["match_id"])
                ids.append(item["match_id"])
            cursor = min(i["started_at"] for i in items) - 1
    return ids


def known_faceit_ids():
    """Faceit ids already covered by archived match details."""
    known = set()
    for path in glob.glob(os.path.join(DETAILS_DIR, "*.json")):
        d = load_json(path, {})
        if d.get("data_source") == "faceit" and d.get("data_source_match_id"):
            known.add(d["data_source_match_id"])
    return known


def backfill_player(entry, known):
    steam_id = entry["steam64_id"]
    name = entry.get("name") or steam_id
    pdir = os.path.normpath(os.path.join(DATA_DIR, entry.get("path", ".")))
    matches_path = os.path.join(pdir, "matches.json")

    player_id = faceit_player_id(steam_id)
    if player_id is None:
        print(f"{name}: no Faceit account found, skipping")
        return

    history = faceit_history_ids(player_id)
    archive = load_json(matches_path, [])
    archived_ids = {m["id"] for m in archive}
    todo = [mid for mid in history if mid not in known]
    print(f"{name}: {len(history)} faceit matches in history, {len(todo)} to look up")

    added = missing = failed = 0
    for i, mid in enumerate(todo, 1):
        try:
            detail = api_get("/v2/matches/faceit/" + mid)
        except urllib.error.HTTPError as e:
            if e.code == 404:
                missing += 1
            else:
                # some historical matches persistently error on Leetify's side
                print(f"  lookup failed for {mid}: HTTP {e.code}, skipping")
                failed += 1
            continue
        finally:
            time.sleep(LEETIFY_REQUEST_DELAY_S)
        known.add(mid)
        detail_path = os.path.join(DETAILS_DIR, detail["id"] + ".json")
        if not os.path.exists(detail_path):
            save_json(detail_path, detail)
        if detail["id"] in archived_ids:
            continue
        record = build_record(steam_id, detail, detail)
        if record is None:
            continue
        archive.append(record)
        archived_ids.add(detail["id"])
        added += 1
        if i % 50 == 0:
            archive.sort(key=lambda m: m["finished_at"])
            save_json(matches_path, archive)
            print(f"  {name}: {i}/{len(todo)} looked up, {added} added so far")

    # matches another tracked player already pulled details for still need a record here
    for mid in history:
        detail = find_detail_by_source_id(mid)
        if detail and detail["id"] not in archived_ids:
            record = build_record(steam_id, detail, detail)
            if record:
                archive.append(record)
                archived_ids.add(detail["id"])
                added += 1

    archive.sort(key=lambda m: m["finished_at"])
    save_json(matches_path, archive)
    print(f"{name}: +{added} matches (archive now {len(archive)}), "
          f"{missing} not in Leetify, {failed} lookup failures")


_DETAIL_INDEX = None


def find_detail_by_source_id(source_id):
    global _DETAIL_INDEX
    if _DETAIL_INDEX is None:
        _DETAIL_INDEX = {}
        for path in glob.glob(os.path.join(DETAILS_DIR, "*.json")):
            d = load_json(path, {})
            if d.get("data_source_match_id"):
                _DETAIL_INDEX[d["data_source_match_id"]] = d
    return _DETAIL_INDEX.get(source_id)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--steam64-id", help="backfill only this player")
    args = parser.parse_args()
    if not FACEIT_KEY:
        sys.exit("FACEIT_API_KEY is required")

    players = load_json(PLAYERS_PATH, [])
    players = [p for p in players if not p.get("unavailable")]
    if args.steam64_id:
        players = [p for p in players if p["steam64_id"] == args.steam64_id]
    if not players:
        sys.exit("no matching players in players.json")

    known = known_faceit_ids()
    for entry in players:
        backfill_player(entry, known)
        _reset_index()


def _reset_index():
    global _DETAIL_INDEX
    _DETAIL_INDEX = None


if __name__ == "__main__":
    main()
