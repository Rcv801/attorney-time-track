# 02 — Trust/IOLTA Ledger Schema

*Phase 2 Spec — Created February 18, 2026*

---

## Context

Every state bar requires attorneys to maintain separate trust (IOLTA) accounts for client funds. Errors in trust accounting can result in bar discipline, suspension, or disbarment. The current schema has only a `trust_balance` field on the `matters` table — no ledger, no audit trail, no transaction history.

This spec creates a proper append-only trust ledger with running balance assertions, audit trail, and reconciliation support.

---

## Design Principles

1. **Append-only** — Trust ledger entries are never updated or deleted. Corrections are new entries.
2. **Running balance assertion** — Every entry stores the balance *after* the transaction. This creates a self-verifying chain.
3. **Per-client, per-matter** — Trust balances are tracked at both levels. A client's total trust balance = sum of all their matter trust balances.
4. **Audit trail** — Every entry has a timestamp, description, and reference. No silent modifications.

---

## Migration SQL

```sql
-- Migration: Trust/IOLTA Ledger
-- supabase/migrations/YYYYMMDDHHMMSS_trust_iolta_ledger.sql

-- ============================================================
-- 1. TRUST LEDGER (APPEND-ONLY)
-- ============================================================

CREATE TABLE trust_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  matter_id UUID NOT NULL REFERENCES matters(id) ON DELETE RESTRICT,

  -- Transaction details
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'deposit',           -- client funds received into trust
    'disbursement',      -- funds paid out to attorney (operating) or third party
    'refund',            -- funds returned to client
    'transfer_in',       -- transfer from another matter's trust
    'transfer_out',      -- transfer to another matter's trust
    'interest',          -- interest earned (if applicable)
    'bank_fee',          -- bank charges against trust
    'correction'         -- correcting entry (with reference to original)
  )),

  -- Amount: positive for deposits/transfers in, negative for disbursements/transfers out
  amount NUMERIC(10,2) NOT NULL,
  -- Running balance AFTER this transaction (self-verifying chain)
  running_balance NUMERIC(10,2) NOT NULL,

  -- Description & references
  description TEXT NOT NULL,
  reference_number TEXT,         -- check number, wire ref, transaction ID
  payor_payee TEXT,              -- who paid / who was paid
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  correction_of UUID REFERENCES trust_ledger(id), -- if type='correction', points to corrected entry

  -- Reconciliation
  reconciled BOOLEAN NOT NULL DEFAULT FALSE,
  reconciled_at TIMESTAMPTZ,
  reconciled_by UUID REFERENCES auth.users(id),

  -- Immutable timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  -- NO updated_at — trust entries are IMMUTABLE
);

-- Indexes
CREATE INDEX idx_trust_client ON trust_ledger(client_id, transaction_date);
CREATE INDEX idx_trust_matter ON trust_ledger(matter_id, transaction_date);
CREATE INDEX idx_trust_user ON trust_ledger(user_id, transaction_date);
CREATE INDEX idx_trust_unreconciled ON trust_ledger(user_id, reconciled) WHERE reconciled = FALSE;
CREATE INDEX idx_trust_type ON trust_ledger(user_id, transaction_type);

-- ============================================================
-- 2. BALANCE VALIDATION FUNCTION
-- ============================================================
-- Validates that the running_balance is correct before inserting.
-- This prevents any application bug from corrupting the ledger.

CREATE OR REPLACE FUNCTION validate_trust_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_last_balance NUMERIC(10,2);
  v_expected_balance NUMERIC(10,2);
BEGIN
  -- Get the most recent balance for this matter
  SELECT running_balance
  INTO v_last_balance
  FROM trust_ledger
  WHERE matter_id = NEW.matter_id
    AND user_id = NEW.user_id
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  -- If no prior entries, previous balance is 0
  v_last_balance := COALESCE(v_last_balance, 0);

  -- Calculate expected balance
  v_expected_balance := v_last_balance + NEW.amount;

  -- Validate
  IF NEW.running_balance != v_expected_balance THEN
    RAISE EXCEPTION 'Trust balance mismatch: expected %, got %. Previous balance: %, amount: %',
      v_expected_balance, NEW.running_balance, v_last_balance, NEW.amount;
  END IF;

  -- Prevent negative balances (trust accounts should never go negative)
  IF v_expected_balance < 0 THEN
    RAISE EXCEPTION 'Trust balance cannot be negative. Current balance: %, attempted withdrawal: %',
      v_last_balance, NEW.amount;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_trust_balance
BEFORE INSERT ON trust_ledger
FOR EACH ROW
EXECUTE FUNCTION validate_trust_balance();

-- ============================================================
-- 3. PREVENT UPDATES AND DELETES ON TRUST LEDGER
-- ============================================================

CREATE OR REPLACE FUNCTION prevent_trust_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Trust ledger entries cannot be deleted. Create a correction entry instead.';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Only allow updating reconciliation fields
    IF OLD.amount != NEW.amount
       OR OLD.running_balance != NEW.running_balance
       OR OLD.transaction_type != NEW.transaction_type
       OR OLD.description != NEW.description
       OR OLD.client_id != NEW.client_id
       OR OLD.matter_id != NEW.matter_id
       OR OLD.transaction_date != NEW.transaction_date
    THEN
      RAISE EXCEPTION 'Trust ledger entries are immutable. Only reconciliation status can be updated.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_trust_modification
BEFORE UPDATE OR DELETE ON trust_ledger
FOR EACH ROW
EXECUTE FUNCTION prevent_trust_modification();

-- ============================================================
-- 4. SYNC MATTER trust_balance FIELD
-- ============================================================
-- Keep matters.trust_balance in sync as a denormalized cache.

CREATE OR REPLACE FUNCTION sync_matter_trust_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE matters
  SET trust_balance = NEW.running_balance,
      updated_at = now()
  WHERE id = NEW.matter_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_trust_balance
AFTER INSERT ON trust_ledger
FOR EACH ROW
EXECUTE FUNCTION sync_matter_trust_balance();

-- ============================================================
-- 5. TRUST BALANCE VIEWS
-- ============================================================

-- Per-matter trust balance (current)
CREATE OR REPLACE VIEW trust_balance_by_matter AS
SELECT DISTINCT ON (matter_id)
  matter_id,
  client_id,
  user_id,
  running_balance AS current_balance,
  transaction_date AS last_transaction_date,
  created_at AS last_transaction_at
FROM trust_ledger
ORDER BY matter_id, created_at DESC, id DESC;

-- Per-client trust balance (aggregate)
CREATE OR REPLACE VIEW trust_balance_by_client AS
SELECT
  client_id,
  user_id,
  SUM(current_balance) AS total_trust_balance,
  COUNT(*) AS matter_count
FROM trust_balance_by_matter
GROUP BY client_id, user_id;

-- Trust activity summary (for reports)
CREATE OR REPLACE VIEW trust_activity_summary AS
SELECT
  user_id,
  client_id,
  matter_id,
  transaction_type,
  DATE_TRUNC('month', transaction_date) AS month,
  COUNT(*) AS transaction_count,
  SUM(amount) AS total_amount
FROM trust_ledger
GROUP BY user_id, client_id, matter_id, transaction_type, DATE_TRUNC('month', transaction_date);

-- ============================================================
-- 6. HELPER FUNCTION: RECORD TRUST TRANSACTION
-- ============================================================
-- Convenience function that calculates running_balance automatically.

CREATE OR REPLACE FUNCTION record_trust_transaction(
  p_user_id UUID,
  p_client_id UUID,
  p_matter_id UUID,
  p_type TEXT,
  p_amount NUMERIC,
  p_description TEXT,
  p_reference TEXT DEFAULT NULL,
  p_payor_payee TEXT DEFAULT NULL,
  p_invoice_id UUID DEFAULT NULL,
  p_correction_of UUID DEFAULT NULL,
  p_transaction_date DATE DEFAULT CURRENT_DATE
)
RETURNS trust_ledger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_last_balance NUMERIC(10,2);
  v_new_balance NUMERIC(10,2);
  v_result trust_ledger;
BEGIN
  -- Get current balance
  SELECT running_balance
  INTO v_last_balance
  FROM trust_ledger
  WHERE matter_id = p_matter_id AND user_id = p_user_id
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  v_last_balance := COALESCE(v_last_balance, 0);
  v_new_balance := v_last_balance + p_amount;

  INSERT INTO trust_ledger (
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

-- ============================================================
-- 7. RLS POLICIES
-- ============================================================

ALTER TABLE trust_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY trust_select ON trust_ledger FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY trust_insert ON trust_ledger FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Update only for reconciliation fields
CREATE POLICY trust_update ON trust_ledger FOR UPDATE
  USING (auth.uid() = user_id);

-- No delete policy — append-only enforced by trigger
-- (The trigger will RAISE EXCEPTION on any delete attempt,
--  but not having a DELETE policy adds defense in depth)
```

