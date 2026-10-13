-- Rollback for 0001_app_settings.sql
--
-- Safe and complete: the table holds one UI preference and no client records, so
-- dropping it discards nothing that matters. The application degrades to
-- localStorage automatically when the table is absent.
--
-- After running this, the report-actions setting reverts to per-browser.

BEGIN;

DROP TABLE IF EXISTS public.app_settings;

COMMIT;
