/**
 * Analytics and Reporting Functions
 * Functions for generating statistics and reports
 */

export const ANALYTICS_FUNCTIONS = `
-- Function to get disaster statistics
CREATE OR REPLACE FUNCTION get_disaster_stats(
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TABLE (
  total_disasters BIGINT,
  active_disasters BIGINT,
  disasters_by_tag JSONB,
  avg_reports_per_disaster NUMERIC,
  avg_resources_per_disaster NUMERIC,
  most_common_locations TEXT[]
) AS $$
DECLARE
  date_filter_start TIMESTAMP WITH TIME ZONE;
  date_filter_end TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Set default date range if not provided
  date_filter_start := COALESCE(start_date, CURRENT_TIMESTAMP - INTERVAL '30 days');
  date_filter_end := COALESCE(end_date, CURRENT_TIMESTAMP);
  
  RETURN QUERY
  WITH disaster_data AS (
    SELECT d.* FROM disasters d 
    WHERE d.created_at BETWEEN date_filter_start AND date_filter_end
  ),
  tag_stats AS (
    SELECT jsonb_object_agg(tag, tag_count) as tags_json
    FROM (
      SELECT unnest(tags) as tag, COUNT(*) as tag_count
      FROM disaster_data
      GROUP BY unnest(tags)
      ORDER BY tag_count DESC
      LIMIT 10
    ) t
  ),
  location_stats AS (
    SELECT array_agg(location_name ORDER BY location_count DESC) as locations
    FROM (
      SELECT location_name, COUNT(*) as location_count
      FROM disaster_data
      WHERE location_name IS NOT NULL
      GROUP BY location_name
      ORDER BY location_count DESC
      LIMIT 5
    ) l
  )
  SELECT 
    COUNT(*)::BIGINT as total_disasters,
    COUNT(*) FILTER (WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days')::BIGINT as active_disasters,
    COALESCE(ts.tags_json, '{}'::jsonb) as disasters_by_tag,
    COALESCE(AVG((SELECT COUNT(*) FROM reports r WHERE r.disaster_id = dd.id)), 0)::NUMERIC as avg_reports_per_disaster,
    COALESCE(AVG((SELECT COUNT(*) FROM resources res WHERE res.disaster_id = dd.id)), 0)::NUMERIC as avg_resources_per_disaster,
    COALESCE(ls.locations, ARRAY[]::TEXT[]) as most_common_locations
  FROM disaster_data dd
  CROSS JOIN tag_stats ts
  CROSS JOIN location_stats ls;
END;
$$ LANGUAGE plpgsql;

-- Function to get resource utilization stats
CREATE OR REPLACE FUNCTION get_resource_utilization()
RETURNS TABLE (
  resource_type TEXT,
  total_resources BIGINT,
  active_resources BIGINT,
  full_resources BIGINT,
  avg_occupancy_rate NUMERIC,
  total_capacity BIGINT,
  total_occupancy BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.type as resource_type,
    COUNT(*)::BIGINT as total_resources,
    COUNT(*) FILTER (WHERE r.status = 'active')::BIGINT as active_resources,
    COUNT(*) FILTER (WHERE r.status = 'full')::BIGINT as full_resources,
    CASE 
      WHEN SUM(r.capacity) > 0 THEN 
        ROUND((SUM(r.current_occupancy)::NUMERIC / SUM(r.capacity)::NUMERIC) * 100, 2)
      ELSE 0
    END as avg_occupancy_rate,
    COALESCE(SUM(r.capacity), 0)::BIGINT as total_capacity,
    COALESCE(SUM(r.current_occupancy), 0)::BIGINT as total_occupancy
  FROM resources r
  WHERE r.capacity IS NOT NULL
  GROUP BY r.type
  ORDER BY total_resources DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get verification statistics
CREATE OR REPLACE FUNCTION get_verification_stats()
RETURNS TABLE (
  total_reports BIGINT,
  pending_reports BIGINT,
  verified_reports BIGINT,
  rejected_reports BIGINT,
  spam_reports BIGINT,
  verification_rate NUMERIC,
  avg_verification_time_hours NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_reports,
    COUNT(*) FILTER (WHERE verification_status = 'pending')::BIGINT as pending_reports,
    COUNT(*) FILTER (WHERE verification_status = 'verified')::BIGINT as verified_reports,
    COUNT(*) FILTER (WHERE verification_status = 'rejected')::BIGINT as rejected_reports,
    COUNT(*) FILTER (WHERE verification_status = 'spam')::BIGINT as spam_reports,
    CASE 
      WHEN COUNT(*) > 0 THEN 
        ROUND((COUNT(*) FILTER (WHERE verification_status != 'pending')::NUMERIC / COUNT(*)::NUMERIC) * 100, 2)
      ELSE 0
    END as verification_rate,
    COALESCE(
      AVG(EXTRACT(EPOCH FROM (verified_at - created_at))/3600) FILTER (WHERE verified_at IS NOT NULL),
      0
    )::NUMERIC as avg_verification_time_hours
  FROM reports;
END;
$$ LANGUAGE plpgsql;
`;

