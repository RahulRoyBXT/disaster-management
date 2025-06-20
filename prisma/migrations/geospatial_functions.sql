-- This file contains SQL to setup PostGIS extensions and helper functions
-- for geospatial queries in the Disaster Management Platform.

-- Enable PostGIS extension if not already enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- Enable PostGIS Topology extension (optional but recommended)
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Enable TIGER Geocoder extension (optional)
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;
CREATE EXTENSION IF NOT EXISTS postgis_tiger_geocoder;

-- Create a function to calculate distance between two points in meters
CREATE OR REPLACE FUNCTION calculate_distance_meters(lat1 float, lon1 float, lat2 float, lon2 float)
RETURNS float AS $$
BEGIN
    RETURN ST_Distance(
        ST_MakePoint(lon1, lat1)::geography,
        ST_MakePoint(lon2, lat2)::geography
    );
END;
$$ LANGUAGE plpgsql;

-- Create a function to find resources within a specific radius
CREATE OR REPLACE FUNCTION find_resources_within_radius(center_lat float, center_lon float, radius_meters float)
RETURNS TABLE (
    id text,
    name text,
    "locationName" text,
    latitude float,
    longitude float,
    type text,
    "disasterId" text,
    distance_meters float
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id, 
        r.name, 
        r."locationName", 
        r.latitude, 
        r.longitude, 
        r.type, 
        r."disasterId",
        ST_Distance(
            ST_MakePoint(r.longitude, r.latitude)::geography,
            ST_MakePoint(center_lon, center_lat)::geography
        ) as distance_meters
    FROM "Resource" r
    WHERE ST_DWithin(
        ST_MakePoint(r.longitude, r.latitude)::geography,
        ST_MakePoint(center_lon, center_lat)::geography,
        radius_meters
    )
    ORDER BY distance_meters ASC;
END;
$$ LANGUAGE plpgsql;

-- Create a function to find disasters within a specific radius
CREATE OR REPLACE FUNCTION find_disasters_within_radius(center_lat float, center_lon float, radius_meters float)
RETURNS TABLE (
    id text,
    title text,
    "locationName" text,
    latitude float,
    longitude float,
    description text,
    tags text[],
    "ownerId" text,
    distance_meters float
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id, 
        d.title, 
        d."locationName", 
        d.latitude, 
        d.longitude, 
        d.description,
        d.tags,
        d."ownerId",
        ST_Distance(
            ST_MakePoint(d.longitude, d.latitude)::geography,
            ST_MakePoint(center_lon, center_lat)::geography
        ) as distance_meters
    FROM "Disaster" d
    WHERE ST_DWithin(
        ST_MakePoint(d.longitude, d.latitude)::geography,
        ST_MakePoint(center_lon, center_lat)::geography,
        radius_meters
    )
    ORDER BY distance_meters ASC;
END;
$$ LANGUAGE plpgsql;

-- Create a function to find disasters within a specific radius with tag filtering
CREATE OR REPLACE FUNCTION find_disasters_within_radius_with_tags(
    center_lat float, 
    center_lon float, 
    radius_meters float,
    filter_tags text[]
)
RETURNS TABLE (
    id text,
    title text,
    "locationName" text,
    latitude float,
    longitude float,
    description text,
    tags text[],
    "ownerId" text,
    distance_meters float
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id, 
        d.title, 
        d."locationName", 
        d.latitude, 
        d.longitude, 
        d.description,
        d.tags,
        d."ownerId",
        ST_Distance(
            ST_MakePoint(d.longitude, d.latitude)::geography,
            ST_MakePoint(center_lon, center_lat)::geography
        ) as distance_meters
    FROM "Disaster" d
    WHERE ST_DWithin(
        ST_MakePoint(d.longitude, d.latitude)::geography,
        ST_MakePoint(center_lon, center_lat)::geography,
        radius_meters
    )
    AND d.tags && filter_tags
    ORDER BY distance_meters ASC;
END;
$$ LANGUAGE plpgsql;

-- Create a spatial index on the Resource table for better query performance
CREATE INDEX IF NOT EXISTS idx_resource_location ON "Resource" USING GIST (
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
);

-- Create a spatial index on the Disaster table for better query performance
CREATE INDEX IF NOT EXISTS idx_disaster_location ON "Disaster" USING GIST (
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
);

-- Create a function to get resources clustered by location
CREATE OR REPLACE FUNCTION get_resource_clusters(zoom_level int)
RETURNS TABLE (
    cluster_id int,
    cluster_size int,
    centroid_lat float,
    centroid_lon float,
    resource_types text[]
) AS $$
DECLARE
    distance float;
BEGIN
    -- Set distance threshold based on zoom level
    CASE
        WHEN zoom_level < 10 THEN distance := 10000; -- 10km for low zoom
        WHEN zoom_level < 14 THEN distance := 5000;  -- 5km for medium zoom
        ELSE distance := 1000;                       -- 1km for high zoom
    END CASE;

    RETURN QUERY
    WITH clusters AS (
        SELECT
            ST_ClusterDBSCAN(ST_SetSRID(ST_MakePoint(longitude, latitude), 4326), distance, 3) OVER () AS cluster_id,
            r.id,
            r.type,
            r.latitude,
            r.longitude
        FROM "Resource" r
    )
    SELECT
        c.cluster_id,
        COUNT(*) AS cluster_size,
        AVG(c.latitude) AS centroid_lat,
        AVG(c.longitude) AS centroid_lon,
        ARRAY_AGG(DISTINCT c.type) AS resource_types
    FROM clusters c
    WHERE c.cluster_id IS NOT NULL
    GROUP BY c.cluster_id;
END;
$$ LANGUAGE plpgsql;