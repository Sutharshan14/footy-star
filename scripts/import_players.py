#!/usr/bin/env python3
"""Import VFL/AFL player data from CSVs into data/players.json.

Usage:
    python scripts/import_players.py <PATH_TO_DATASET_ROOT>

The dataset root is expected to contain data/players/ with paired CSVs:
    {lastname}_{firstname}_{birthdate}_personal_details.csv
    {lastname}_{firstname}_{birthdate}_performance_details.csv
"""

import argparse
import csv
import json
import re
import sys
from collections import Counter
from datetime import date, datetime
from pathlib import Path
from typing import Optional

# Map raw Team strings (historic + variants) -> current 18-team Player schema name.
# Extend this if a first run reports unmapped teams.
TEAM_MAP = {
    'Adelaide': 'Adelaide',
    'Adelaide Crows': 'Adelaide',
    'Brisbane': 'Brisbane',
    'Brisbane Lions': 'Brisbane',
    'Brisbane Bears': 'Brisbane',
    'Carlton': 'Carlton',
    'Collingwood': 'Collingwood',
    'Essendon': 'Essendon',
    'Fitzroy': 'Brisbane',
    'Footscray': 'Western Bulldogs',
    'Fremantle': 'Fremantle',
    'Geelong': 'Geelong',
    'Gold Coast': 'Gold Coast',
    'Greater Western Sydney': 'GWS',
    'GWS': 'GWS',
    'GWS Giants': 'GWS',
    'Hawthorn': 'Hawthorn',
    'Kangaroos': 'North Melbourne',
    'Melbourne': 'Melbourne',
    'North Melbourne': 'North Melbourne',
    'Port Adelaide': 'Port Adelaide',
    'Richmond': 'Richmond',
    'St Kilda': 'St Kilda',
    'St. Kilda': 'St Kilda',
    'South Melbourne': 'Sydney',
    'Sydney': 'Sydney',
    'Sydney Swans': 'Sydney',
    'West Coast': 'West Coast',
    'West Coast Eagles': 'West Coast',
    'Western Bulldogs': 'Western Bulldogs',
}

ACTIVE_YEAR = 2025  # latest_year >= ACTIVE_YEAR -> finalYear=null, active=true
TODAY = date.today()


def slugify(s: str) -> str:
    s = s.lower()
    s = re.sub(r"[^a-z0-9]+", '-', s)
    return s.strip('-')


def parse_date(s: str) -> Optional[date]:
    if not s:
        return None
    s = s.strip()
    if not s:
        return None
    for fmt in ('%Y-%m-%d', '%d/%m/%Y', '%d-%m-%Y', '%Y/%m/%d', '%m/%d/%Y'):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def calc_age(born: Optional[date]) -> Optional[int]:
    if not born:
        return None
    age = TODAY.year - born.year
    if (TODAY.month, TODAY.day) < (born.month, born.day):
        age -= 1
    return age


def to_int(s) -> Optional[int]:
    if s is None:
        return None
    s = str(s).strip()
    if not s:
        return None
    try:
        return int(float(s))
    except ValueError:
        return None


def read_personal(path: Path) -> dict:
    with path.open('r', encoding='utf-8-sig', newline='') as f:
        return next(csv.DictReader(f), {}) or {}


def read_performance(path: Path) -> list[dict]:
    with path.open('r', encoding='utf-8-sig', newline='') as f:
        return list(csv.DictReader(f))


def build_player(
    personal_path: Path,
    performance_path: Path,
    unmapped_teams: Counter,
) -> Optional[dict]:
    personal = read_personal(personal_path)
    if not personal:
        return None

    first_name = (personal.get('first_name') or '').strip()
    last_name = (personal.get('last_name') or '').strip()
    if not first_name or not last_name:
        return None

    born = parse_date(personal.get('born_date') or '')
    debut = parse_date(personal.get('debut_date') or '')
    height = to_int(personal.get('height'))

    perf_rows = read_performance(performance_path)
    if not perf_rows:
        return None

    years = [y for y in (to_int(r.get('year')) for r in perf_rows) if y is not None]
    if not years:
        return None
    latest_year = max(years)

    # Debut year: prefer Debut Date, fall back to earliest performance year.
    debut_year = debut.year if debut else min(years)
    if debut_year < 1970:
        return None

    games_played = len(perf_rows)
    is_active = latest_year >= ACTIVE_YEAR
    final_year = None if is_active else latest_year

    # Filter: 50+ games OR still active.
    if games_played < 50 and not is_active:
        return None

    # Most common Jersey Num in most recent season.
    last_season_rows = [r for r in perf_rows if to_int(r.get('year')) == latest_year]
    jersey_counter = Counter(
        n for n in (to_int(r.get('jersey_num')) for r in last_season_rows)
        if n is not None
    )
    jumper_number = jersey_counter.most_common(1)[0][0] if jersey_counter else None

    # Most recent team: last non-empty team in latest season.
    raw_team = None
    for r in reversed(last_season_rows):
        t = (r.get('team') or '').strip()
        if t:
            raw_team = t
            break
    team = TEAM_MAP.get(raw_team) if raw_team else None
    if not team:
        if raw_team:
            unmapped_teams[raw_team] += 1
        return None

    return {
        'id': f'{slugify(first_name)}-{slugify(last_name)}',
        'firstName': first_name,
        'lastName': last_name,
        'nicknames': [],
        'team': team,
        'position': None,
        'age': calc_age(born),
        'heightCm': height,
        'gamesPlayed': games_played,
        'jumperNumber': jumper_number,
        'draftPick': None,
        'state': None,
        'debutYear': debut_year,
        'finalYear': final_year,
        'active': is_active,
        '_birthYear': born.year if born else None,
    }


