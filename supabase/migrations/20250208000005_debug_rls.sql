-- Debug and fix RLS policies
-- Check current policies and recreate them if needed

-- Check if RLS is enabled
DO $$
BEGIN
  -- Enable RLS on all tables
  ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
  ALTER TABLE matters ENABLE ROW LEVEL SECURITY;
  ALTER TABLE entries ENABLE ROW LEVEL SECURITY;
END $$;

-- Recreate policies for clients
DO $$
BEGIN
  -- Drop if exists (ignore errors)
  DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON clients;
  DROP POLICY IF EXISTS "Enable select for users based on user_id" ON clients;
  DROP POLICY IF EXISTS "Enable update for users based on user_id" ON clients;
  DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON clients;
  
  -- Create new policies
  CREATE POLICY "Enable insert for authenticated users only"
    ON clients FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');
    
  CREATE POLICY "Enable select for users based on user_id"
    ON clients FOR SELECT
    USING (user_id = auth.uid());
    
  CREATE POLICY "Enable update for users based on user_id"
    ON clients FOR UPDATE
    USING (user_id = auth.uid());
    
  CREATE POLICY "Enable delete for users based on user_id"
    ON clients FOR DELETE
    USING (user_id = auth.uid());
END $$;

-- Recreate policies for matters
DO $$
BEGIN
  DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON matters;
  DROP POLICY IF EXISTS "Enable select for users based on user_id" ON matters;
  DROP POLICY IF EXISTS "Enable update for users based on user_id" ON matters;
  DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON matters;
  
  CREATE POLICY "Enable insert for authenticated users only"
    ON matters FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');
    
  CREATE POLICY "Enable select for users based on user_id"
    ON matters FOR SELECT
    USING (user_id = auth.uid());
    
  CREATE POLICY "Enable update for users based on user_id"
    ON matters FOR UPDATE
    USING (user_id = auth.uid());
    
  CREATE POLICY "Enable delete for users based on user_id"
    ON matters FOR DELETE
    USING (user_id = auth.uid());
END $$;

-- Recreate policies for entries
DO $$
BEGIN
  DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON entries;
  DROP POLICY IF EXISTS "Enable select for users based on user_id" ON entries;
  DROP POLICY IF EXISTS "Enable update for users based on user_id" ON entries;
  DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON entries;
  
  CREATE POLICY "Enable insert for authenticated users only"
    ON entries FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');
    
  CREATE POLICY "Enable select for users based on user_id"
    ON entries FOR SELECT
    USING (user_id = auth.uid());
    
  CREATE POLICY "Enable update for users based on user_id"
    ON entries FOR UPDATE
    USING (user_id = auth.uid());
    
  CREATE POLICY "Enable delete for users based on user_id"
    ON entries FOR DELETE
    USING (user_id = auth.uid());
END $$;
