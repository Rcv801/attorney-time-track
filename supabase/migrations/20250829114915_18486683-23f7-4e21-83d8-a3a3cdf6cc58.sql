-- Add archived column to entries table
ALTER TABLE public.entries 
ADD COLUMN archived boolean NOT NULL DEFAULT false;