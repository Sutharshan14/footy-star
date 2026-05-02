#!/usr/bin/env node
/**
 * Exports data/players.json to data/players_for_editing.csv so missing
 * fields can be filled in visually in Excel/Sheets, then re-imported via
 * scripts/importFromCsv.js.
 *
 * Usage:
 *   node scripts/exportToCsv.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INPUT = path.join(ROOT, 'data', 'players.json');
const OUTPUT = path.join(ROOT, 'data', 'players_for_editing.csv');

const COLUMNS = [
  'id',
  'firstName',
  'lastName',
  'team',
  'position',
  'age',
  'heightCm',
  'gamesPlayed',
  'jumperNumber',
  'state',
  'debutYear',
  'finalYear',
  'draftPick',
  'nicknames',
  'active',
  'NEEDS_REVIEW',
  'NOTES',
];

// RFC 4180: quote field if it contains comma, double-quote, CR, or LF.
// Inside quotes, double-quote is escaped by doubling.
function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (s === '') return '';
  if (/[",\r\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function rowToCsv(row) {
  return COLUMNS.map((col) => csvEscape(row[col])).join(',');
}

function playerToRow(p) {
  return {
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    team: p.team,
    // Empty (not "null") for unknown nullable fields, per spec.
    position: p.position == null ? '' : p.position,
    age: p.age,
    heightCm: p.heightCm,
    gamesPlayed: p.gamesPlayed,
    jumperNumber: p.jumperNumber,
    state: p.state == null ? '' : p.state,
    debutYear: p.debutYear,
    // Active players have finalYear=null and we want it blank (not "null").
    finalYear: p.finalYear == null ? '' : p.finalYear,
    draftPick: p.draftPick == null ? '' : p.draftPick,
    nicknames: Array.isArray(p.nicknames) && p.nicknames.length > 0
      ? p.nicknames.join('|')
      : '',
    active: p.active ? 'TRUE' : 'FALSE',
    NEEDS_REVIEW: '',
    NOTES: '',
  };
}

function main() {
  const raw = fs.readFileSync(INPUT, 'utf8');
  const players = JSON.parse(raw);

  // Sort: active TRUE first, then team A-Z, then lastName A-Z.
  const sorted = [...players].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    const teamCmp = String(a.team).localeCompare(String(b.team));
    if (teamCmp !== 0) return teamCmp;
    return String(a.lastName).localeCompare(String(b.lastName));
  });

  const lines = [COLUMNS.join(',')];
  for (const p of sorted) {
    lines.push(rowToCsv(playerToRow(p)));
  }
  // Trailing newline.
  fs.writeFileSync(OUTPUT, lines.join('\r\n') + '\r\n', 'utf8');

  // ---- Summary ----
  const missingPosition = players.filter((p) => p.position == null).length;
  const missingState = players.filter((p) => p.state == null).length;
  const missingDraftPick = players.filter((p) => p.draftPick == null).length;
  const active = players.filter((p) => p.active);

  const teamCounts = new Map();
  for (const p of active) {
    teamCounts.set(p.team, (teamCounts.get(p.team) || 0) + 1);
  }

  console.log(`Wrote ${players.length} rows -> ${OUTPUT}`);
  console.log('');
  console.log(`Missing position:   ${missingPosition}`);
  console.log(`Missing state:      ${missingState}`);
  console.log(`Missing draftPick:  ${missingDraftPick}`);
  console.log(`Active players:     ${active.length}`);
  console.log('');
  console.log('Active players by team:');
  for (const team of [...teamCounts.keys()].sort()) {
    console.log(`  ${team}: ${teamCounts.get(team)}`);
  }
}

main();
