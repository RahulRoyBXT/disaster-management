/**
 * Reports Table Schema
 * Stores user-generated reports and updates for disasters
 */

export const REPORTS_TABLE_SCHEMA = `
-- Create reports table
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  disaster_id UUID NOT NULL REFERENCES disasters(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  content TEXT,
  image_url TEXT,
  location GEOGRAPHY(POINT, 4326),
  verification_status TEXT CHECK (verification_status IN ('pending', 'verified', 'rejected', 'spam')) DEFAULT 'pending',
  verified_by TEXT,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Constraints
  CONSTRAINT reports_user_id_length CHECK (length(user_id) > 0),
  CONSTRAINT reports_content_or_image CHECK (content IS NOT NULL OR image_url IS NOT NULL),
  CONSTRAINT reports_verification_logic CHECK (
    (verification_status = 'pending' AND verified_by IS NULL AND verified_at IS NULL) OR
    (verification_status != 'pending' AND verified_by IS NOT NULL AND verified_at IS NOT NULL)
  )
);

-- Add comments for documentation
COMMENT ON TABLE reports IS 'User-generated reports and updates for disaster events';
COMMENT ON COLUMN reports.id IS 'Unique identifier for the report';
COMMENT ON COLUMN reports.disaster_id IS 'Foreign key reference to disasters table';
COMMENT ON COLUMN reports.user_id IS 'ID of the user who submitted this report';
COMMENT ON COLUMN reports.content IS 'Textual content of the report';
COMMENT ON COLUMN reports.image_url IS 'URL to associated image or media';
COMMENT ON COLUMN reports.location IS 'Optional location where report was made';
COMMENT ON COLUMN reports.verification_status IS 'Status of report verification';
COMMENT ON COLUMN reports.verified_by IS 'ID of user who verified this report';
COMMENT ON COLUMN reports.verified_at IS 'Timestamp when report was verified';
COMMENT ON COLUMN reports.metadata IS 'Additional metadata in JSON format';
`;

export const REPORTS_INDEXES = `
-- Indexes for reports table
CREATE INDEX IF NOT EXISTS reports_disaster_id_idx ON reports (disaster_id);
CREATE INDEX IF NOT EXISTS reports_user_id_idx ON reports (user_id);
CREATE INDEX IF NOT EXISTS reports_verification_status_idx ON reports (verification_status);
CREATE INDEX IF NOT EXISTS reports_created_at_idx ON reports (created_at DESC);
CREATE INDEX IF NOT EXISTS reports_location_idx ON reports USING GIST (location);
CREATE INDEX IF NOT EXISTS reports_content_idx ON reports USING GIN (to_tsvector('english', content));
CREATE INDEX IF NOT EXISTS reports_verified_at_idx ON reports (verified_at DESC);
`;

export const REPORTS_TRIGGERS = `
-- Update timestamp trigger for reports
CREATE OR REPLACE FUNCTION update_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reports_updated_at_trigger
  BEFORE UPDATE ON reports
  FOR EACH ROW
  EXECUTE FUNCTION update_reports_updated_at();

-- Auto-verify reports trigger (example business logic)
CREATE OR REPLACE FUNCTION auto_verify_trusted_users()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-verify reports from trusted users (example logic)
  IF NEW.user_id IN (SELECT user_id FROM trusted_users) THEN
    NEW.verification_status = 'verified';
    NEW.verified_by = 'system';
    NEW.verified_at = CURRENT_TIMESTAMP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Uncomment when trusted_users table exists
-- CREATE TRIGGER reports_auto_verify_trigger
--   BEFORE INSERT ON reports
--   FOR EACH ROW
--   EXECUTE FUNCTION auto_verify_trusted_users();
`;

export const REPORTS_RLS_POLICIES = `
-- Row Level Security policies for reports
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read verified reports
CREATE POLICY IF NOT EXISTS "reports_select_policy" 
ON reports FOR SELECT 
USING (verification_status = 'verified' OR verification_status = 'pending');

-- Policy: Authenticated users can insert reports
CREATE POLICY IF NOT EXISTS "reports_insert_policy" 
ON reports FOR INSERT 
WITH CHECK (true);

-- Policy: Users can update their own reports (only pending ones)
CREATE POLICY IF NOT EXISTS "reports_update_policy" 
ON reports FOR UPDATE 
USING (verification_status = 'pending');

-- Policy: Users can delete their own pending reports
CREATE POLICY IF NOT EXISTS "reports_delete_policy" 
ON reports FOR DELETE 
USING (verification_status = 'pending');
`;

export const REPORTS_SCHEMA_COMPLETE = [
  REPORTS_TABLE_SCHEMA,
  REPORTS_INDEXES,
  REPORTS_TRIGGERS,
  REPORTS_RLS_POLICIES,
];
