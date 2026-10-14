/**
 * Development-only mock Supabase backend.
 *
 * Serves fixture data from the Vite dev server so the app can be run, demoed
 * and reviewed locally without credentials and without touching production.
 *
 * This is a Vite plugin, not application code. It is registered only when
 * `TRACKSIMPLY_MOCK=1` and Vite is in dev mode, so none of it exists in a
 * production build — `npm run build` never loads this file.
 */

const DAY = 86400000;

const iso = (offsetDays) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);

const OWNER = '11111111-1111-1111-1111-111111111111';
const STAFF = '22222222-2222-2222-2222-222222222222';

let counter = 0;
const row = (userId, extra) => ({ id: `demo-${++counter}`, user_id: userId, created_at: new Date().toISOString(), ...extra });

function buildFixtures() {
  counter = 0;
  const rows = { site_users: [], transactions: [], debts: [], budgets: [], inventory: [], vehicles: [] };

  // One account in each state, so the table shows what active, suspended and
  // deactivated actually look like without having to create them first.
  rows.site_users = [
    {
      id: OWNER, username: 'demo_owner', password: 'demo', role: 'superadmin',
      active: true, created_at: iso(-400),
      suspended_at: null, suspended_until: null, suspend_reason: null,
    },
    {
      id: STAFF, username: 'demo_staff', password: 'demo', role: 'user',
      active: true, created_at: iso(-380),
      suspended_at: null, suspended_until: null, suspend_reason: null,
    },
    {
      id: '33333333-3333-3333-3333-333333333333', username: 'demo_suspended', password: 'demo',
      role: 'user', active: true, created_at: iso(-200),
      suspended_at: new Date(Date.now() - 2 * 86400000).toISOString(),
      suspended_until: new Date(Date.now() + 5 * 86400000).toISOString(),
      suspend_reason: 'Awaiting payment confirmation',
    },
    {
      id: '44444444-4444-4444-4444-444444444444', username: 'demo_inactive', password: 'demo',
      role: 'user', active: false, created_at: iso(-150),
      suspended_at: null, suspended_until: null, suspend_reason: null,
    },
  ];

  const tx = (userId, offset, description, amount, type, category, extra = {}) =>
    row(userId, { description, amount, type, category, source: 'business', vehicle_reg: null, date: iso(offset), ...extra });

  // Six months of plausible trading history. Deterministic, but generated
  // relative to today so the demo never looks empty as time passes.
  const products = [
    { name: 'Spiral Bound Notebook', price: 250, qty: [20, 45, 30, 60, 35, 50] },
    { name: 'Ballpoint Pens (Black)', price: 50, qty: [80, 120, 90, 150, 100, 130] },
    { name: 'A4 Printing Paper', price: 1200, qty: [15, 30, 20, 40, 25, 35] },
  ];

  for (let month = 5; month >= 0; month -= 1) {
    const base = -month * 30;

    products.forEach((product, index) => {
      const qty = product.qty[index];
      const start = base - 26;
      rows.transactions.push(tx(OWNER, start, `${product.name} bulk order (x${qty})`, qty * product.price, 'Income', index === 2 ? 'Sales' : 'Sales'));
    });

    rows.transactions.push(tx(OWNER, base - 25, 'Photocopying and binding', 38000 + month * 2500, 'Income', 'Services'));
    rows.transactions.push(tx(OWNER, base - 24, 'Rent', 60000, 'Expense', 'Rent'));
    rows.transactions.push(tx(OWNER, base - 20, 'Printing paper and consumables', 45000 + month * 3000, 'Expense', 'Stock/Inventory'));
    rows.transactions.push(tx(OWNER, base - 17, 'Business licence and permits', 24000, 'Expense', 'Licensing/Insurance'));
    rows.transactions.push(tx(OWNER, base - 14, month === 1 ? 92000 : month === 4 ? 31000 : 22000, 'Expense', 'Marketing'));
    rows.transactions.push(tx(OWNER, base - 12, 'Shop assistant wages', 35000, 'Expense', 'Staff'));
    rows.transactions.push(tx(OWNER, base - 9, 'Electricity and internet', 18500, 'Expense', 'Software'));
    rows.transactions.push(tx(OWNER, base - 6, 'Packaging materials', 14500, 'Expense', 'Stock/Inventory'));

    rows.transactions.push(tx(OWNER, base - 18, 'Delivery run', 26000 + month * 1800, 'Income', 'Revenue', { source: 'vehicle', vehicle_reg: 'KDA 111A' }));
    rows.transactions.push(tx(OWNER, base - 16, 'Diesel', 21000 + month * 900, 'Expense', 'Fuel', { source: 'vehicle', vehicle_reg: 'KDA 111A' }));
    rows.transactions.push(tx(OWNER, base - 5, 'Delivery run', 14500 + month * 700, 'Income', 'Revenue', { source: 'vehicle', vehicle_reg: 'KDB 222B' }));
    if (month !== 3) {
      rows.transactions.push(tx(OWNER, base - 11, month === 0 ? 58000 : 21000, 'Expense', 'Service/Maintenance', { source: 'vehicle', vehicle_reg: 'KDB 222B' }));
    }
    rows.transactions.push(tx(OWNER, base - 10, 'Insurance premium', 32000, 'Expense', 'Licensing/Insurance', { source: 'vehicle', vehicle_reg: 'KDB 222B' }));

    if (month > 0) {
      rows.transactions.push(tx(STAFF, base - 21, 'Small order stationery', 18000, 'Income', 'Sales'));
      rows.transactions.push(tx(STAFF, base - 19, 'Delivery fuel', 9000, 'Expense', 'Fuel', { source: 'vehicle', vehicle_reg: 'KDA 111A' }));
    }
  }

  rows.debts = [
    row(OWNER, { name: 'Business Expansion Loan', total: 1800000, interest: 12, min_payment: 62000 }),
    row(OWNER, { name: 'Bank Overdraft', total: 320000, interest: 18, min_payment: 25000 }),
    // Minimum payment below monthly interest: exercises the "never clears" path.
    row(OWNER, { name: 'Supplier Credit (Line A)', total: 145000, interest: 30, min_payment: 900 }),
  ];

  rows.budgets = [
    row(OWNER, { category: 'Marketing', budget: 60000, actual: 22000 }),
    row(OWNER, { category: 'Stock/Inventory', budget: 180000, actual: 90000 }),
    row(OWNER, { category: 'Rent', budget: 60000, actual: 60000 }),
    row(OWNER, { category: 'Staff', budget: 35000, actual: 35000 }),
    row(OWNER, { category: 'Software', budget: 25000, actual: 18500 }),
  ];

  rows.inventory = [
    row(OWNER, { name: 'Spiral Bound Notebook', stock: 140, reorder: 40, price: 250 }),
    row(OWNER, { name: 'Ballpoint Pens (Black)', stock: 320, reorder: 80, price: 50 }),
    row(OWNER, { name: 'A4 Printing Paper', stock: 28, reorder: 25, price: 1200 }),
    row(OWNER, { name: 'Scientific Calculator', stock: 46, reorder: 15, price: 1850 }),
    row(OWNER, { name: 'Lever Arch File', stock: 62, reorder: 20, price: 950 }),
    row(OWNER, { name: 'Desk Organiser', stock: 9, reorder: 12, price: 800 }),
  ];

  rows.vehicles = [
    row(OWNER, { reg_no: 'KDA 111A', description: 'Isuzu FRR — delivery' }),
    row(OWNER, { reg_no: 'KDB 222B', description: 'Toyota Hiace — staff shuttle' }),
  ];

  return rows;
}

