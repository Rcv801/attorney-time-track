-- Add billed flag to entries
ALTER TABLE public.entries
ADD COLUMN IF NOT EXISTS billed boolean NOT NULL DEFAULT false;

-- Optional: future-proof index if you plan to filter by billed often (commented out)
-- CREATE INDEX IF NOT EXISTS idx_entries_billed ON public.entries (billed);
