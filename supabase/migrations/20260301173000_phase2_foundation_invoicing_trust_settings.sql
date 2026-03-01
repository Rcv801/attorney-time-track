-- Migration: Phase 2 foundation (Invoicing + Trust/IOLTA + User Settings)
-- Source specs:
--   specs/phase2/01-invoicing-data-model.md
--   specs/phase2/02-trust-iolta-schema.md
--   specs/phase2/07-settings-page-spec.md

BEGIN;

-- ============================================================
-- 0) Shared helper: updated_at trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- 1) Invoice sequence / numbering
-- ============================================================
CREATE TABLE IF NOT EXISTS public.invoice_sequences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  prefix text NOT NULL DEFAULT 'INV-',
  next_number integer NOT NULL DEFAULT 1001,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoice_sequences_next_number_check CHECK (next_number > 0)
);

CREATE OR REPLACE FUNCTION public.get_next_invoice_number(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text;
  v_number integer;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Not authorized to generate invoice number for this user';
  END IF;

  INSERT INTO public.invoice_sequences AS s (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id)
  DO UPDATE SET
    next_number = s.next_number + 1,
    updated_at = now()
  RETURNING prefix, next_number - 1 INTO v_prefix, v_number;

  IF v_number IS NULL THEN
    v_number := 1001;
  END IF;

  RETURN v_prefix || lpad(v_number::text, 5, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.get_next_invoice_number(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_next_invoice_number(uuid) TO authenticated;

DROP TRIGGER IF EXISTS trg_invoice_sequences_updated_at ON public.invoice_sequences;
CREATE TRIGGER trg_invoice_sequences_updated_at
BEFORE UPDATE ON public.invoice_sequences
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 2) Expenses
-- ============================================================
CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  matter_id uuid NOT NULL REFERENCES public.matters(id) ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  date date NOT NULL DEFAULT current_date,
  amount numeric(10,2) NOT NULL CHECK (amount >= 0),
  description text NOT NULL,
  category text CHECK (category IN (
    'filing_fee', 'copies', 'postage', 'travel', 'court_reporter',
    'expert_witness', 'service_of_process', 'other'
  )),
  billable boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'unbilled' CHECK (status IN ('unbilled', 'invoiced', 'written_off')),
  invoice_id uuid,
  receipt_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_matter ON public.expenses(matter_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user_status ON public.expenses(user_id, status);
CREATE INDEX IF NOT EXISTS idx_expenses_invoice ON public.expenses(invoice_id);

DROP TRIGGER IF EXISTS trg_expenses_updated_at ON public.expenses;
CREATE TRIGGER trg_expenses_updated_at
BEFORE UPDATE ON public.expenses
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 3) Replace invoices table with production-ready schema
-- ============================================================
ALTER TABLE public.entries DROP CONSTRAINT IF EXISTS entries_invoice_id_fkey;
DROP TABLE IF EXISTS public.invoices CASCADE;

CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  matter_id uuid REFERENCES public.matters(id) ON DELETE RESTRICT,

  invoice_number text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'viewed', 'paid', 'partial', 'overdue', 'void', 'written_off')),

  issued_date date NOT NULL DEFAULT current_date,
  due_date date NOT NULL DEFAULT (current_date + interval '30 days'),
  date_range_start date,
  date_range_end date,

  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  tax_rate numeric(5,4) NOT NULL DEFAULT 0,
  tax_amount numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,
  amount_paid numeric(10,2) NOT NULL DEFAULT 0,
  balance_due numeric(10,2) NOT NULL DEFAULT 0,

  trust_applied numeric(10,2) NOT NULL DEFAULT 0,

  notes text,
  payment_terms text DEFAULT 'Net 30',
  payment_link text,

  pdf_url text,

  sent_at timestamptz,
  viewed_at timestamptz,
  paid_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT invoices_number_not_blank CHECK (length(trim(invoice_number)) > 0),
  CONSTRAINT invoices_nonnegative_amounts CHECK (
    subtotal >= 0 AND tax_amount >= 0 AND total >= 0 AND amount_paid >= 0 AND balance_due >= 0 AND trust_applied >= 0
  )
);

