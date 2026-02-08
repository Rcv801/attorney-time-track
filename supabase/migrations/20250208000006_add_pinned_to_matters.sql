-- Add is_pinned column to matters table
ALTER TABLE matters ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_matters_is_pinned ON matters(is_pinned);
