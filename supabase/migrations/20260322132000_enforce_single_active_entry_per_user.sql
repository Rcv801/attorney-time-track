BEGIN;

-- Close out duplicate active entries before adding the constraint.
WITH ranked AS (
  SELECT
    id,
    user_id,
    start_at,
    row_number() OVER (
      PARTITION BY user_id
      ORDER BY start_at DESC, created_at DESC, id DESC
    ) AS rn
  FROM public.entries
  WHERE end_at IS NULL
)
UPDATE public.entries e
SET
  end_at = now(),
  paused_at = NULL
FROM ranked r
WHERE e.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_entries_single_active_per_user
  ON public.entries (user_id)
  WHERE end_at IS NULL;

COMMIT;
