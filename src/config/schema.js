// Database schema SQL definitions for Supabase setup

export const ENABLE_POSTGIS = `
-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;
`;

export const CREATE_DISASTERS_TABLE = `
-- Create disasters table
CREATE TABLE IF NOT EXISTS disasters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  location_name TEXT,
  location GEOGRAPHY(POINT, 4326),
  description TEXT,
  tags TEXT[],
  owner_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  audit_trail JSONB DEFAULT '[]'
);

-- Create indexes for disasters table
CREATE INDEX IF NOT EXISTS disasters_location_idx ON disasters USING GIST (location);
CREATE INDEX IF NOT EXISTS disasters_tags_idx ON disasters USING GIN (tags);
CREATE INDEX IF NOT EXISTS disasters_owner_idx ON disasters (owner_id);
CREATE INDEX IF NOT EXISTS disasters_created_at_idx ON disasters (created_at DESC);
`;

export const CREATE_REPORTS_TABLE = `
-- Create reports table
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  disaster_id UUID REFERENCES disasters(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  content TEXT,
  image_url TEXT,
  verification_status TEXT CHECK (verification_status IN ('pending', 'verified', 'fake')) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for reports table
CREATE INDEX IF NOT EXISTS reports_disaster_id_idx ON reports (disaster_id);
CREATE INDEX IF NOT EXISTS reports_user_id_idx ON reports (user_id);
CREATE INDEX IF NOT EXISTS reports_verification_status_idx ON reports (verification_status);
CREATE INDEX IF NOT EXISTS reports_created_at_idx ON reports (created_at DESC);
`;

export const CREATE_RESOURCES_TABLE = `
-- Create resources table
CREATE TABLE IF NOT EXISTS resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  disaster_id UUID REFERENCES disasters(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location_name TEXT,
  location GEOGRAPHY(POINT, 4326),
  type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for resources table
CREATE INDEX IF NOT EXISTS resources_location_idx ON resources USING GIST (location);
CREATE INDEX IF NOT EXISTS resources_disaster_id_idx ON resources (disaster_id);
CREATE INDEX IF NOT EXISTS resources_type_idx ON resources (type);
CREATE INDEX IF NOT EXISTS resources_created_at_idx ON resources (created_at DESC);
`;

export const CREATE_CACHE_TABLE = `
-- Create cache table
CREATE TABLE IF NOT EXISTS cache (
  key TEXT PRIMARY KEY,
  value JSONB,
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Create index for cache table
CREATE INDEX IF NOT EXISTS cache_expires_at_idx ON cache (expires_at);
`;

// Row Level Security (RLS) policies
export const SETUP_RLS_POLICIES = `
-- Enable RLS on all tables
ALTER TABLE disasters ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE cache ENABLE ROW LEVEL SECURITY;

-- Disasters policies
CREATE POLICY IF NOT EXISTS "disasters_select_policy" ON disasters FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "disasters_insert_policy" ON disasters FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "disasters_update_policy" ON disasters FOR UPDATE USING (true);
CREATE POLICY IF NOT EXISTS "disasters_delete_policy" ON disasters FOR DELETE USING (true);

-- Reports policies  
CREATE POLICY IF NOT EXISTS "reports_select_policy" ON reports FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "reports_insert_policy" ON reports FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "reports_update_policy" ON reports FOR UPDATE USING (true);
CREATE POLICY IF NOT EXISTS "reports_delete_policy" ON reports FOR DELETE USING (true);

-- Resources policies
CREATE POLICY IF NOT EXISTS "resources_select_policy" ON resources FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "resources_insert_policy" ON resources FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "resources_update_policy" ON resources FOR UPDATE USING (true);
CREATE POLICY IF NOT EXISTS "resources_delete_policy" ON resources FOR DELETE USING (true);

-- Cache policies
CREATE POLICY IF NOT EXISTS "cache_select_policy" ON cache FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "cache_insert_policy" ON cache FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "cache_update_policy" ON cache FOR UPDATE USING (true);
CREATE POLICY IF NOT EXISTS "cache_delete_policy" ON cache FOR DELETE USING (true);
`;

// Utility functions
export const CREATE_UTILITY_FUNCTIONS = `
-- Function to clean expired cache entries
CREATE OR REPLACE FUNCTION clean_expired_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM cache WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to add audit trail entry
CREATE OR REPLACE FUNCTION add_audit_trail(
  disaster_uuid UUID,
  action_type TEXT,
  user_identifier TEXT
)
RETURNS VOID AS $$
BEGIN
  UPDATE disasters 
  SET audit_trail = audit_trail || jsonb_build_object(
    'action', action_type,
    'user_id', user_identifier,
    'timestamp', NOW()
  )
  WHERE id = disaster_uuid;
END;
$$ LANGUAGE plpgsql;

-- Function to get nearby resources
CREATE OR REPLACE FUNCTION get_nearby_resources(
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  radius_meters INTEGER DEFAULT 10000
)
RETURNS TABLE (
  id UUID,
  disaster_id UUID,
  name TEXT,
  location_name TEXT,
  type TEXT,
  distance_meters DOUBLE PRECISION,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.disaster_id,
    r.name,
    r.location_name,
    r.type,
    ST_Distance(r.location, ST_SetSRID(ST_MakePoint(lng, lat), 4326)) as distance_meters,
    r.created_at
  FROM resources r
  WHERE ST_DWithin(
    r.location,
    ST_SetSRID(ST_MakePoint(lng, lat), 4326),
    radius_meters
  )
  ORDER BY distance_meters;
END;
$$ LANGUAGE plpgsql;
`;

// All schema creation queries in order
export const ALL_SCHEMA_QUERIES = [
  ENABLE_POSTGIS,
  CREATE_DISASTERS_TABLE,
  CREATE_REPORTS_TABLE,
  CREATE_RESOURCES_TABLE,
  CREATE_CACHE_TABLE,
  SETUP_RLS_POLICIES,
  CREATE_UTILITY_FUNCTIONS,
];
