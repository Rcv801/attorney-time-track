# Phase 2 Sprint 1 – Migration + Type Generation Notes

## New migration added

- `supabase/migrations/20260301173000_phase2_foundation_invoicing_trust_settings.sql`

## What it includes

- Invoicing foundation: `invoice_sequences`, rebuilt `invoices`, `invoice_line_items`, `payments`, `expenses`
- Trust/IOLTA foundation: `trust_ledger`, validation/immutability/sync triggers, trust helper RPC
- Settings foundation: `user_settings`
- RLS policies for all new/changed Phase 2 tables
- Helper views:
  - `unbilled_entries`
  - `invoice_summary`
  - `trust_balance_by_matter`
  - `trust_balance_by_client`
  - `trust_activity_summary`

## Apply migration

```bash
npx supabase db push
```

## Regenerate TypeScript types (required after migration)

> Replace `<project-id>` with the real Supabase project id.

```bash
npx supabase gen types typescript --project-id <project-id> --schema public > src/integrations/supabase/types.ts
```

## Post-migration sanity checks

```sql
select public.get_next_invoice_number(auth.uid());

select *
from public.record_trust_transaction(
  auth.uid(),
  '<client-id>'::uuid,
  '<matter-id>'::uuid,
  'deposit',
  1000.00,
  'Initial retainer',
  null,
  'Client Name',
  null,
  null,
  current_date
);
```
