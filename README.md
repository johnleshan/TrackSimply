# TrackSimply

Bookkeeping and business analytics for small and medium businesses — record
transactions, track debts, plan budgets, keep on top of inventory and a vehicle
fleet, and see your numbers in one clean view.

An AI assistant can answer questions about your own records and act on them,
with a preview before anything is saved.

## Entry, and why a signed-in user still sees the landing page

The marketing landing page is the front door for everyone. A remembered session
does not skip past it — the visitor lands on the marketing page, and "Step
inside" then either drops a remembered user straight into the app or shows the
sign-in screen for everybody else. Signing out returns to the front door.

The reason is not decoration. It is the only reliable way to reach people who
were already signed in when a release ships: their session restores instantly
and they would otherwise go straight to the tools and never learn what changed.
The release panel is gated the same way — it opens once the visitor is actually
inside the app, never on top of the landing page.

## Signing in, and the Auth0 alternative

Username and password still work, unchanged. A second path sits beside it:
**Continue with Auth0** on the sign-in screen, using Auth0's Universal Login.

Auth0 proves *who* someone is. It never decides *what they may do*:

| Step | Rule |
|---|---|
| Address trusted? | Only when Auth0 reports `email_verified = true` |
| Which account? | Exactly one `site_users` row with that email |
| Role source | That row — never a claim from Auth0 |
| No match | Refused; no account is ever created |
| Suspended / deactivated | Refused, same gate as the password path |

A stranger can sign up in Auth0 (its login page is public) and still get
nothing: no linked row means no entry. Linking is deliberate — an administrator
fills in **Linked email** on an account in Account Management. The database
enforces the "exactly one" part with a unique index on `lower(email)`.

**Setup:**

1. Apply `supabase/migrations/0003_user_email.sql`.
2. In Account Management, set **Linked email** on the accounts that should use
   Auth0. Leave it blank to keep an account password-only.
3. In the Auth0 application, list every origin the app runs on under Allowed
   Callback URLs, Allowed Logout URLs and Allowed Web Origins — including
   `http://localhost:5173` for local work. A missing entry appears as
   "Callback URL mismatch" after login.
4. Leave the address unverified in Auth0 and sign-in is refused on purpose. That
   is what stops someone claiming `admin@yourcompany.com` by simply typing it.

`VITE_AUTH0_DOMAIN` and `VITE_AUTH0_CLIENT_ID` are public and may be committed;
the client secret of an SPA does not exist. The SDK itself is loaded on demand,
so visitors who never touch Auth0 do not download it.

One limit worth stating plainly: this protects the *sign-in*, not the database.
While Row Level Security is disabled and the publishable key ships in the bundle,
anyone can write to `site_users` directly. See `supabase/migrations/README.md`.

## Running it

```bash
npm install
npm run dev:demo   # fixtures, writes allowed — safe for a look around
npm run dev:live   # the real database, writes blocked — safe browsing
npm run dev        # the real database, writes allowed — on purpose only
```

Then open http://localhost:5173.

For production:

```bash
npm run build
```

The output in `dist/` is a static bundle; deploy it anywhere that serves files.
Vercel is wired up (`vercel.json`) including the serverless function in `api/`.

## Modes, and why there are three

The three scripts above differ in *what data the app touches* and *what it can
do to it*:

| Script | Data source | Writes |
|---|---|---|
| `npm run dev:demo` | in-memory fixtures | allowed |
| `npm run dev:live` | the real database | **blocked in the browser** |
| `npm run dev` | the real database | allowed |

`dev:live` exists because pointing local code at real business data while
clicking around is how records get damaged. Its write guard rejects every write
with a plain explanation; browses work normally. It is a browser-side guard —
scripts running directly against the database are not covered, so any script
that writes is pointed at `dev:demo` or fixtures.

## AI assistant

Backed by Groq through a small serverless proxy (`api/assistant.js`) so the
access key never ships to the browser. Model and limits are fixed server-side.

To run it, set `GROQ_API_KEY` (no `VITE_` prefix — Vite inlines those into the
public bundle) and, optionally, `GROQ_MODEL`. Verify with:

```bash
node scripts/check-ai.cjs
```

Every read the assistant performs is aggregated server-side before the model
sees it, so prompts contain summaries — not a dump of the ledger.

## Data safety

The database is Supabase (Postgres) accessed through its REST API. A few rules
the project holds itself to:

- **Snapshots first.** `scripts/snapshot-data.cjs` fingerprints every row of
  every table. Multiple times a session, changes are verified against the last
  snapshot so data loss or silent alteration cannot slip by unnoticed:

  ```bash
  node scripts/snapshot-data.cjs --capture    # write baseline
  node scripts/snapshot-data.cjs --compare backups/snapshot-baseline.json
  ```

- **Every row or none.** Supabase caps any single response at 1,000 rows.
  Reads of tables that can exceed that go through `src/lib/pagedFetch.js`,
  which pages in blocks — a plain `select('*')` looks complete and silently
  under-reports.

- **Reads not writes.** Verification scripts only ever read. Writes about app
  behaviour (e.g. what a user has read) stay on the device, not in the database.

- **No data modification without permission.** Especially on the real
  database.

Verification suites (plain Node, no test framework to install):

```bash
node scripts/verify-analytics.js   # report engine
node scripts/verify-accounts.js    # account status rules
```

## Known / in-progress

- Row Level Security is off; Supabase Auth is the intended fix.
- Not yet applied, in `supabase/migrations/`: `0001_app_settings.sql`,
  `0002_user_suspension.sql`.
