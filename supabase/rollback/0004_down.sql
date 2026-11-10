-- 0004_down.sql
--
-- Undoes 0004_auth0_required.sql.
--
-- Dropping the column re-opens the password path for every account. That is the
-- intended recovery: if Auth0 is unreachable, this restores the previous way in.
-- No rows, roles or business records are touched.

alter table public.site_users
  drop constraint if exists site_users_auth0_requires_email;

alter table public.site_users
  drop column if exists auth0_required;
