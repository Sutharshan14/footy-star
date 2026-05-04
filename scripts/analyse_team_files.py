"""
analyze_team_files.py

Matches AFL Tables team-history files against your AFL.com.au CSV
to show which players have position data and which need it sourced elsewhere.

Usage: python analyze_team_files.py
"""

import openpyxl
import csv
import re
import os
from collections import Counter

# === CONFIG: set paths ===
PROJECT_DIR = "D:/Projects/AFLStar/footy-star"
AFL_CSV = os.path.join(PROJECT_DIR, "data/draft_data_from_afl.csv")
GWS_CSV = os.path.join(PROJECT_DIR, "data/gws_only.csv")
TEAM_FILES_DIR = os.path.join(PROJECT_DIR, "data/team_files")  # put your 18 xlsx here
OUTPUT_CSV = os.path.join(PROJECT_DIR, "data/team_file_match_report.csv")

# === Helpers ===
def normalize(s):
    """Strip whitespace and apostrophes for matching."""
    return re.sub(r"['\xa0]", "", str(s or "")).lower().strip()

def parse_seasons(s):
    """'1972-1991' -> (1972, 1991). '2026' -> (2026, 2026)."""
    years = re.findall(r"\d{4}", str(s or ""))
    if not years:
        return None, None
    return int(years[0]), int(years[-1])

def parse_games(s):
    """'426 (302-1-123)' -> 426"""
    m = re.match(r"(\d+)", str(s or "").strip())
    return int(m.group(1)) if m else None

# === Load AFL.com.au data ===
afl_lookup = {}

def load_afl_csv(path):
    if not os.path.exists(path):
        print(f"WARNING: {path} not found")
        return
    with open(path, encoding="utf-8") as f:
        for r in csv.DictReader(f):
            key = f"{normalize(r['firstName'])} {normalize(r['surname'])}"
            afl_lookup[key] = {
                "position": r.get("position", "").strip(),
                "draftType": r.get("draftType", "").strip(),
                "draftPosition": r.get("draftPosition", "").strip(),
                "team_afl": r.get("team", "").strip(),
            }

load_afl_csv(AFL_CSV)
load_afl_csv(GWS_CSV)
print(f"Loaded {len(afl_lookup)} players from AFL.com.au CSVs")

# === Process all team files ===
all_rows = []

if not os.path.isdir(TEAM_FILES_DIR):
    print(f"ERROR: directory {TEAM_FILES_DIR} doesn't exist")
    print("Create it and put all 18 .xlsx team files in there.")
    exit(1)

for filename in sorted(os.listdir(TEAM_FILES_DIR)):
    if not filename.endswith(".xlsx"):
        continue
    path = os.path.join(TEAM_FILES_DIR, filename)
    # Get team name from filename (e.g. "Hawthorn_AFLT..." -> "Hawthorn")
    team_name = filename.split("_")[0]
    
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb.active
    file_count = 0
    
    for row in ws.iter_rows(min_row=2, values_only=True):
        if not row or not row[2]:
            continue
        player = str(row[2]).strip()
        if ", " not in player:
            continue
        last, first = player.split(", ", 1)
        
        debut_year, final_year = parse_seasons(row[8])
        games = parse_games(row[6])
        height = re.match(r"(\d+)", str(row[4] or ""))
        height_cm = int(height.group(1)) if height else None
        dob = row[3]
        
        key = f"{normalize(first)} {normalize(last)}"
        match = afl_lookup.get(key, {})
        
        all_rows.append({
            "firstName": first.strip(),
            "lastName": last.strip(),
            "team_from_file": team_name,
            "team_from_afl": match.get("team_afl", ""),
            "jumperNumber": row[1],
            "heightCm": height_cm,
            "DOB": dob.date() if hasattr(dob, "date") else dob,
            "gamesPlayed": games,
            "debutYear": debut_year,
            "finalYear": final_year,
            "active": final_year == 2026,
            "position": match.get("position", ""),
            "draftType": match.get("draftType", ""),
            "draftPosition": match.get("draftPosition", ""),
            "matched_afl": "yes" if match else "no",
        })
        file_count += 1
    
    print(f"  {filename}: {file_count} players")

# === Deduplicate (a player can appear in multiple team files) ===
# Keep the row from the team where they finished (most recent finalYear, or longest games)
unique = {}
for r in all_rows:
    key = f"{normalize(r['firstName'])} {normalize(r['lastName'])}"
    existing = unique.get(key)
    if not existing:
        unique[key] = r
        continue
    # Keep the row with higher final year (most recent team) or more games
    if (r["finalYear"] or 0) > (existing["finalYear"] or 0):
        unique[key] = r
    elif (r["finalYear"] == existing["finalYear"]) and (r["gamesPlayed"] or 0) > (existing["gamesPlayed"] or 0):
        unique[key] = r

deduped = list(unique.values())
print(f"\nTotal player-rows across team files: {len(all_rows)}")
print(f"Unique players after dedup: {len(deduped)}")

# === Report ===
matched = [r for r in deduped if r["matched_afl"] == "yes"]
unmatched_active = [r for r in deduped if r["matched_afl"] == "no" and r["active"]]
unmatched_retired = [r for r in deduped if r["matched_afl"] == "no" and not r["active"]]

print(f"\n=== Coverage ===")
print(f"  Have position from AFL.com.au: {len(matched)}")
print(f"  No position, active (anomaly): {len(unmatched_active)}")
print(f"  No position, retired (need to source): {len(unmatched_retired)}")

# Retired by debut decade
print(f"\n  Retired without position by debut decade:")
decade_counts = Counter((r["debutYear"] // 10) * 10 for r in unmatched_retired if r["debutYear"])
for d in sorted(decade_counts.keys()):
    print(f"    {d}s: {decade_counts[d]}")

# === Write full output ===
fields = [
    "firstName", "lastName", "team_from_file", "team_from_afl",
    "jumperNumber", "heightCm", "DOB", "gamesPlayed",
    "debutYear", "finalYear", "active", "position",
    "draftType", "draftPosition", "matched_afl",
]
with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=fields)
    w.writeheader()
    for r in sorted(deduped, key=lambda x: (-(x["gamesPlayed"] or 0), x["lastName"])):
        w.writerow(r)

print(f"\nWritten: {OUTPUT_CSV}")
print(f"Open in Excel/Sheets to inspect.")