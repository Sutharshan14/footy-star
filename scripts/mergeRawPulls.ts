import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import type { Player, Position, Team, State } from '../types/player';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const RAW_DIR = join('data', 'raw_pulls');
const PLAYERS_PATH = join('data', 'players.json');

// Filename stem -> canonical Team string used in players.json
const TEAM_BY_FILE: Record<string, Team> = {
  adelaide: 'Adelaide',
  brisbane_lions: 'Brisbane',
  carlton: 'Carlton',
  collingwood: 'Collingwood',
  essendon: 'Essendon',
  fremantle: 'Fremantle',
  geelong: 'Geelong',
  gold_coast: 'Gold Coast',
  gws: 'GWS',
  hawthorn: 'Hawthorn',
  melbourne: 'Melbourne',
  north_melbourne: 'North Melbourne',
  port_adelaide: 'Port Adelaide',
  richmond: 'Richmond',
  st_kilda: 'St Kilda',
  sydney: 'Sydney',
  west_coast: 'West Coast',
  western_bulldogs: 'Western Bulldogs',
};

// Footywire's coarse position -> our Position type. Mid/Ruck map cleanly.
// Forward and Defender are bucketed by height: tall -> Key, short -> Small,
// otherwise the wing/half-back tier. Manual review is still expected.
const HEIGHT_TALL_CM = 190;
const HEIGHT_SMALL_CM = 183;

function mapPosition(raw: string, heightCm: number | null): Position | null {
  switch (raw) {
    case 'Midfield': return 'Midfielder';
    case 'Ruck':     return 'Ruck';
    case 'Forward':
      if (heightCm == null) return 'Forward Flank';
      if (heightCm >= HEIGHT_TALL_CM)  return 'Key Forward';
      if (heightCm <  HEIGHT_SMALL_CM) return 'Small Forward';
      return 'Forward Flank';
    case 'Defender':
      if (heightCm == null) return 'Half Back';
      if (heightCm >= HEIGHT_TALL_CM)  return 'Key Defender';
      if (heightCm <  HEIGHT_SMALL_CM) return 'Small Defender';
      return 'Half Back';
    default: return null;
  }
}

// ---------------------------------------------------------------------------
// Tiny RFC-4180 CSV parser (handles quoted fields with embedded commas)
// ---------------------------------------------------------------------------

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { cell += c; }
    } else {
      if (c === '"') { inQuotes = true; }
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\r') { /* skip */ }
      else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else { cell += c; }
    }
  }
  if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

// ---------------------------------------------------------------------------
// Field parsing
// ---------------------------------------------------------------------------

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

function parseDob(s: string): Date | null {
  // "9 Oct 1997"
  const m = s.trim().match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
  if (!m) return null;
  const month = MONTHS[m[2]];
  if (month === undefined) return null;
  return new Date(Number(m[3]), month, Number(m[1]));
}