ALTER TABLE public.entries
  ADD CONSTRAINT entries_invoice_id_fkey
  FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;

ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_invoice_id_fkey
  FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX idx_invoices_number_user ON public.invoices(user_id, invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON public.invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(user_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_dates ON public.invoices(user_id, issued_date);

DROP TRIGGER IF EXISTS trg_invoices_updated_at ON public.invoices;
CREATE TRIGGER trg_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 4) Invoice line items
-- ============================================================
CREATE TABLE IF NOT EXISTS public.invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  entry_id uuid REFERENCES public.entries(id) ON DELETE SET NULL,
  expense_id uuid REFERENCES public.expenses(id) ON DELETE SET NULL,

  line_type text NOT NULL CHECK (line_type IN ('time', 'expense', 'flat_fee', 'adjustment', 'discount')),

  date date NOT NULL,
  description text NOT NULL,
  matter_name text,
  quantity numeric(6,2),
  rate numeric(10,2),
  amount numeric(10,2) NOT NULL,

  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT invoice_line_items_one_source CHECK (
    (entry_id IS NOT NULL AND expense_id IS NULL)
    OR (entry_id IS NULL AND expense_id IS NOT NULL)
    OR (entry_id IS NULL AND expense_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_line_items_invoice ON public.invoice_line_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_line_items_entry ON public.invoice_line_items(entry_id);
CREATE INDEX IF NOT EXISTS idx_line_items_expense ON public.invoice_line_items(expense_id);

-- ============================================================
-- 5) Payments
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,

  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  payment_method text NOT NULL CHECK (payment_method IN (
    'stripe_card', 'stripe_ach', 'check', 'cash', 'wire', 'trust_application', 'other'
  )),
  payment_date date NOT NULL DEFAULT current_date,

  stripe_payment_intent_id text,
  reference_number text,

  account_type text NOT NULL DEFAULT 'operating' CHECK (account_type IN ('operating', 'trust')),
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),

  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_invoice ON public.payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_date ON public.payments(user_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_stripe ON public.payments(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

-- ============================================================
-- 6) Payment trigger -> invoice balance/status updates
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_invoice_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_paid numeric(10,2);
  v_trust_applied numeric(10,2);
  v_total numeric(10,2);
BEGIN
  SELECT COALESCE(SUM(amount), 0)
  INTO v_total_paid
  FROM public.payments
  WHERE invoice_id = NEW.invoice_id
    AND status = 'completed';

  SELECT total, trust_applied
  INTO v_total, v_trust_applied
  FROM public.invoices
  WHERE id = NEW.invoice_id;

  UPDATE public.invoices
  SET
    amount_paid = v_total_paid,
    balance_due = GREATEST(total - v_total_paid - trust_applied, 0),
    status = CASE
      WHEN (v_total_paid + COALESCE(v_trust_applied, 0)) >= v_total THEN 'paid'
      WHEN v_total_paid > 0 THEN 'partial'
      ELSE status
    END,
    paid_at = CASE
      WHEN (v_total_paid + COALESCE(v_trust_applied, 0)) >= v_total THEN now()
      ELSE paid_at
    END,
    updated_at = now()
  WHERE id = NEW.invoice_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payment_update_invoice ON public.payments;
CREATE TRIGGER trg_payment_update_invoice
AFTER INSERT OR UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.update_invoice_on_payment();

-- ============================================================
-- 7) Trust ledger (append-only with balance assertions)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.trust_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  matter_id uuid NOT NULL REFERENCES public.matters(id) ON DELETE RESTRICT,

  transaction_date date NOT NULL DEFAULT current_date,
  transaction_type text NOT NULL CHECK (transaction_type IN (
    'deposit', 'disbursement', 'refund', 'transfer_in', 'transfer_out',
    'interest', 'bank_fee', 'correction'
  )),

  amount numeric(10,2) NOT NULL,
  running_balance numeric(10,2) NOT NULL,

  description text NOT NULL,
  reference_number text,
  payor_payee text,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  correction_of uuid REFERENCES public.trust_ledger(id),

  reconciled boolean NOT NULL DEFAULT false,
  reconciled_at timestamptz,
  reconciled_by uuid REFERENCES auth.users(id),

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trust_client ON public.trust_ledger(client_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_trust_matter ON public.trust_ledger(matter_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_trust_user ON public.trust_ledger(user_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_trust_unreconciled ON public.trust_ledger(user_id, reconciled)
  WHERE reconciled = false;
CREATE INDEX IF NOT EXISTS idx_trust_type ON public.trust_ledger(user_id, transaction_type);

CREATE OR REPLACE FUNCTION public.validate_trust_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_balance numeric(10,2);
  v_expected_balance numeric(10,2);
BEGIN
  SELECT running_balance
  INTO v_last_balance
  FROM public.trust_ledger
  WHERE matter_id = NEW.matter_id
    AND user_id = NEW.user_id
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  v_last_balance := COALESCE(v_last_balance, 0);
  v_expected_balance := v_last_balance + NEW.amount;

  IF NEW.running_balance <> v_expected_balance THEN
    RAISE EXCEPTION 'Trust balance mismatch: expected %, got %. Previous balance: %, amount: %',
      v_expected_balance, NEW.running_balance, v_last_balance, NEW.amount;
  END IF;

  IF v_expected_balance < 0 THEN
    RAISE EXCEPTION 'Trust balance cannot be negative. Current balance: %, attempted amount: %',
      v_last_balance, NEW.amount;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_trust_balance ON public.trust_ledger;
CREATE TRIGGER trg_validate_trust_balance
BEFORE INSERT ON public.trust_ledger
FOR EACH ROW
EXECUTE FUNCTION public.validate_trust_balance();

CREATE OR REPLACE FUNCTION public.prevent_trust_modification()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Trust ledger entries cannot be deleted. Create a correction entry instead.';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.amount <> NEW.amount
      OR OLD.running_balance <> NEW.running_balance
      OR OLD.transaction_type <> NEW.transaction_type
      OR OLD.description <> NEW.description
      OR OLD.client_id <> NEW.client_id
      OR OLD.matter_id <> NEW.matter_id
      OR OLD.transaction_date <> NEW.transaction_date
      OR OLD.reference_number IS DISTINCT FROM NEW.reference_number
      OR OLD.payor_payee IS DISTINCT FROM NEW.payor_payee
      OR OLD.invoice_id IS DISTINCT FROM NEW.invoice_id
      OR OLD.correction_of IS DISTINCT FROM NEW.correction_of
    THEN
      RAISE EXCEPTION 'Trust ledger entries are immutable. Only reconciliation fields can be updated.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_trust_modification ON public.trust_ledger;
CREATE TRIGGER trg_prevent_trust_modification
BEFORE UPDATE OR DELETE ON public.trust_ledger
FOR EACH ROW
EXECUTE FUNCTION public.prevent_trust_modification();

CREATE OR REPLACE FUNCTION public.sync_matter_trust_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.matters
  SET trust_balance = NEW.running_balance,
      updated_at = now()
  WHERE id = NEW.matter_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_trust_balance ON public.trust_ledger;
CREATE TRIGGER trg_sync_trust_balance
AFTER INSERT ON public.trust_ledger
FOR EACH ROW
EXECUTE FUNCTION public.sync_matter_trust_balance();

CREATE OR REPLACE FUNCTION public.record_trust_transaction(
  p_user_id uuid,
  p_client_id uuid,
  p_matter_id uuid,
  p_type text,
  p_amount numeric,
  p_description text,
  p_reference text DEFAULT NULL,
  p_payor_payee text DEFAULT NULL,
  p_invoice_id uuid DEFAULT NULL,
  p_correction_of uuid DEFAULT NULL,
  p_transaction_date date DEFAULT current_date
)
RETURNS public.trust_ledger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_balance numeric(10,2);
  v_new_balance numeric(10,2);
  v_result public.trust_ledger;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Not authorized to record trust transactions for this user';
  END IF;

  SELECT running_balance
  INTO v_last_balance
  FROM public.trust_ledger
  WHERE matter_id = p_matter_id
    AND user_id = p_user_id
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  v_last_balance := COALESCE(v_last_balance, 0);
  v_new_balance := v_last_balance + p_amount;

  INSERT INTO public.trust_ledger (
    user_id, client_id, matter_id, transaction_date, transaction_type,
    amount, running_balance, description, reference_number,
    payor_payee, invoice_id, correction_of
  ) VALUES (
    p_user_id, p_client_id, p_matter_id, p_transaction_date, p_type,
    p_amount, v_new_balance, p_description, p_reference,
    p_payor_payee, p_invoice_id, p_correction_of
  )
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.record_trust_transaction(uuid,uuid,uuid,text,numeric,text,text,text,uuid,uuid,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_trust_transaction(uuid,uuid,uuid,text,numeric,text,text,text,uuid,uuid,date) TO authenticated;

-- ============================================================
-- 8) User settings
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  firm_name text,
  attorney_name text,
  bar_number text,
  phone text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  zip text,
  logo_url text,

  default_rate numeric(10,2) DEFAULT 300.00,
  billing_increment integer DEFAULT 6,
  rounding_rule text DEFAULT 'up' CHECK (rounding_rule IN ('up', 'down', 'nearest')),
  timekeeper_classification text DEFAULT 'PARTNER',

  payment_terms text DEFAULT 'Net 30',
  default_tax_rate numeric(5,4) DEFAULT 0,
  invoice_notes text,

  reply_to_email text,
  email_subject_template text DEFAULT 'Invoice {number} from {firm_name}',
  email_body_template text DEFAULT 'Please find your invoice attached. You can pay online using the link below.',

  stripe_connected boolean DEFAULT false,
  stripe_publishable_key text,
  pass_fees_to_client boolean DEFAULT false,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT user_settings_default_rate_nonnegative CHECK (default_rate IS NULL OR default_rate >= 0),
  CONSTRAINT user_settings_billing_increment_check CHECK (billing_increment IN (6, 10, 15)),
  CONSTRAINT user_settings_tax_rate_nonnegative CHECK (default_tax_rate IS NULL OR default_tax_rate >= 0)
);

DROP TRIGGER IF EXISTS trg_user_settings_updated_at ON public.user_settings;
CREATE TRIGGER trg_user_settings_updated_at
BEFORE UPDATE ON public.user_settings
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 9) RLS
-- ============================================================
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trust_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invoices_select ON public.invoices;
DROP POLICY IF EXISTS invoices_insert ON public.invoices;
DROP POLICY IF EXISTS invoices_update ON public.invoices;
DROP POLICY IF EXISTS invoices_delete ON public.invoices;
CREATE POLICY invoices_select ON public.invoices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY invoices_insert ON public.invoices FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY invoices_update ON public.invoices FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY invoices_delete ON public.invoices FOR DELETE USING (auth.uid() = user_id AND status = 'draft');

DROP POLICY IF EXISTS line_items_select ON public.invoice_line_items;
DROP POLICY IF EXISTS line_items_insert ON public.invoice_line_items;
DROP POLICY IF EXISTS line_items_update ON public.invoice_line_items;
DROP POLICY IF EXISTS line_items_delete ON public.invoice_line_items;
CREATE POLICY line_items_select ON public.invoice_line_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_line_items.invoice_id
      AND i.user_id = auth.uid()
  ));
