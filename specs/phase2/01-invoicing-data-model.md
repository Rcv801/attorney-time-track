# 01 — Invoicing Data Model (Supabase Migration)

*Phase 2 Spec — Created February 18, 2026*

---

## Context

The current `invoices` table is minimal: `client_id`, `date_range_start`, `date_range_end`, `total_amount`, `file_url`, `invoice_name`, `notes`. No line items, no payments, no invoice numbering sequence, no status tracking. The `entries` table has `invoice_id` and `billed` fields but no workflow to populate them.

This migration replaces the existing invoices table with a production-ready schema and adds `invoice_line_items`, `payments`, `expenses`, and supporting infrastructure.

---

## Migration SQL

```sql
-- Migration: Phase 2 Invoicing Schema
-- Run as a Supabase migration (supabase/migrations/YYYYMMDDHHMMSS_phase2_invoicing.sql)

-- ============================================================
-- 1. INVOICE NUMBER SEQUENCE
-- ============================================================
-- Per-user invoice numbering. Each user gets their own sequence.
-- Format: user sets a prefix (e.g., "INV-") and numbers auto-increment.

CREATE TABLE IF NOT EXISTS invoice_sequences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  prefix TEXT NOT NULL DEFAULT 'INV-',
  next_number INTEGER NOT NULL DEFAULT 1001,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Function to get next invoice number (atomic)
CREATE OR REPLACE FUNCTION get_next_invoice_number(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prefix TEXT;
  v_number INTEGER;
BEGIN
  -- Insert default if not exists, then increment
  INSERT INTO invoice_sequences (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO UPDATE
    SET next_number = invoice_sequences.next_number + 1,
        updated_at = now()
  RETURNING prefix, next_number - 1 INTO v_prefix, v_number;

  -- If it was a fresh insert, the number is 1001 (default)
  -- If it was an update, we got the pre-increment value
  IF v_number IS NULL THEN
    v_number := 1001;
  END IF;

  RETURN v_prefix || lpad(v_number::TEXT, 5, '0');
END;
$$;

-- ============================================================
-- 2. EXPENSES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  matter_id UUID NOT NULL REFERENCES matters(id) ON DELETE RESTRICT,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  description TEXT NOT NULL,
  category TEXT CHECK (category IN ('filing_fee', 'copies', 'postage', 'travel', 'court_reporter', 'expert_witness', 'service_of_process', 'other')),
  billable BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'unbilled' CHECK (status IN ('unbilled', 'invoiced', 'written_off')),
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  receipt_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_expenses_matter ON expenses(matter_id);
CREATE INDEX idx_expenses_user_status ON expenses(user_id, status);
CREATE INDEX idx_expenses_invoice ON expenses(invoice_id);

-- ============================================================
-- 3. REPLACE INVOICES TABLE
-- ============================================================
-- Drop old invoices table and recreate with full schema.
-- NOTE: The old table has no data in production (no UI exists).
-- If there IS data, migrate it first.

-- First, drop the FK from entries
ALTER TABLE entries DROP CONSTRAINT IF EXISTS entries_invoice_id_fkey;

-- Drop old invoices table
DROP TABLE IF EXISTS invoices CASCADE;

-- Create new invoices table
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  matter_id UUID REFERENCES matters(id) ON DELETE RESTRICT,
  -- A single invoice can span one matter or one client (all matters)
  -- If matter_id is NULL, it's a client-level invoice

  invoice_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'viewed', 'paid', 'partial', 'overdue', 'void', 'written_off')),

  -- Dates
  issued_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
  date_range_start DATE,
  date_range_end DATE,

  -- Amounts (all NUMERIC for precision — never use FLOAT for money)
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,4) DEFAULT 0, -- e.g., 0.0825 for 8.25%
  tax_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
  balance_due NUMERIC(10,2) NOT NULL DEFAULT 0,

  -- Trust
  trust_applied NUMERIC(10,2) NOT NULL DEFAULT 0, -- amount drawn from trust

  -- Content
  notes TEXT, -- terms, notes to client
  payment_terms TEXT DEFAULT 'Net 30',
  payment_link TEXT, -- Stripe payment URL

  -- PDF
  pdf_url TEXT,

  -- Tracking
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Re-add FK from entries
ALTER TABLE entries
  ADD CONSTRAINT entries_invoice_id_fkey
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX idx_invoices_number_user ON invoices(user_id, invoice_number);
CREATE INDEX idx_invoices_client ON invoices(client_id);
CREATE INDEX idx_invoices_status ON invoices(user_id, status);
CREATE INDEX idx_invoices_dates ON invoices(user_id, issued_date);

-- ============================================================
-- 4. INVOICE LINE ITEMS
-- ============================================================

CREATE TABLE invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,

  -- Source references (one of these should be set)
  entry_id UUID REFERENCES entries(id) ON DELETE SET NULL,
  expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL,

  -- Type
  line_type TEXT NOT NULL CHECK (line_type IN ('time', 'expense', 'flat_fee', 'adjustment', 'discount')),

  -- Snapshot data (captured at invoice time — immutable billing record)
  date DATE NOT NULL,
  description TEXT NOT NULL,
  matter_name TEXT, -- snapshot
  quantity NUMERIC(6,2), -- hours for time entries, 1 for expenses
  rate NUMERIC(10,2), -- hourly rate for time, NULL for expenses
  amount NUMERIC(10,2) NOT NULL,

  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_line_items_invoice ON invoice_line_items(invoice_id);
CREATE INDEX idx_line_items_entry ON invoice_line_items(entry_id);

-- ============================================================
-- 5. PAYMENTS TABLE
-- ============================================================

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,

  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL
    CHECK (payment_method IN ('stripe_card', 'stripe_ach', 'check', 'cash', 'wire', 'trust_application', 'other')),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- External references
  stripe_payment_intent_id TEXT,
  reference_number TEXT, -- check number, wire ref, etc.

  -- Account type (critical for trust compliance)
  account_type TEXT NOT NULL DEFAULT 'operating'
    CHECK (account_type IN ('operating', 'trust')),

  status TEXT NOT NULL DEFAULT 'completed'
    CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),

  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_invoice ON payments(invoice_id);
CREATE INDEX idx_payments_user_date ON payments(user_id, payment_date);
CREATE INDEX idx_payments_stripe ON payments(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;

-- ============================================================
-- 6. TRIGGER: AUTO-UPDATE INVOICE BALANCE ON PAYMENT
-- ============================================================

CREATE OR REPLACE FUNCTION update_invoice_on_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_paid NUMERIC(10,2);
  v_total NUMERIC(10,2);
BEGIN
  -- Calculate total payments for this invoice
  SELECT COALESCE(SUM(amount), 0)
  INTO v_total_paid
  FROM payments
  WHERE invoice_id = NEW.invoice_id
    AND status = 'completed';

  -- Get invoice total
  SELECT total INTO v_total
  FROM invoices WHERE id = NEW.invoice_id;

  -- Update invoice
  UPDATE invoices
  SET
    amount_paid = v_total_paid,
    balance_due = total - v_total_paid - trust_applied,
    status = CASE
      WHEN v_total_paid + (SELECT trust_applied FROM invoices WHERE id = NEW.invoice_id) >= v_total THEN 'paid'
      WHEN v_total_paid > 0 THEN 'partial'
      ELSE status
    END,
    paid_at = CASE
      WHEN v_total_paid + (SELECT trust_applied FROM invoices WHERE id = NEW.invoice_id) >= v_total THEN now()
      ELSE paid_at
    END,
    updated_at = now()
  WHERE id = NEW.invoice_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_payment_update_invoice
AFTER INSERT OR UPDATE ON payments
FOR EACH ROW
EXECUTE FUNCTION update_invoice_on_payment();

-- ============================================================
-- 7. TRIGGER: AUTO-UPDATE updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_invoices_updated_at
BEFORE UPDATE ON invoices
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_expenses_updated_at
BEFORE UPDATE ON expenses
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_invoice_sequences_updated_at
BEFORE UPDATE ON invoice_sequences
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 8. RLS POLICIES
-- ============================================================

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_sequences ENABLE ROW LEVEL SECURITY;

-- Invoices: user can only access their own
CREATE POLICY invoices_select ON invoices FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY invoices_insert ON invoices FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY invoices_update ON invoices FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY invoices_delete ON invoices FOR DELETE
  USING (auth.uid() = user_id AND status = 'draft');
  -- Only draft invoices can be deleted

-- Invoice Line Items: access via invoice ownership
CREATE POLICY line_items_select ON invoice_line_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM invoices WHERE invoices.id = invoice_line_items.invoice_id AND invoices.user_id = auth.uid()
  ));
CREATE POLICY line_items_insert ON invoice_line_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM invoices WHERE invoices.id = invoice_line_items.invoice_id AND invoices.user_id = auth.uid()
  ));
CREATE POLICY line_items_update ON invoice_line_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM invoices WHERE invoices.id = invoice_line_items.invoice_id AND invoices.user_id = auth.uid()
  ));
CREATE POLICY line_items_delete ON invoice_line_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM invoices
    WHERE invoices.id = invoice_line_items.invoice_id
      AND invoices.user_id = auth.uid()
      AND invoices.status = 'draft'
  ));

-- Payments
CREATE POLICY payments_select ON payments FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY payments_insert ON payments FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY payments_update ON payments FOR UPDATE
  USING (auth.uid() = user_id);
-- No delete policy — payments are permanent records

-- Expenses
CREATE POLICY expenses_select ON expenses FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY expenses_insert ON expenses FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY expenses_update ON expenses FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY expenses_delete ON expenses FOR DELETE
  USING (auth.uid() = user_id AND status = 'unbilled');

-- Invoice Sequences
CREATE POLICY sequences_select ON invoice_sequences FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY sequences_insert ON invoice_sequences FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY sequences_update ON invoice_sequences FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================
-- 9. HELPER VIEWS
-- ============================================================

-- Unbilled entries view (for invoice builder)
CREATE OR REPLACE VIEW unbilled_entries AS
SELECT
  e.*,
  m.name AS matter_name,
  m.matter_number,
  m.hourly_rate AS matter_rate,
  c.name AS client_name,
  c.hourly_rate AS client_rate,
  COALESCE(m.hourly_rate, c.hourly_rate, 0) AS effective_rate,
  CASE
    WHEN e.duration_sec IS NOT NULL AND e.duration_sec > 0
    THEN GREATEST(CEIL((e.duration_sec::NUMERIC / 360)) / 10, 0.1)
    WHEN e.end_at IS NOT NULL
    THEN GREATEST(
      CEIL((EXTRACT(EPOCH FROM (e.end_at::TIMESTAMPTZ - e.start_at::TIMESTAMPTZ))
        - COALESCE(e.total_paused_seconds, 0)) / 360) / 10,
      0.1
    )
    ELSE 0
  END AS billed_hours
FROM entries e
JOIN matters m ON e.matter_id = m.id
JOIN clients c ON e.client_id = c.id
WHERE e.billed = FALSE
  AND e.archived = FALSE
  AND e.end_at IS NOT NULL
  AND e.invoice_id IS NULL;

-- Invoice summary view (for lists)
CREATE OR REPLACE VIEW invoice_summary AS
SELECT
  i.*,
  c.name AS client_name,
  m.name AS matter_name,
  (SELECT COUNT(*) FROM invoice_line_items li WHERE li.invoice_id = i.id) AS line_item_count,
  (SELECT COUNT(*) FROM payments p WHERE p.invoice_id = i.id AND p.status = 'completed') AS payment_count
FROM invoices i
JOIN clients c ON i.client_id = c.id
LEFT JOIN matters m ON i.matter_id = m.id;
```

