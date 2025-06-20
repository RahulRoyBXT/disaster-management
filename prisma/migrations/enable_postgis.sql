-- Enable PostGIS extension for geospatial functions
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create a spatial index on resources for faster geospatial queries
CREATE INDEX IF NOT EXISTS resources_location_idx ON "Resource" USING gist (
  ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
);

-- Create a spatial index on disasters for faster geospatial queries
CREATE INDEX IF NOT EXISTS disasters_location_idx ON "Disaster" USING gist (
  ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
);

-- Explain the purpose of these operations
COMMENT ON EXTENSION postgis IS 'PostGIS extension for geospatial operations';
COMMENT ON INDEX resources_location_idx IS 'Spatial index for faster proximity searches on resources';
COMMENT ON INDEX disasters_location_idx IS 'Spatial index for faster proximity searches on disasters';
