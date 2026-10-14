/**
 * Account suspension.
 *
 * Suspension is deliberately separate from deactivation, because they answer
 * different questions:
 *
 *   Deactivate  the account is off, indefinitely, until an administrator says
 *               otherwise. This is the exit state.
 *   Suspend     the account is off for a bounded period — a mistake, a dispute,
 *               a payment that is expected to arrive. It lifts by itself.
 *
 * Getting the difference wrong has a cost either way: deactivating as a
 * temporary measure means nobody knows when, or whether, to turn it back on;
 * suspending something that should be shut off means it quietly returns.
 *
 * Indefinite suspension is stored as a far-future timestamp rather than NULL,
 * so one column answers both "is this suspended" and "until when". NULL means
 * simply not suspended.
 */

export const INDEFINITE_UNTIL = '9000-01-01T00:00:00.000Z';

const INDEFINITE_YEAR = 9000;

export const SUSPENSION_PRESETS = [
  { key: '24h', label: '24 hours', hours: 24 },
  { key: '3d', label: '3 days', hours: 72 },
  { key: '1w', label: '1 week', hours: 168 },
  { key: '30d', label: '30 days', hours: 720 },
  { key: 'indefinite', label: 'Until lifted', hours: null },
];

export const MAX_REASON_LENGTH = 200;

/** Resolves a preset key into the timestamp to store. */
export function suspendUntil(presetKey, now = new Date()) {
  const preset = SUSPENSION_PRESETS.find((p) => p.key === presetKey);
  if (!preset) return null;
  if (preset.hours === null) return INDEFINITE_UNTIL;
  return new Date(now.getTime() + preset.hours * 3600000).toISOString();
}

export function isIndefinite(until) {
  if (!until) return false;
  const d = until instanceof Date ? until : new Date(until);
  return !Number.isNaN(d.getTime()) && d.getFullYear() >= INDEFINITE_YEAR;
}

/**
 * The single source of truth for what state an account is in. Deactivation is
 * checked first: an account that is both deactivated and previously suspended
 * is deactivated, and saying otherwise would mislead whoever reads the table.
 */
export function accountStatus(user, now = new Date()) {
  if (!user) return { key: 'unknown', label: 'Unknown', tone: 'muted' };

  if (!user.active) {
    return {
      key: 'inactive',
      label: 'Deactivated',
      tone: 'danger',
      detail: 'Signed in as nobody until an administrator reactivates it.',
    };
  }

  const until = user.suspended_until ? new Date(user.suspended_until) : null;
  if (until && !Number.isNaN(until.getTime()) && until.getTime() > now.getTime()) {
    return {
      key: 'suspended',
      label: 'Suspended',
      tone: 'warning',
      until,
      indefinite: isIndefinite(until),
      reason: user.suspend_reason || null,
    };
  }

  return { key: 'active', label: 'Active', tone: 'success' };
}

/** True while a suspension is still blocking sign-in. */
export function isSuspended(user, now = new Date()) {
  return accountStatus(user, now).key === 'suspended';
}

/**
 * The message shown on the sign-in screen. Deliberately explicit: someone who
 * cannot get into their own business deserves to know whether the lock is
 * temporary, and when it lifts.
 */
export function suspensionMessage(status) {
  if (!status || status.key !== 'suspended') return null;
  const reason = status.reason ? ` Reason given: ${status.reason}` : '';
  if (status.indefinite) {
    return `This account is suspended until an administrator lifts it.${reason}`;
  }
  return `This account is suspended until ${formatDateTime(status.until)}.${reason}`;
}

export function formatDateTime(value) {
  // new Date(null) is the epoch, not an invalid date, so an explicit guard is
  // needed or an absent value renders as "1 Jan 1970".
  if (value === null || value === undefined || value === '') return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/** Human summary for the admin table: "3 days left" reads better than a date. */
export function suspensionRemaining(status, now = new Date()) {
  if (!status || status.key !== 'suspended') return null;
  if (status.indefinite) return 'until lifted';
  const ms = status.until.getTime() - now.getTime();
  if (ms <= 0) return 'expired';
  const hours = ms / 3600000;
  if (hours < 1) return `${Math.max(1, Math.round(ms / 60000))} min left`;
  if (hours < 48) return `${Math.round(hours)} hr left`;
  return `${Math.round(hours / 24)} days left`;
}

export function validateReason(reason) {
  const trimmed = String(reason || '').trim();
  if (trimmed.length > MAX_REASON_LENGTH) {
    return { ok: false, error: `Keep the reason under ${MAX_REASON_LENGTH} characters.` };
  }
  return { ok: true, value: trimmed || null };
}
