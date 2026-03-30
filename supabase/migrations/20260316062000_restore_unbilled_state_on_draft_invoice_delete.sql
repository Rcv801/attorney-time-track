BEGIN;

CREATE OR REPLACE FUNCTION public.restore_unbilled_state_on_draft_invoice_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'draft' THEN
    UPDATE public.entries
    SET
      billed = false,
      invoice_id = NULL
    WHERE invoice_id = OLD.id;

    UPDATE public.expenses
    SET
      status = 'unbilled',
      invoice_id = NULL
    WHERE invoice_id = OLD.id
      AND status = 'invoiced';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_restore_unbilled_state_on_draft_invoice_delete ON public.invoices;
CREATE TRIGGER trg_restore_unbilled_state_on_draft_invoice_delete
BEFORE DELETE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.restore_unbilled_state_on_draft_invoice_delete();

COMMIT;
