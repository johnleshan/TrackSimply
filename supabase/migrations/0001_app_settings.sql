-- ============================================================================
-- 0001_app_settings
-- ============================================================================
--
-- Phase:      EXPAND  (purely additive — creates one new table)
-- Purpose:    Shared application settings, so a superadmin preference applies
--             to every user and device instead of living in one browser.
-- Touches:    Creates public.app_settings. Does NOT alter, read or move any
--             existing table or row.
-- Code that ships with this: src/lib/appSettings.js (already degrades to
--             localStorage when the table is missing, so the app works either
--             way and order does not matter).
--
-- ============================================================================
-- WHY THIS IS SAFE AGAINST LIVE DATA
-- ============================================================================
--
-- CREATE TABLE is additive. It does not lock, rewrite or read any existing
-- table, so the 1,496 transactions and every client record are untouched. The
-- only new row is the default setting this migration seeds.
--
-- The rollback is equally clean: the table holds one preference and no client
-- data, so dropping it costs nothing.
--
-- ============================================================================
-- KNOWN LIMITATION — READ BEFORE ASSUMING THIS IS A PERMISSION
-- ============================================================================
--
-- Row Level Security is NOT enabled on this table, or any other. With the
-- publishable key embedded in the browser bundle, any client can read and write
-- app_settings directly. This makes the setting SHARED and CONSISTENT; it does
-- NOT make it enforced. Anyone determined enough can override it with developer
-- tools or a single HTTP request.
--
-- Genuine enforcement requires RLS plus a real auth token, which needs the
-- Supabase Auth migration. That is separate, larger work with its own data-safety
-- plan, and must not be bolted on here.
--
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. PRE-FLIGHT — must all be safe before proceeding
-- ---------------------------------------------------------------------------

-- Confirm the table does not already exist. Expected: 0 rows.
-- SELECT count(*) FROM information_schema.tables
--   WHERE table_schema = 'public' AND table_name = 'app_settings';

-- ---------------------------------------------------------------------------
-- 1. THE CHANGE
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.app_settings (
    key         TEXT PRIMARY KEY,
    value       JSONB,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.app_settings IS
    'Shared UI preferences. Not a security boundary: RLS is disabled, so any client holding the publishable key can write here.';

-- Seed the default. Report actions are off because exporting writes real client
-- records to a file, which should not happen as a side effect of viewing a report.
INSERT INTO public.app_settings (key, value)
VALUES ('reportActionsEnabled', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. POST-FLIGHT
-- ---------------------------------------------------------------------------

-- Exactly one row, value false.
-- SELECT key, value FROM public.app_settings;

COMMIT;

-- ============================================================================
-- ROLLBACK — see supabase/rollback/0001_down.sql
-- The table holds no client data, so this is safe:
--   DROP TABLE IF EXISTS public.app_settings;
-- ============================================================================
