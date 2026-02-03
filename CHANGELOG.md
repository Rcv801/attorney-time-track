# Changelog

All notable changes to the Attorney Time Tracker will be documented in this file.

## [Unreleased] - 2026-02-03

### Fixed - Bug Fixes Round 2

#### 1. Timer Performance Optimization (BUG-001) ✅
- **Priority**: MEDIUM
- **Issue**: Timer could potentially drift over long periods (8+ hours)
- **Location**: `src/pages/app/Dashboard.tsx` - useEffect timer logic
- **Fix**: Optimized timer to parse timestamps once instead of on each tick
- **Details**:
  - Timer already used drift-free approach (`Date.now() - startTime`)
  - Improved efficiency by caching parsed timestamps
  - Added comprehensive comments explaining anti-drift mechanism
- **Impact**: More efficient timer with same accuracy, clearer code for maintenance
- **Testing**: Verified via code review and build test; manual testing recommended for 30+ minute sessions

#### 2. Paused Timer Billing Accuracy (BUG-003) ✅
- **Priority**: LOW
- **Issue**: Concern that paused timer might show incorrect billing amount
- **Location**: `src/pages/app/Dashboard.tsx` - activeAmount calculation
- **Fix**: Verified calculation is correct; added clarifying comments
- **Details**:
  - Billing calculation uses `elapsed` which already excludes `total_paused_seconds`
  - No code changes needed - already working correctly
  - Added comment to document the intended behavior
- **Impact**: Code clarity improved; billing remains accurate
- **Formula**: `(elapsed / 3600) * hourlyRate` where `elapsed` excludes paused time

#### 3. Hourly Rate Validation (BUG-004) ✅
- **Priority**: MEDIUM
- **Issue**: No validation on hourly rate input; users could enter negative, non-numeric, or extremely large values
- **Location**: `src/pages/app/Clients.tsx` - rate input field and client creation/editing
- **Fix**: Added comprehensive validation at multiple levels
- **Changes**:
  - HTML5 validation: `min="0"`, `max="10000"`, `required` attributes
  - JavaScript validation in `add()` function with error alerts
  - JavaScript validation in `rename()` function with error alerts
  - Added helpful hint text: "Must be between $0 and $10,000"
  - Updated prompt text to show validation requirements
- **Impact**: 
  - Prevents `$NaN` display issues
  - Prevents negative billing amounts
  - Prevents unrealistic hourly rates
  - Better user experience with clear error messages
- **Valid Range**: $0.00 - $10,000.00

#### 4. Invoice File Upload/Download Verification (BUG-007) ✅
- **Priority**: MEDIUM
- **Issue**: Invoice file upload/download functionality hadn't been tested
- **Location**: `src/components/InvoiceCreateDialog.tsx`, `src/pages/app/Invoices.tsx`
- **Fix**: Comprehensive code review + testing preparation
- **Findings**:
  - Code is well-implemented and follows best practices
  - Proper error handling with user-friendly toasts
  - Accepts: `.pdf`, `.jpg`, `.jpeg`, `.png`
  - Uses Supabase Storage with proper security (files scoped to user ID)
  - Download implementation uses proper blob handling with cleanup
- **Testing Resources Created**:
  - `test-invoice.html` for generating test PDFs
  - Detailed test plan in `TESTING_PLAN.md`
- **Impact**: Confidence that file upload/download is production-ready
- **Status**: Code verified; manual testing recommended before launch

#### 5. Delete All Data Functionality (BUG-008) ✅
- **Priority**: LOW
- **Issue**: "Delete All Data" used hacky SQL workaround (`.neq("id", "00000000...")`)
- **Location**: `src/pages/app/Settings.tsx` - wipe function
- **Fix**: Replaced with proper deletion logic
- **Changes**:
  - Replaced `.neq()` hack with `.eq("user_id", user.id)`
  - Added comprehensive error handling (try/catch)
  - Added deletion for invoices table (was missing)
  - Proper deletion order: entries → invoices → clients
  - User feedback via success/error alerts
  - Page refresh after deletion to clear cached state
  - Respects Row Level Security (RLS) and foreign key constraints
- **Impact**:
  - Properly scoped to current user's data only
  - Better error handling and user feedback
  - More maintainable code
  - Safer deletion process
- **Security**: Only deletes data for authenticated user, respects RLS policies

### Testing & Documentation

#### Files Created
- `BUG_FIXES_ROUND_2_REPORT.md` - Comprehensive test report with detailed analysis
- `TESTING_PLAN.md` - Manual testing procedures for all bug fixes
- `test-invoice.html` - Sample invoice for PDF upload testing

#### Build Verification
- ✅ TypeScript compilation successful
- ✅ No errors or warnings (except chunk size optimization opportunity)
- ✅ All 1822 modules transformed successfully
- ✅ Production build completes in ~3.3 seconds

#### Commit Information
- **Commit**: `79d0044`
- **Files Modified**: 3 (Dashboard.tsx, Clients.tsx, Settings.tsx)
- **Files Created**: 3 (test reports and testing resources)
- **Status**: Committed to main branch, ready to push

### Recommendations Before Launch

#### Critical Manual Tests
1. Timer accuracy over 30+ minutes
2. Hourly rate validation with invalid inputs
3. Invoice file upload and download
4. Delete all data functionality (on test account)
5. End-to-end workflow testing

#### Future Enhancements (Optional)
- Auto-generate PDF invoices instead of requiring upload
- Replace prompt() dialogs with proper modals
- Add unit tests for timer logic
- Bundle size optimization (code splitting)

---

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
