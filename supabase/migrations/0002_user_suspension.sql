-- ============================================================================
-- 0002_user_suspension
-- ============================================================================
--
-- Phase:      EXPAND  (purely additive — three nullable columns on site_users)
-- Purpose:    Suspend an account for a bounded period, separately from
--             deactivating it permanently.
-- Touches:    public.site_users — ADDs three nullable columns. Does not alter,
--             rename or drop any existing column, and does not touch a single
--             existing row.
-- Code that ships with this: src/lib/accountStatus.js treats the fields as
--             absent when they do not exist, and src/context/AuthContext.jsx
--             simply never blocks anyone. So the app works before or after the
--             migration and the order does not matter.
--
-- ============================================================================
-- WHY THIS IS SAFE AGAINST LIVE DATA
-- ============================================================================
--
-- Adding a nullable column with no default does not rewrite the table in
-- PostgreSQL and takes only a momentary lock, so it is safe on a live table.
-- The three existing accounts will read NULL for all three fields, which means
-- "not suspended" — exactly the behaviour they have today.
--
-- Nothing is backfilled and no existing column is modified, so there is no path
-- by which an account is locked out by this change.
--
-- ============================================================================
-- KNOWN LIMITATION
-- ============================================================================
--
-- Enforcement happens in the browser, in the login query. With Row Level
-- Security disabled, a suspended user holding the publishable key could talk to
-- the API directly and bypass the check entirely. Suspension is a real
-- deterrent against a normal user and meaningless against a determined one.
-- Adding an RLS policy on site_users is the actual fix, and belongs with the
-- Auth migration rather than here.
--
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. PRE-FLIGHT — expected: 0 for each
-- ---------------------------------------------------------------------------

-- SELECT count(*) FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='site_users'
--     AND column_name IN ('suspended_at','suspended_until','suspend_reason');

-- Confirm no row is currently suspended in a way this would misread. Expected: 3.
-- SELECT count(*) FROM public.site_users WHERE active = true;

-- ---------------------------------------------------------------------------
-- 1. THE CHANGE
-- ---------------------------------------------------------------------------

ALTER TABLE public.site_users
    ADD COLUMN IF NOT EXISTS suspended_at    TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS suspend_reason  TEXT;

COMMENT ON COLUMN public.site_users.suspended_until IS
    'NULL = not suspended. A past timestamp = suspension expired. A far-future timestamp (year 9000) = suspended until an administrator lifts it.';
COMMENT ON COLUMN public.site_users.suspend_reason IS
    'Shown to the user on the sign-in screen when their suspension blocks them.';

-- ---------------------------------------------------------------------------
-- 2. POST-FLIGHT
-- ---------------------------------------------------------------------------

-- Three columns, three rows, none suspended.
-- SELECT username, active, suspended_until, suspend_reason FROM public.site_users;

COMMIT;

-- ============================================================================
-- ROLLBACK — supabase/rollback/0002_down.sql
--   ALTER TABLE public.site_users
--     DROP COLUMN IF EXISTS suspended_at,
--     DROP COLUMN IF EXISTS suspended_until,
--     DROP COLUMN IF EXISTS suspend_reason;
-- Drops only the new columns. No existing data is affected.
-- ============================================================================
