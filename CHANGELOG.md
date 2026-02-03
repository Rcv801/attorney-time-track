# Changelog

All notable changes to the Attorney Time Tracker will be documented in this file.

## [Unreleased] - 2026-02-02

### Fixed - Critical Bugs

#### 1. Duration Calculation Bug (HIGHEST PRIORITY) ✅
- **Issue**: Paused time was not being subtracted from total duration
- **Location**: Database schema - `entries.duration_sec` generated column
- **Fix**: Updated the generated column formula to subtract `total_paused_seconds` from the elapsed time
- **Impact**: All future timer entries will now correctly calculate duration. Existing entries will automatically recalculate.
- **Migration**: `20260202230707_fix_critical_bugs.sql`
- **Formula**: `EXTRACT(EPOCH FROM (end_at - start_at))::INTEGER - COALESCE(total_paused_seconds, 0)`

#### 2. Multiple Active Timers Prevention (HIGH PRIORITY) ✅
- **Issue**: Need to ensure only one active timer per user at a time
- **Location**: Database constraint on `entries` table
- **Fix**: Verified and ensured unique partial index exists on `user_id WHERE end_at IS NULL`
- **Impact**: Users can no longer accidentally start multiple timers simultaneously
- **Migration**: `20260202230707_fix_critical_bugs.sql` (verification + creation if missing)
- **Constraint**: `idx_entries_single_active` unique index

#### 3. Invoiced Entries Protection (HIGH PRIORITY) ✅
- **Issue**: Users could edit or delete entries after they were added to invoices (data integrity risk)
- **Location**: Database trigger + Frontend UI
- **Fixes Applied**:
  - **Database**: Added `prevent_invoiced_entry_edit()` trigger that blocks modifications to any entry with `invoice_id` set
  - **Frontend**: Disabled Edit and Delete buttons for invoiced entries in `Entries.tsx`
  - **UI Feedback**: Added tooltips explaining why buttons are disabled
- **Impact**: 
  - Invoiced entries are now immutable (except for un-invoicing by clearing `invoice_id`)
  - Attempting to modify invoiced entries will raise a clear error message
  - UI clearly indicates which entries are invoiced (visual styling + disabled controls)
- **Migration**: `20260202230707_fix_critical_bugs.sql`
- **Files Modified**: 
  - `src/pages/app/Entries.tsx` (added `disabled={!!e.invoice_id}` to Edit and Delete buttons)

### Technical Details

**Database Changes:**
- Dropped and recreated `duration_sec` as a generated column with corrected formula
- Added index on `duration_sec` for better query performance
- Created `prevent_invoiced_entry_edit()` trigger function
- Applied trigger to `entries` table on UPDATE operations

**Frontend Changes:**
- Edit button now disabled when `entry.invoice_id` is not null
- Delete button now disabled when `entry.invoice_id` is not null
- Added title attributes to disabled buttons explaining the restriction
- Existing visual indication (muted background) maintained for invoiced entries

**Testing Checklist:**
- [x] Duration calculation includes pause time subtraction
- [ ] Attempting to start second timer while one is active fails with clear error
- [ ] Attempting to edit invoiced entry via UI shows disabled button
- [ ] Attempting to edit invoiced entry via API raises exception
- [ ] Un-invoicing an entry (setting invoice_id to NULL) is allowed
- [ ] Non-invoiced entries can still be edited normally

### Migration Instructions

To apply these fixes to your Supabase instance:

1. **Via Supabase Dashboard:**
   - Go to: SQL Editor
   - Copy the contents of `supabase/migrations/20260202230707_fix_critical_bugs.sql`
   - Run the migration
   - Verify success with the test queries included at the bottom of the migration file

2. **Via Supabase CLI:**
   ```bash
   supabase db push
   ```

3. **Deploy Frontend Changes:**
   ```bash
   npm run build
   # Deploy to your hosting provider
   ```

### Rollback Plan

If issues arise, the changes can be rolled back:

```sql
-- Rollback duration calculation
ALTER TABLE public.entries DROP COLUMN IF EXISTS duration_sec;
ALTER TABLE public.entries ADD COLUMN duration_sec INTEGER GENERATED ALWAYS AS (
  CASE WHEN end_at IS NOT NULL THEN EXTRACT(EPOCH FROM (end_at - start_at))::INTEGER END
) STORED;

-- Remove invoiced entry protection
DROP TRIGGER IF EXISTS prevent_invoiced_entry_edit_trigger ON public.entries;
DROP FUNCTION IF EXISTS public.prevent_invoiced_entry_edit();
```

---

## Format Guidelines

This changelog follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) principles.

**Categories:**
- **Added** for new features
- **Changed** for changes in existing functionality
- **Deprecated** for soon-to-be removed features
- **Removed** for now removed features
- **Fixed** for any bug fixes
- **Security** for vulnerability fixes
