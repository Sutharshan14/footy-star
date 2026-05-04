"""
extract_famous_retirees.py

Reads the team match report and the famous retirees master list.
Outputs a CSV containing only the famous retirees who matched in the team files.
"""

import csv
import re

REPORT_PATH = "data/team_file_match_report.csv"
FAMOUS_PATH = "data/famous_retirees_master.csv"
OUTPUT_PATH = "data/famous_retirees_with_data.csv"

def normalize(s):
    """Strip apostrophes, periods, non-breaking spaces. Lowercase."""
    return re.sub(r"['\xa0\.]", "", str(s or "")).lower().strip()

# Load famous names
famous_keys = {}
with open(FAMOUS_PATH, encoding="utf-8") as f:
    for r in csv.DictReader(f):
        key = f"{normalize(r['firstName'])} {normalize(r['lastName'])}"
        famous_keys[key] = r['sources']

print(f"Famous retirees in master list: {len(famous_keys)}")

# Match against report
output_rows = []
unmatched_famous = set(famous_keys.keys())

with open(REPORT_PATH, encoding="utf-8") as f:
    for r in csv.DictReader(f):
        key = f"{normalize(r['firstName'])} {normalize(r['lastName'])}"
        if key in famous_keys:
            r['fameSource'] = famous_keys[key]
            output_rows.append(r)
            unmatched_famous.discard(key)

# Write output
if output_rows:
    fields = list(output_rows[0].keys())
    with open(OUTPUT_PATH, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(output_rows)

print(f"\nFamous retirees found in team files: {len(output_rows)}")
print(f"Famous names NOT found: {len(unmatched_famous)}")

if unmatched_famous:
    print(f"\nNot-found names (first 20):")
    for k in sorted(unmatched_famous)[:20]:
        print(f"  {k}")

print(f"\nWritten: {OUTPUT_PATH}")