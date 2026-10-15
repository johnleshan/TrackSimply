# TrackSimply

Bookkeeping and business analytics for small and medium businesses — record
transactions, track debts, plan budgets, keep on top of inventory and a vehicle
fleet, and see your numbers in one clean view.

An AI assistant can answer questions about your own records and act on them,
with a preview before anything is saved.

## Running it

```bash
npm install
npm run dev:demo   # fixtures, writes allowed — safe for a look around
npm run dev:live   # the real database, writes blocked — safe browsing
npm run dev        # the real database, writes allowed — on purpose only
```

Then open http://localhost:5173.

For production:

```bash
npm run build
```

The output in `dist/` is a static bundle; deploy it anywhere that serves files.
Vercel is wired up (`vercel.json`) including the serverless function in `api/`.

## Modes, and why there are three

The three scripts above differ in *what data the app touches* and *what it can
do to it*:

| Script | Data source | Writes |
|---|---|---|
| `npm run dev:demo` | in-memory fixtures | allowed |
| `npm run dev:live` | the real database | **blocked in the browser** |
| `npm run dev` | the real database | allowed |

`dev:live` exists because pointing local code at real business data while
clicking around is how records get damaged. Its write guard rejects every write
with a plain explanation; browses work normally. It is a browser-side guard —
scripts running directly against the database are not covered, so any script
that writes is pointed at `dev:demo` or fixtures.

## AI assistant

Backed by Groq through a small serverless proxy (`api/assistant.js`) so the
access key never ships to the browser. Model and limits are fixed server-side.

To run it, set `GROQ_API_KEY` (no `VITE_` prefix — Vite inlines those into the
public bundle) and, optionally, `GROQ_MODEL`. Verify with:

```bash
node scripts/check-ai.cjs
```

Every read the assistant performs is aggregated server-side before the model
sees it, so prompts contain summaries — not a dump of the ledger.

## Data safety

The database is Supabase (Postgres) accessed through its REST API. A few rules
the project holds itself to:

- **Snapshots first.** `scripts/snapshot-data.cjs` fingerprints every row of
  every table. Multiple times a session, changes are verified against the last
  snapshot so data loss or silent alteration cannot slip by unnoticed:

  ```bash
  node scripts/snapshot-data.cjs --capture    # write baseline
  node scripts/snapshot-data.cjs --compare backups/snapshot-baseline.json
  ```

- **Every row or none.** Supabase caps any single response at 1,000 rows.
  Reads of tables that can exceed that go through `src/lib/pagedFetch.js`,
  which pages in blocks — a plain `select('*')` looks complete and silently
  under-reports.

- **Reads not writes.** Verification scripts only ever read. Writes about app
  behaviour (e.g. what a user has read) stay on the device, not in the database.

- **No data modification without permission.** Especially on the real
  database.

Verification suites (plain Node, no test framework to install):

```bash
node scripts/verify-analytics.js   # report engine
node scripts/verify-accounts.js    # account status rules
```

## Known / in-progress

- Row Level Security is off; Supabase Auth is the intended fix.
- Not yet applied, in `supabase/migrations/`: `0001_app_settings.sql`,
  `0002_user_suspension.sql`.