CREATE POLICY line_items_insert ON public.invoice_line_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_line_items.invoice_id
      AND i.user_id = auth.uid()
  ));
CREATE POLICY line_items_update ON public.invoice_line_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_line_items.invoice_id
      AND i.user_id = auth.uid()
  ));
CREATE POLICY line_items_delete ON public.invoice_line_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_line_items.invoice_id
      AND i.user_id = auth.uid()
      AND i.status = 'draft'
  ));

DROP POLICY IF EXISTS payments_select ON public.payments;
DROP POLICY IF EXISTS payments_insert ON public.payments;
DROP POLICY IF EXISTS payments_update ON public.payments;
CREATE POLICY payments_select ON public.payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY payments_insert ON public.payments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY payments_update ON public.payments FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS expenses_select ON public.expenses;
DROP POLICY IF EXISTS expenses_insert ON public.expenses;
DROP POLICY IF EXISTS expenses_update ON public.expenses;
DROP POLICY IF EXISTS expenses_delete ON public.expenses;
CREATE POLICY expenses_select ON public.expenses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY expenses_insert ON public.expenses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY expenses_update ON public.expenses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY expenses_delete ON public.expenses FOR DELETE USING (auth.uid() = user_id AND status = 'unbilled');

DROP POLICY IF EXISTS sequences_select ON public.invoice_sequences;
DROP POLICY IF EXISTS sequences_insert ON public.invoice_sequences;
DROP POLICY IF EXISTS sequences_update ON public.invoice_sequences;
CREATE POLICY sequences_select ON public.invoice_sequences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY sequences_insert ON public.invoice_sequences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY sequences_update ON public.invoice_sequences FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS trust_select ON public.trust_ledger;
DROP POLICY IF EXISTS trust_insert ON public.trust_ledger;
DROP POLICY IF EXISTS trust_update ON public.trust_ledger;
CREATE POLICY trust_select ON public.trust_ledger FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY trust_insert ON public.trust_ledger FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY trust_update ON public.trust_ledger FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS settings_select ON public.user_settings;
DROP POLICY IF EXISTS settings_insert ON public.user_settings;
DROP POLICY IF EXISTS settings_update ON public.user_settings;
CREATE POLICY settings_select ON public.user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY settings_insert ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY settings_update ON public.user_settings FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- 10) Helper views
-- ============================================================
CREATE OR REPLACE VIEW public.unbilled_entries AS
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
      THEN GREATEST(CEIL((e.duration_sec::numeric / 360)) / 10, 0.1)
    WHEN e.end_at IS NOT NULL
      THEN GREATEST(
        CEIL((EXTRACT(EPOCH FROM (e.end_at::timestamptz - e.start_at::timestamptz))
          - COALESCE(e.total_paused_seconds, 0)) / 360) / 10,
        0.1
      )
    ELSE 0
  END AS billed_hours
