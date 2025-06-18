Got it! Here's a detailed, step-by-step documentation-style `db.md` file that you can follow like a manual to build all Supabase schemas correctly for your Disaster Response Coordination Platform project:

---

````md
# 📦 Supabase Database Schema Guide – Disaster Response Coordination Platform

This document walks you through creating the full database layer in Supabase (PostgreSQL + PostGIS) to support the disaster management platform. Follow each section step-by-step to ensure your schema matches backend logic and geospatial needs.

---







### This is The Data we have to follow.

## Must follow
Use Supabase (PostgreSQL) with tables:
disasters: (id, title, location_name [TEXT], location [GEOGRAPHY], description, tags [TEXT[]], owner_id, created_at, audit_trail [JSONB])
reports: (id, disaster_id, user_id, content, image_url, verification_status, created_at)
resources: (id, disaster_id, name, location_name [TEXT], location [GEOGRAPHY], type, created_at)
cache: (key, value [JSONB], expires_at)
Create geospatial indexes on location columns (e.g., CREATE INDEX disasters_location_idx ON disasters USING GIST (location)) for fast queries.
Create indexes on tags (GIN index) and owner_id for efficient filtering.
Store audit trails as JSONB (e.g., { action: "update", user_id: "netrunnerX", timestamp: "2025-06-17T17:16:00Z" }).
Use Supabase JavaScript SDK for queries (e.g., supabase.from('disasters').select('*')).
Optimize geospatial queries (e.g., SELECT * FROM resources WHERE ST_DWithin(location, ST_SetSRID(ST_Point(-74.0060, 40.7128), 4326), 10000)).
Use Cursor/Windsurf for Supabase queries (e.g., “Generate a Supabase geospatial query”).





## 🛠️ Prerequisites

Before you start:

- Create a Supabase project: https://supabase.com/dashboard
- Enable the “PostGIS” extension:
  1. Go to SQL Editor → New Query
  2. Run:
     ```sql
     create extension if not exists postgis;
     ```

---

## 1️⃣ Create Table: `disasters`

This table holds each disaster record and supports location-based lookups.

### ✅ Fields:

| Name          | Type                | Description |
|---------------|---------------------|-------------|
| id            | UUID (PK)           | Unique disaster ID |
| title         | TEXT                | Disaster name (e.g., "NYC Flood") |
| location_name | TEXT                | Human-readable location (e.g., "Manhattan, NYC") |
| location      | GEOGRAPHY(POINT)    | Lat/Lng coordinates (for mapping and proximity) |
| description   | TEXT                | Details about the disaster |
| tags          | TEXT[]              | Disaster types (e.g., `["flood", "urgent"]`) |
| owner_id      | TEXT                | Creator of the disaster (e.g., “reliefAdmin”) |
| created_at    | TIMESTAMP           | Auto-generated timestamp |
| audit_trail   | JSONB               | Tracks actions taken on this record |

### 🧱 SQL:

```sql
create table disasters (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  location_name text,
  location geography(POINT, 4326),
  description text,
  tags text[],
  owner_id text not null,
  created_at timestamp with time zone default current_timestamp,
  audit_trail jsonb default '[]'
);

create index disasters_location_idx on disasters using GIST (location);
create index disasters_tags_idx on disasters using GIN (tags);
create index disasters_owner_idx on disasters (owner_id);
````

---

## 2️⃣ Create Table: `reports`

User-generated updates or social reports tied to a disaster.

### ✅ Fields:

| Name                 | Type      | Description                      |
| -------------------- | --------- | -------------------------------- |
| id                   | UUID      | Unique ID                        |
| disaster\_id         | UUID (FK) | Linked disaster                  |
| user\_id             | TEXT      | Reporter user ID                 |
| content              | TEXT      | Textual content                  |
| image\_url           | TEXT      | Link to image (optional)         |
| verification\_status | TEXT      | "pending", "verified", or "fake" |
| created\_at          | TIMESTAMP | Submission time                  |

### 🧱 SQL:

```sql
create table reports (
  id uuid primary key default gen_random_uuid(),
  disaster_id uuid references disasters(id) on delete cascade,
  user_id text not null,
  content text,
  image_url text,
  verification_status text check (verification_status in ('pending', 'verified', 'fake')) default 'pending',
  created_at timestamp with time zone default current_timestamp
);
```

---

## 3️⃣ Create Table: `resources`

This table tracks available shelters, hospitals, or supply points during a disaster.

### ✅ Fields:

| Name           | Type             | Description                             |
| -------------- | ---------------- | --------------------------------------- |
| id             | UUID             | Unique ID                               |
| disaster\_id   | UUID (FK)        | Linked disaster                         |
| name           | TEXT             | Resource name                           |
| location\_name | TEXT             | Human-readable location                 |
| location       | GEOGRAPHY(POINT) | Geocoordinates                          |
| type           | TEXT             | Resource type (shelter, food, hospital) |
| created\_at    | TIMESTAMP        | Timestamp                               |

### 🧱 SQL:

```sql
create table resources (
  id uuid primary key default gen_random_uuid(),
  disaster_id uuid references disasters(id) on delete cascade,
  name text not null,
  location_name text,
  location geography(POINT, 4326),
  type text,
  created_at timestamp with time zone default current_timestamp
);

