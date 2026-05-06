import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

type CanonicalTeam =
  | 'Adelaide'
  | 'Brisbane'
  | 'Carlton'
  | 'Collingwood'
  | 'Essendon'
  | 'Fitzroy'
  | 'Fremantle'
  | 'Geelong'
  | 'Gold Coast'
  | 'GWS'
  | 'Hawthorn'
  | 'Melbourne'
  | 'North Melbourne'
  | 'Port Adelaide'
  | 'Richmond'
  | 'Sydney'
  | 'St Kilda'
  | 'West Coast'
  | 'Western Bulldogs';

type Position =
  | 'KEY_FORWARD'
  | 'MEDIUM_FORWARD'
  | 'MIDFIELDER_FORWARD'
  | 'MIDFIELDER'
  | 'RUCK'
  | 'MEDIUM_DEFENDER'
  | 'KEY_DEFENDER';

type OutputPlayer = {
  id: string;
  firstName: string;
  lastName: string;
  team: CanonicalTeam;
  position: Position | null;
  age: number;
  heightCm: number | null;
  gamesPlayed: number | null;
  jumperNumber: number | null;
  state: null;
  debutYear: number | null;
  finalYear: number | null;
  draftPick: number | null;
  nicknames: string[];
  active: boolean;
};

type ParseIssue = {
  source: string;
  rowNumber: number;
  reason: string;
};

type RetireeNeedingPosition = {
  id: string;
  firstName: string;
  lastName: string;
  team: CanonicalTeam;
  debutYear: number | null;
  finalYear: number | null;
  gamesPlayed: number | null;
  fameSource: string;
};

const TEAM_NORMALISATION: Record<string, CanonicalTeam> = {
  Adelaide: 'Adelaide',
  Brisbane: 'Brisbane',
  'Brisbane Lions': 'Brisbane',
  Carlton: 'Carlton',
  Collingwood: 'Collingwood',
  Essendon: 'Essendon',
  Fitzroy: 'Fitzroy',
  Fremantle: 'Fremantle',
  'Fremantle.xlsx': 'Fremantle',
  Geelong: 'Geelong',
  'Gold Coast': 'Gold Coast',
  Goldcoast: 'Gold Coast',
  GWS: 'GWS',
  Hawthorn: 'Hawthorn',
  Melbourne: 'Melbourne',
  'North Melbourne': 'North Melbourne',
  NorthMelbourne: 'North Melbourne',
  'Port Adelaide': 'Port Adelaide',
  PortAdelaide: 'Port Adelaide',
  Richmond: 'Richmond',
  Sydney: 'Sydney',
  'St Kilda': 'St Kilda',
  Stkilda: 'St Kilda',
  'West Coast': 'West Coast',
  WestCoast: 'West Coast',
  'Western Bulldogs': 'Western Bulldogs',
  WesternBulldogs: 'Western Bulldogs',
};

function parseCsv(content: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let currentField = '';
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const next = content[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentField += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      currentRow.push(currentField);
      currentField = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        i += 1;
      }
      currentRow.push(currentField);
      currentField = '';
      if (currentRow.some((cell) => cell.trim().length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      continue;
    }

    currentField += char;
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some((cell) => cell.trim().length > 0)) {
      rows.push(currentRow);
    }
  }

  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((row) => {
    const out: Record<string, string> = {};
    headers.forEach((header, idx) => {
      out[header] = (row[idx] ?? '').trim();
    });
    return out;
  });
}

function slugPart(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/'/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function makeId(firstName: string, lastName: string): string {
  return `${slugPart(firstName)}-${slugPart(lastName)}`.replace(/-+/g, '-');
}

