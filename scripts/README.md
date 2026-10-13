# Operational scripts

Production tooling. Everything in `scratch/` is throwaway debugging that must
never be run against the live database — several of those files print plaintext
passwords to the console.

## Running the app locally

Three modes. Pick deliberately — two of them touch the live database.

### Demo mode — `npm run dev:demo`

Serves fixture data from the Vite dev server (`scripts/dev-mock-plugin.js`).
**No Supabase project is contacted at all**, so it is safe to click through, add
records and delete them freely.

Open <http://localhost:5173> and sign in with `demo_owner` / `demo`
(a `demo_staff` / `demo` account exists too, to show tenant separation).

The mock is a Vite plugin declaring `apply: 'serve'`, so it is excluded from
`npm run build` and cannot reach production.

### Credentials

Put the real project values in **`.env.local`** at the repo root (gitignored):

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>
```

`.env.local` is loaded in every Vite mode. Do not use `.env.development.local` —
that is only loaded in `development` mode and would be silently ignored by
`--mode live`.

The anon key is publishable by design; it is already embedded in the deployed
client bundle. It does **not** need protecting. The `service_role` key does, and
must never go in this project — nothing here talks to a server.

### Live, read-only — `npm run dev:live`

Connects to the real database with every create, update and delete blocked by a
dev-only guard (`scripts/dev-write-guard.js`). Use this to review real client
records, verify analytics against real figures, and click around freely — you
cannot alter anything.

Blocked requests fail with HTTP 405 and a console explanation rather than
silently, so nothing looks like a mysterious bug.

> This matters because **Row Level Security is not enabled**. The anon key can
> read and write every row, so any local instance pointed at production is a
> hazard. This mode removes that hazard without removing your ability to test.

### Live, writable — `npm run dev`

Connects to the real database and allows writes. There is no confirmation beyond
the app's own dialogs, and no read-only mode.

> Anything you do here **changes live client records**.

To check connectivity without the UI:

```
node scripts/check-connection.cjs
```

Read-only. Reports per-table row counts and confirms the project is reachable.

## `snapshot-data.cjs`

Captures a fingerprint of every row in every table, so you can prove that a
deploy changed the data only in the ways you intended.

It is **read-only by construction**: the file contains no insert, update,
delete, upsert or rpc call. Keep it that way.

### Credentials

Read from the environment, or from `.env` at the repo root (gitignored):

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

The anon key is sufficient **because the script cannot write**. This is also
why adding a write call to this file would be dangerous: with Row Level
Security currently disabled, anyone holding that key can delete the whole
database.

### Capturing the baseline

Do this **now**, before any code change reaches production:

```
node scripts/snapshot-data.cjs --out backups/snapshot-baseline.json
```

Then immediately take a real backup from the Supabase dashboard
(**Project Settings → Database → Backups → Download**) and **verify you can
restore it**. The snapshot proves what changed; the dashboard backup is the
thing that actually gets your records back.

### Verifying a deploy

```
node scripts/snapshot-data.cjs --out backups/before.json
# ... deploy ...
node scripts/snapshot-data.cjs --out backups/after.json
node scripts/snapshot-data.cjs --compare backups/before.json
```

Exit code `0` means no record was lost or silently altered. Exit code `1` means
records disappeared or changed — roll back before doing anything else. The diff
prints the **id** of every affected row, so the exact records can be identified.

Output is written to `backups/`, which is gitignored, because the fingerprints
still describe real business records.

### Reading the results

| Line | Meaning |
|---|---|
| `= IDENTICAL` | Nothing changed. Good. |
| `+ ADDED` | New rows. Expected if the release creates records. |
| `~ CHANGED` | A row was edited. Legitimate only if you intended it. |
| `- REMOVED` | **Data loss.** Investigate immediately. |
| `~ SKIPPED` | Table was unreadable or missing. A change in availability is itself a finding. |

A fingerprint is a SHA-256 of the row's contents with keys sorted, so it is
stable across runs and independent of column order. The `password` column is
excluded from `site_users` fingerprints.

The script paginates. PostgREST returns at most 1000 rows per request by
default, and an unpaginated query would silently truncate — which would look
exactly like mass data loss in the comparison.

## Known limitation

This reads through PostgREST using the **anon** key. Once Row Level Security is
enabled, anon reads will return nothing and the snapshot will report every table
as `unreadable`. That is expected, not a bug — at that point verification must
move to a direct connection (`DATABASE_URL` with the DB password) or to a
privileged read-only Postgres role. Plan for that before starting RLS work.