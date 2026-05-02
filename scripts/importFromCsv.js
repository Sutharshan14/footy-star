#!/usr/bin/env node
/**
 * Imports data/players_for_editing.csv back into data/players.json.
 * Validates each row and logs warnings for obviously wrong data.
 *
 * Usage:
 *   node scripts/importFromCsv.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INPUT = path.join(ROOT, 'data', 'players_for_editing.csv');
const OUTPUT = path.join(ROOT, 'data', 'players.json');

const KNOWN_TEAMS = new Set([
  'Adelaide', 'Brisbane', 'Carlton', 'Collingwood',
  'Essendon', 'Fremantle', 'Geelong', 'Gold Coast',
  'GWS', 'Hawthorn', 'Melbourne', 'North Melbourne',
  'Port Adelaide', 'Richmond', 'St Kilda', 'Sydney',
  'West Coast', 'Western Bulldogs',
]);

const KNOWN_POSITIONS = new Set([
  'Key Forward', 'Small Forward', 'Forward Flank',
  'Midfielder', 'Ruck', 'Wing',
  'Half Back', 'Key Defender', 'Small Defender',
]);

const KNOWN_STATES = new Set(['VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT']);

const CURRENT_YEAR = new Date().getFullYear();

// ---- RFC 4180 CSV parser ----
// Handles quoted fields with embedded commas, CRLF, and "" for an escaped
// quote. Returns string[][] (rows of fields). Tolerates LF or CRLF line
// endings and a trailing newline.
function parseCsv(text) {
  // Strip UTF-8 BOM if present.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (i + 1 < n && text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        field += c;
        i++;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
        i++;
      } else if (c === ',') {
        row.push(field);
        field = '';
        i++;
      } else if (c === '\r') {
        // CR or CRLF: end of record.
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
        i++;
        if (i < n && text[i] === '\n') i++;
      } else if (c === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
        i++;
      } else {
        field += c;
        i++;
      }
    }
  }
  // Flush trailing field/row if file didn't end with a newline,
  // OR ignore a final empty row from a trailing newline.
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// ---- Field coercion ----
function toIntOrNull(s) {
  if (s === '' || s == null) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return NaN;
  return n;
}

function toStringOrNull(s) {
  if (s === '' || s == null) return null;
  return s;
}

function toBoolean(s) {
  const v = String(s).trim().toUpperCase();
  if (v === 'TRUE') return true;
  if (v === 'FALSE') return false;
  return null;
}

function main() {
  const raw = fs.readFileSync(INPUT, 'utf8');
  const rows = parseCsv(raw);
  if (rows.length === 0) {
    console.error('ERROR: CSV is empty');
    process.exit(1);
  }
  const header = rows[0];
  const dataRows = rows.slice(1).filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ''));

  // Map header -> index for resilience to column reordering.
  const idx = Object.fromEntries(header.map((h, i) => [h.trim(), i]));
  const required = [
    'id', 'firstName', 'lastName', 'team', 'position', 'age',
    'heightCm', 'gamesPlayed', 'jumperNumber', 'state', 'debutYear',
    'finalYear', 'draftPick', 'nicknames', 'active',
  ];
  const missingHeaders = required.filter((h) => !(h in idx));
  if (missingHeaders.length > 0) {
    console.error(`ERROR: missing required columns: ${missingHeaders.join(', ')}`);
    process.exit(1);
  }

  const get = (row, col) => (idx[col] != null ? (row[idx[col]] ?? '') : '');

  const warnings = [];
  const players = [];

  dataRows.forEach((row, lineNo) => {
    const csvLine = lineNo + 2; // 1-based + header line
    const id = get(row, 'id').trim();
    const firstName = get(row, 'firstName').trim();
    const lastName = get(row, 'lastName').trim();
    const team = get(row, 'team').trim();
    const positionRaw = get(row, 'position').trim();
    const ageRaw = get(row, 'age').trim();
    const heightRaw = get(row, 'heightCm').trim();
    const gamesRaw = get(row, 'gamesPlayed').trim();
    const jumperRaw = get(row, 'jumperNumber').trim();
    const stateRaw = get(row, 'state').trim();
    const debutRaw = get(row, 'debutYear').trim();
    const finalRaw = get(row, 'finalYear').trim();
    const draftRaw = get(row, 'draftPick').trim();
    const nicknamesRaw = get(row, 'nicknames');
    const activeRaw = get(row, 'active').trim();

    const tag = `[row ${csvLine} ${id || '(no id)'}]`;

    const age = toIntOrNull(ageRaw);
    const heightCm = toIntOrNull(heightRaw);
    const gamesPlayed = toIntOrNull(gamesRaw);
    const jumperNumber = toIntOrNull(jumperRaw);
    const debutYear = toIntOrNull(debutRaw);
    const finalYear = toIntOrNull(finalRaw);
    const draftPick = toIntOrNull(draftRaw);
    const active = toBoolean(activeRaw);

    // Validations.
    if (!id) warnings.push(`${tag} missing id`);
    if (!firstName) warnings.push(`${tag} missing firstName`);
    if (!lastName) warnings.push(`${tag} missing lastName`);

    if (!KNOWN_TEAMS.has(team)) {
      warnings.push(`${tag} team '${team}' is not in the known 18-team list`);
    }
    if (positionRaw !== '' && !KNOWN_POSITIONS.has(positionRaw)) {
      warnings.push(`${tag} position '${positionRaw}' is not in the known position list`);
    }
    if (stateRaw !== '' && !KNOWN_STATES.has(stateRaw)) {
      warnings.push(`${tag} state '${stateRaw}' is not in VIC/NSW/QLD/SA/WA/TAS/NT/ACT`);
    }

    if (Number.isNaN(heightCm)) {
      warnings.push(`${tag} heightCm '${heightRaw}' is not an integer`);
    } else if (heightCm != null && (heightCm < 160 || heightCm > 215)) {
      warnings.push(`${tag} heightCm ${heightCm} is outside 160-215`);
    }
    if (Number.isNaN(age)) {
      warnings.push(`${tag} age '${ageRaw}' is not an integer`);
    } else if (age != null && (age < 16 || age > 45)) {
      warnings.push(`${tag} age ${age} is outside 16-45`);
    }
    if (Number.isNaN(gamesPlayed)) {
      warnings.push(`${tag} gamesPlayed '${gamesRaw}' is not an integer`);
    } else if (gamesPlayed != null && (gamesPlayed < 0 || gamesPlayed > 450)) {
      warnings.push(`${tag} gamesPlayed ${gamesPlayed} is outside 0-450`);
    }
    if (Number.isNaN(debutYear)) {
      warnings.push(`${tag} debutYear '${debutRaw}' is not an integer`);
    } else if (debutYear != null && (debutYear < 1970 || debutYear > CURRENT_YEAR)) {
      warnings.push(`${tag} debutYear ${debutYear} is outside 1970-${CURRENT_YEAR}`);
    }
    if (Number.isNaN(jumperNumber)) {
      warnings.push(`${tag} jumperNumber '${jumperRaw}' is not an integer`);
    } else if (jumperNumber != null && (jumperNumber < 1 || jumperNumber > 99)) {
      warnings.push(`${tag} jumperNumber ${jumperNumber} is outside 1-99`);
    }
    if (Number.isNaN(finalYear)) {
      warnings.push(`${tag} finalYear '${finalRaw}' is not an integer`);
    }
    if (Number.isNaN(draftPick)) {
      warnings.push(`${tag} draftPick '${draftRaw}' is not an integer`);
    }
    if (active === null) {
      warnings.push(`${tag} active '${activeRaw}' is not TRUE/FALSE`);
    }

    const nicknames = nicknamesRaw === ''
      ? []
      : nicknamesRaw.split('|').map((s) => s.trim()).filter((s) => s !== '');

    players.push({
      id,
      firstName,
      lastName,
      nicknames,
      team,
      position: toStringOrNull(positionRaw),
      age: Number.isNaN(age) ? null : age,
      heightCm: Number.isNaN(heightCm) ? null : heightCm,
      gamesPlayed: Number.isNaN(gamesPlayed) ? null : gamesPlayed,
      jumperNumber: Number.isNaN(jumperNumber) ? null : jumperNumber,
      draftPick: Number.isNaN(draftPick) ? null : draftPick,
      state: toStringOrNull(stateRaw),
      debutYear: Number.isNaN(debutYear) ? null : debutYear,
      finalYear: Number.isNaN(finalYear) ? null : finalYear,
      active: active === null ? false : active,
    });
  });

  fs.writeFileSync(OUTPUT, JSON.stringify(players, null, 2) + '\n', 'utf8');

  // ---- Summary ----
  const activeCount = players.filter((p) => p.active).length;
  const missingPosition = players.filter((p) => p.position == null).length;
  const missingState = players.filter((p) => p.state == null).length;
  const missingDraftPick = players.filter((p) => p.draftPick == null).length;

  console.log(`Imported ${players.length} players -> ${OUTPUT}`);
  console.log('');
  console.log(`Active players:     ${activeCount}`);
  console.log(`Missing position:   ${missingPosition}`);
  console.log(`Missing state:      ${missingState}`);
  console.log(`Missing draftPick:  ${missingDraftPick}`);

  if (warnings.length === 0) {
    console.log('\nNo validation warnings.');
  } else {
    console.log(`\n${warnings.length} validation warning(s):`);
    for (const w of warnings) console.log(`  ${w}`);
  }
}

main();
