-- Add notes column to clients for storing per-client notes
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS notes text;