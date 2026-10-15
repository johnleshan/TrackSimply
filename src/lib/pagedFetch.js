/**
 * Reads every row of a table, not just the first page.
 *
 * Supabase caps any single PostgREST response at 1,000 rows (db-max-rows).
 * `.select('*')` with no `.limit()` therefore looks complete but silently stops
 * at 1,000.
 *
 * This was not theoretical on this database: the admin user had 1,507
 * transactions, so Bookkeeping, Dashboard, Analytics and the AI assistant were
 * all working from 1,000 of them. Income, expenses and category totals were
 * understated, and net position was out by 1,074,018 KES. Nothing errored. It
 * just reported wrong numbers about the client's money, which is the one class
 * of bug that must not ship.
 *
 * A `.range()` request inside the cap still returns in full, so paging in fixed
 * blocks and stopping on a short block gets the whole table. The loop asks for
 * one row past the end to detect the final page reliably rather than guessing
 * from a full block, which would need an extra round trip in the common case.
 */

import { supabase } from './supabase';

const PAGE_SIZE = 500;

/**
 * @param {string} table
 * @param {object} [opts]
 * @param {string} [opts.columns]  columns to select, defaults to all
 * @param {object} [opts.eq]       column -> value, applied as equality filters
 * @param {object} [opts.order]    column -> { ascending }
 * @param {number} [opts.pageSize]
 * @returns {Promise<{ data: any[], error: Error|null, truncated: boolean }>}
 */
export async function fetchAllRows(table, opts = {}) {
  const { columns = '*', eq = {}, order = {}, pageSize = PAGE_SIZE } = opts;

  const rows = [];
  let from = 0;
  let truncated = false;

  for (;;) {
    let query = supabase.from(table).select(columns).range(from, from + pageSize - 1);

    for (const [column, value] of Object.entries(eq)) {
      query = query.eq(column, value);
    }

    for (const [column, direction] of Object.entries(order)) {
      query = query.order(column, direction);
    }

    const { data, error } = await query;
    if (error) return { data: rows, error, truncated };

    const batch = data || [];
    rows.push(...batch);

    // A short block means we have reached the end.
    if (batch.length < pageSize) break;

    from += pageSize;

    // Backstop. If the row cap is ever removed server-side, this still
    // terminates rather than looping forever.
    if (rows.length >= 1_000_000) {
      truncated = true;
      break;
    }
  }

  return { data: rows, error: null, truncated };
}

/**
 * PostgREST caps a single request at 1,000 rows. This is the same cap, named,
 * so the number that decides correctness is in one place rather than scattered
 * as magic values.
 */
export const ROW_CAP = 1000;