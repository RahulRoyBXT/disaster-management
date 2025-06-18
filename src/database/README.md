# Database Architecture Documentation

## Overview

This document provides a comprehensive guide to the Disaster Response
Coordination Platform database architecture, built on Supabase (PostgreSQL) with
PostGIS for geospatial operations.

## Project Structure

```
src/
├── database/
│   ├── index.js                    # Main database schema exports
│   ├── schemas/                    # Modular table schemas
│   │   ├── disasters.js           # Disasters table and related
│   │   ├── reports.js              # Reports table and related
│   │   ├── resources.js            # Resources table and related
│   │   └── cache.js                # Cache table and related
│   ├── functions/                  # Database functions
│   │   ├── core.js                 # Core and geospatial functions
│   │   └── analytics.js            # Analytics and reporting functions
│   └── migrations/                 # Database migrations
│       ├── index.js                # Migration runner
│       └── 001_initial_setup.js    # Initial database setup
├── config/
│   ├── database.js                 # Database connection and helpers
│   └── schema.js                   # Legacy schema (kept for reference)
└── scripts/
    ├── setup-database.js           # Database setup script
    └── migrate.js                  # Migration CLI tool
```

## Database Schema

### Core Tables

#### 1. `disasters`

Primary table for disaster events with geospatial support.

```sql
CREATE TABLE disasters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  location_name TEXT,
  location GEOGRAPHY(POINT, 4326),
  description TEXT,
  tags TEXT[],
  owner_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  audit_trail JSONB DEFAULT '[]'::jsonb
);
```

**Features:**

- Geospatial location storage using PostGIS
- Tag-based categorization
- Audit trail tracking
- Full-text search capabilities

**Indexes:**

- GIST index on `location` for spatial queries
- GIN index on `tags` for tag-based filtering
- Full-text search indexes on `title` and `description`

#### 2. `reports`

User-generated reports and updates for disasters.

```sql
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  disaster_id UUID NOT NULL REFERENCES disasters(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  content TEXT,
  image_url TEXT,
  location GEOGRAPHY(POINT, 4326),
  verification_status TEXT DEFAULT 'pending',
  verified_by TEXT,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb
);
```

**Features:**

- Content verification workflow
- Optional geolocation for reports
- Support for media attachments
- Metadata storage for additional information

#### 3. `resources`

Available resources during disasters (shelters, hospitals, supplies).

```sql
CREATE TABLE resources (
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
  status TEXT DEFAULT 'active',
  created_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb
);
```

**Features:**

- Capacity management with occupancy tracking
- Auto-status updates based on occupancy
- Flexible contact information storage
- Operating hours scheduling

#### 4. `cache`

Temporary data storage with TTL for API responses and computations.

```sql
CREATE TABLE cache (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}'::jsonb
);
```

**Features:**

- TTL-based expiration
- Access tracking and statistics
- Tag-based cache categorization
- Automatic cleanup of expired entries

## Database Functions

### Geospatial Functions

#### `get_nearby_resources(lat, lng, radius, type?, disaster_id?)`

Finds resources within a specified radius of a location.

```sql
SELECT * FROM get_nearby_resources(40.7128, -74.0060, 5000, 'shelter');
```

#### `get_disasters_in_bounds(min_lat, min_lng, max_lat, max_lng, tags?)`

Retrieves disasters within a bounding box, optionally filtered by tags.

#### `calculate_distance(lat1, lng1, lat2, lng2)`

Calculates distance between two geographic points.

### Analytics Functions

#### `get_disaster_stats(start_date?, end_date?)`

Generates comprehensive disaster statistics.

#### `get_resource_utilization()`

Provides resource utilization metrics by type.

#### `get_verification_stats()`

Returns report verification statistics.

### Utility Functions

#### `clean_expired_cache()`

Removes expired cache entries and returns count of deleted entries.

#### `search_disasters(term, limit?)`

