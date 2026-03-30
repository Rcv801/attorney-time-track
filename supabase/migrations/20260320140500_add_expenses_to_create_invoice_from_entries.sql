BEGIN;

DROP FUNCTION IF EXISTS public.create_invoice_from_entries(uuid,uuid,uuid,uuid[],date,date,numeric,text,text,boolean);

CREATE OR REPLACE FUNCTION public.create_invoice_from_entries(
  p_user_id uuid,
  p_client_id uuid,
  p_matter_id uuid DEFAULT NULL,
  p_entry_ids uuid[] DEFAULT NULL,
  p_expense_ids uuid[] DEFAULT NULL,
  p_issued_date date DEFAULT current_date,
  p_due_date date DEFAULT NULL,
  p_tax_rate numeric DEFAULT NULL,
  p_payment_terms text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_auto_apply_trust boolean DEFAULT false
)
RETURNS public.invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry_ids uuid[];
  v_expense_ids uuid[];
  v_entry_count integer;
  v_expense_count integer;
  v_entry_min_date date;
  v_entry_max_date date;
  v_expense_min_date date;
  v_expense_max_date date;
  v_entry_subtotal numeric(10,2);
  v_expense_subtotal numeric(10,2);
  v_min_date date;
  v_max_date date;
  v_subtotal numeric(10,2);
  v_tax_rate numeric(5,4);
  v_tax_amount numeric(10,2);
  v_total numeric(10,2);
  v_payment_terms text;
  v_invoice_number text;
  v_invoice public.invoices;
  v_last_trust_balance numeric(10,2);
  v_trust_to_apply numeric(10,2);
  v_new_trust_balance numeric(10,2);
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Not authorized to create invoices for this user';
  END IF;

  SELECT ARRAY(
    SELECT DISTINCT entry_id
    FROM unnest(COALESCE(p_entry_ids, ARRAY[]::uuid[])) AS entry_id
    WHERE entry_id IS NOT NULL
  )
  INTO v_entry_ids;

  SELECT ARRAY(
    SELECT DISTINCT expense_id
    FROM unnest(COALESCE(p_expense_ids, ARRAY[]::uuid[])) AS expense_id
    WHERE expense_id IS NOT NULL
  )
  INTO v_expense_ids;

  IF COALESCE(array_length(v_entry_ids, 1), 0) = 0
    AND COALESCE(array_length(v_expense_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Select at least one unbilled entry or expense before creating an invoice';
  END IF;

  PERFORM 1
  FROM public.entries
  WHERE id = ANY(COALESCE(v_entry_ids, ARRAY[]::uuid[]))
    AND user_id = p_user_id
  FOR UPDATE;

  PERFORM 1
  FROM public.expenses
  WHERE id = ANY(COALESCE(v_expense_ids, ARRAY[]::uuid[]))
    AND user_id = p_user_id
  FOR UPDATE;

  SELECT
    COUNT(*)::integer,
    MIN(ue.start_at::date),
    MAX(COALESCE(ue.end_at, ue.start_at)::date),
    ROUND(COALESCE(SUM(COALESCE(ue.billed_hours, 0) * COALESCE(ue.effective_rate, 0)), 0), 2)
  INTO
    v_entry_count,
    v_entry_min_date,
    v_entry_max_date,
    v_entry_subtotal
  FROM public.unbilled_entries ue
  WHERE ue.user_id = p_user_id
    AND ue.id = ANY(COALESCE(v_entry_ids, ARRAY[]::uuid[]))
    AND ue.client_id = p_client_id
    AND (p_matter_id IS NULL OR ue.matter_id = p_matter_id);

  IF v_entry_count <> COALESCE(array_length(v_entry_ids, 1), 0) THEN
    RAISE EXCEPTION 'Some selected entries are no longer invoiceable. Refresh and try again.';
  END IF;

  SELECT
    COUNT(*)::integer,
    MIN(e.date),
    MAX(e.date),
    ROUND(COALESCE(SUM(e.amount), 0), 2)
  INTO
    v_expense_count,
    v_expense_min_date,
    v_expense_max_date,
    v_expense_subtotal
  FROM public.expenses e
  WHERE e.user_id = p_user_id
    AND e.id = ANY(COALESCE(v_expense_ids, ARRAY[]::uuid[]))
    AND e.client_id = p_client_id
    AND (p_matter_id IS NULL OR e.matter_id = p_matter_id)
    AND e.billable = true
    AND e.status = 'unbilled'
    AND e.invoice_id IS NULL;

  IF v_expense_count <> COALESCE(array_length(v_expense_ids, 1), 0) THEN
    RAISE EXCEPTION 'Some selected expenses are no longer invoiceable. Refresh and try again.';
  END IF;

  v_min_date := COALESCE(LEAST(v_entry_min_date, v_expense_min_date), v_entry_min_date, v_expense_min_date);
  v_max_date := COALESCE(GREATEST(v_entry_max_date, v_expense_max_date), v_entry_max_date, v_expense_max_date);
  v_subtotal := ROUND(COALESCE(v_entry_subtotal, 0) + COALESCE(v_expense_subtotal, 0), 2);
  v_tax_rate := COALESCE(p_tax_rate, 0);
  v_tax_amount := ROUND(v_subtotal * v_tax_rate, 2);
  v_total := v_subtotal + v_tax_amount;
  v_payment_terms := COALESCE(
    NULLIF(trim(p_payment_terms), ''),
    (
      SELECT us.payment_terms
      FROM public.user_settings us
      WHERE us.user_id = p_user_id
    ),
    'Net 30'
  );
  v_invoice_number := public.get_next_invoice_number(p_user_id);

  INSERT INTO public.invoices (
    user_id,
    client_id,
    matter_id,
    invoice_number,
    status,
    issued_date,
    due_date,
    date_range_start,
    date_range_end,
    subtotal,
    tax_rate,
    tax_amount,
    total,
    amount_paid,
    balance_due,
    trust_applied,
    notes,
    payment_terms
  ) VALUES (
    p_user_id,
    p_client_id,
    p_matter_id,
    v_invoice_number,
    'draft',
    COALESCE(p_issued_date, current_date),
    COALESCE(p_due_date, COALESCE(p_issued_date, current_date) + 30),
    v_min_date,
    v_max_date,
    v_subtotal,
    v_tax_rate,
    v_tax_amount,
    v_total,
    0,
    v_total,
    0,
    COALESCE(NULLIF(trim(p_notes), ''), NULL),
    v_payment_terms
  )
  RETURNING * INTO v_invoice;

  INSERT INTO public.invoice_line_items (
    invoice_id,
    entry_id,
    expense_id,
    line_type,
    date,
    description,
    matter_name,
    quantity,
    rate,
    amount,
    sort_order
  )
  SELECT
    v_invoice.id,
    item.entry_id,
    item.expense_id,
    item.line_type,
    item.item_date,
    item.description,
    item.matter_name,
    item.quantity,
    item.rate,
    item.amount,
    ROW_NUMBER() OVER (ORDER BY item.item_date, item.line_type, COALESCE(item.entry_id, item.expense_id)) - 1
  FROM (
    SELECT
      ue.id AS entry_id,
      NULL::uuid AS expense_id,
      'time'::text AS line_type,
      ue.start_at::date AS item_date,
      COALESCE(NULLIF(trim(ue.notes), ''), 'Time entry') AS description,
      ue.matter_name,
      COALESCE(ue.billed_hours, 0) AS quantity,
      COALESCE(ue.effective_rate, 0) AS rate,
      ROUND(COALESCE(ue.billed_hours, 0) * COALESCE(ue.effective_rate, 0), 2) AS amount
    FROM public.unbilled_entries ue
    WHERE ue.user_id = p_user_id
      AND ue.id = ANY(COALESCE(v_entry_ids, ARRAY[]::uuid[]))

    UNION ALL

    SELECT
      NULL::uuid AS entry_id,
      e.id AS expense_id,
      'expense'::text AS line_type,
      e.date AS item_date,
      COALESCE(NULLIF(trim(e.description), ''), 'Expense') AS description,
      m.name AS matter_name,
      1::numeric AS quantity,
      NULL::numeric AS rate,
      ROUND(COALESCE(e.amount, 0), 2) AS amount
    FROM public.expenses e
    LEFT JOIN public.matters m ON m.id = e.matter_id
    WHERE e.user_id = p_user_id
      AND e.id = ANY(COALESCE(v_expense_ids, ARRAY[]::uuid[]))
  ) AS item;

  UPDATE public.entries
  SET
    billed = true,
    invoice_id = v_invoice.id
  WHERE user_id = p_user_id
    AND id = ANY(COALESCE(v_entry_ids, ARRAY[]::uuid[]));

  UPDATE public.expenses
  SET
    invoice_id = v_invoice.id,
    status = 'invoiced'
  WHERE user_id = p_user_id
    AND id = ANY(COALESCE(v_expense_ids, ARRAY[]::uuid[]));

  IF p_auto_apply_trust AND p_matter_id IS NOT NULL THEN
    SELECT running_balance
    INTO v_last_trust_balance
    FROM public.trust_ledger
    WHERE matter_id = p_matter_id
      AND user_id = p_user_id
    ORDER BY created_at DESC, id DESC
    LIMIT 1;

    v_last_trust_balance := COALESCE(v_last_trust_balance, 0);
    v_trust_to_apply := LEAST(v_total, v_last_trust_balance);

    IF v_trust_to_apply > 0 THEN
      v_new_trust_balance := v_last_trust_balance - v_trust_to_apply;

      INSERT INTO public.trust_ledger (
        user_id,
        client_id,
        matter_id,
        transaction_date,
        transaction_type,
        amount,
        running_balance,
        description,
        invoice_id
      ) VALUES (
        p_user_id,
        p_client_id,
        p_matter_id,
        COALESCE(p_issued_date, current_date),
        'disbursement',
        -v_trust_to_apply,
        v_new_trust_balance,
        'Auto-applied trust to invoice ' || v_invoice_number,
        v_invoice.id
      );

      UPDATE public.invoices
      SET
        trust_applied = v_trust_to_apply,
        balance_due = GREATEST(v_total - v_trust_to_apply, 0),
        status = CASE
          WHEN v_trust_to_apply >= v_total THEN 'paid'
          WHEN v_trust_to_apply > 0 THEN 'partial'
          ELSE status
        END,
        paid_at = CASE
          WHEN v_trust_to_apply >= v_total THEN now()
          ELSE paid_at
        END,
        updated_at = now()
      WHERE id = v_invoice.id
      RETURNING * INTO v_invoice;
    END IF;
  END IF;

  RETURN v_invoice;
END;
$$;

REVOKE ALL ON FUNCTION public.create_invoice_from_entries(uuid,uuid,uuid,uuid[],uuid[],date,date,numeric,text,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_invoice_from_entries(uuid,uuid,uuid,uuid[],uuid[],date,date,numeric,text,text,boolean) TO authenticated;

COMMIT;