---

## Usage Examples

### Record a retainer deposit
```typescript
const { data } = await supabase.rpc('record_trust_transaction', {
  p_user_id: userId,
  p_client_id: clientId,
  p_matter_id: matterId,
  p_type: 'deposit',
  p_amount: 5000.00,
  p_description: 'Initial retainer deposit',
  p_reference: 'Check #1234',
  p_payor_payee: 'John Smith'
});
```

### Disburse funds to pay an invoice
```typescript
const { data } = await supabase.rpc('record_trust_transaction', {
  p_user_id: userId,
  p_client_id: clientId,
  p_matter_id: matterId,
  p_type: 'disbursement',
  p_amount: -750.00, // negative for withdrawals
  p_description: 'Applied to Invoice INV-01005',
  p_invoice_id: invoiceId
});
```

### Get current trust balance for a matter
```typescript
const { data } = await supabase
  .from('trust_balance_by_matter')
  .select('*')
  .eq('matter_id', matterId)
  .single();
// data.current_balance
```

### Get full trust ledger for a client
```typescript
const { data } = await supabase
  .from('trust_ledger')
  .select('*')
  .eq('client_id', clientId)
  .order('created_at', { ascending: true });
```

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Append-only with trigger enforcement | State bar requirement. No silent edits. Corrections are explicit new entries. |
| Running balance stored per-entry | Self-verifying chain. Any corruption is immediately detectable. |
| Balance validation trigger | Prevents application bugs from creating invalid balances. |
| Negative balance prevention | Trust accounts must never go negative — ethical obligation. |
| `matters.trust_balance` synced via trigger | Keeps the denormalized field accurate without manual updates. |
| Per-matter (not per-client) tracking | Different matters can have different retainer amounts. Client total = sum of matters. |
| `record_trust_transaction` helper | Calculates running_balance automatically, reducing chance of app-level errors. |
