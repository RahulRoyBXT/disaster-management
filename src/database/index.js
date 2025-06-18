/**
 * Database Schema Index
 * Main entry point for all database schema definitions
 */

import { DISASTERS_SCHEMA_COMPLETE } from './schemas/disasters.js';
import { REPORTS_SCHEMA_COMPLETE } from './schemas/reports.js';
import { RESOURCES_SCHEMA_COMPLETE } from './schemas/resources.js';
import { CACHE_SCHEMA_COMPLETE } from './schemas/cache.js';
import { CORE_FUNCTIONS_COMPLETE } from './functions/core.js';
import { ANALYTICS_FUNCTIONS_COMPLETE } from './functions/analytics.js';

/**
 * Complete database schema setup in correct order
 * Order matters due to foreign key dependencies
 */
export const COMPLETE_DATABASE_SCHEMA = [
  // 1. Core functions and extensions first
  ...CORE_FUNCTIONS_COMPLETE,

  // 2. Base tables (disasters must be created before reports and resources)
  ...DISASTERS_SCHEMA_COMPLETE,

  // 3. Dependent tables
  ...REPORTS_SCHEMA_COMPLETE,
  ...RESOURCES_SCHEMA_COMPLETE,

  // 4. Cache table (independent)
  ...CACHE_SCHEMA_COMPLETE,

  // 5. Analytics functions last
  ...ANALYTICS_FUNCTIONS_COMPLETE,
];

/**
 * Schema metadata for documentation and management
 */
export const SCHEMA_METADATA = {
  version: '1.0.0',
  description: 'Disaster Response Coordination Platform Database Schema',
  created: new Date().toISOString(),
  tables: {
    disasters: {
      description: 'Main disaster events with geospatial support',
      primaryKey: 'id (UUID)',
      indexes: ['location (GIST)', 'tags (GIN)', 'owner_id', 'created_at'],
      features: ['geospatial', 'full-text-search', 'audit-trail'],
    },
    reports: {
      description: 'User-generated reports for disasters',
      primaryKey: 'id (UUID)',
      foreignKeys: ['disaster_id -> disasters(id)'],
      indexes: ['disaster_id', 'user_id', 'verification_status', 'location (GIST)'],
      features: ['verification-workflow', 'geospatial', 'full-text-search'],
    },
    resources: {
      description: 'Available resources during disasters',
      primaryKey: 'id (UUID)',
      foreignKeys: ['disaster_id -> disasters(id)'],
      indexes: ['location (GIST)', 'disaster_id', 'type', 'status'],
      features: ['geospatial', 'capacity-management', 'proximity-search'],
    },
    cache: {
      description: 'Temporary data storage with TTL',
      primaryKey: 'key (TEXT)',
      indexes: ['expires_at', 'tags (GIN)', 'access_count'],
      features: ['ttl-expiration', 'access-tracking', 'tag-based-operations'],
    },
  },
  functions: {
    geospatial: [
      'get_nearby_resources(lat, lng, radius, type?, disaster_id?)',
      'get_disasters_in_bounds(min_lat, min_lng, max_lat, max_lng, tags?)',
      'calculate_distance(lat1, lng1, lat2, lng2)',
    ],
    analytics: [
      'get_disaster_stats(start_date?, end_date?)',
      'get_resource_utilization()',
      'get_verification_stats()',
      'generate_disaster_report(disaster_id)',
      'get_daily_activity(date?)',
    ],
    utilities: [
      'clean_expired_cache()',
      'get_cache_stats()',
      'search_disasters(term, limit?)',
      'add_audit_trail(disaster_id, action, user_id, data?)',
      'get_audit_trail(disaster_id)',
    ],
  },
  extensions: ['postgis', 'uuid-ossp', 'pg_trgm'],
  features: [
    'Geospatial operations with PostGIS',
    'Full-text search capabilities',
    'Row-level security (RLS)',
    'Audit trail tracking',
    'Cache management with TTL',
    'Analytics and reporting',
    'Proximity-based queries',
    'Data verification workflow',
  ],
};

/**
 * Development and testing utilities
 */
export const DEV_UTILITIES = {
  // Sample data for testing
  sampleDisaster: {
    title: 'Flash Flood in Downtown',
    location_name: 'Downtown District, Metro City',
    description: 'Heavy rainfall causing severe flooding in the downtown area',
    tags: ['flood', 'urban', 'urgent'],
    owner_id: 'admin_user_001',
  },

  sampleReport: {
    content: 'Water level rising rapidly near Main Street bridge',
    verification_status: 'pending',
  },

  sampleResource: {
    name: 'Emergency Shelter Alpha',
    location_name: 'Community Center, 123 Oak Street',
    type: 'shelter',
    capacity: 200,
    current_occupancy: 45,
    contact_info: {
      phone: '+1-555-0123',
      email: 'shelter.alpha@emergency.gov',
    },
    operating_hours: {
      monday: '24/7',
      tuesday: '24/7',
      wednesday: '24/7',
      thursday: '24/7',
      friday: '24/7',
      saturday: '24/7',
      sunday: '24/7',
    },
  },

  // Common query patterns
  queryExamples: {
    nearbyResources: `
      SELECT * FROM get_nearby_resources(40.7128, -74.0060, 5000, 'shelter');
    `,
    disasterSearch: `
      SELECT * FROM search_disasters('flood downtown', 10);
    `,
    dailyStats: `
      SELECT get_daily_activity('2025-06-17'::DATE);
    `,
    resourceStats: `
      SELECT * FROM get_resource_utilization();
    `,
  },
};

export default {
  COMPLETE_DATABASE_SCHEMA,
  SCHEMA_METADATA,
  DEV_UTILITIES,
};
