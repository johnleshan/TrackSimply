-- 0003_user_email.sql
--
-- Links an Auth0 identity to a TrackSimply account.
--
-- Why a column rather than a match on the username:
--
--   Auth0 identifies a person by a verified email address. TrackSimply accounts
--   are keyed by a username that is not an email ('admin', 'superadmin', 'user'),
--   so there is nothing to compare. Without this column an Auth0 sign-in has no
--   way to find its role, and guessing (for example by username prefix) is how
--   privilege escalation happens.
--
-- The rule the application enforces:
--
--   * an Auth0 address is trusted only when Auth0 reports email_verified = true
--   * it must match EXACTLY ONE row here
--   * if it matches nothing, the sign-in is refused; no account is ever created
--   * the role comes from the row, never from Auth0
--
-- A UNIQUE index on lower(email) enforces the "exactly one" part in the database
-- itself, so a race or a careless edit cannot make one address resolve to two
-- roles. It is partial because most rows will have no email.
--
-- Safe to run more than once.

alter table public.site_users
  add column if not exists email text;

comment on column public.site_users.email is
  'Verified Auth0 email address linked to this account. NULL means the account cannot sign in with Auth0.';

create unique index if not exists site_users_email_lower_idx
  on public.site_users (lower(email))
  where email is not null;
