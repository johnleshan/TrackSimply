# Database change process

This project runs a **live business**. Every user records on this app is real
revenue, real stock and real liabilities. This directory exists so that a schema
change is never a guess.

## Ground rules

1. **The schema is only ever changed by a file in this directory.**
   Never click through changes in the Supabase dashboard. A manual change is
   invisible to the next person and cannot be replayed or rolled back.

2. **Migrations are forward-only and immutable.**
   Once a migration has been applied to production, its file is frozen. If it
   was wrong, write a new migration that corrects it. Editing history destroys
   the only record of what the database actually received.

3. **Numbering.** `NNNN_short_description.sql`, strictly increasing, never reused.
   `0000_baseline.sql` is the exception: it is the captured state of production
   at the moment tracking began and must never be re-applied or edited.

4. **Expand → migrate → contract.** Never combine phases in one release.

   | Phase | Release | Action | Safe because |
   |---|---|---|---|
   | Expand | N | `ADD COLUMN` (nullable, no default), `CREATE TABLE` | Old code ignores new columns |
   | Migrate | N+1 | Backfill data, dual-write, start reading new column | Both columns populated and equal |
   | Contract | N+2 | `DROP COLUMN`, `SET NOT NULL`, rename | Verified zero readers/writers in N+1 |

   A column must survive at least one full release cycle between first being
   written and being dropped.

5. **Every migration ships with a rollback script** in `rollback/NNNN_down.sql`
   and must be preceded by verification queries that prove the change is safe on
   the live data (see `TEMPLATE.sql`).

6. **Nothing destructive without a verified backup and a proven restore.**
   A backup that has never been restored is a hypothesis, not a backup.

## What is currently NOT established

- **`0000_baseline.sql` does not exist yet.** It must be captured from the live
  database (see `../../scripts/README.md`) before any migration is written.
- There is **no Row Level Security** on any table. Tenant isolation is enforced
  only by `user_id` filters that run in browser JavaScript. This is a security
  finding, not a data-loss risk, and is tracked separately.
- The `vehicles` table is used by the application but is **absent** from the
  original `scratch/initialize_database.sql`, which proves production has
  received manual changes. Treat the original file as unreliable.

## Applying

Preferred: the Supabase CLI, which records applied state in
`supabase_migrations.schema_migrations`.

```
supabase db push --db-url "$DATABASE_URL"
```

Manual fallback (only when the CLI is unavailable) is to run the file in the
Supabase SQL editor **in a single transaction**, then append the filename and
timestamp to `APPLIED.md`.