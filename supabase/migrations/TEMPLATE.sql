-- ============================================================================
-- MIGRATION TEMPLATE — copy this file, do not apply it as-is.
-- Rename to NNNN_short_description.sql
-- ============================================================================
--
-- Phase:      [ EXPAND | MIGRATE | CONTRACT ]
-- Author:
-- Date:
-- Relates to: (issue / PR)
--
-- WHY THIS IS SAFE TO RUN AGAINST LIVE DATA:
--   <Explain what makes this non-destructive. If you cannot answer this in one
--    sentence without hedging, you are in the CONTRACT phase and are not ready.>
--
-- WHAT IT TOUCHES:
--   Tables:    <list>
--   Columns:   <list>
--   Code that must ship alongside: <list, or "none">
--
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. PRE-FLIGHT VERIFICATION (run these FIRST, against production, and paste
--    the actual output into the PR description. Do not proceed if they do not
--    return what you expect.)
-- ---------------------------------------------------------------------------

-- How many rows will this touch? If this is larger than you expect, STOP.
-- SELECT count(*) FROM public.example WHERE <predicate>;

-- Do any rows violate the constraint you are about to add? This must return 0.
-- SELECT count(*) FROM public.example
--  WHERE <new_column> IS NULL;

-- Are there duplicate values that the new constraint would reject?
-- SELECT <col>, count(*) FROM public.example
--  GROUP BY <col> HAVING count(*) > 1;

-- ---------------------------------------------------------------------------
-- 1. THE CHANGE
-- ---------------------------------------------------------------------------

-- ADD COLUMN must be nullable with no default. Postgres takes a lock and
-- rewrites nothing when adding a nullable column without a default, so this is
-- safe on a large table. A non-volatile DEFAULT (e.g. now()) also forces a full
-- table rewrite on older Postgres — avoid it.
--
-- ALTER TABLE public.example ADD COLUMN new_column TEXT;

-- CREATE TABLE is always additive and always safe.
--
-- CREATE TABLE IF NOT EXISTS public.example_child (
--     id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     parent_id  UUID NOT NULL REFERENCES public.example(id) ON DELETE CASCADE,
--     label      TEXT NOT NULL,
--     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
-- );

-- CONTRACT phase only. Never run any of the following until the column has been
-- written and read by a released version of the app for a full release cycle,
-- and you have verified zero remaining references:
--
-- ALTER TABLE public.example DROP COLUMN new_column;
-- ALTER TABLE public.example ALTER COLUMN new_column SET NOT NULL;
-- ALTER TABLE public.example RENAME COLUMN old TO new;
-- ALTER TABLE public.example DROP TABLE other;

-- Adding Row Level Security CHANGES WHAT THE BROWSER CAN SEE. Before enabling it,
-- confirm every query in src/ still returns its rows, and read
-- "The localStorage resurrection bug" in ../../supabase/migrations/README.md --
-- an RLS change that makes a count return 0 will re-insert stale legacy data.
--
-- ALTER TABLE public.example ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY example_select_own ON public.example
--   FOR SELECT USING (<predicate>);

-- ---------------------------------------------------------------------------
-- 2. POST-FLIGHT VERIFICATION (run after, paste output into the PR)
-- ---------------------------------------------------------------------------

-- Row count must be exactly what it was pre-flight. Any difference means you
-- lost or duplicated live data and you must roll back immediately.
-- SELECT count(*) FROM public.example;

-- Build must still succeed, and the affected views must still render:
--   npm run build

COMMIT;

-- ============================================================================
-- Rollback: copy the contents of rollback/NNNN_down.sql here as a comment, or
-- reference it. A migration without a written rollback path is not finished.
-- ============================================================================