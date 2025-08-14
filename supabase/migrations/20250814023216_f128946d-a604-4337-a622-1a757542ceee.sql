-- Add pause tracking columns to entries table
ALTER TABLE public.entries 
ADD COLUMN paused_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN total_paused_seconds INTEGER DEFAULT 0;