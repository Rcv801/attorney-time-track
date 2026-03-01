# Sprint 1 TODO – Expense CRUD on Entries Page

Expense CRUD was not implemented in this pass to avoid coupling schema work with a larger UI/data flow change and risking timer/time-entry regressions.

## Exact file targets

1. `src/pages/app/Entries.tsx`
   - Add second tab/card for **Expenses** below or beside time entries.
   - Query `expenses` with joined `matters` + `clients`.
   - Add row actions: edit/delete (respect `status='unbilled'` delete rule).

2. `src/components/forms/ExpenseForm.tsx` (new)
   - Fields: `date`, `matter_id`, `client_id`, `amount`, `description`, `category`, `billable`, optional `receipt_url`.
   - Validation (zod) + RHF similar to existing `EntryForm.tsx` patterns.

3. `src/integrations/supabase/types.ts`
   - Regenerate after migration so `expenses` types are available.

4. `src/pages/app/Dashboard.tsx` (optional follow-up)
   - Add expense totals widget (unbilled/invoiced) if needed for quick visibility.

## Suggested implementation order

1. Add read-only expenses table on Entries page.
2. Add create dialog + insert mutation.
3. Add edit dialog + update mutation.
4. Add delete mutation with guard and user-facing reason when disallowed.
