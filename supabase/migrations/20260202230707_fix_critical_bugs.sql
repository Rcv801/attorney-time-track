-- ================================================
-- CRITICAL BUG FIXES - Created: 2026-02-02 23:07
-- ================================================
-- 1. Fix duration calculation to subtract paused time
-- 2. Ensure single active timer constraint exists
-- 3. Prevent editing of invoiced entries
-- ================================================

-- ================================================
-- BUG FIX #1: Duration Calculation (HIGHEST PRIORITY)
-- ================================================
-- Issue: Paused time not subtracted from total duration
-- Fix: Update the generated column to subtract total_paused_seconds

-- Drop the old generated column
ALTER TABLE public.entries 
DROP COLUMN IF EXISTS duration_sec;

-- Recreate with correct calculation
ALTER TABLE public.entries 
ADD COLUMN duration_sec INTEGER GENERATED ALWAYS AS (
  CASE 
    WHEN end_at IS NOT NULL THEN 
      GREATEST(
        0, 
        EXTRACT(EPOCH FROM (end_at - start_at))::INTEGER - COALESCE(total_paused_seconds, 0)
      )
    ELSE NULL
  END
) STORED;

-- Add index for better performance when filtering by duration
CREATE INDEX IF NOT EXISTS idx_entries_duration_sec ON public.entries(duration_sec) 
WHERE duration_sec IS NOT NULL;

-- ================================================
-- BUG FIX #2: Multiple Timers Prevention (HIGH PRIORITY)
-- ================================================
-- Issue: Need to ensure no multiple active timers per user
-- Fix: Ensure the unique partial index exists (it was added in a previous migration,
--      but we're ensuring it exists here for safety)

-- This prevents multiple active timers (end_at IS NULL) for the same user
CREATE UNIQUE INDEX IF NOT EXISTS idx_entries_single_active
ON public.entries(user_id)
WHERE end_at IS NULL;

-- ================================================
-- BUG FIX #3: Invoiced Entries Protection (HIGH PRIORITY)
-- ================================================
-- Issue: Users can edit entries after they're invoiced
-- Fix: Add trigger to block updates to invoiced entries

-- Create function to prevent editing invoiced entries
CREATE OR REPLACE FUNCTION public.prevent_invoiced_entry_edit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if the entry is already invoiced
  IF OLD.invoice_id IS NOT NULL THEN
    -- Allow updating invoice_id to NULL (un-invoicing)
    -- But block all other changes
    IF NEW.invoice_id IS NULL THEN
      -- Only allow changing invoice_id back to NULL, no other changes
      IF (NEW.start_at IS DISTINCT FROM OLD.start_at OR
          NEW.end_at IS DISTINCT FROM OLD.end_at OR
          NEW.client_id IS DISTINCT FROM OLD.client_id OR
          NEW.notes IS DISTINCT FROM OLD.notes OR
          NEW.paused_at IS DISTINCT FROM OLD.paused_at OR
          NEW.total_paused_seconds IS DISTINCT FROM OLD.total_paused_seconds OR
          NEW.archived IS DISTINCT FROM OLD.archived OR
          NEW.billed IS DISTINCT FROM OLD.billed) THEN
        RAISE EXCEPTION 'Cannot modify invoiced entries. Please un-invoice the entry first.';
      END IF;
    ELSE
      -- invoice_id is not being cleared, block all changes except invoice_id itself
      IF (NEW.start_at IS DISTINCT FROM OLD.start_at OR
          NEW.end_at IS DISTINCT FROM OLD.end_at OR
          NEW.client_id IS DISTINCT FROM OLD.client_id OR
          NEW.notes IS DISTINCT FROM OLD.notes OR
          NEW.paused_at IS DISTINCT FROM OLD.paused_at OR
          NEW.total_paused_seconds IS DISTINCT FROM OLD.total_paused_seconds OR
          NEW.archived IS DISTINCT FROM OLD.archived OR
          NEW.billed IS DISTINCT FROM OLD.billed) THEN
        RAISE EXCEPTION 'Cannot modify invoiced entries';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS prevent_invoiced_entry_edit_trigger ON public.entries;

-- Create trigger to enforce the protection
CREATE TRIGGER prevent_invoiced_entry_edit_trigger
  BEFORE UPDATE ON public.entries
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_invoiced_entry_edit();

-- ================================================
-- VERIFICATION QUERIES (for testing)
-- ================================================
-- Run these after migration to verify:
--
-- 1. Check duration calculation:
--    SELECT id, start_at, end_at, total_paused_seconds, duration_sec
--    FROM public.entries WHERE end_at IS NOT NULL LIMIT 10;
--
-- 2. Try creating multiple active timers (should fail):
--    INSERT INTO public.entries (user_id, client_id, start_at) 
--    VALUES (..., ..., NOW());
--    -- Run again with same user_id (should fail)
--
-- 3. Try editing an invoiced entry (should fail):
--    UPDATE public.entries SET notes = 'test' WHERE invoice_id IS NOT NULL;
-- ================================================
