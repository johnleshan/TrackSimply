/**
 * Shared date-range presets.
 *
 * Replaces the `getWeekRange()` that was duplicated in DashboardOverview and
 * Bookkeeping. The default week is deliberately preserved as Sunday-to-Saturday:
 * existing screens already display figures derived from it, and silently
 * redefining the week would change numbers the business has already seen.
 */

import { toIsoDate } from './format.js';

export const ALL_TIME = { start: '1970-01-01', end: '2099-12-31' };

function startOfWeekSunday(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function startOfQuarter(date) {
  return new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1);
}

function endOfQuarter(date) {
  return new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3 + 3, 0);
}

function shiftMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

/**
 * Built relative to `now` so the labels stay correct when the app is opened
 * days after a range was last used.
 */
export function buildPresets(now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisWeekStart = startOfWeekSunday(today);

  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  const lastWeekEnd = new Date(thisWeekStart);
  lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);

  const prevMonthAnchor = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevQuarterAnchor = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 - 3, 1);

  return [
    { key: 'today', label: 'Today', range: { start: toIsoDate(today), end: toIsoDate(today) } },
    {
      key: 'thisWeek',
      label: 'This Week',
      range: { start: toIsoDate(thisWeekStart), end: toIsoDate(thisWeekStart.getTime() + 6 * 86400000) },
    },
    {
      key: 'lastWeek',
      label: 'Last Week',
      range: { start: toIsoDate(lastWeekStart), end: toIsoDate(lastWeekEnd) },
    },
    { key: 'thisMonth', label: 'This Month', range: { start: toIsoDate(startOfMonth(today)), end: toIsoDate(endOfMonth(today)) } },
    {
      key: 'lastMonth',
      label: 'Last Month',
      range: { start: toIsoDate(startOfMonth(prevMonthAnchor)), end: toIsoDate(endOfMonth(prevMonthAnchor)) },
    },
    { key: 'thisQuarter', label: 'This Quarter', range: { start: toIsoDate(startOfQuarter(today)), end: toIsoDate(endOfQuarter(today)) } },
    {
      key: 'lastQuarter',
      label: 'Last Quarter',
      range: { start: toIsoDate(startOfQuarter(prevQuarterAnchor)), end: toIsoDate(endOfQuarter(prevQuarterAnchor)) },
    },
    { key: 'ytd', label: 'Year to Date', range: { start: toIsoDate(new Date(today.getFullYear(), 0, 1)), end: toIsoDate(today) } },
    { key: 'lastYear', label: 'Last Year', range: { start: toIsoDate(new Date(today.getFullYear() - 1, 0, 1)), end: toIsoDate(new Date(today.getFullYear() - 1, 11, 31)) } },
    { key: 'allTime', label: 'All Time', range: ALL_TIME },
  ];
}

export function isAllTime(range) {
  return range?.start === ALL_TIME.start;
}

/** Inclusive day count, used for burn-rate and projection maths. */
export function daysInRange(range) {
  const start = new Date(`${range.start}T00:00:00`);
  const end = new Date(`${range.end}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.max(1, Math.round((end - start) / 86400000) + 1);
}

export function isWithin(date, range) {
  if (!date) return false;
  const iso = toIsoDate(date);
  return iso >= range.start && iso <= range.end;
}

/**
 * Picks a bucket size that keeps a series legible. A year of daily points is
 * unreadable as a line chart and wasteful to render.
 */
export function autoGranularity(range) {
  const days = isAllTime(range) ? 365 : daysInRange(range);
  if (days <= 31) return 'day';
  if (days <= 92) return 'week';
  if (days <= 400) return 'month';
  return 'quarter';
}

export function bucketStart(date, granularity) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (granularity === 'week') {
    d.setDate(d.getDate() - d.getDay());
    return d;
  }
  if (granularity === 'month') return new Date(d.getFullYear(), d.getMonth(), 1);
  if (granularity === 'quarter') return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);
  return d;
}

export function nextBucket(date, granularity) {
  const d = bucketStart(date, granularity);
  if (granularity === 'day') d.setDate(d.getDate() + 1);
  else if (granularity === 'week') d.setDate(d.getDate() + 7);
  else if (granularity === 'month') d.setMonth(d.getMonth() + 1);
  else if (granularity === 'quarter') d.setMonth(d.getMonth() + 3);
  return d;
}

/** Fills gaps so a quiet month renders as a zero rather than vanishing. */
export function enumerateBuckets(range, granularity) {
  const buckets = [];
  let cursor = bucketStart(new Date(`${range.start}T00:00:00`), granularity);
  const limit = new Date(`${range.end}T00:00:00`);

  while (cursor <= limit && buckets.length < 2000) {
    buckets.push(cursor);
    cursor = nextBucket(cursor, granularity);
  }
  return buckets;
}

export function describeRange(range) {
  const preset = buildPresets().find((p) => p.range.start === range.start && p.range.end === range.end);
  if (preset) return preset.label;
  if (isAllTime(range)) return 'All Time';
  return `${range.start} to ${range.end}`;
}