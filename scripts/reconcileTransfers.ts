import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Player, Team } from '../types/player';

const RAW_DIR = join('data', 'raw_pulls');
const PLAYERS_PATH = join('data', 'players.json');

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

// ---------------------------------------------------------------------------
// CSV (RFC 4180) and slug helpers — duplicated from mergeRawPulls.ts to keep
// these scripts self-contained.
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

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/['’.`]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function nameSlug(firstName: string, lastName: string): string {
  return `${slug(firstName)}|${slug(lastName)}`;
}

// ---------------------------------------------------------------------------
// Build name -> current team from raw_pulls
// ---------------------------------------------------------------------------

function buildCurrentTeamIndex(): Map<string, Team> {
  const present = new Set(
    readdirSync(RAW_DIR)
      .filter((f) => f.toLowerCase().endsWith('.csv'))
      .map((f) => f.toLowerCase().replace(/\.csv$/, '')),
  );
  const idx = new Map<string, Team>();
  for (const stem of Object.keys(TEAM_BY_FILE)) {
    if (!present.has(stem)) continue;
    const team = TEAM_BY_FILE[stem];
    const records = parseCsv(readFileSync(join(RAW_DIR, `${stem}.csv`), 'utf8'));
    if (records.length === 0) continue;
    const [, ...body] = records;
    for (const cells of body) {
      if (cells.length < 3) continue;
      const surname = cells[1].trim();
      const firstName = cells[2].trim();
      if (!firstName || !surname) continue;
      idx.set(nameSlug(firstName, surname), team);
    }
  }
  return idx;
}

// ---------------------------------------------------------------------------
// Reconcile
// ---------------------------------------------------------------------------

interface Reconciled {
  name: string;
  oldTeam: string;
  newTeam: string;
  keptId: string;
  removedId: string;
}

function main(): void {
  const players: Player[] = JSON.parse(readFileSync(PLAYERS_PATH, 'utf8'));
  const currentYear = new Date().getFullYear();
  const currentTeamByName = buildCurrentTeamIndex();

  // Index existing records by slugified name (no team component)
  const byName = new Map<string, Player[]>();
  for (const p of players) {
    const k = nameSlug(p.firstName, p.lastName);
    const arr = byName.get(k);
    if (arr) arr.push(p); else byName.set(k, [p]);
  }

  const toDelete = new Set<Player>();
  const reconciled: Reconciled[] = [];
  const manualReview: string[] = [];

  for (const [nameKey, currentTeam] of currentTeamByName) {
    const records = byName.get(nameKey);
    if (!records || records.length < 2) continue;

    const onCurrent = records.filter((p) => p.team === currentTeam);
    const onOther = records.filter((p) => p.team !== currentTeam);
    if (onCurrent.length === 0 || onOther.length === 0) continue;

    // Identify candidates created by mergeRawPulls.ts (placeholder debutYear).
    const placeholders = onCurrent.filter((p) => p.debutYear === currentYear);
    const realOnCurrent = onCurrent.filter((p) => p.debutYear !== currentYear);
    // The "real" historical record on the old team must be active — otherwise
    // it's a same-name retired player and we should leave both alone.
    const activeOnOther = onOther.filter((p) => p.active);

    const sample = records[0];
    const fullName = `${sample.firstName} ${sample.lastName}`;

    if (realOnCurrent.length > 0) {
      // The merge already had a real record on the current team AND created a
      // placeholder. That's only possible if two distinct people share a name
      // and the merge couldn't disambiguate — punt to manual review.
      if (placeholders.length > 0) {
        manualReview.push(
          `${fullName}: real ${currentTeam} record + ${placeholders.length} placeholder(s) on same team; also ${onOther.length} record(s) on other teams`,
        );
      }
      continue;
    }

    if (placeholders.length !== 1) {
      manualReview.push(
        `${fullName}: ${placeholders.length} placeholder(s) on ${currentTeam}; ${onOther.length} record(s) on other teams`,
      );
      continue;
    }
    if (activeOnOther.length !== 1) {
      // 0 active on other teams -> placeholder is just a new player who happens
      // to share a name with a retired one. Leave it.
      // 2+ active on other teams -> ambiguous transfer, manual.
      if (activeOnOther.length >= 2) {
        manualReview.push(
          `${fullName}: ${activeOnOther.length} active records on other teams (${activeOnOther.map((p) => p.team).join(', ')}); current team is ${currentTeam}`,
        );
      }
      continue;
    }

    const placeholder = placeholders[0];
    const real = activeOnOther[0];
    const oldTeam = real.team;

    // Apply the transfer to the real record, pull fresh stats from the
    // placeholder, then drop the placeholder.
    real.team = currentTeam;
    if (real.position == null && placeholder.position != null) {
      real.position = placeholder.position;
    }
    real.gamesPlayed = placeholder.gamesPlayed;
    real.heightCm = placeholder.heightCm;
    real.jumperNumber = placeholder.jumperNumber;
    real.age = placeholder.age;
    real.active = true;
    real.finalYear = null;

    toDelete.add(placeholder);
    reconciled.push({
      name: fullName,
      oldTeam,
      newTeam: currentTeam,
      keptId: real.id,
      removedId: placeholder.id,
    });
  }

  const finalPlayers = players.filter((p) => !toDelete.has(p));
  writeFileSync(PLAYERS_PATH, JSON.stringify(finalPlayers, null, 2) + '\n', 'utf8');

  console.log(`wrote ${finalPlayers.length} players -> ${PLAYERS_PATH}`);
  console.log(`reconciled transfers:    ${reconciled.length}`);
  console.log(`flagged for manual:      ${manualReview.length}`);
  console.log(`removed placeholders:    ${toDelete.size}`);

  if (reconciled.length) {
    console.log('\n# Transfers applied');
    for (const r of reconciled) {
      console.log(`  ~ ${r.name}: ${r.oldTeam} -> ${r.newTeam} (kept ${r.keptId}, removed ${r.removedId})`);
    }
  }
  if (manualReview.length) {
    console.log('\n# Manual review needed');
    for (const m of manualReview) console.log(`  ? ${m}`);
  }

  // Active-by-team sanity check
  const counts = new Map<string, number>();
  for (const p of finalPlayers) {
    if (!p.active) continue;
    counts.set(p.team, (counts.get(p.team) ?? 0) + 1);
  }
  console.log('\nActive players by team after reconcile:');
  for (const team of [...counts.keys()].sort()) {
    console.log(`  ${team}: ${counts.get(team)}`);
  }
}

main();
