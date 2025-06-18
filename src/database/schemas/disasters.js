/**
 * Disasters Table Schema
 * Main table for storing disaster information with geospatial support
 */

export const DISASTERS_TABLE_SCHEMA = `
-- Create disasters table with geospatial support
CREATE TABLE IF NOT EXISTS disasters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  location_name TEXT,
  location GEOGRAPHY(POINT, 4326),
  description TEXT,
  tags TEXT[],
  owner_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  audit_trail JSONB DEFAULT '[]'::jsonb,
  
  -- Constraints
  CONSTRAINT disasters_title_length CHECK (length(title) > 0),
  CONSTRAINT disasters_owner_id_length CHECK (length(owner_id) > 0)
);

-- Add comments for documentation
COMMENT ON TABLE disasters IS 'Main table storing disaster events with geospatial location data';
COMMENT ON COLUMN disasters.id IS 'Unique identifier for the disaster';
COMMENT ON COLUMN disasters.title IS 'Human-readable disaster title';
COMMENT ON COLUMN disasters.location_name IS 'Human-readable location description';
COMMENT ON COLUMN disasters.location IS 'PostGIS geography point (latitude, longitude)';
COMMENT ON COLUMN disasters.description IS 'Detailed description of the disaster';
COMMENT ON COLUMN disasters.tags IS 'Array of disaster type tags for categorization';
COMMENT ON COLUMN disasters.owner_id IS 'ID of the user who created this disaster record';
COMMENT ON COLUMN disasters.audit_trail IS 'JSONB array of actions performed on this record';
`;

export const DISASTERS_INDEXES = `
-- Indexes for disasters table
CREATE INDEX IF NOT EXISTS disasters_location_idx ON disasters USING GIST (location);
CREATE INDEX IF NOT EXISTS disasters_tags_idx ON disasters USING GIN (tags);
CREATE INDEX IF NOT EXISTS disasters_owner_idx ON disasters (owner_id);
CREATE INDEX IF NOT EXISTS disasters_created_at_idx ON disasters (created_at DESC);
CREATE INDEX IF NOT EXISTS disasters_title_idx ON disasters USING GIN (to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS disasters_description_idx ON disasters USING GIN (to_tsvector('english', description));
`;

export const DISASTERS_TRIGGERS = `
-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_disasters_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER disasters_updated_at_trigger
  BEFORE UPDATE ON disasters
  FOR EACH ROW
  EXECUTE FUNCTION update_disasters_updated_at();
`;

export const DISASTERS_RLS_POLICIES = `
-- Row Level Security policies for disasters
ALTER TABLE disasters ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read disasters
CREATE POLICY IF NOT EXISTS "disasters_select_policy" 
ON disasters FOR SELECT 
USING (true);

-- Policy: Authenticated users can insert disasters
CREATE POLICY IF NOT EXISTS "disasters_insert_policy" 
ON disasters FOR INSERT 
WITH CHECK (true);

-- Policy: Users can update their own disasters
CREATE POLICY IF NOT EXISTS "disasters_update_policy" 
ON disasters FOR UPDATE 
USING (true);

-- Policy: Users can delete their own disasters
CREATE POLICY IF NOT EXISTS "disasters_delete_policy" 
ON disasters FOR DELETE 
USING (true);
`;

export const DISASTERS_SCHEMA_COMPLETE = [
  DISASTERS_TABLE_SCHEMA,
  DISASTERS_INDEXES,
  DISASTERS_TRIGGERS,
  DISASTERS_RLS_POLICIES,
];
