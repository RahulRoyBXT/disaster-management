/**
 * Resources Table Schema
 * Stores available resources like shelters, hospitals, supply points
 */

export const RESOURCES_TABLE_SCHEMA = `
-- Create resources table with geospatial support
CREATE TABLE IF NOT EXISTS resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  disaster_id UUID NOT NULL REFERENCES disasters(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location_name TEXT,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  capacity INTEGER,
  current_occupancy INTEGER DEFAULT 0,
  contact_info JSONB DEFAULT '{}'::jsonb,
  operating_hours JSONB DEFAULT '{}'::jsonb,
  status TEXT CHECK (status IN ('active', 'inactive', 'full', 'maintenance')) DEFAULT 'active',
  created_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Constraints
  CONSTRAINT resources_name_length CHECK (length(name) > 0),
  CONSTRAINT resources_type_length CHECK (length(type) > 0),
  CONSTRAINT resources_capacity_positive CHECK (capacity IS NULL OR capacity > 0),
  CONSTRAINT resources_occupancy_valid CHECK (
    current_occupancy >= 0 AND 
    (capacity IS NULL OR current_occupancy <= capacity)
  )
);

-- Add comments for documentation
COMMENT ON TABLE resources IS 'Available resources during disasters (shelters, hospitals, supplies)';
COMMENT ON COLUMN resources.id IS 'Unique identifier for the resource';
COMMENT ON COLUMN resources.disaster_id IS 'Foreign key reference to disasters table';
COMMENT ON COLUMN resources.name IS 'Name of the resource';
COMMENT ON COLUMN resources.location_name IS 'Human-readable location description';
COMMENT ON COLUMN resources.location IS 'PostGIS geography point (required for proximity searches)';
COMMENT ON COLUMN resources.type IS 'Type of resource (shelter, hospital, food, water, etc.)';
COMMENT ON COLUMN resources.description IS 'Detailed description of the resource';
COMMENT ON COLUMN resources.capacity IS 'Maximum capacity if applicable';
COMMENT ON COLUMN resources.current_occupancy IS 'Current number of people/items';
COMMENT ON COLUMN resources.contact_info IS 'Contact information in JSON format';
COMMENT ON COLUMN resources.operating_hours IS 'Operating hours schedule in JSON format';
COMMENT ON COLUMN resources.status IS 'Current operational status';
COMMENT ON COLUMN resources.metadata IS 'Additional resource-specific data';
`;

export const RESOURCES_INDEXES = `
-- Indexes for resources table
CREATE INDEX IF NOT EXISTS resources_location_idx ON resources USING GIST (location);
CREATE INDEX IF NOT EXISTS resources_disaster_id_idx ON resources (disaster_id);
CREATE INDEX IF NOT EXISTS resources_type_idx ON resources (type);
CREATE INDEX IF NOT EXISTS resources_status_idx ON resources (status);
CREATE INDEX IF NOT EXISTS resources_created_at_idx ON resources (created_at DESC);
CREATE INDEX IF NOT EXISTS resources_capacity_idx ON resources (capacity) WHERE capacity IS NOT NULL;
CREATE INDEX IF NOT EXISTS resources_name_idx ON resources USING GIN (to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS resources_description_idx ON resources USING GIN (to_tsvector('english', description));

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS resources_type_status_idx ON resources (type, status);
CREATE INDEX IF NOT EXISTS resources_disaster_type_idx ON resources (disaster_id, type);
`;

export const RESOURCES_TRIGGERS = `
-- Update timestamp trigger for resources
CREATE OR REPLACE FUNCTION update_resources_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER resources_updated_at_trigger
  BEFORE UPDATE ON resources
  FOR EACH ROW
  EXECUTE FUNCTION update_resources_updated_at();

-- Auto-update status based on occupancy
CREATE OR REPLACE FUNCTION update_resource_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-mark as full when capacity is reached
  IF NEW.capacity IS NOT NULL AND NEW.current_occupancy >= NEW.capacity THEN
    NEW.status = 'full';
  -- Auto-mark as active if occupancy drops below capacity
  ELSIF NEW.capacity IS NOT NULL AND NEW.current_occupancy < NEW.capacity AND OLD.status = 'full' THEN
    NEW.status = 'active';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER resources_status_trigger
  BEFORE UPDATE ON resources
  FOR EACH ROW
  EXECUTE FUNCTION update_resource_status();
`;

export const RESOURCES_RLS_POLICIES = `
-- Row Level Security policies for resources
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read active resources
CREATE POLICY IF NOT EXISTS "resources_select_policy" 
ON resources FOR SELECT 
USING (status IN ('active', 'full'));

-- Policy: Authenticated users can insert resources
CREATE POLICY IF NOT EXISTS "resources_insert_policy" 
ON resources FOR INSERT 
WITH CHECK (true);

-- Policy: Users can update resources they created
CREATE POLICY IF NOT EXISTS "resources_update_policy" 
ON resources FOR UPDATE 
USING (true);

-- Policy: Users can delete resources they created
CREATE POLICY IF NOT EXISTS "resources_delete_policy" 
ON resources FOR DELETE 
USING (true);
`;

export const RESOURCES_SCHEMA_COMPLETE = [
  RESOURCES_TABLE_SCHEMA,
  RESOURCES_INDEXES,
  RESOURCES_TRIGGERS,
  RESOURCES_RLS_POLICIES,
];
