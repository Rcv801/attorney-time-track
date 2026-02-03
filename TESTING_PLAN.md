# Bug Fixes Testing Plan - Round 2

## Testing Environment
- **Dev Server**: http://localhost:8080/
- **Tech Stack**: React, TypeScript, Supabase
- **Browser**: Chrome/Safari (latest)

---

## BUG-001: Timer Drift Over Long Periods ⏱️

### Issue
Timer uses setInterval(1000) and could drift 30-60 seconds over 8+ hours.

### Fix Applied
- Optimized timer to parse timestamps once instead of on each tick
- Timer already uses `Date.now() - startTime` approach (drift-free)
- Added clear comments explaining the anti-drift mechanism

### Test Steps
1. Navigate to Dashboard
2. Select a client and start a timer
3. Let timer run for at least 5 minutes
4. Compare timer display with actual system clock time
5. **Expected**: Timer should match system time within 1 second
6. **Edge Case**: Pause timer, wait 2 minutes, resume - verify paused time not counted

### Test Results
- [ ] Timer accuracy within 1 second after 5 minutes
- [ ] Timer accuracy within 2 seconds after 30 minutes (long test)
- [ ] Paused time correctly excluded from elapsed
- [ ] No visible drift or lag in timer display

---

## BUG-003: Paused Timer Shows Incorrect Billing Amount 💰

### Issue
When paused, billing amount includes paused time (confusing UX).

### Fix Applied
- Verified that `activeAmount` calculation uses `elapsed`, which already excludes `total_paused_seconds`
- Added comment clarifying the billing calculation logic

### Test Steps
1. Create a client with hourly rate of $100/hr
2. Start timer for that client
3. Let it run for 6 minutes (should show ~$10)
4. Pause the timer
5. Wait 3 minutes while paused
6. Check displayed billing amount
7. **Expected**: Should still show ~$10, not ~$15
8. Resume timer and verify billing continues correctly

### Test Results
- [ ] Billing amount freezes when timer is paused
- [ ] Billing amount excludes paused time
- [ ] Resuming timer continues billing from paused amount
- [ ] Final entry duration excludes all paused time

---

## BUG-004: No Validation on Hourly Rate ⚠️

### Issue
User can enter negative, text, or extremely large values (causes $NaN).

### Fix Applied
- Added `min="0"` and `max="10000"` attributes to input field
- Added validation in `add()` function (new client)
- Added validation in `rename()` function (edit client)
- Added helpful hint text and error messages

### Test Steps - Add New Client
1. Navigate to Clients page
2. Click "Add Client"
3. Enter name: "Test Client"
4. **Test Invalid Inputs**:
   - Try entering `-50` → Should show HTML5 validation error
   - Try entering `99999` → Should allow but show error on save
   - Try entering `abc` → Should not allow (type="number")
5. Enter valid rate: `150.00`
6. Save client
7. **Expected**: Valid rate saves, invalid rates rejected with clear error

### Test Steps - Edit Existing Client
1. Find a client in the list
2. Click "Edit"
3. Try entering invalid hourly rate in prompt
4. **Expected**: Alert shown: "Invalid hourly rate. Must be a number between $0 and $10,000."
5. Enter valid rate
6. **Expected**: Client updated successfully

### Test Results
- [ ] Negative rates rejected with error message
- [ ] Rates > $10,000 rejected with error message
- [ ] Non-numeric input prevented by HTML5 validation
- [ ] Valid rates ($0-$10,000) accepted
- [ ] Helpful hint text visible: "Must be between $0 and $10,000"
- [ ] Edit prompt shows validation message in prompt text
- [ ] Edit validation works correctly

---

## BUG-007: PDF/File Upload Not Tested 📄

### Issue
Invoice file upload/download functionality hasn't been tested, might be broken.

### Fix Applied
N/A - This is a testing task. The code for file upload exists in `InvoiceCreateDialog.tsx`.

### Test Steps - File Upload
1. Create some time entries (at least 3-4 entries)
2. Navigate to Entries page
3. Select multiple entries (same client)
4. Click "Create Invoice"
5. **Test without file**:
   - Enter invoice name
   - Click "Create Invoice"
   - **Expected**: Invoice created successfully without file
6. **Test with PDF file**:
   - Select entries again
   - Click "Create Invoice"
   - Upload a test PDF file (create a simple one or use any PDF)
   - Enter invoice name: "Test Invoice with PDF"
   - Click "Create Invoice"
   - **Expected**: Invoice created with file attached
7. **Test with image file**:
   - Repeat with .jpg or .png file
   - **Expected**: Image file accepted and uploaded

