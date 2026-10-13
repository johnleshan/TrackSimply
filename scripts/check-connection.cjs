/**
 * Read-only connectivity check against the live TrackSimply database.
 *
 * Contains no insert, update, delete or rpc call. Reports whether the project
 * is reachable and how many rows each table holds, so the shape of the live
 * data is known before anyone opens the app.
 *
 * Run with:  node scripts/check-connection.js
 */

const { createClient } = require('@supabase/supabase-js');

const TABLES = ['site_users', 'transactions', 'debts', 'budgets', 'inventory', 'vehicles'];

async function main() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY first.');
    process.exit(1);
  }

  console.log(`Project: ${new URL(url).hostname.split('.')[0]}\n`);
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (const table of TABLES) {
    const { count, error } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true });

    if (error) {
      console.log(`  ${table.padEnd(14)} ERROR  ${error.code || ''} ${error.message}`);
    } else {
      console.log(`  ${table.padEnd(14)} ${String(count ?? 0).padStart(6)} rows`);
    }
  }

  console.log('\nReachable, read-only. Nothing was written.');
}

main().catch((err) => {
  console.error('Connection failed:', err.message);
  process.exit(1);
});