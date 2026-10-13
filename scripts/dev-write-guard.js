/**
 * Development-only write guard.
 *
 * With Row Level Security disabled, the publishable anon key can read and write
 * every row in the database. That makes a local instance pointed at production
 * a genuine hazard: a stray click in Bookkeeping, Inventory or Account Manager
 * alters a real client's record with no confirmation beyond the app's own
 * dialog.
 *
 * This plugin intercepts fetch() in the browser and refuses every non-read
 * request, so a live-data session can browse, search and verify analytics
 * without being able to modify anything.
 *
 * Reads pass through untouched. Writes are rejected with an explanation rather
 * than failing silently, so nothing looks like a mysterious bug.
 *
 * Enabled by `npm run dev:live`. It declares `apply: 'serve'`, so it is
 * excluded from `vite build` and cannot reach a production bundle.
 */

const GUARD_SCRIPT = `
(() => {
  const BLOCKED = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);
  const original = window.fetch.bind(window);

  window.fetch = function guardedFetch(input, init = {}) {
    const url = typeof input === 'string' ? input : input?.url || '';
    const method = String(init.method || (typeof input !== 'string' && input?.method) || 'GET').toUpperCase();

    if (BLOCKED.has(method) && /\\/rest\\/v1\\//.test(url)) {
      const table = (url.split('/rest/v1/')[1] || '').split('?')[0] || '?';
      console.warn(
        '[TrackSimply] BLOCKED ' + method + ' ' + table + '\\n' +
        'Read-only session: local testing cannot modify live records.\\n' +
        'Use  npm run dev:demo  to write freely against fixtures, or\\n' +
        '     npm run dev        to write against the real database deliberately.'
      );
      return Promise.resolve(new Response(
        JSON.stringify({
          message: 'Blocked by the local read-only guard.',
          hint: 'Run "npm run dev" to allow writes against the real database.',
        }),
        { status: 405, headers: { 'Content-Type': 'application/json' } }
      ));
    }

    return original(input, init);
  };

  console.info(
    '%c TrackSimply %c READ-ONLY SESSION %c\\n' +
    'Browsing live data. All create, update and delete requests are blocked.\\n' +
    'Nothing you do here can change a client record.',
    'background:#0891b2;color:#0f172a;font-weight:700;padding:2px 6px;border-radius:4px',
    'background:#dc2626;color:#fff;font-weight:700;padding:2px 6px;border-radius:4px',
    'color:inherit'
  );
})();
`;

export function writeGuardPlugin() {
  return {
    name: 'tracksimply-write-guard',
    apply: 'serve',
    transformIndexHtml() {
      return [
        {
          tag: 'script',
          injectTo: 'head-prepend',
          children: GUARD_SCRIPT,
        },
      ];
    },
  };
}