/**
 * Verification for the account suspension logic.
 *
 * Run with:  node scripts/verify-accounts.js
 *
 * The rules around which account state wins, and when a suspension has expired,
 * are the sort of thing that is easy to get subtly wrong and hard to notice —
 * so they are asserted here rather than trusted.
 */

import {
  accountStatus, suspendUntil, isSuspended, isIndefinite, suspensionMessage,
  suspensionRemaining, validateReason, formatDateTime,
  SUSPENSION_PRESETS, INDEFINITE_UNTIL, MAX_REASON_LENGTH,
} from '../src/lib/accountStatus.js';

let passed = 0;
let failed = 0;

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) passed += 1;
  else {
    failed += 1;
    console.error(`  FAIL  ${label}\n        expected ${JSON.stringify(expected)}\n        actual   ${JSON.stringify(actual)}`);
  }
}

function truthy(label, value) {
  if (value) passed += 1;
  else { failed += 1; console.error(`  FAIL  ${label} (got ${JSON.stringify(value)})`); }
}

const NOW = new Date('2026-10-14T12:00:00Z');

const base = {
  id: 'u1', username: 'staff', role: 'user', active: true,
  suspended_at: null, suspended_until: null, suspend_reason: null,
};

/* ------------------------------------------------------------------ */
console.error('\naccountStatus');

check('a plain active account', accountStatus(base, NOW).key, 'active');
check('active label', accountStatus(base, NOW).label, 'Active');

check('deactivated account', accountStatus({ ...base, active: false }, NOW).key, 'inactive');
check('deactivated label', accountStatus({ ...base, active: false }, NOW).label, 'Deactivated');

check('missing user', accountStatus(null, NOW).key, 'unknown');

/* Suspension in the future blocks. */
const suspended = {
  ...base,
  suspended_at: '2026-10-12T12:00:00Z',
  suspended_until: '2026-10-20T12:00:00Z',
  suspend_reason: 'Awaiting payment',
};
const s = accountStatus(suspended, NOW);
check('active-but-suspended reads as suspended', s.key, 'suspended');
check('suspension carries its reason', s.reason, 'Awaiting payment');
check('suspension is not indefinite', s.indefinite, false);

/* An expired suspension must not block. This is the whole point of the field:
   it lifts by itself, with nobody having to remember to undo it. */
check('expired suspension reads as active', accountStatus(
  { ...base, suspended_until: '2026-10-13T12:00:00Z' }, NOW
).key, 'active');

/* The boundary: exactly now is already over. */
check('a suspension ending exactly now has lifted', accountStatus(
  { ...base, suspended_until: '2026-10-14T12:00:00Z' }, NOW
).key, 'active');

/* Indefinite suspension. */
const forever = { ...base, suspended_until: INDEFINITE_UNTIL };
check('indefinite suspension blocks', accountStatus(forever, NOW).key, 'suspended');
check('indefinite suspension is flagged', accountStatus(forever, NOW).indefinite, true);
check('indefinite suspension survives a far-future check',
  accountStatus(forever, new Date('2200-01-01T00:00:00Z')).key, 'suspended');

/* Deactivation outranks suspension. Showing 'suspended' on a deactivated
   account would tell an administrator the wrong thing about why it is off. */
check('deactivated and suspended reads as deactivated', accountStatus(
  { ...base, active: false, suspended_until: '2026-10-20T12:00:00Z' }, NOW
).key, 'inactive');

/* A column that does not exist yet yields undefined, which must not block. */
check('undefined suspension fields are harmless', accountStatus(
  { id: 'u', username: 'x', role: 'user', active: true }, NOW
).key, 'active');
check('garbage timestamp is harmless', accountStatus(
  { ...base, suspended_until: 'not a date' }, NOW
).key, 'active');

check('isSuspended true', isSuspended(suspended, NOW), true);
check('isSuspended false once expired', isSuspended({ ...base, suspended_until: '2026-01-01T00:00:00Z' }, NOW), false);

/* ------------------------------------------------------------------ */
console.error('\nsuspendUntil');

const p = (key) => suspendUntil(key, NOW);
check('24 hours', p('24h'), new Date(NOW.getTime() + 24 * 3600000).toISOString());
check('3 days', p('3d'), new Date(NOW.getTime() + 72 * 3600000).toISOString());
check('1 week', p('1w'), new Date(NOW.getTime() + 168 * 3600000).toISOString());
check('30 days', p('30d'), new Date(NOW.getTime() + 720 * 3600000).toISOString());
check('indefinite preset', p('indefinite'), INDEFINITE_UNTIL);
check('unknown preset is rejected', p('nonsense'), null);
check('every preset resolves', SUSPENSION_PRESETS.filter((x) => p(x.key) === null).length, 0);

check('indefinite detected', isIndefinite(INDEFINITE_UNTIL), true);
check('a normal date is not indefinite', isIndefinite('2026-10-20T12:00:00Z'), false);
check('null is not indefinite', isIndefinite(null), false);

/* ------------------------------------------------------------------ */
console.error('\nsuspensionMessage');

const msg = suspensionMessage(accountStatus(suspended, NOW));
truthy('names the lift time', msg.includes('20 Oct 2026'));
truthy('includes the reason', msg.includes('Awaiting payment'));

const indefMsg = suspensionMessage(accountStatus(forever, NOW));
truthy('indefinite says an administrator must lift it',
  indefMsg.toLowerCase().includes('administrator lifts it'));

check('no message for an active account', suspensionMessage(accountStatus(base, NOW)), null);

/* ------------------------------------------------------------------ */
console.error('\nsuspensionRemaining');

check('indefinite reads as until lifted',
  suspensionRemaining(accountStatus(forever, NOW), NOW), 'until lifted');

const soon = accountStatus({ ...base, suspended_until: new Date(NOW.getTime() + 5 * 3600000).toISOString() }, NOW);
check('hours remaining', suspensionRemaining(soon, NOW), '5 hr left');

const days = accountStatus({ ...base, suspended_until: new Date(NOW.getTime() + 5 * 86400000).toISOString() }, NOW);
check('days remaining', suspensionRemaining(days, NOW), '5 days left');

const expired = accountStatus({ ...base, suspended_until: '2026-10-01T00:00:00Z' }, NOW);
check('no remaining text for an expired suspension', suspensionRemaining(expired, NOW), null);

/* ------------------------------------------------------------------ */
console.error('\nvalidateReason');

check('empty becomes null', validateReason(''), { ok: true, value: null });
check('whitespace becomes null', validateReason('   '), { ok: true, value: null });
check('text is trimmed', validateReason('  late payer  ').value, 'late payer');
check('over the limit is rejected', validateReason('x'.repeat(MAX_REASON_LENGTH + 1)).ok, false);
check('exactly the limit is allowed', validateReason('x'.repeat(MAX_REASON_LENGTH)).ok, true);
check('undefined is allowed and null', validateReason(undefined), { ok: true, value: null });

/* ------------------------------------------------------------------ */
console.error('\nformatDateTime');
check('formats a date', formatDateTime('2026-10-20T14:30:00Z').length > 8, true);
check('invalid date is safe', formatDateTime('rubbish'), '—');
check('null is safe', formatDateTime(null), '—');

console.error(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