export const REPORTING_FUNCTIONS = `
-- Function to generate disaster summary report
CREATE OR REPLACE FUNCTION generate_disaster_report(disaster_uuid UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
  disaster_info RECORD;
  reports_count INTEGER;
  resources_count INTEGER;
  verified_reports_count INTEGER;
BEGIN
  -- Get disaster information
  SELECT * INTO disaster_info FROM disasters WHERE id = disaster_uuid;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Disaster not found');
  END IF;
  
  -- Get counts
  SELECT COUNT(*) INTO reports_count FROM reports WHERE disaster_id = disaster_uuid;
  SELECT COUNT(*) INTO resources_count FROM resources WHERE disaster_id = disaster_uuid;
  SELECT COUNT(*) INTO verified_reports_count 
  FROM reports WHERE disaster_id = disaster_uuid AND verification_status = 'verified';
  
  -- Build result
  result := jsonb_build_object(
    'disaster', jsonb_build_object(
      'id', disaster_info.id,
      'title', disaster_info.title,
      'location_name', disaster_info.location_name,
      'description', disaster_info.description,
      'tags', disaster_info.tags,
      'owner_id', disaster_info.owner_id,
      'created_at', disaster_info.created_at
    ),
    'statistics', jsonb_build_object(
      'total_reports', reports_count,
      'verified_reports', verified_reports_count,
      'total_resources', resources_count,
      'verification_rate', 
        CASE 
          WHEN reports_count > 0 THEN 
            ROUND((verified_reports_count::NUMERIC / reports_count::NUMERIC) * 100, 2)
          ELSE 0 
        END
    ),
    'generated_at', CURRENT_TIMESTAMP
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to get daily activity summary
CREATE OR REPLACE FUNCTION get_daily_activity(target_date DATE DEFAULT CURRENT_DATE)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
  start_time TIMESTAMP WITH TIME ZONE;
  end_time TIMESTAMP WITH TIME ZONE;
BEGIN
  start_time := target_date::TIMESTAMP WITH TIME ZONE;
  end_time := start_time + INTERVAL '1 day';
  
  WITH daily_stats AS (
    SELECT 
      (SELECT COUNT(*) FROM disasters WHERE created_at BETWEEN start_time AND end_time) as new_disasters,
      (SELECT COUNT(*) FROM reports WHERE created_at BETWEEN start_time AND end_time) as new_reports,
      (SELECT COUNT(*) FROM resources WHERE created_at BETWEEN start_time AND end_time) as new_resources,
      (SELECT COUNT(*) FROM reports WHERE verified_at BETWEEN start_time AND end_time) as verified_reports
  )
  SELECT jsonb_build_object(
    'date', target_date,
    'new_disasters', ds.new_disasters,
    'new_reports', ds.new_reports,
    'new_resources', ds.new_resources,
    'verified_reports', ds.verified_reports,
    'total_activity', ds.new_disasters + ds.new_reports + ds.new_resources + ds.verified_reports
  ) INTO result
  FROM daily_stats ds;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;
`;

export const ANALYTICS_FUNCTIONS_COMPLETE = [ANALYTICS_FUNCTIONS, REPORTING_FUNCTIONS];
