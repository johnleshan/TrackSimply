/**
 * Formatting helpers.
 *
 * Currency is KES throughout the app (hardcoded in every tool view, so it is
 * kept consistent here rather than introduced as a new source of truth).
 */

const CURRENCY = 'KES';

export function formatCurrency(value, { decimals = 0 } = {}) {
  const n = Number(value) || 0;
  return `${CURRENCY} ${n.toLocaleString('en-KE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

/**
 * Compact form for axis labels and dense tiles, where 'KES 1,450,000' will not
 * fit. Picks a divisor and keeps one decimal only when it carries information.
 */
export function formatCompact(value) {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';

  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (abs >= 10_000) return `${sign}${(abs / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return `${sign}${Math.round(abs)}`;
}

export function formatPercent(value, decimals = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${n.toFixed(decimals)}%`;
}

/** 'en-GB' gives day-month-year, matching the existing Bookkeeping tables. */
export function formatDate(value, options = {}) {
  const d = value instanceof Date ? value : parseIsoDate(value);
  if (!d || Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', ...options });
}

export function formatMonth(value) {
  const d = value instanceof Date ? value : parseIsoDate(value);
  if (!d || Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
}

export function parseIsoDate(value) {
  if (!value) return null;
  // A bare 'YYYY-MM-DD' is parsed as UTC midnight by Date, which lands on the
  // previous day for anyone west of Greenwich. Split it manually so a recorded
  // transaction date always falls on the day it was actually entered.
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toIsoDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function pluralise(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}