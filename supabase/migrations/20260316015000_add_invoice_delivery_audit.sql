CREATE TABLE IF NOT EXISTS public.invoice_delivery_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  provider text NOT NULL DEFAULT 'resend',
  provider_message_id text,
  status text NOT NULL CHECK (status IN ('sent', 'failed')),
  error_message text,
  pdf_path text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_delivery_audit_invoice
  ON public.invoice_delivery_audit(invoice_id, created_at DESC);

ALTER TABLE public.invoice_delivery_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invoice_delivery_audit_select ON public.invoice_delivery_audit;
DROP POLICY IF EXISTS invoice_delivery_audit_insert ON public.invoice_delivery_audit;

CREATE POLICY invoice_delivery_audit_select ON public.invoice_delivery_audit
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY invoice_delivery_audit_insert ON public.invoice_delivery_audit
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

INSERT INTO storage.buckets (id, name, public)
VALUES ('invoice-pdfs', 'invoice-pdfs', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS invoice_pdfs_select ON storage.objects;
DROP POLICY IF EXISTS invoice_pdfs_insert ON storage.objects;
DROP POLICY IF EXISTS invoice_pdfs_update ON storage.objects;

CREATE POLICY invoice_pdfs_select ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'invoice-pdfs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY invoice_pdfs_insert ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'invoice-pdfs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY invoice_pdfs_update ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'invoice-pdfs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'invoice-pdfs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