FROM public.entries e
JOIN public.matters m ON e.matter_id = m.id
JOIN public.clients c ON e.client_id = c.id
WHERE e.billed = false
  AND e.archived = false
  AND e.end_at IS NOT NULL
  AND e.invoice_id IS NULL;

CREATE OR REPLACE VIEW public.invoice_summary AS
SELECT
  i.*,
  c.name AS client_name,
  m.name AS matter_name,
  (
    SELECT COUNT(*)
    FROM public.invoice_line_items li
    WHERE li.invoice_id = i.id
  ) AS line_item_count,
  (
    SELECT COUNT(*)
    FROM public.payments p
    WHERE p.invoice_id = i.id
      AND p.status = 'completed'
  ) AS payment_count
FROM public.invoices i
JOIN public.clients c ON i.client_id = c.id
LEFT JOIN public.matters m ON i.matter_id = m.id;

CREATE OR REPLACE VIEW public.trust_balance_by_matter AS
SELECT DISTINCT ON (matter_id)
  matter_id,
  client_id,
  user_id,
  running_balance AS current_balance,
  transaction_date AS last_transaction_date,
  created_at AS last_transaction_at
FROM public.trust_ledger
ORDER BY matter_id, created_at DESC, id DESC;

CREATE OR REPLACE VIEW public.trust_balance_by_client AS
SELECT
  client_id,
  user_id,
  SUM(current_balance) AS total_trust_balance,
  COUNT(*) AS matter_count
FROM public.trust_balance_by_matter
GROUP BY client_id, user_id;

CREATE OR REPLACE VIEW public.trust_activity_summary AS
SELECT
  user_id,
  client_id,
  matter_id,
  transaction_type,
  date_trunc('month', transaction_date) AS month,
  COUNT(*) AS transaction_count,
  SUM(amount) AS total_amount
FROM public.trust_ledger
GROUP BY user_id, client_id, matter_id, transaction_type, date_trunc('month', transaction_date);

COMMIT;
