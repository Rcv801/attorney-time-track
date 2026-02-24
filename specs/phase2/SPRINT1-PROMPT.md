# Sprint 1 Cowork Prompt — DB Migrations & Settings

Paste this entire prompt into Cowork with the `attorney-time-track/` folder selected.

---

## TASK

We're kicking off Phase 2 of SixMin Legal. Your job in this session is to complete **Sprint 1, Tasks 1.1–1.4**: all database migrations and the Settings page foundation.

**Start by reading these files in order:**
1. `specs/phase2/00-overnight-summary.md`
2. `specs/phase2/01-invoicing-data-model.md`
3. `specs/phase2/02-trust-iolta-schema.md`
4. `specs/phase2/07-settings-page-spec.md`
5. `src/integrations/supabase/types.ts` (understand existing schema)
6. `supabase/` directory (understand existing migrations)

Then complete the following tasks in order:

---

### Task 1.1 — Invoicing Migration SQL

Create a new Supabase migration file: `supabase/migrations/[timestamp]_phase2_invoicing.sql`

Use the SQL from `specs/phase2/01-invoicing-data-model.md`. This includes:
- Expanded `invoices` table (replace or alter existing minimal schema)
- `invoice_line_items` table
- `payments` table
- `expenses` table
- `invoice_sequences` table (for sequential invoice numbers)
- All triggers (payment auto-update invoice balance, invoice number generation)
- All RLS policies
- `unbilled_entries` view

**Important:** Check `src/integrations/supabase/types.ts` first — an `invoices` table may already exist with a different schema. Write the migration to handle this (ALTER if exists, CREATE if not). Do not break existing data.

---

### Task 1.2 — Trust/IOLTA Migration SQL

Create a new Supabase migration file: `supabase/migrations/[timestamp]_phase2_trust.sql`

Use the SQL from `specs/phase2/02-trust-iolta-schema.md`. This includes:
- `trust_ledger` table (append-only)
- Immutability trigger (block UPDATE and DELETE)
- Running balance validation trigger
- `record_trust_transaction()` helper function
- Auto-sync trigger to update `matters.trust_balance`
- All RLS policies

---

### Task 1.3 — user_settings Migration SQL

Create a new Supabase migration file: `supabase/migrations/[timestamp]_phase2_settings.sql`

Use the schema from `specs/phase2/07-settings-page-spec.md`. This includes:
- `user_settings` table with columns for: firm_name, firm_address, default_rate, billing_increment, invoice_prefix, invoice_next_number, stripe_account_id, stripe_publishable_key, email_service, email_from_name, email_from_address, invoice_notes_default, invoice_due_days
- Auto-create row on new user signup (trigger on auth.users)
- RLS policies (users can only read/write their own settings)

---

### Task 1.4 — Settings Page (UI)

Build `src/pages/app/Settings.tsx` using the spec in `specs/phase2/07-settings-page-spec.md`.

Requirements:
- Single-page settings (no tabs — this is intentional, keep it lean)
- Sections: Firm Info, Billing Defaults, Invoice Defaults, Stripe Connection (placeholder for now — just input fields for API key)
- Use shadcn/ui Card components for each section
- TanStack Query for loading/saving (query key: `['user_settings']`)
- Optimistic updates on save
- Toast notification on success/error
- Form validation (firm_name required, rates must be positive numbers)

Add the Settings route to `src/App.tsx` and add a Settings link to `src/components/layout/Sidebar.tsx`.

---

### After All Tasks

1. Update `src/integrations/supabase/types.ts` to reflect the new tables (add TypeScript interfaces matching the new schema — we'll regenerate from Supabase CLI later but add manual types now so the app compiles)
2. Write a summary to `specs/phase2/SPRINT1-COMPLETE.md` noting: what was created, any decisions made, anything that needs follow-up

---

## Confirmed Decisions (do not second-guess these)

- **Free tier:** 3 active matters cap only. No other limits on invoices or entries.
- **Tax field:** Include `tax_rate` and `tax_amount` columns in invoices schema, but do NOT show them in the UI yet. Default to 0.
- **Client matter reference:** Add `client_matter_number TEXT` column to the `matters` table (used by corporate clients and required for LEDES export).

## Constraints

- `NUMERIC(10,2)` for all money fields — never FLOAT
- RLS on every new table — no exceptions  
- Trust ledger must be append-only — the immutability trigger is critical
- TypeScript strict — no `any`
- shadcn/ui only — no new component libraries