const unquote = (value) => {
  const raw = String(value);
  if (raw.startsWith('"') && raw.endsWith('"')) return raw.slice(1, -1).replace(/\\"/g, '"');
  return raw;
};

/**
 * Applies the subset of PostgREST filters the application actually uses.
 * Without this, a query such as .eq('username', x).single() would receive the
 * whole table and fail, so the mock has to filter and single-row behave
 * correctly rather than just return fixtures.
 */
function applyFilters(rows, params) {
  let out = rows;

  for (const [key, raw] of params.entries()) {
    const match = /^(eq|neq|gt|gte|lt|lte)\.(.*)$/s.exec(raw);
    if (!match) continue;

    const [, op, rawValue] = match;
    const value = unquote(rawValue);

    out = out.filter((row) => {
      const cell = row[key];
      if (cell === undefined || cell === null) return false;

      if (op === 'eq') return String(cell) === value;
      if (op === 'neq') return String(cell) !== value;
      const left = Number(cell);
      const right = Number(value);
      if (Number.isNaN(left) || Number.isNaN(right)) return false;
      if (op === 'gt') return left > right;
      if (op === 'gte') return left >= right;
      if (op === 'lt') return left < right;
      return left <= right;
    });
  }

  return out;
}

/**
 * Applies ?order=column.direction.
 *
 * The mock previously ignored ordering entirely, so rows came back in insertion
 * order. That is not how PostgREST behaves, and it mattered: Bookkeeping reads
 * `txs[0]` as "the newest transaction", which is only true because the real API
 * honours .order('date', { ascending: false }). Without this the mock made a
 * working screen look broken.
 */
function applyOrder(rows, params) {
  const spec = params.get('order');
  if (!spec) return rows;

  // PostgREST applies the last key first, so iterate in reverse to make the
  // leftmost key the primary sort.
  const keys = spec.split(',').map((s) => s.trim()).filter(Boolean).reverse();
  const out = [...rows];

  for (const key of keys) {
    const [column, ...mods] = key.split('.');
    const desc = mods.includes('desc');
    out.sort((a, b) => {
      const av = a[column];
      const bv = b[column];
      if (av === bv) return 0;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv));
      return desc ? -cmp : cmp;
    });
  }

  return out;
}

