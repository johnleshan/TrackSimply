# Rollback scripts

One file per migration: `NNNN_down.sql`, matching `../migrations/NNNN_*.sql`.

A rollback script is **not** "undo my migration". Restoring dropped business data
is impossible from SQL alone, so:

- **EXPAND migrations** (`ADD COLUMN`, `CREATE TABLE`) — rollback is safe and
  non-destructive: `ALTER TABLE ... DROP COLUMN` on a column nothing has read
  yet discards no data.
- **CONTRACT migrations** (`DROP COLUMN`, `SET NOT NULL`, type changes) —
  rollback is **destructive or impossible**. This is the entire reason they must
  sit a full release cycle behind. If the data cannot be recovered from a
  verified backup, the migration must not be written.

Before relying on a rollback script, rehearse it against a restored copy of
production. Untested rollback is the same category of fiction as untested backup.