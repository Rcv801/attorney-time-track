-- Add archived column to entries table
ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;

-- Create an index for better performance when filtering by archived status
CREATE INDEX IF NOT EXISTS idx_entries_archived ON public.entries(archived);