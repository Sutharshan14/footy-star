import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const CSV_HEADERS = [
  'id', 'firstName', 'lastName', 'team', 'position', 'age',
  'heightCm', 'gamesPlayed', 'jumperNumber', 'state', 'debutYear',
  'finalYear', 'draftPick', 'nicknames', 'active', 'NEEDS_REVIEW', 'NOTES',
] as const;

type Header = typeof CSV_HEADERS[number];
type Row = Record<Header, string | number | boolean | null>;

function parseArgs(): { inputPath: string; team: string } {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: tsx scripts/parseAflTables.ts <inputFile> <teamName>');
    console.error('  e.g.  tsx scripts/parseAflTables.ts data/raw_pasted/Adelaide.txt Adelaide');
    process.exit(1);
  }
  return { inputPath: args[0], team: args[1] };
}

function calcAge(dobStr: string, today: Date): number | null {
  // Expect YYYY-MM-DD
  const m = dobStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d] = m;
  const dob = new Date(Number(y), Number(mo) - 1, Number(d));
  if (Number.isNaN(dob.getTime())) return null;
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/['’.`]/g, '')        // strip apostrophes / dots
    .replace(/\s+/g, '-')          // spaces -> hyphens
    .replace(/[^a-z0-9-]/g, '-')   // anything else weird -> hyphen
    .replace(/-+/g, '-')           // collapse repeats
    .replace(/^-|-$/g, '');        // trim leading/trailing
}

function makeId(firstName: string, lastName: string): string {
  return `${slug(firstName)}-${slug(lastName)}`;
}

function csvEscape(v: string | number | boolean | null): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : String(v);
  if (/[,"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

interface ParseOutcome {
  row: Row | null;
  warning?: string;
}

function parseLine(
  raw: string,
  lineNum: number,
  team: string,
  today: Date,
  currentSeason: number,
): ParseOutcome {
  // The AFL Tables paste is tab-separated. Trim each cell to absorb stray
  // padding spaces that some browsers add around the tabs.
  const cols = raw.split('\t').map((c) => c.trim());
  if (cols.length < 11) {
    return {
      row: null,
      warning: `line ${lineNum}: expected 11 tab-separated columns, got ${cols.length} — "${raw.trim()}"`,
    };
  }

  const [, jumperRaw, playerRaw, dobRaw, htRaw, , gamesRaw, , seasonsRaw] = cols;
  // (cap, wt, goals, debutAge, lastAge are intentionally ignored)

  // --- Player name: "Last, First [Middle ...]" ----------------------------
  const commaIdx = playerRaw.indexOf(',');
  if (commaIdx === -1) {
    return { row: null, warning: `line ${lineNum}: name has no comma — "${playerRaw}"` };
  }
  const lastName = playerRaw.slice(0, commaIdx).trim();
  const firstName = playerRaw.slice(commaIdx + 1).trim();
  if (!lastName || !firstName) {
    return { row: null, warning: `line ${lineNum}: empty first or last name — "${playerRaw}"` };
  }

  // --- Jumper number ------------------------------------------------------
  if (!/^\d+$/.test(jumperRaw)) {
    return { row: null, warning: `line ${lineNum}: jumper "#" not numeric — "${jumperRaw}"` };
  }
  const jumperNumber = Number(jumperRaw);

  // --- Height: "181cm" ----------------------------------------------------
  const htMatch = htRaw.match(/^(\d+)\s*cm$/i);
  if (!htMatch) {
    return { row: null, warning: `line ${lineNum}: cannot parse HT — "${htRaw}"` };
  }
  const heightCm = Number(htMatch[1]);

  // --- Games played: "340 (185-0-155)" -----------------------------------
  const gMatch = gamesRaw.match(/^(\d+)\s*\(\s*\d+\s*-\s*\d+\s*-\s*\d+\s*\)$/);
  if (!gMatch) {
    return { row: null, warning: `line ${lineNum}: cannot parse Games — "${gamesRaw}"` };
  }
  const gamesPlayed = Number(gMatch[1]);

  // --- Seasons: "1995-2010", single "2024", or comma-separated stints ----
  // AFL Tables joins multiple stints with commas when a player left and
  // returned (e.g. "2005-2013, 2015-2016" or "2008-2009, 2011-2014, 2017-2019").
  // Gap years aren't represented in the schema, so collapse to overall span.
  const seasonChunks = seasonsRaw.split(',').map((c) => c.trim()).filter(Boolean);
  const years: number[] = [];
  let seasonsOk = seasonChunks.length > 0;
  for (const chunk of seasonChunks) {
    const m = chunk.match(/^(\d{4})(?:\s*-\s*(\d{4}))?$/);
    if (!m) { seasonsOk = false; break; }
    years.push(Number(m[1]), m[2] ? Number(m[2]) : Number(m[1]));
  }
  if (!seasonsOk) {
    return { row: null, warning: `line ${lineNum}: cannot parse Seasons — "${seasonsRaw}"` };
  }
  const debutYear = Math.min(...years);
  const lastSeasonYear = Math.max(...years);
  const active = lastSeasonYear === currentSeason;
  const finalYear: number | null = active ? null : lastSeasonYear;

  // --- DOB -> age ---------------------------------------------------------
  const age = calcAge(dobRaw, today);
  if (age === null) {
    return { row: null, warning: `line ${lineNum}: cannot parse DOB — "${dobRaw}"` };
  }

  const row: Row = {
    id: makeId(firstName, lastName),
    firstName,
    lastName,
    team,
    position: '',
    age,
    heightCm,
    gamesPlayed,
    jumperNumber,
    state: '',
    debutYear,
    finalYear: finalYear === null ? '' : finalYear,
    draftPick: '',
    nicknames: '',
    active,
    NEEDS_REVIEW: '',
    NOTES: '',
  };
  return { row };
}

function isHeaderLine(line: string): boolean {
  // The header row from AFL Tables starts with "Cap" and contains "Player".
  return /^\s*Cap\b/i.test(line) && /\bPlayer\b/i.test(line);
}

function main(): void {
  const { inputPath, team } = parseArgs();
  const today = new Date();
  const currentSeason = today.getFullYear();

  const text = readFileSync(inputPath, 'utf8');
  const lines = text.split(/\r?\n/);

  const rows: Row[] = [];
  const warnings: string[] = [];

  lines.forEach((raw, i) => {
    const lineNum = i + 1;
    if (!raw.trim()) return;
    if (isHeaderLine(raw)) return;

    const { row, warning } = parseLine(raw, lineNum, team, today, currentSeason);
    if (row) rows.push(row);
    if (warning) warnings.push(warning);
  });

  const outDir = join('data', 'parsed');
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `${team}.csv`);

  const out: string[] = [];
  out.push(CSV_HEADERS.join(','));
  for (const r of rows) {
    out.push(CSV_HEADERS.map((h) => csvEscape(r[h])).join(','));
  }
  writeFileSync(outPath, out.join('\n') + '\n', 'utf8');

  console.log(`Parsed ${rows.length} player(s) -> ${outPath}`);
  if (warnings.length > 0) {
    console.warn(`\n${warnings.length} row(s) need manual attention:`);
    for (const w of warnings) console.warn(`  ! ${w}`);
    process.exitCode = 0; // not a failure — just a heads-up
  }
}

main();
