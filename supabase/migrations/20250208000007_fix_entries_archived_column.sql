-- Reconcile old archived-column naming mismatch.
-- Earlier migration created is_archived, but the app and later Phase 2 schema expect archived.

BEGIN;

ALTER TABLE public.entries
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

UPDATE public.entries
SET archived = COALESCE(is_archived, archived, false)
WHERE archived IS DISTINCT FROM COALESCE(is_archived, archived, false);

CREATE INDEX IF NOT EXISTS idx_entries_archived ON public.entries(archived);

COMMIT;