function parseDate(value: string): Date | null {
  const v = value.trim();
  if (!v) return null;

  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v)) {
    const [dd, mm, yyyy] = v.split('/').map((p) => Number.parseInt(p, 10));
    const d = new Date(Date.UTC(yyyy, mm - 1, dd));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const d = new Date(`${v}T00:00:00Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const fallback = new Date(v);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function calculateAge(dob: Date, asOf: Date): number {
  let age = asOf.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = asOf.getUTCMonth() - dob.getUTCMonth();
  const dayDiff = asOf.getUTCDate() - dob.getUTCDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }

  return age;
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function makePersonDobKey(firstName: string, lastName: string, dobIso: string): string {
  return `${slugPart(firstName)}-${slugPart(lastName)}|${dobIso}`;
}

function teamFromTeamFileNameOrThrow(fileName: string): CanonicalTeam {
  const name = fileName.trim();
  if (name === 'Brisbane_Bears_AFLT_ALL_above_100_Games.xlsx') {
    throw new Error('SKIP_FILE_BRISBANE_BEARS');
  }
  if (name === 'Fremantle.xlsx') {
    return normaliseTeamOrThrow('Fremantle.xlsx');
  }
  const m = name.match(/^(.+?)_AFLT_ALL_above_100_Games\.xlsx$/i);
  if (!m) {
    throw new Error(`Unrecognised team file name format: ${fileName}`);
  }
  const rawTeamFromFile = (m[1] ?? '').replace(/_/g, ' ').trim();
  return normaliseTeamOrThrow(rawTeamFromFile);
}

function loadGamesMapFromTeamFiles(teamFilesDir: string): Map<string, number> {
  const teamFiles = readdirSync(teamFilesDir).filter(
    (f) => f.toLowerCase().endsWith('.xlsx') && !f.startsWith('~$'),
  );
  const pythonScript = `
import datetime
import json
import os
import re
import sys
from openpyxl import load_workbook

team_dir = sys.argv[1]
records = []

def dob_to_iso(value):
    if value is None:
        return ""
    if isinstance(value, datetime.datetime):
        return value.date().isoformat()
    if isinstance(value, datetime.date):
        return value.isoformat()
    s = str(value).strip()
    if not s:
        return ""
    m = re.match(r"^(\\d{4})-(\\d{2})-(\\d{2})", s)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    m = re.match(r"^(\\d{2})/(\\d{2})/(\\d{4})$", s)
    if m:
        return f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
    return ""

for filename in os.listdir(team_dir):
    if not filename.lower().endswith(".xlsx"):
        continue
    if filename.startswith("~$"):
        continue
    full_path = os.path.join(team_dir, filename)
    wb = load_workbook(full_path, data_only=True, read_only=True)
    ws = wb.active
    rows = ws.iter_rows(values_only=True)
    header_row = next(rows, None)
    if header_row is None:
        continue
    headers = [str(h).strip() if h is not None else "" for h in header_row]
    try:
        idx_player = headers.index("Player")
        idx_dob = headers.index("DOB")
        idx_games = headers.index("Games (W-D-L)")
    except ValueError:
        continue
    for row in rows:
        player = row[idx_player] if idx_player < len(row) else None
        dob = row[idx_dob] if idx_dob < len(row) else None
        games = row[idx_games] if idx_games < len(row) else None
        if player is None or games is None:
            continue
        player_s = str(player).strip()
        if "," not in player_s:
            continue
        last, first = [p.strip() for p in player_s.split(",", 1)]
        dob_iso = dob_to_iso(dob)
        if not first or not last or not dob_iso:
            continue
        gmatch = re.match(r"^\\s*(\\d+)\\b", str(games))
        if not gmatch:
            continue
        records.append({
            "firstName": first,
            "lastName": last,
            "dobIso": dob_iso,
            "gamesPlayed": int(gmatch.group(1)),
            "file": filename
        })

print(json.dumps(records))
`;

  if (teamFiles.length === 0) {
    throw new Error(`No .xlsx files found in team files folder: ${teamFilesDir}`);
  }

  const raw = execFileSync('python', ['-c', pythonScript, teamFilesDir], {
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  });
  const parsed = JSON.parse(raw) as Array<{
    firstName: string;
    lastName: string;
    dobIso: string;
    gamesPlayed: number;
    file: string;
  }>;

  const gamesByKey = new Map<string, number>();
  const fileByKey = new Map<string, string>();
  for (const row of parsed) {
    let team: CanonicalTeam;
    try {
      team = teamFromTeamFileNameOrThrow(row.file);
    } catch (error) {
      if (error instanceof Error && error.message === 'SKIP_FILE_BRISBANE_BEARS') {
        continue;
      }
      throw error;
    }
    const personKey = makePersonDobKey(row.firstName, row.lastName, row.dobIso);
    const key = `${team}|${personKey}`;
    const existing = gamesByKey.get(key);
    if (existing !== undefined && existing !== row.gamesPlayed) {
      const existingFile = fileByKey.get(key) ?? 'unknown file';
      throw new Error(
        `Conflicting gamesPlayed for ${row.firstName} ${row.lastName} (${row.dobIso}) in ${team}: ` +
          `${existing} from ${existingFile} vs ${row.gamesPlayed} from ${row.file}`,
      );
    }
    gamesByKey.set(key, row.gamesPlayed);
    fileByKey.set(key, row.file);
  }
  return gamesByKey;
}

function parseIntStrict(raw: string): number | null {
  const cleaned = raw.trim();
  if (!cleaned || cleaned.toUpperCase() === 'NA') {
    return null;
  }
  const digits = cleaned.replace(/cm$/i, '').trim();
  if (!/^-?\d+$/.test(digits)) {
    return null;
  }
  return Number.parseInt(digits, 10);
}

function normaliseTeamOrThrow(rawTeam: string): CanonicalTeam {
  const t = rawTeam.trim();
  const mapped = TEAM_NORMALISATION[t];
  if (!mapped) {
    throw new Error(`Unknown team value encountered: "${rawTeam}"`);
  }
  return mapped;
}

function assertPosition(value: string): Position | null {
  const v = value.trim();
  if (!v) return null;
  const allowed = new Set<Position>([
    'KEY_FORWARD',
    'MEDIUM_FORWARD',
    'MIDFIELDER_FORWARD',
    'MIDFIELDER',
    'RUCK',
    'MEDIUM_DEFENDER',
    'KEY_DEFENDER',
  ]);
  return allowed.has(v as Position) ? (v as Position) : null;
}

function isNationalDraft(raw: string): boolean {
  return raw.trim().toLowerCase() === 'nationaldraft';
}

function boolTrue(raw: string): boolean {
  const v = raw.trim();
  return v === 'True' || v === 'TRUE';
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function run(): void {
  const root = process.cwd();
  const asOf = new Date();

  const activeAPath = resolve(root, 'data', 'draft_data_from_afl.csv');
  const activeBPath = resolve(root, 'data', 'gws_only.csv');
  const retireePath = resolve(root, 'data', 'famous_retirees_with_data.csv');
  const playersOutPath = resolve(root, 'data', 'players.json');
  const retireeOutPath = resolve(root, 'data', 'retirees_needing_position.csv');
  const teamFilesDir = resolve(root, 'data', 'team_files');

  const issues: ParseIssue[] = [];
  const warnings: string[] = [];
  const activeById = new Map<string, OutputPlayer>();
  const retireeById = new Map<string, OutputPlayer>();
  const retireeNeedsPosition: RetireeNeedingPosition[] = [];
  const gamesByPersonDobKey = loadGamesMapFromTeamFiles(teamFilesDir);
  let activeMissingGamesCount = 0;

  const activeSources = [
    { source: 'draft_data_from_afl.csv', rows: parseCsv(readFileSync(activeAPath, 'utf8')) },
    { source: 'gws_only.csv', rows: parseCsv(readFileSync(activeBPath, 'utf8')) },
  ];

  activeSources.forEach(({ source, rows }) => {
    rows.forEach((row, idx) => {
      const rowNumber = idx + 2;
      const firstName = row.firstName?.trim() ?? '';
      const lastName = row.surname?.trim() ?? '';

      if (!firstName || !lastName) {
        issues.push({ source, rowNumber, reason: 'Missing firstName or surname' });
        return;
      }

      const dob = parseDate(row.dateOfBirth ?? '');
      if (!dob) {
        issues.push({ source, rowNumber, reason: `Invalid dateOfBirth "${row.dateOfBirth ?? ''}"` });
        return;
      }

      const team = normaliseTeamOrThrow(row.team ?? '');
      const position = assertPosition(row.position ?? '');
      if (!position) {
        issues.push({ source, rowNumber, reason: `Invalid position "${row.position ?? ''}"` });
        return;
      }

      const heightCm = parseIntStrict(row.heightInCm ?? '');
      const jumperNumber = parseIntStrict(row.jumperNumber ?? '');
      const debutYear = parseIntStrict(row.debutYear ?? '');
      const draftPosition = parseIntStrict(row.draftPosition ?? '');

      if (heightCm === null) {
        issues.push({ source, rowNumber, reason: `Invalid heightInCm "${row.heightInCm ?? ''}"` });
        return;
      }

      const id = makeId(firstName, lastName);
      const gamesKey = `${team}|${makePersonDobKey(firstName, lastName, toIsoDate(dob))}`;
      const gamesPlayed = gamesByPersonDobKey.get(gamesKey) ?? null;
      if (gamesPlayed === null) {
        activeMissingGamesCount += 1;
      }
      const player: OutputPlayer = {
        id,
        firstName,
        lastName,
        team,
        position,
        age: calculateAge(dob, asOf),
        heightCm,
        gamesPlayed,
        jumperNumber,
        state: null,
        debutYear,
        finalYear: null,
        draftPick: isNationalDraft(row.draftType ?? '') ? draftPosition : null,
        nicknames: [],
        active: true,
      };

      if (activeById.has(id)) {
        warnings.push(`Duplicate active id "${id}" in ${source} row ${rowNumber}; keeping first active record.`);
        return;
      }

      activeById.set(id, player);
    });
  });

  const retireeRows = parseCsv(readFileSync(retireePath, 'utf8'));
  retireeRows.forEach((row, idx) => {
    const rowNumber = idx + 2;

    if (boolTrue(row.active ?? '')) {
      return;
    }

    const firstName = row.firstName?.trim() ?? '';
    const lastName = row.lastName?.trim() ?? '';

    if (!firstName || !lastName) {
      issues.push({ source: 'famous_retirees_with_data.csv', rowNumber, reason: 'Missing firstName or lastName' });
      return;
    }

    const dob = parseDate(row.DOB ?? '');
    if (!dob) {
      issues.push({ source: 'famous_retirees_with_data.csv', rowNumber, reason: `Invalid DOB "${row.DOB ?? ''}"` });
      return;
    }

    const team = normaliseTeamOrThrow(row.team_from_file ?? '');
    const gamesPlayed = parseIntStrict(row.gamesPlayed ?? '');
    const jumperNumber = parseIntStrict(row.jumperNumber ?? '');
    const heightCm = parseIntStrict(row.heightCm ?? '');
    const debutYear = parseIntStrict(row.debutYear ?? '');
    const finalYear = parseIntStrict(row.finalYear ?? '');
    const draftPosition = parseIntStrict(row.draftPosition ?? '');

    const id = makeId(firstName, lastName);
    const player: OutputPlayer = {
      id,
      firstName,
      lastName,
      team,
      position: null,
      age: calculateAge(dob, asOf),
      heightCm,
      gamesPlayed,
      jumperNumber,
      state: null,
      debutYear,
      finalYear,
      draftPick: isNationalDraft(row.draftType ?? '') ? draftPosition : null,
      nicknames: [],
      active: false,
    };

    if (retireeById.has(id)) {
      warnings.push(`Duplicate retiree id "${id}" in famous_retirees_with_data.csv row ${rowNumber}; keeping first retiree record.`);
      return;
    }

    retireeById.set(id, player);
    retireeNeedsPosition.push({
      id,
      firstName,
      lastName,
      team,
      debutYear,
      finalYear,
      gamesPlayed,
      fameSource: row.fameSource ?? '',
    });
  });

  const dedupedRetirees: OutputPlayer[] = [];
  retireeById.forEach((retiree, id) => {
    if (activeById.has(id)) {
      warnings.push(`Retiree id "${id}" also present in active data; keeping active record.`);
      return;
    }
    dedupedRetirees.push(retiree);
  });

  const finalPlayers = [...activeById.values(), ...dedupedRetirees].sort((a, b) => a.id.localeCompare(b.id));
  const retireeNeedsPositionFinal = retireeNeedsPosition
    .filter((r) => !activeById.has(r.id))
    .sort((a, b) => a.id.localeCompare(b.id));

  writeFileSync(playersOutPath, `${JSON.stringify(finalPlayers, null, 2)}\n`, 'utf8');

  const retireeHeader = [
    'id',
    'firstName',
    'lastName',
    'team',
    'debutYear',
    'finalYear',
    'gamesPlayed',
    'fameSource',
    'position',
  ];
  const retireeLines = retireeNeedsPositionFinal.map((r) =>
    [
      r.id,
      r.firstName,
      r.lastName,
      r.team,
      r.debutYear === null ? '' : String(r.debutYear),
      r.finalYear === null ? '' : String(r.finalYear),
      r.gamesPlayed === null ? '' : String(r.gamesPlayed),
      r.fameSource,
      '',
    ]
      .map(csvEscape)
      .join(','),
  );
  writeFileSync(retireeOutPath, `${retireeHeader.join(',')}\n${retireeLines.join('\n')}\n`, 'utf8');

  const activeCount = finalPlayers.filter((p) => p.active).length;
  const retiredCount = finalPlayers.length - activeCount;

  const byTeam = new Map<string, number>();
  const byPosition = new Map<string, number>();
  finalPlayers.forEach((p) => {
    byTeam.set(p.team, (byTeam.get(p.team) ?? 0) + 1);
    const key = p.position ?? 'null';
    byPosition.set(key, (byPosition.get(key) ?? 0) + 1);
  });

  const sortCounts = (m: Map<string, number>) =>
    [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  console.log('Build complete.');
  console.log(`Total players in players.json: ${finalPlayers.length}`);
  console.log(`Active: ${activeCount}`);
  console.log(`Retired: ${retiredCount}`);
  console.log('Count by team:');
  sortCounts(byTeam).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  console.log('Count by position:');
  sortCounts(byPosition).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  console.log(`Retirees needing position fill: ${retireeNeedsPositionFinal.length}`);

  if (warnings.length > 0) {
    console.log('Warnings/anomalies:');
    warnings.forEach((w) => console.log(`  - ${w}`));
  } else {
    console.log('Warnings/anomalies: none');
  }
  console.log(`Active players with no team_files games match: ${activeMissingGamesCount}`);

  if (issues.length > 0) {
    console.log('Rows that failed to parse and were skipped:');
    issues.forEach((i) => console.log(`  - ${i.source} row ${i.rowNumber}: ${i.reason}`));
  } else {
    console.log('Rows that failed to parse and were skipped: none');
  }
}

try {
  run();
} catch (error) {
  console.error('Build aborted.');
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(String(error));
  }
  process.exit(1);
}
