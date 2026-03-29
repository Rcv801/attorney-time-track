-- SECURITY FIX: Remove INSERT policies that only check auth.role() without verifying user_id
-- These allow any authenticated user to insert rows with someone else's user_id
-- Since RLS policies are PERMISSIVE (OR logic), a single weak policy defeats all others

-- clients: drop the overly permissive policy
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.clients;
DROP POLICY IF EXISTS "Users can insert their own clients" ON public.clients;
-- clients_insert_own already correctly checks user_id = auth.uid()

-- entries: same fix
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.entries;
DROP POLICY IF EXISTS "Users can insert their own entries" ON public.entries;
-- entries_insert_own_phase1 already correctly checks user_id = auth.uid()

-- matters: same fix
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.matters;
DROP POLICY IF EXISTS "Users can insert their own matters" ON public.matters;
CREATE POLICY "matters_insert_own" ON public.matters
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Clean up duplicate SELECT policies (keep one per table)
DROP POLICY IF EXISTS "Enable select for users based on user_id" ON public.clients;
DROP POLICY IF EXISTS "Users can view their own clients" ON public.clients;
DROP POLICY IF EXISTS "Enable select for users based on user_id" ON public.entries;
DROP POLICY IF EXISTS "Users can view their own entries" ON public.entries;
DROP POLICY IF EXISTS "Enable select for users based on user_id" ON public.matters;
DROP POLICY IF EXISTS "Users can view their own matters" ON public.matters;

-- Clean up duplicate UPDATE policies
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON public.clients;
DROP POLICY IF EXISTS "Users can update their own clients" ON public.clients;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON public.entries;
DROP POLICY IF EXISTS "Users can update their own entries" ON public.entries;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON public.matters;
DROP POLICY IF EXISTS "Users can update their own matters" ON public.matters;

-- Clean up duplicate DELETE policies
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON public.clients;
DROP POLICY IF EXISTS "Users can delete their own clients" ON public.clients;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON public.entries;
DROP POLICY IF EXISTS "Users can delete their own entries" ON public.entries;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON public.matters;
DROP POLICY IF EXISTS "Users can delete their own matters" ON public.matters;

-- Re-create proper policies for matters (since all originals were duplicates that got dropped)
CREATE POLICY "matters_select_own" ON public.matters
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "matters_update_own" ON public.matters
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "matters_delete_own" ON public.matters
  FOR DELETE USING (user_id = auth.uid());
