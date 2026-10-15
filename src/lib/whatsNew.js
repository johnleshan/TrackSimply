/**
 * What's New.
 *
 * Releases are described in customer language: what changed for them and what
 * they should notice. Internal engineering detail has no place here.
 *
 * `seen` tracking is per variant in localStorage, never in the database —
 * which release a person has read is not business data.
 */

export const APP_VERSION = '1.1.0';

export const RELEASES = [
  {
    version: '1.1.0',
    date: 'October 2026',
    title: 'Sharper numbers, smarter assistant, new Analytics',
    items: [
      {
        kind: 'new',
        text: 'Business Analytics — income, expenses, profit, receivables and chart breakdowns with explanations for every figure. Export to CSV or print a clean report.',
      },
      {
        kind: 'new',
        text: 'The AI assistant can put its answers into action: it can log transactions, record debts and check budgets in the same conversation.',
      },
      {
        kind: 'improved',
        text: 'Reports now open on the most recent period that actually has data, so you never land on an empty month.',
      },
      {
        kind: 'improved',
        text: 'Report settings follow you across the business — a period chosen on the Dashboard is the one Analytics uses.',
      },
      {
        kind: 'improved',
        text: 'Sign-in screen redesigned, remembers credentials properly for password managers, and clears old errors between attempts.',
      },
      {
        kind: 'fixed',
        text: 'Financial figures were only counting the most recent 1,000 transactions. All records are now included, which can change your totals — in the correct direction.',
      },
      {
        kind: 'fixed',
        text: 'Deleted records no longer reappear out of stored browser data, and inventory is edited by exact record, not by name.',
      },
      {
        kind: 'fixed',
        text: 'Charts: tooltips work everywhere, and selecting a doughnut slice no longer hides part of it.',
      },
      {
        kind: 'security',
        text: 'The AI assistant now runs through a server endpoint, so its access key is never sent to your browser.',
      },
    ],
  },
  {
    version: '1.0.0',
    date: 'First release',
    title: 'TrackSimply',
    items: [
      {
        kind: 'new',
        text: 'Bookkeeping, Debt Tracker, Budget Planner, Inventory and Fleet Registry in one place.',
      },
      {
        kind: 'new',
        text: 'AI assistant for questions about your own records, with a live preview before anything is saved.',
      },
    ],
  },
];

const SEEN_KEY = (version) => `tracksimply_whatsnew_seen_${version}`;

/**
 * Versions the user has not seen yet, newest first.
 * @returns {string[]}
 */
export function getUnseenVersions() {
  return RELEASES.filter((r) => !localStorage.getItem(SEEN_KEY(r.version))).map((r) => r.version);
}

/** @param {string} version */
export function markSeen(version) {
  localStorage.setItem(SEEN_KEY(version), new Date().toISOString());
}

/**
 * Called when the user dismisses the panel. Marks every listed release as seen
 * so the badge clears even if older entries are still on screen.
 */
export function markAllSeen() {
  for (const r of RELEASES) markSeen(r.version);
}
