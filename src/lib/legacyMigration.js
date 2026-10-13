/**
 * Legacy localStorage -> cloud migration.
 *
 * Historical behaviour, and why it is dangerous:
 *
 *   const { count } = await supabase.from(T).select('id', {count, head}).eq('user_id', id);
 *   if (count === 0 && local.length > 0) await supabase.from(T).insert(local);
 *
 * The guard was "if I have no records, import my old ones". But the localStorage
 * key was never cleared, so any user who deleted all their records of a given
 * type had those records silently resurrected from the browser as new rows on
 * their next login.
 *
 * It is worse than stale data. The same guard fires whenever a query returns
 * zero rows for any reason -- including a transient failure, or Row Level
 * Security hiding rows -- which would re-import stale legacy data for every user
 * at once. Enabling RLS without fixing this would corrupt the dataset
 * wholesale.
 *
 * The fix: migrate at most once per user per entity, ever, and record that fact
 * so the guard can never reopen.
 */

const MARKER_PREFIX = 'tracksimply_migrated_';

/**
 * @param {string} entity   Table name, e.g. 'transactions'.
 * @param {string} userId
 * @param {() => Promise<number|null>} countRemote Rows already in the cloud for this user.
 * @param {() => Promise<any>} migrateUploads Legacy rows. Must be all-or-nothing.
 * @returns {Promise<'skipped'|'already-run'|'imported'|'upload-failed'|'nothing-to-import'>}
 */
export async function runLegacyMigration(entity, userId, countRemote, migrateUploads) {
  const marker = `${MARKER_PREFIX}${entity}_${userId}`;

  if (localStorage.getItem(marker)) {
    return 'already-run';
  }

  let remoteCount;
  try {
    remoteCount = await countRemote();
  } catch {
    // Could not determine remote state. Do NOT migrate and do NOT write the
    // marker, so a genuine first-run import is retried rather than lost.
    return 'skipped';
  }

  if (remoteCount === null) return 'skipped';

  // Cloud already has records for this user. The migration window is closed for
  // good. Sealing it here is what stops deleted records from coming back.
  if (remoteCount > 0) {
    localStorage.setItem(marker, new Date().toISOString());
    return 'skipped';
  }

  try {
    await migrateUploads();
  } catch {
    // Nothing was written (Supabase inserts are atomic), so it is safe to retry
    // on the next load. The marker is intentionally not written.
    return 'upload-failed';
  }

  localStorage.setItem(marker, new Date().toISOString());
  return 'imported';
}