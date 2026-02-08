-- Migration: Add matters table and update entries
-- Phase 1: Matters model, 6-minute rounding prep, quick-switch timer

-- Create matters table
CREATE TABLE IF NOT EXISTS matters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  matter_number TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  hourly_rate DECIMAL(10,2),
  flat_fee DECIMAL(10,2),
  billing_type TEXT DEFAULT 'hourly',
  trust_balance DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on matters
ALTER TABLE matters ENABLE ROW LEVEL SECURITY;

-- RLS policies for matters
CREATE POLICY "Users can view their own matters" ON matters
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own matters" ON matters
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own matters" ON matters
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own matters" ON matters
  FOR DELETE USING (user_id = auth.uid());

-- Add matter_id to entries table
ALTER TABLE entries ADD COLUMN IF NOT EXISTS matter_id UUID REFERENCES matters(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_entries_matter_id ON entries(matter_id);
CREATE INDEX IF NOT EXISTS idx_matters_client_id ON matters(client_id);
CREATE INDEX IF NOT EXISTS idx_matters_user_status ON matters(user_id, status);

-- Migration: Create default matters for existing clients
-- This runs automatically when the migration is applied

-- Create a function to handle the migration
CREATE OR REPLACE FUNCTION migrate_existing_entries_to_matters()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  client_record RECORD;
  new_matter_id UUID;
BEGIN
  -- For each client that has entries but no matters, create a "General" matter
  FOR client_record IN 
    SELECT DISTINCT c.id, c.user_id, c.name
    FROM clients c
    INNER JOIN entries e ON e.client_id = c.id
    WHERE NOT EXISTS (
      SELECT 1 FROM matters m WHERE m.client_id = c.id
    )
  LOOP
    -- Create default matter for this client
    INSERT INTO matters (
      user_id,
      client_id,
      name,
      matter_number,
      description,
      status,
      billing_type
    ) VALUES (
      client_record.user_id,
      client_record.id,
      'General',
      NULL,
      'Default matter created during migration',
      'active',
      'hourly'
    )
    RETURNING id INTO new_matter_id;
    
    -- Update existing entries to point to this matter
    UPDATE entries
    SET matter_id = new_matter_id
    WHERE client_id = client_record.id
    AND matter_id IS NULL;
  END LOOP;
END;
$$;

-- Run the migration (comment out if you want to run manually)
SELECT migrate_existing_entries_to_matters();

-- Create updated_at trigger for matters
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_matters_updated_at ON matters;
CREATE TRIGGER update_matters_updated_at
  BEFORE UPDATE ON matters
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