---

## Schema Decisions

| Decision | Rationale |
|----------|-----------|
| `NUMERIC(10,2)` for all money | Never use FLOAT for currency. NUMERIC is exact. |
| Invoice numbers are per-user with configurable prefix | Solo attorneys want "INV-01001"; firms might want "VLF-2026-001" |
| `matter_id` is optional on invoices | Allows client-level invoices spanning multiple matters |
| Line items snapshot data at invoice time | If entry description or rate changes later, invoice is unchanged (accounting requirement) |
| Payments cannot be deleted via RLS | Financial records must be permanent. Corrections via refund entries. |
| Draft invoices are the only deletable invoices | Once sent, an invoice must be voided, not deleted (audit trail) |
| `trust_applied` on invoices | Tracks how much of the invoice was paid from trust, separate from external payments |
| `balance_due` is computed by trigger | Keeps balance always consistent: `total - amount_paid - trust_applied` |

---

## TypeScript Types (to add to `types.ts` after running migration)

After running this migration, regenerate Supabase types with:
```bash
npx supabase gen types typescript --project-id <project-id> > src/integrations/supabase/types.ts
```

---

## Migration Checklist

- [ ] Back up existing invoices data (if any)
- [ ] Run migration in Supabase dashboard or CLI
- [ ] Regenerate TypeScript types
- [ ] Update `entries` queries that reference `invoices` FK
- [ ] Test RLS policies with authenticated user
- [ ] Verify `get_next_invoice_number()` function works
- [ ] Verify payment trigger updates invoice balance correctly
