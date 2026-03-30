-- Historical seed migration disabled for clean/project-agnostic bootstraps.
--
-- The original file inserted demo rows using an outdated schema
-- (missing user_id ownership and referencing non-existent columns like email/rate).
--
-- Keep this migration number as a no-op so existing histories remain contiguous,
-- but do not seed production/dev cloud projects implicitly.

DO $$
BEGIN
  RAISE NOTICE 'Skipping legacy demo seed migration 20250208000002_seed_data.sql';
END $$;
