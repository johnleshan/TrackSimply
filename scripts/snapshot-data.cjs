/**
 * snapshot-data.cjs — READ-ONLY data fingerprint for TrackSimply.
 *
 * Captures per-table row counts and a per-row fingerprint so that any two points
 * in time can be compared and any record that was created, altered or destroyed
 * can be identified by id.
 *
 * This is the safety net for live business data: run it before and after any
 * deploy and confirm the only differences are the ones you intended.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THIS SCRIPT CANNOT WRITE. It contains no insert, update, delete, upsert, rpc or
 * storage call. Every Supabase query is a `.select()`. Do not add write calls
 * here — the value of this file is that it is safe to run against production.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Usage:
 *   node scripts/snapshot-data.cjs --out backups/snapshot-before.json
 *   node scripts/snapshot-data.cjs --out backups/snapshot-after.json
 *   node scripts/snapshot-data.cjs --compare backups/snapshot-before.json
 *
 * Credentials are read from the environment, or from a .env file in the repo
 * root. They are never printed or written to the snapshot.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const TABLES = ['site_users', 'transactions', 'debts', 'budgets', 'inventory', 'vehicles'];

// Never fingerprint or store credential material. Password changes are not
// business records and a hash of one is still material worth not keeping.
const EXCLUDED_COLUMNS = new Set(['password']);

const PAGE_SIZE = 1000;

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return {};
  const out = {};
  for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function parseArgs(argv) {
  const args = { compare: null, out: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--compare') args.compare = argv[++i];
    else if (argv[i] === '--out') args.out = argv[++i];
  }
  return args;
}

/** Stable stringify so a fingerprint depends on content, not key order. */
function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const keys = Object.keys(value).filter((k) => !EXCLUDED_COLUMNS.has(k)).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
}

function fingerprint(row) {
  return crypto.createHash('sha256').update(canonical(row)).digest('hex').slice(0, 16);
}

/**
 * PostgREST caps responses at `max-rows` (1000 by default). A naive select()
 * silently truncates, which would look like mass data loss. Always paginate.
 */
async function fetchAll(supabase, table) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      return { rows: null, error };
    }
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return { rows, error: null };
}

async function capture() {
  const fileEnv = loadEnv();
  const url = process.env.VITE_SUPABASE_URL || fileEnv.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY || fileEnv.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error(
      'Missing credentials. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY\n' +
        'in the environment, or in a .env file at the repo root.\n\n' +
        'This script is read-only, so the publishable anon key is sufficient —\n' +
        'but that is exactly why it must never contain a write call.'
    );
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const tables = {};

  for (const table of TABLES) {
    const { rows, error } = await fetchAll(supabase, table);

    if (error) {
      const missing =
        error.code === '42P01' ||
        error.code === 'PGRST205' ||
        /does not exist|not found/i.test(error.message || '');
      tables[table] = {
        status: missing ? 'absent' : 'unreadable',
        error: missing ? 'table does not exist' : `${error.code || ''} ${error.message || ''}`.trim(),
        count: null,
        rows: null,
      };
      console.error(`  ${table.padEnd(14)} ${tables[table].status.toUpperCase()} — ${tables[table].error}`);
      continue;
    }

    const fingerprints = {};
    for (const row of rows) {
      const id = row.id !== undefined && row.id !== null ? String(row.id) : `anon:${fingerprint(row)}`;
      fingerprints[id] = fingerprint(row);
    }

    tables[table] = { status: 'ok', count: rows.length, rows: fingerprints };
    console.error(`  ${table.padEnd(14)} ${String(rows.length).padStart(6)} rows`);
  }

  return {
    capturedAt: new Date().toISOString(),
    projectRef: (() => {
      try {
        return new URL(url).hostname.split('.')[0];
      } catch {
        return 'unknown';
      }
    })(),
    tables,
  };
}

function compare(previous, current) {
  const names = new Set([...Object.keys(previous.tables), ...Object.keys(current.tables)]);
  let clean = true;

  for (const name of names) {
    const before = previous.tables[name];
    const after = current.tables[name];

    if (!before || before.status !== 'ok' || !after || after.status !== 'ok') {
      console.log(`\n${name.toUpperCase()}`);
      console.log(`  ~ SKIPPED — ${before?.status || 'absent in first snapshot'} -> ${after?.status || 'absent in second snapshot'}`);
      console.log('    A change in table availability is itself significant. Investigate before continuing.');
      if ((before?.status || 'absent') !== (after?.status || 'absent')) clean = false;
      continue;
    }

    const beforeIds = new Set(Object.keys(before.rows));
    const afterIds = new Set(Object.keys(after.rows));
    const added = [...afterIds].filter((id) => !beforeIds.has(id));
    const removed = [...beforeIds].filter((id) => !afterIds.has(id));
    const changed = [...afterIds].filter(
      (id) => beforeIds.has(id) && before.rows[id] !== after.rows[id]
    );

    const delta = after.count - before.count;
    console.log(`\n${name.toUpperCase()}  ${before.count} -> ${after.count}  (${delta >= 0 ? '+' : ''}${delta})`);

    if (removed.length) {
      clean = false;
      console.log(`  - REMOVED (${removed.length}) — data loss, investigate immediately:`);
      removed.forEach((id) => console.log(`      ${id}`));
    }
    if (changed.length) {
      console.log(`  ~ CHANGED  (${changed.length}) — verify these edits were intended:`);
      changed.forEach((id) => console.log(`      ${id}  ${before.rows[id]} -> ${after.rows[id]}`));
    }
    if (added.length) {
      console.log(`  + ADDED    (${added.length})`);
      added.forEach((id) => console.log(`      ${id}`));
    }
    if (!added.length && !removed.length && !changed.length) {
      console.log('  = IDENTICAL');
    }
  }

  return clean;
}

(async () => {
  const args = parseArgs(process.argv.slice(2));

  if (args.compare) {
    const previous = JSON.parse(fs.readFileSync(args.compare, 'utf8'));
    console.error(`Comparing against ${args.compare}\ncaptured ${previous.capturedAt}\n`);
    const current = await capture();
    const clean = compare(previous, current);
    console.log(
      clean
        ? '\nNo records were lost or silently altered.'
        : '\nRECORDS WERE LOST OR ALTERED. Roll back before going further.'
    );
    process.exit(clean ? 0 : 1);
  }

  console.error('Capturing read-only snapshot...\n');
  const snapshot = await capture();

  if (args.out) {
    fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
    fs.writeFileSync(args.out, JSON.stringify(snapshot, null, 2));
    console.error(`\nWritten to ${args.out}`);
    console.error('Note: backups/ is gitignored. Do not commit this file.');
  } else {
    console.log(JSON.stringify(snapshot, null, 2));
  }
})().catch((err) => {
  console.error('Snapshot failed:', err);
  process.exit(1);
});