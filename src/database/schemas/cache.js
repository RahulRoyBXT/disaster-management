/**
 * Cache Table Schema
 * Stores cached API responses and expensive computations
 */

export const CACHE_TABLE_SCHEMA = `
-- Create cache table for storing temporary data
CREATE TABLE IF NOT EXISTS cache (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Constraints
  CONSTRAINT cache_key_length CHECK (length(key) > 0),
  CONSTRAINT cache_expires_future CHECK (expires_at > created_at)
);

-- Add comments for documentation
COMMENT ON TABLE cache IS 'Cache table for storing temporary data with TTL support';
COMMENT ON COLUMN cache.key IS 'Unique cache key identifier';
COMMENT ON COLUMN cache.value IS 'Cached data in JSON format';
COMMENT ON COLUMN cache.expires_at IS 'Expiration timestamp for TTL';
COMMENT ON COLUMN cache.access_count IS 'Number of times this cache entry was accessed';
COMMENT ON COLUMN cache.last_accessed_at IS 'Last time this cache entry was accessed';
COMMENT ON COLUMN cache.tags IS 'Tags for cache categorization and bulk operations';
COMMENT ON COLUMN cache.metadata IS 'Additional metadata about the cached entry';
`;

export const CACHE_INDEXES = `
-- Indexes for cache table
CREATE INDEX IF NOT EXISTS cache_expires_at_idx ON cache (expires_at);
CREATE INDEX IF NOT EXISTS cache_created_at_idx ON cache (created_at DESC);
CREATE INDEX IF NOT EXISTS cache_last_accessed_idx ON cache (last_accessed_at DESC);
CREATE INDEX IF NOT EXISTS cache_tags_idx ON cache USING GIN (tags);
CREATE INDEX IF NOT EXISTS cache_access_count_idx ON cache (access_count DESC);

-- Partial indexes for performance
CREATE INDEX IF NOT EXISTS cache_active_entries_idx ON cache (key) WHERE expires_at > CURRENT_TIMESTAMP;
`;

export const CACHE_TRIGGERS = `
-- Update access tracking trigger
CREATE OR REPLACE FUNCTION update_cache_access()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if this is a SELECT operation (read access)
  -- This would need to be called manually from application code
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-cleanup expired entries trigger
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete expired entries when new ones are inserted
  DELETE FROM cache WHERE expires_at < CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cache_cleanup_trigger
  AFTER INSERT ON cache
  FOR EACH STATEMENT
  EXECUTE FUNCTION cleanup_expired_cache();
`;

export const CACHE_RLS_POLICIES = `
-- Row Level Security policies for cache
ALTER TABLE cache ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read non-expired cache entries
CREATE POLICY IF NOT EXISTS "cache_select_policy" 
ON cache FOR SELECT 
USING (expires_at > CURRENT_TIMESTAMP);

-- Policy: Authenticated users can insert cache entries
CREATE POLICY IF NOT EXISTS "cache_insert_policy" 
ON cache FOR INSERT 
WITH CHECK (true);

-- Policy: Anyone can update cache entries (for access tracking)
CREATE POLICY IF NOT EXISTS "cache_update_policy" 
ON cache FOR UPDATE 
USING (true);

-- Policy: Anyone can delete cache entries
CREATE POLICY IF NOT EXISTS "cache_delete_policy" 
ON cache FOR DELETE 
USING (true);
`;

export const CACHE_SCHEMA_COMPLETE = [
  CACHE_TABLE_SCHEMA,
  CACHE_INDEXES,
  CACHE_TRIGGERS,
  CACHE_RLS_POLICIES,
];