create index resources_location_idx on resources using GIST (location);
```

---

## 4️⃣ Create Table: `cache`

This table caches expensive external API calls (Gemini, Mapbox, Browse Page, etc.) with expiration logic.

### ✅ Fields:

| Name        | Type      | Description         |
| ----------- | --------- | ------------------- |
| key         | TEXT (PK) | Unique cache key    |
| value       | JSONB     | Cached API response |
| expires\_at | TIMESTAMP | TTL expiration time |

### 🧱 SQL:

```sql
create table cache (
  key text primary key,
  value jsonb,
  expires_at timestamp with time zone
);
```

---

## 5️⃣ Bonus Indexes & Queries

### 🔍 Example: Nearby resources using PostGIS

```sql
SELECT * FROM resources
WHERE ST_DWithin(
  location,
  ST_SetSRID(ST_MakePoint(:lng, :lat), 4326),
  10000 -- in meters (10km radius)
);
```

### 🔍 Example: Filter disasters by tag

```sql
SELECT * FROM disasters
WHERE tags @> ARRAY['earthquake'];
```

### 🧾 Append an audit trail on update

```sql
UPDATE disasters
SET audit_trail = audit_trail || jsonb_build_object(
  'action', 'update',
  'user_id', 'reliefAdmin',
  'timestamp', NOW()
)
WHERE id = 'your-disaster-id';
```

---

## 🧪 Mock Data Examples

### ✅ Sample Disaster

```json
{
  "title": "Flood in Delhi",
  "location_name": "South Delhi",
  "description": "Heavy waterlogging in parts of Delhi.",
  "tags": ["flood", "urgent"],
  "owner_id": "netrunnerX"
}
```

### ✅ Sample Report

```json
{
  "disaster_id": "some-disaster-uuid",
  "user_id": "user123",
  "content": "We need clean water in Lajpat Nagar.",
  "image_url": "https://cdn.example.com/flood.jpg",
  "verification_status": "pending"
}
```

### ✅ Sample Resource

```json
{
  "disaster_id": "some-disaster-uuid",
  "name": "Relief Camp A",
  "location_name": "Kalkaji, Delhi",
  "type": "shelter"
}
```

### ✅ Sample Cache

```json
{
  "key": "gemini:extract-location:Heavy flooding in NYC",
  "value": { "location_name": "Manhattan, NYC" },
  "expires_at": "2025-06-17T20:00:00Z"
}
```

---

## ✅ Final Checklist

* [ ] PostGIS extension is enabled
* [ ] All tables created (`disasters`, `reports`, `resources`, `cache`)
* [ ] Geospatial indexes are in place
* [ ] Supabase SDK integrated for CRUD, queries, and real-time features
* [ ] Use structured caching to throttle external APIs
* [ ] Use mock data for rapid testing and development

---

> 💡 This `db.md` is your implementation reference. You can extend this with migrations, seeders, or ER diagrams if needed.

```

---

Let me know if you also want a seed script or a visual ER diagram!
```