def resolve_duplicate_ids(players: list[dict]) -> None:
    counts = Counter(p['id'] for p in players)
    for p in players:
        if counts[p['id']] > 1 and p.get('_birthYear') is not None:
            p['id'] = f"{p['id']}-{p['_birthYear']}"
    # Re-check: if still colliding (same name AND same birth year), append index.
    counts = Counter(p['id'] for p in players)
    seen: dict[str, int] = {}
    for p in players:
        if counts[p['id']] > 1:
            seen[p['id']] = seen.get(p['id'], 0) + 1
            p['id'] = f"{p['id']}-{seen[p['id']]}"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path,
                        help='Path to dataset root (containing data/players/) OR '
                             'the players/ directory directly')
    parser.add_argument('--out', type=Path,
                        default=Path(__file__).resolve().parent.parent / 'data' / 'players.json',
                        help='Output JSON path (default: data/players.json)')
    args = parser.parse_args()

    candidate = args.source / 'data' / 'players'
    if candidate.is_dir():
        players_dir = candidate
    elif args.source.is_dir():
        players_dir = args.source
    else:
        print(f'ERROR: {args.source} is not a directory', file=sys.stderr)
        return 1

    pairs: dict[str, dict[str, Path]] = {}
    for csv_path in players_dir.glob('*.csv'):
        name = csv_path.name
        if name.endswith('_personal_details.csv'):
            key = name[:-len('_personal_details.csv')]
            pairs.setdefault(key, {})['personal'] = csv_path
        elif name.endswith('_performance_details.csv'):
            key = name[:-len('_performance_details.csv')]
            pairs.setdefault(key, {})['performance'] = csv_path

    print(f'Found {len(pairs)} player key(s) in {players_dir}', file=sys.stderr)

    players: list[dict] = []
    skipped_missing_pair = 0
    skipped_filtered = 0
    errors = 0
    unmapped_teams: Counter = Counter()

    for key, files in pairs.items():
        if 'personal' not in files or 'performance' not in files:
            skipped_missing_pair += 1
            continue
        try:
            p = build_player(files['personal'], files['performance'], unmapped_teams)
        except Exception as e:
            print(f'  error on {key}: {e}', file=sys.stderr)
            errors += 1
            continue
        if p is None:
            skipped_filtered += 1
        else:
            players.append(p)

    resolve_duplicate_ids(players)
    for p in players:
        p.pop('_birthYear', None)
    players.sort(key=lambda p: (p['lastName'].lower(), p['firstName'].lower()))

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open('w', encoding='utf-8') as f:
        json.dump(players, f, indent=2, ensure_ascii=False)
        f.write('\n')

    # ---- Summary ----
    print()
    print(f'Wrote {len(players)} players -> {args.out}')
    print(f'Skipped (missing CSV pair):   {skipped_missing_pair}')
    print(f'Skipped (failed filters):     {skipped_filtered}')
    print(f'Errors:                       {errors}')

    if unmapped_teams:
        print('\nUnmapped team strings (extend TEAM_MAP and re-run):')
        for t, n in unmapped_teams.most_common():
            print(f'  {t!r}: {n}')

    decade_counts = Counter((p['debutYear'] // 10) * 10 for p in players)
    print('\nBy debut decade:')
    for decade in sorted(decade_counts):
        print(f'  {decade}s: {decade_counts[decade]}')

    active = [p for p in players if p['active']]
    team_counts = Counter(p['team'] for p in active)
    print(f'\nActive players by team ({len(active)} total):')
    for team in sorted(team_counts):
        print(f'  {team}: {team_counts[team]}')

    return 0


if __name__ == '__main__':
    raise SystemExit(main())