### Test Steps - File Download
1. Navigate to Invoices page
2. Find an invoice with a file attached
3. Look for "Invoice file attached" indicator with file icon
4. Click "Download" button
5. **Expected**: File downloads successfully
6. Open downloaded file
7. **Expected**: File opens correctly and is not corrupted

### Test Steps - File Display
1. Click "View" on an invoice with file
2. Check the invoice details dialog
3. **Expected**: Shows all invoice details including associated entries
4. Verify download button works from dialog too

### Test Results - Upload
- [ ] Invoice creation works without file
- [ ] PDF file upload works (.pdf)
- [ ] Image file upload works (.jpg, .png)
- [ ] File size limits respected (if any)
- [ ] File upload shows filename after selection
- [ ] File icon displayed after upload

### Test Results - Download
- [ ] Download button visible for invoices with files
- [ ] Download button triggers file download
- [ ] Downloaded file has correct filename
- [ ] Downloaded PDF opens correctly
- [ ] Downloaded image opens correctly
- [ ] No corruption or errors in downloaded files

### Test Results - Edge Cases
- [ ] Multiple invoices with different files work
- [ ] Large files handle appropriately
- [ ] File type validation works (only .pdf, .jpg, .jpeg, .png accepted)

---

## BUG-008: Delete All Data Uses Hacky SQL 🗑️

### Issue
"Delete All Data" button uses `.neq("id", "00000000...")` workaround instead of proper deletion.

### Fix Applied
- Replaced hacky approach with proper `.eq("user_id", user.id)` deletion
- Added proper error handling
- Deletes in correct order: entries → invoices → clients
- Respects RLS and foreign key constraints
- Shows success/error alerts
- Refreshes page after deletion

### Test Steps - Safe Testing (Recommended)
1. **BACKUP FIRST**: Export data or test on a test account
2. Create some test data:
   - Create 2 test clients
   - Create 5-10 test entries
   - Create 1 test invoice
3. Navigate to Settings page
4. Scroll to "Delete all my data" section
5. Try clicking "Delete all my data" without typing "DELETE"
6. **Expected**: Button disabled
7. Type "DELETE" in the input field
8. Click "Delete all my data"
9. **Expected**: 
   - Alert: "All your data has been deleted successfully."
   - Page refreshes
   - All clients, entries, and invoices gone

### Test Steps - Error Handling
1. Test with network disconnected (if possible)
2. **Expected**: Error alert shown with helpful message

### Test Steps - Verification
After deletion, verify:
1. Dashboard shows no active timer
2. Clients page shows no clients
3. Entries page shows no entries
4. Invoices page shows no invoices
5. Can create new data normally
6. No errors in browser console

### Test Results
- [ ] Button disabled until "DELETE" typed
- [ ] Deletion works without errors
- [ ] All entries deleted
- [ ] All invoices deleted
- [ ] All clients deleted
- [ ] Success alert shown
- [ ] Page refreshes after deletion
- [ ] No orphaned data remains
- [ ] Can create new data after deletion
- [ ] Error handling works (network errors, etc.)
- [ ] No console errors during deletion

---

## Integration Tests 🔄

### Test: Complete Workflow
1. Create a client with $200/hr rate
2. Start timer for that client
3. Let it run for 3 minutes
4. Pause for 2 minutes
5. Resume and run for 2 more minutes
6. Stop timer (should show 5 minutes total, $16.67)
7. Create another entry manually
8. Create an invoice with both entries
9. Upload a PDF to the invoice
10. Download the invoice PDF
11. Verify all data is correct

### Test Results
- [ ] End-to-end workflow completes without errors
- [ ] All features work together correctly
- [ ] Data integrity maintained throughout

---

## Browser Console Checks 🔍

During all tests, monitor browser console for:
- [ ] No errors
- [ ] No warnings about deprecated functions
- [ ] No network errors (except expected ones)
- [ ] TypeScript compilation successful (no errors in terminal)

---

## Performance Checks ⚡

- [ ] Timer updates smoothly (no lag)
- [ ] Page loads quickly (&lt;2 seconds)
- [ ] Invoice creation completes in reasonable time
- [ ] File uploads work for files up to 5MB
- [ ] No memory leaks (check with long timer sessions)

---

## Final Checklist ✅

Before marking as complete:
- [ ] All critical bugs tested and verified
- [ ] All test results documented
- [ ] No regressions introduced
- [ ] Code committed to git
- [ ] CHANGELOG.md updated
- [ ] Test report created (BUG_FIXES_ROUND_2_REPORT.md)
- [ ] Changes pushed to GitHub