function ageFrom(dob: Date, today: Date): number {
  let age = today.getFullYear() - dob.getFullYear();
  const md = today.getMonth() - dob.getMonth();
  if (md < 0 || (md === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

function parseHeightCm(s: string): number | null {
  const m = s.trim().match(/^(\d+)\s*cm$/i);
  return m ? Number(m[1]) : null;
}

function parseInt0(s: string): number {
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : 0;
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/['’.`]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function nameKey(firstName: string, lastName: string, team: string): string {
  return `${slug(firstName)}|${slug(lastName)}|${team}`;
}

// ---------------------------------------------------------------------------
// CSV -> intermediate row
// ---------------------------------------------------------------------------

interface RawRow {
  team: Team;
  jumperNumber: number;
  firstName: string;
  lastName: string;
  gamesPlayed: number;
  dob: Date | null;
  heightCm: number | null;
  position1Raw: string;
  position2Raw: string;
  sourceFile: string;
  sourceLine: number;
}

function loadRawRows(): { rows: RawRow[]; warnings: string[]; missingFiles: string[] } {
  const expectedStems = Object.keys(TEAM_BY_FILE);
  const presentStems = new Set(
    readdirSync(RAW_DIR)
      .filter((f) => f.toLowerCase().endsWith('.csv'))
      .map((f) => basename(f, '.csv').toLowerCase()),
  );
  const missingFiles = expectedStems.filter((s) => !presentStems.has(s));

  const rows: RawRow[] = [];
  const warnings: string[] = [];

  for (const stem of expectedStems) {
    if (!presentStems.has(stem)) continue;
    const team = TEAM_BY_FILE[stem];
    const path = join(RAW_DIR, `${stem}.csv`);
    const records = parseCsv(readFileSync(path, 'utf8'));
    if (records.length === 0) continue;
    const [, ...body] = records; // skip header

    body.forEach((cells, i) => {
      const lineNum = i + 2;
      if (cells.length < 10) {
        warnings.push(`${stem}.csv:${lineNum}: expected 10 columns, got ${cells.length}`);
        return;
      }
      const [no, surname, firstName, games, , dobRaw, htRaw, , pos1, pos2] = cells;
      if (!firstName || !surname) {
        warnings.push(`${stem}.csv:${lineNum}: missing first/last name`);
        return;
      }
      rows.push({
        team,
        jumperNumber: parseInt0(no),
        firstName: firstName.trim(),
        lastName: surname.trim(),
        gamesPlayed: parseInt0(games),
        dob: parseDob(dobRaw),
        heightCm: parseHeightCm(htRaw),
        position1Raw: pos1.trim(),
        position2Raw: pos2.trim(),
        sourceFile: `${stem}.csv`,
        sourceLine: lineNum,
      });
    });
  }

  return { rows, warnings, missingFiles };
}

// ---------------------------------------------------------------------------
// Merge
// ---------------------------------------------------------------------------

interface MergeReport {
  positionsFilled: number;
  positionsAlreadySet: number;
  newPlayers: string[];           // "First Last (Team)"
  ambiguousMatches: string[];     // CSV name matched multiple existing records
  unknownPosition: string[];      // Position_1 not in any known bucket
  badRows: string[];              // parse warnings
  missingFiles: string[];
}

function mergeRawIntoPlayers(
  raw: RawRow[],
  players: Player[],
  parseWarnings: string[],
  missingFiles: string[],
  today: Date,
): { players: Player[]; report: MergeReport } {
  const report: MergeReport = {
    positionsFilled: 0,
    positionsAlreadySet: 0,
    newPlayers: [],
    ambiguousMatches: [],
    unknownPosition: [],
    badRows: parseWarnings,
    missingFiles,
  };

  // Index existing players by match key
  const byKey = new Map<string, Player[]>();
  for (const p of players) {
    const k = nameKey(p.firstName, p.lastName, p.team);
    const arr = byKey.get(k);
    if (arr) arr.push(p); else byKey.set(k, [p]);
  }

  for (const r of raw) {
    const position = mapPosition(r.position1Raw, r.heightCm);
    if (!position && r.position1Raw && r.position1Raw !== 'NA') {
      report.unknownPosition.push(
        `${r.sourceFile}:${r.sourceLine}: "${r.position1Raw}" for ${r.firstName} ${r.lastName}`,
      );
    }

    const key = nameKey(r.firstName, r.lastName, r.team);
    const candidates = byKey.get(key) ?? [];

    let match: Player | null = null;
    if (candidates.length === 1) {
      match = candidates[0];
    } else if (candidates.length > 1) {
      const active = candidates.filter((p) => p.active);
      if (active.length === 1) {
        match = active[0];
      } else {
        report.ambiguousMatches.push(
          `${r.firstName} ${r.lastName} (${r.team}) -> ${candidates.length} existing records, ${active.length} active`,
        );
        continue;
      }
    }

    if (match) {
      if (position) {
        if (match.position == null) {
          match.position = position;
          report.positionsFilled++;
        } else {
          report.positionsAlreadySet++;
        }
      }
      continue;
    }

    // No match — create a fresh record
    const age = r.dob ? ageFrom(r.dob, today) : 0;
    const newPlayer: Player = {
      id: `${slug(r.firstName)}-${slug(r.lastName)}`,
      firstName: r.firstName,
      lastName: r.lastName,
      nicknames: [],
      team: r.team,
      position: position ?? (null as unknown as Position),
      age,
      heightCm: r.heightCm ?? 0,
      gamesPlayed: r.gamesPlayed,
      jumperNumber: r.jumperNumber,
      draftPick: null,
      state: null as unknown as State,
      debutYear: today.getFullYear(), // placeholder — flagged in report
      finalYear: null,
      active: true,
    };
    players.push(newPlayer);
    // Keep the index in sync in case the same name appears in two CSVs
    const arr = byKey.get(key);
    if (arr) arr.push(newPlayer); else byKey.set(key, [newPlayer]);

    report.newPlayers.push(`${r.firstName} ${r.lastName} (${r.team})`);
  }

  return { players, report };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function printReport(r: MergeReport): void {
  console.log('--- merge summary ---');
  console.log(`positions filled:        ${r.positionsFilled}`);
  console.log(`positions already set:   ${r.positionsAlreadySet}`);
  console.log(`new player records:      ${r.newPlayers.length}`);
  console.log(`ambiguous name matches:  ${r.ambiguousMatches.length}`);
  console.log(`unknown position values: ${r.unknownPosition.length}`);
  console.log(`bad CSV rows:            ${r.badRows.length}`);
  console.log(`missing CSV files:       ${r.missingFiles.length}`);

  if (r.missingFiles.length) {
    console.log('\n# Missing CSV files (expected stems)');
    for (const f of r.missingFiles) console.log(`  - ${f}.csv`);
  }
  if (r.ambiguousMatches.length) {
    console.log('\n# Ambiguous matches — reconcile manually');
    for (const m of r.ambiguousMatches) console.log(`  - ${m}`);
  }
  if (r.newPlayers.length) {
    console.log('\n# New player records created (debutYear is a placeholder)');
    for (const n of r.newPlayers) console.log(`  + ${n}`);
  }
  if (r.unknownPosition.length) {
    console.log('\n# Unknown Position_1 values');
    for (const u of r.unknownPosition) console.log(`  ? ${u}`);
  }
  if (r.badRows.length) {
    console.log('\n# Bad CSV rows');
    for (const b of r.badRows) console.log(`  ! ${b}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const today = new Date();
  const players: Player[] = JSON.parse(readFileSync(PLAYERS_PATH, 'utf8'));
  const { rows, warnings, missingFiles } = loadRawRows();
  const { players: merged, report } = mergeRawIntoPlayers(
    rows, players, warnings, missingFiles, today,
  );

  writeFileSync(PLAYERS_PATH, JSON.stringify(merged, null, 2) + '\n', 'utf8');
  console.log(`wrote ${merged.length} players -> ${PLAYERS_PATH}`);
  printReport(report);
}

main();