const ALLOWED_HEADERS = [
  'authorization',
  'apikey',
  'content-type',
  'x-client-info',
  'prefer',
  'range',
  'accept-profile',
  'content-profile',
  'x-supabase-api-version',
].join(', ');

function mockPlugin() {
  let fixtures = buildFixtures();

  return {
    name: 'tracksimply-dev-mock',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url || '';
        if (!rawUrl.startsWith('/rest/v1/') && !rawUrl.startsWith('/auth/v1/')) return next();

        // The Supabase client sends `authorization` and `apikey`, so opening the
        // app on any origin other than the one in VITE_SUPABASE_URL produces
        // cross-origin requests that trigger a preflight. Reaching the app via
        // localhost, 127.0.0.1 or the LAN address are all different origins, so
        // without this the browser rejects every database call.
        res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS);
        res.setHeader('Access-Control-Expose-Headers', 'Content-Range');
        res.setHeader('Access-Control-Max-Age', '86400');
        res.setHeader('Vary', 'Origin');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          return res.end();
        }

        const base = 'http://localhost';
        const parsed = new URL(rawUrl, base);

        if (parsed.pathname.startsWith('/auth/v1/')) {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          return res.end('{}');
        }

        const table = parsed.pathname.slice('/rest/v1/'.length);
        const allRows = fixtures[table];

        // Re-seed hourly so a long-running dev session stays realistic.
        if (!server._mockSeededAt || Date.now() - server._mockSeededAt > 3600000) {
          fixtures = buildFixtures();
          server._mockSeededAt = Date.now();
        }

        const sendJson = (payload, status = 200) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(payload));
        };

        /* Writes are implemented in memory so features that mutate records —
           suspending an account, editing a user — can be exercised end to end
           in demo mode. Demo mode is the only safe place to test a write: the
           dev:live guard blocks mutations against the real database, so without
           this there would be no way to verify a write path at all. */
        if (!allRows) {
          return sendJson([]);
        }

        const readBody = () => new Promise((resolve) => {
          let raw = '';
          req.on('data', (chunk) => { raw += chunk; });
          req.on('end', () => {
            try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); }
          });
        });

        if (req.method === 'PATCH' || req.method === 'PUT') {
          const patch = await readBody();
          const targets = applyFilters(allRows, parsed.searchParams);
          const updated = [];
          for (const row of targets) {
            Object.assign(row, patch);
            updated.push(row);
          }
          return sendJson(updated);
        }

        if (req.method === 'POST') {
          const body = await readBody();
          const incoming = Array.isArray(body) ? body : [body];
          const created = incoming.map((row) => ({
            id: `demo-${Date.now()}-${allRows.length}`,
            created_at: new Date().toISOString(),
            ...row,
          }));
          allRows.push(...created);
          return sendJson(created, 201);
        }

        if (req.method === 'DELETE') {
          const targets = new Set(applyFilters(allRows, parsed.searchParams));
          const kept = allRows.filter((row) => !targets.has(row));
          fixtures[table] = kept;
          return sendJson([]);
        }

        const rows = applyOrder(applyFilters(allRows, parsed.searchParams), parsed.searchParams);
        const wantsSingle = (req.headers.accept || '').includes('vnd.pgrst.object');

        res.setHeader('Content-Range', `0-${Math.max(rows.length - 1, 0)}/*`);

        // HEAD carries the row count for { count: 'exact', head: true }.
        if (req.method === 'HEAD') {
          res.statusCode = 200;
          res.setHeader('Content-Range', `0-${Math.max(rows.length - 1, 0)}/*`);
          return res.end();
        }

        // .single() — PostgREST returns PGRST116 when the result is not exactly
        // one row, and the client surfaces that as an error.
        if (wantsSingle) {
          if (rows.length === 1) {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify(rows[0]));
          }
          res.statusCode = 406;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({
            code: 'PGRST116',
            details: 'Results contain 0 rows',
            hint: null,
            message: 'JSON object requested, multiple (or no) rows returned',
          }));
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify(rows));
      });
    },
  };
}

export { mockPlugin };