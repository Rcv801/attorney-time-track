-- Fix RLS policies for clients table
-- Ensures authenticated users can create, read, update, and delete their own clients

-- Enable RLS (if not already enabled)
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own clients" ON clients;
DROP POLICY IF EXISTS "Users can insert their own clients" ON clients;
DROP POLICY IF EXISTS "Users can update their own clients" ON clients;
DROP POLICY IF EXISTS "Users can delete their own clients" ON clients;

-- Create policies
CREATE POLICY "Users can view their own clients" ON clients
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own clients" ON clients
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own clients" ON clients
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own clients" ON clients
  FOR DELETE USING (user_id = auth.uid());

-- Also ensure RLS is enabled on entries and matters
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE matters ENABLE ROW LEVEL SECURITY;

-- Refresh policies on entries (if they exist)
DROP POLICY IF EXISTS "Users can view their own entries" ON entries;
DROP POLICY IF EXISTS "Users can insert their own entries" ON entries;
DROP POLICY IF EXISTS "Users can update their own entries" ON entries;
DROP POLICY IF EXISTS "Users can delete their own entries" ON entries;

CREATE POLICY "Users can view their own entries" ON entries
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own entries" ON entries
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own entries" ON entries
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own entries" ON entries
  FOR DELETE USING (user_id = auth.uid());

-- Refresh policies on matters (if they exist)
DROP POLICY IF EXISTS "Users can view their own matters" ON matters;
DROP POLICY IF EXISTS "Users can insert their own matters" ON matters;
DROP POLICY IF EXISTS "Users can update their own matters" ON matters;
DROP POLICY IF EXISTS "Users can delete their own matters" ON matters;

CREATE POLICY "Users can view their own matters" ON matters
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own matters" ON matters
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own matters" ON matters
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own matters" ON matters
  FOR DELETE USING (user_id = auth.uid());
