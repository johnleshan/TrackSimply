-- 0004_auth0_required.sql
--
-- Lets an account be marked "Auth0 only", so the password path refuses it.
--
-- Why this is separate from having an email (0003):
--
--   Linking an email ENABLES a new way in. It does not close the old one —
--   'superadmin' with the old shared password would keep working, which is
--   exactly the hole this file closes.
--
--   Keeping it a separate switch also makes the rollout safe. An account can
--   be linked and tested with Auth0 while the password still works; only when
--   someone confirms Auth0 is reachable for that person is the switch turned
--   on. Turning it on before the address is verified locks the account out.
--
-- Break-glass: if an Auth0-only account must be recovered and Auth0 is not
-- available, set the flag back to false directly:
--
--   update public.site_users set auth0_required = false where username = '...';
--
-- That is deliberately possible. This is a lock, not a one-way door.
--
-- Run 0003 first: the constraint below needs the email column.
-- Safe to run more than once.

alter table public.site_users
  add column if not exists auth0_required boolean not null default false;

comment on column public.site_users.auth0_required is
  'When true, the password path refuses this account and sign-in must go through Auth0. Requires email.';

-- An Auth0-only account without an address is unreachable by design, so refuse
-- to create that state rather than discovering it at sign-in time.
alter table public.site_users
  drop constraint if exists site_users_auth0_requires_email;

alter table public.site_users
  add constraint site_users_auth0_requires_email
  check (auth0_required = false or email is not null);
