-- 0003_down.sql
--
-- Undoes 0003_user_email.sql.
--
-- Dropping the column removes only the Auth0 link. It does not touch usernames,
-- passwords, roles or any business record. After this, every Auth0 sign-in is
-- refused because there is no address to match.

drop index if exists public.site_users_email_lower_idx;

alter table public.site_users
  drop column if exists email;