Performs full-text search across disasters with ranking.

#### `add_audit_trail(disaster_id, action, user_id, data?)`

Adds an entry to a disaster's audit trail.

## Indexes and Performance

### Spatial Indexes

- All location columns use GIST indexes for efficient spatial queries
- Supports proximity searches, bounding box queries, and spatial joins

### Text Search Indexes

- GIN indexes on text fields enable fast full-text search
- Trigram indexes improve partial text matching

### Composite Indexes

- Strategic composite indexes for common query patterns
- Optimized for disaster-type-status and location-based queries

## Row Level Security (RLS)

All tables have RLS enabled with appropriate policies:

- **Read access**: Generally open for public data
- **Write access**: Authenticated users can insert
- **Update/Delete**: Users can modify their own data
- **Admin access**: Special policies for administrative operations

## Migration System

### Running Migrations

```bash
# Run all migrations
npm run db:setup

# Run specific migration
npm run db:migrate run 001

# Check migration status
npm run db:migrate status

# Rollback migration
npm run db:migrate rollback 001
```

### Migration Structure

Each migration includes:

- **Version**: Unique identifier
- **Description**: Human-readable description
- **Up**: Forward migration function
- **Down**: Rollback function (optional)
- **Metadata**: Additional information

## Usage Examples

### Basic Queries

```javascript
// Find nearby shelters
const { data } = await supabase.rpc('get_nearby_resources', {
  lat: 40.7128,
  lng: -74.006,
  radius_meters: 5000,
  resource_type: 'shelter',
});

// Search disasters
const { data } = await supabase.rpc('search_disasters', {
  search_term: 'flood downtown',
  search_limit: 10,
});

// Get disaster statistics
const { data } = await supabase.rpc('get_disaster_stats', {
  start_date: '2025-01-01',
  end_date: '2025-12-31',
});
```

### Cache Operations

```javascript
import { CacheModel } from './src/models/CacheModel.js';

// Store with TTL
await CacheModel.set('api:weather:NYC', weatherData, 3600);

// Retrieve cached data
const cached = await CacheModel.get('api:weather:NYC');

// Clean expired entries
await CacheModel.cleanExpired();
```

## Development Guidelines

### Adding New Tables

1. Create schema file in `src/database/schemas/`
2. Add table definition with proper constraints
3. Include indexes, triggers, and RLS policies
4. Create migration file
5. Update main index file
6. Add model class if needed

### Best Practices

- Always use prepared statements
- Include proper error handling
- Add appropriate indexes for query patterns
- Use JSONB for flexible data storage
- Implement proper RLS policies
- Document all functions and procedures

### Testing

- Use sample data for development
- Test geospatial queries with real coordinates
- Validate cache TTL behavior
- Test migration rollbacks
- Verify RLS policy enforcement

## Monitoring and Maintenance

### Database Health Checks

```javascript
import {
  validateDatabaseSchema,
  getDatabaseStats,
} from './src/config/database.js';

// Check schema validity
const schemaStatus = await validateDatabaseSchema();

// Get usage statistics
const stats = await getDatabaseStats();
```

### Cache Management

```sql
-- Get cache statistics
SELECT * FROM get_cache_stats();

-- Clean expired entries
SELECT clean_expired_cache();
```

### Performance Monitoring

- Monitor query performance through Supabase dashboard
- Track spatial query performance
- Monitor cache hit rates
- Review slow query logs

## Extensions Used

- **PostGIS**: Geospatial operations and data types
- **uuid-ossp**: UUID generation functions
- **pg_trgm**: Trigram matching for fuzzy text search

## Security Considerations

- All user inputs are validated
- RLS policies enforce data access rules
- API keys are properly managed
- Geospatial data is validated for accuracy
- Cache entries have automatic expiration
- Audit trails track all modifications

---

For more information, see the individual schema files and function definitions
in the `src/database/` directory.
