BEGIN;

CREATE OR REPLACE FUNCTION public.apply_trust_to_invoice(
  p_user_id uuid,
  p_invoice_id uuid,
  p_amount numeric,
  p_description text DEFAULT NULL,
  p_reference text DEFAULT NULL,
  p_transaction_date date DEFAULT current_date
)
RETURNS public.trust_ledger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice public.invoices;
  v_last_balance numeric(10,2);
  v_new_trust_applied numeric(10,2);
  v_remaining_due numeric(10,2);
  v_new_balance numeric(10,2);
  v_ledger_entry public.trust_ledger;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Not authorized to apply trust funds for this user';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Trust application amount must be greater than zero';
  END IF;

  SELECT *
  INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id
    AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found for this user';
  END IF;

  IF v_invoice.matter_id IS NULL THEN
    RAISE EXCEPTION 'Invoice must be linked to a matter before trust can be applied';
  END IF;

  SELECT running_balance
  INTO v_last_balance
  FROM public.trust_ledger
  WHERE matter_id = v_invoice.matter_id
    AND user_id = p_user_id
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  v_last_balance := COALESCE(v_last_balance, 0);
  v_remaining_due := GREATEST(v_invoice.total - v_invoice.amount_paid - v_invoice.trust_applied, 0);

  IF v_remaining_due <= 0 THEN
    RAISE EXCEPTION 'Invoice has no remaining balance due';
  END IF;

  IF p_amount > v_remaining_due THEN
    RAISE EXCEPTION 'Trust application exceeds invoice balance. Remaining due: %', v_remaining_due;
  END IF;

  IF p_amount > v_last_balance THEN
    RAISE EXCEPTION 'Trust application exceeds available matter balance. Available: %', v_last_balance;
  END IF;

  v_new_balance := v_last_balance - p_amount;

  INSERT INTO public.trust_ledger (
    user_id,
    client_id,
    matter_id,
    transaction_date,
    transaction_type,
    amount,
    running_balance,
    description,
    reference_number,
    invoice_id
  ) VALUES (
    p_user_id,
    v_invoice.client_id,
    v_invoice.matter_id,
    p_transaction_date,
    'disbursement',
    -p_amount,
    v_new_balance,
    COALESCE(p_description, 'Trust applied to invoice ' || v_invoice.invoice_number),
    p_reference,
    p_invoice_id
  )
  RETURNING * INTO v_ledger_entry;

  v_new_trust_applied := v_invoice.trust_applied + p_amount;

  UPDATE public.invoices
  SET
    trust_applied = v_new_trust_applied,
    balance_due = GREATEST(total - amount_paid - v_new_trust_applied, 0),
    status = CASE
      WHEN (amount_paid + v_new_trust_applied) >= total THEN 'paid'
      WHEN (amount_paid + v_new_trust_applied) > 0 THEN 'partial'
      ELSE status
    END,
    paid_at = CASE
      WHEN (amount_paid + v_new_trust_applied) >= total THEN now()
      ELSE paid_at
    END,
    updated_at = now()
  WHERE id = p_invoice_id;

  RETURN v_ledger_entry;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_trust_to_invoice(uuid,uuid,numeric,text,text,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_trust_to_invoice(uuid,uuid,numeric,text,text,date) TO authenticated;

COMMIT;
