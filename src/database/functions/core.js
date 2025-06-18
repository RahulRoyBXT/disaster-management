/**
 * PostGIS and Core Database Functions
 * Essential database functions for geospatial operations and utilities
 */

export const ENABLE_EXTENSIONS = `
-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add comments
COMMENT ON EXTENSION postgis IS 'PostGIS extension for geospatial operations';
COMMENT ON EXTENSION "uuid-ossp" IS 'UUID generation functions';
COMMENT ON EXTENSION pg_trgm IS 'Trigram matching for text search';
`;

export const GEOSPATIAL_FUNCTIONS = `
-- Function to get nearby resources with distance calculation
CREATE OR REPLACE FUNCTION get_nearby_resources(
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  radius_meters INTEGER DEFAULT 10000,
  resource_type TEXT DEFAULT NULL,
  disaster_uuid UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  disaster_id UUID,
  name TEXT,
  location_name TEXT,
  type TEXT,
  status TEXT,
  distance_meters DOUBLE PRECISION,
  capacity INTEGER,
  current_occupancy INTEGER,
  contact_info JSONB,
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
    r.status,
    ST_Distance(r.location, ST_SetSRID(ST_MakePoint(lng, lat), 4326)) as distance_meters,
    r.capacity,
    r.current_occupancy,
    r.contact_info,
    r.created_at
  FROM resources r
  WHERE 
    ST_DWithin(
      r.location,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326),
      radius_meters
    )
    AND r.status IN ('active', 'full')
    AND (resource_type IS NULL OR r.type = resource_type)
    AND (disaster_uuid IS NULL OR r.disaster_id = disaster_uuid)
  ORDER BY distance_meters;
END;
$$ LANGUAGE plpgsql;

-- Function to get disasters within a bounding box
CREATE OR REPLACE FUNCTION get_disasters_in_bounds(
  min_lat DOUBLE PRECISION,
  min_lng DOUBLE PRECISION,
  max_lat DOUBLE PRECISION,
  max_lng DOUBLE PRECISION,
  tag_filter TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  location_name TEXT,
  location GEOGRAPHY(POINT, 4326),
  description TEXT,
  tags TEXT[],
  owner_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.title,
    d.location_name,
    d.location,
    d.description,
    d.tags,
    d.owner_id,
    d.created_at
  FROM disasters d
  WHERE 
    d.location && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
    AND (tag_filter IS NULL OR d.tags && tag_filter)
  ORDER BY d.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate distance between two points
CREATE OR REPLACE FUNCTION calculate_distance(
  lat1 DOUBLE PRECISION,
  lng1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION,
  lng2 DOUBLE PRECISION
)
RETURNS DOUBLE PRECISION AS $$
BEGIN
  RETURN ST_Distance(
    ST_SetSRID(ST_MakePoint(lng1, lat1), 4326),
    ST_SetSRID(ST_MakePoint(lng2, lat2), 4326)
  );
END;
$$ LANGUAGE plpgsql;
`;

export const AUDIT_FUNCTIONS = `
-- Function to add audit trail entry to disasters
CREATE OR REPLACE FUNCTION add_audit_trail(
  disaster_uuid UUID,
  action_type TEXT,
  user_identifier TEXT,
  additional_data JSONB DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  audit_entry JSONB;
BEGIN
  -- Build audit entry
  audit_entry := jsonb_build_object(
    'action', action_type,
    'user_id', user_identifier,
    'timestamp', CURRENT_TIMESTAMP,
    'data', COALESCE(additional_data, '{}'::jsonb)
  );
  
  -- Add to audit trail
  UPDATE disasters 
  SET audit_trail = audit_trail || audit_entry
  WHERE id = disaster_uuid;
END;
$$ LANGUAGE plpgsql;

-- Function to get audit trail for a disaster
CREATE OR REPLACE FUNCTION get_audit_trail(disaster_uuid UUID)
RETURNS JSONB AS $$
DECLARE
  trail JSONB;
BEGIN
  SELECT audit_trail INTO trail
  FROM disasters
  WHERE id = disaster_uuid;
  
  RETURN COALESCE(trail, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql;
`;

export const UTILITY_FUNCTIONS = `
-- Function to clean expired cache entries
CREATE OR REPLACE FUNCTION clean_expired_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM cache WHERE expires_at < CURRENT_TIMESTAMP;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get cache statistics
CREATE OR REPLACE FUNCTION get_cache_stats()
RETURNS TABLE (
  total_entries BIGINT,
  expired_entries BIGINT,
  active_entries BIGINT,
  total_size_mb NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_entries,
    COUNT(*) FILTER (WHERE expires_at < CURRENT_TIMESTAMP) as expired_entries,
    COUNT(*) FILTER (WHERE expires_at >= CURRENT_TIMESTAMP) as active_entries,
    ROUND(pg_total_relation_size('cache')/1024.0/1024.0, 2) as total_size_mb
  FROM cache;
END;
$$ LANGUAGE plpgsql;

-- Function to search disasters by text
CREATE OR REPLACE FUNCTION search_disasters(
  search_term TEXT,
  search_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  location_name TEXT,
  description TEXT,
  tags TEXT[],
  rank REAL,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.title,
    d.location_name,
    d.description,
    d.tags,
    ts_rank(to_tsvector('english', d.title || ' ' || COALESCE(d.description, '')), plainto_tsquery('english', search_term)) as rank,
    d.created_at
  FROM disasters d
  WHERE 
    to_tsvector('english', d.title || ' ' || COALESCE(d.description, '')) @@ plainto_tsquery('english', search_term)
    OR d.tags && ARRAY[search_term]
    OR d.location_name ILIKE '%' || search_term || '%'
  ORDER BY rank DESC, d.created_at DESC
  LIMIT search_limit;
END;
$$ LANGUAGE plpgsql;
`;

export const CORE_FUNCTIONS_COMPLETE = [
  ENABLE_EXTENSIONS,
  GEOSPATIAL_FUNCTIONS,
  AUDIT_FUNCTIONS,
  UTILITY_FUNCTIONS,
];
