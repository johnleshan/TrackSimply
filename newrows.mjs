import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split(/\r?\n/)
  .filter(l => l && !l.startsWith('#') && l.includes('='))
  .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; }));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const snap = JSON.parse(fs.readFileSync('backups/snapshot-baseline.json','utf8'));
const tables = snap.tables || snap;
const oldIds = new Set(Object.keys(tables.transactions.rows));
const { data: live } = await sb.from('transactions').select('*').range(0, 2999);
const added = (live||[]).filter(t => !oldIds.has(t.id));
console.log(`baseline count=${tables.transactions.count}  live rows fetched=${live.length}  ADDED=${added.length}\n`);
for (const t of added) console.log(`  ${t.date}  ${t.type}  ${t.category}  "${t.name}"  ${t.amount}  desc=${JSON.stringify(t.description)}  [${t.id.slice(0,8)}]`);
