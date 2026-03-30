-- Migration: Baseline schema for clean project bootstraps
-- Provides the original Phase 1 foundations that later migrations assume

BEGIN;

-- ------------------------------------------------------------
-- Profiles mirror auth.users for app-owned metadata / FKs
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;

CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE USING (id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill any already-existing auth users.
INSERT INTO public.profiles (id, email)
SELECT id, email
FROM auth.users
ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email;

-- ------------------------------------------------------------
-- Clients
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  hourly_rate numeric(10,2) NOT NULL DEFAULT 0,
  color text,
  notes text,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clients_user_id ON public.clients(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_user_archived ON public.clients(user_id, archived);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clients_select_own ON public.clients;
DROP POLICY IF EXISTS clients_insert_own ON public.clients;
DROP POLICY IF EXISTS clients_update_own ON public.clients;
DROP POLICY IF EXISTS clients_delete_own ON public.clients;

CREATE POLICY clients_select_own ON public.clients
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY clients_insert_own ON public.clients
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY clients_update_own ON public.clients
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY clients_delete_own ON public.clients
  FOR DELETE USING (user_id = auth.uid());

-- ------------------------------------------------------------
-- Minimal pre-Phase-2 invoices table
-- Later replaced by 20260301173000_phase2_foundation_invoicing_trust_settings.sql
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  invoice_name text NOT NULL,
  date_range_start date NOT NULL,
  date_range_end date NOT NULL,
  total_amount numeric(10,2),
  file_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON public.invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON public.invoices(client_id);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invoices_select_own_phase1 ON public.invoices;
DROP POLICY IF EXISTS invoices_insert_own_phase1 ON public.invoices;
DROP POLICY IF EXISTS invoices_update_own_phase1 ON public.invoices;
DROP POLICY IF EXISTS invoices_delete_own_phase1 ON public.invoices;

CREATE POLICY invoices_select_own_phase1 ON public.invoices
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY invoices_insert_own_phase1 ON public.invoices
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY invoices_update_own_phase1 ON public.invoices
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY invoices_delete_own_phase1 ON public.invoices
  FOR DELETE USING (user_id = auth.uid());

-- ------------------------------------------------------------
-- Entries
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz,
  duration_sec integer,
  notes text,
  paused_at timestamptz,
  total_paused_seconds integer DEFAULT 0,
  billed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entries_user_id ON public.entries(user_id);
CREATE INDEX IF NOT EXISTS idx_entries_client_id ON public.entries(client_id);
CREATE INDEX IF NOT EXISTS idx_entries_start_at ON public.entries(start_at DESC);
CREATE INDEX IF NOT EXISTS idx_entries_invoice_id ON public.entries(invoice_id);

ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS entries_select_own_phase1 ON public.entries;
DROP POLICY IF EXISTS entries_insert_own_phase1 ON public.entries;
DROP POLICY IF EXISTS entries_update_own_phase1 ON public.entries;
DROP POLICY IF EXISTS entries_delete_own_phase1 ON public.entries;

CREATE POLICY entries_select_own_phase1 ON public.entries
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY entries_insert_own_phase1 ON public.entries
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY entries_update_own_phase1 ON public.entries
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY entries_delete_own_phase1 ON public.entries
  FOR DELETE USING (user_id = auth.uid());

COMMIT;
