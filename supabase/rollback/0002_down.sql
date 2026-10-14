-- Rollback for 0002_user_suspension.sql
--
-- Drops only the columns this migration added. No pre-existing column is
-- touched, so no account data is affected. Any suspension currently in force is
-- lifted, since the application can no longer see the fields.

BEGIN;

ALTER TABLE public.site_users
    DROP COLUMN IF EXISTS suspended_at,
    DROP COLUMN IF EXISTS suspended_until,
    DROP COLUMN IF EXISTS suspend_reason;

COMMIT;
