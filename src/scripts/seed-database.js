import { disasterModel, reportModel, resourceModel, cacheModel } from '../models/index.js';
import { logger } from '../utils/logger.js';

/**
 * Seed database with sample data for development and testing
 */

// Sample disaster data
const sampleDisasters = [
  {
    title: 'Flood in Delhi NCR',
    location_name: 'South Delhi, India',
    description:
      'Heavy waterlogging reported in multiple areas of South Delhi due to monsoon rains. Roads are flooded and traffic is severely affected.',
    tags: ['flood', 'urgent', 'monsoon'],
    owner_id: 'admin_user_1',
  },
  {
    title: 'Earthquake in Nepal',
    location_name: 'Kathmandu Valley, Nepal',
    description:
      'Magnitude 6.2 earthquake struck the Kathmandu Valley. Multiple buildings damaged, rescue operations underway.',
    tags: ['earthquake', 'critical', 'rescue'],
    owner_id: 'admin_user_2',
  },
  {
    title: 'Cyclone Approaching Mumbai',
    location_name: 'Mumbai, Maharashtra, India',
    description:
      'Cyclonic storm expected to make landfall near Mumbai. Evacuation orders issued for coastal areas.',
    tags: ['cyclone', 'evacuation', 'coastal'],
    owner_id: 'admin_user_1',
  },
  {
    title: 'Wildfire in California',
    location_name: 'Los Angeles County, CA, USA',
    description:
      'Forest fire spreading rapidly in the hills near Los Angeles. Multiple homes evacuated.',
    tags: ['wildfire', 'evacuation', 'forest'],
    owner_id: 'admin_user_3',
  },
];

// Sample reports data (will be linked to disasters after creation)
const sampleReports = [
  {
    user_id: 'citizen_reporter_1',
    content:
      'Water level is rising rapidly in Lajpat Nagar. Many cars are stuck. Need immediate help.',
    verification_status: 'pending',
  },
  {
    user_id: 'citizen_reporter_2',
    content: 'Rescue boats are available at Lodhi Road. Contact local authorities for assistance.',
    verification_status: 'verified',
  },
  {
    user_id: 'volunteer_1',
    content: 'Setting up temporary shelter at community center. Can accommodate 50 families.',
    verification_status: 'verified',
  },
];

// Sample resources data (will be linked to disasters after creation)
const sampleResources = [
  {
    name: 'Emergency Relief Center',
    location_name: 'Connaught Place, New Delhi',
    type: 'shelter',
  },
  {
    name: 'AIIMS Hospital Emergency Ward',
    location_name: 'Ansari Nagar, New Delhi',
    type: 'hospital',
  },
  {
    name: 'Red Cross Food Distribution',
    location_name: 'India Gate, New Delhi',
    type: 'food',
  },
  {
    name: 'Temporary Medical Camp',
    location_name: 'Kathmandu Durbar Square',
    type: 'medical',
  },
];

// Sample cache data
const sampleCacheData = [
  {
    key: 'gemini:weather:delhi',
    value: {
      temperature: 28,
      humidity: 85,
      conditions: 'Heavy Rain',
      forecast: 'Continued rainfall expected for next 24 hours',
    },
    ttl: 3600, // 1 hour
  },
  {
    key: 'mapbox:geocode:south_delhi',
    value: {
      latitude: 28.5355,
      longitude: 77.291,
      place_name: 'South Delhi, Delhi, India',
    },
    ttl: 86400, // 24 hours
  },
];

/**
 * Seed disasters table
 */
async function seedDisasters() {
  logger.info('🌱 Seeding disasters...');
  const createdDisasters = [];

  for (const disaster of sampleDisasters) {
    try {
      // Add some location coordinates for geospatial features
      let disasterWithLocation = { ...disaster };

      if (disaster.location_name.includes('Delhi')) {
        disasterWithLocation = {
          ...disaster,
          latitude: 28.6139,
          longitude: 77.209,
        };
      } else if (disaster.location_name.includes('Kathmandu')) {
        disasterWithLocation = {
          ...disaster,
          latitude: 27.7172,
          longitude: 85.324,
        };
      } else if (disaster.location_name.includes('Mumbai')) {
        disasterWithLocation = {
          ...disaster,
          latitude: 19.076,
          longitude: 72.8777,
        };
      } else if (disaster.location_name.includes('Los Angeles')) {
        disasterWithLocation = {
          ...disaster,
          latitude: 34.0522,
          longitude: -118.2437,
        };
      }

      const created = await disasterModel.createWithLocation(disasterWithLocation);
      createdDisasters.push(created);
      logger.info(`✅ Created disaster: ${created.title}`);
    } catch (error) {
      logger.error(`❌ Failed to create disaster: ${disaster.title}`, error);
    }
  }

  return createdDisasters;
}

/**
 * Seed reports table
 */
async function seedReports(disasters) {
  logger.info('🌱 Seeding reports...');

  for (let i = 0; i < sampleReports.length; i++) {
    const report = sampleReports[i];
    const disaster = disasters[i % disasters.length]; // Cycle through disasters

    try {
      const reportData = {
        ...report,
        disaster_id: disaster.id,
      };

      const created = await reportModel.create(reportData);
      logger.info(`✅ Created report for disaster: ${disaster.title}`);
    } catch (error) {
      logger.error(`❌ Failed to create report for disaster: ${disaster.title}`, error);
    }
  }
}

/**
 * Seed resources table
 */
async function seedResources(disasters) {
  logger.info('🌱 Seeding resources...');

  for (let i = 0; i < sampleResources.length; i++) {
    const resource = sampleResources[i];
    const disaster = disasters[i % disasters.length]; // Cycle through disasters

    try {
      let resourceWithLocation = {
        ...resource,
        disaster_id: disaster.id,
      };

      // Add coordinates based on location
      if (resource.location_name.includes('Delhi')) {
        resourceWithLocation.latitude = 28.6139 + (Math.random() - 0.5) * 0.1;
        resourceWithLocation.longitude = 77.209 + (Math.random() - 0.5) * 0.1;
      } else if (resource.location_name.includes('Kathmandu')) {
        resourceWithLocation.latitude = 27.7172 + (Math.random() - 0.5) * 0.1;
        resourceWithLocation.longitude = 85.324 + (Math.random() - 0.5) * 0.1;
      }

      const created = await resourceModel.createWithLocation(resourceWithLocation);
      logger.info(`✅ Created resource: ${created.name}`);
    } catch (error) {
      logger.error(`❌ Failed to create resource: ${resource.name}`, error);
    }
  }
}

/**
 * Seed cache table
 */
async function seedCache() {
  logger.info('🌱 Seeding cache...');

  for (const cacheItem of sampleCacheData) {
    try {
      await cacheModel.set(cacheItem.key, cacheItem.value, cacheItem.ttl);
      logger.info(`✅ Created cache entry: ${cacheItem.key}`);
    } catch (error) {
      logger.error(`❌ Failed to create cache entry: ${cacheItem.key}`, error);
    }
  }
}

/**
 * Main seeding function
 */
async function seedDatabase() {
  try {
    logger.info('🚀 Starting database seeding...');

    // Check if data already exists
    const existingDisasters = await disasterModel.count();
    if (existingDisasters > 0) {
      logger.warn('⚠️  Database already contains data. Skipping seed...');
      logger.info('To force re-seed, clear the database first.');
      return;
    }

    // Seed in order (disasters first, then related data)
    const disasters = await seedDisasters();

    if (disasters.length > 0) {
      await seedReports(disasters);
      await seedResources(disasters);
    }

    await seedCache();

    logger.info('✅ Database seeding completed successfully!');

    // Print seeding summary
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    DATABASE SEEDING COMPLETE                ║
╠══════════════════════════════════════════════════════════════╣
║ Sample Data Created:                                         ║
║ • ${disasters.length} Disasters with geospatial data                         ║
║ • ${sampleReports.length} Reports from various users                         ║
║ • ${sampleResources.length} Resources (shelters, hospitals, food centers)    ║
║ • ${sampleCacheData.length} Cache entries for API responses                  ║
║                                                              ║
║ You can now:                                                 ║
║ • Start the development server: npm run dev                  ║
║ • Test API endpoints with sample data                        ║
║ • View data in Supabase dashboard                            ║
╚══════════════════════════════════════════════════════════════╝
    `);
  } catch (error) {
    logger.error('❌ Database seeding failed:', error);
    throw error;
  }
}

// Run seeding if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase().catch(error => {
    logger.error('Seeding failed:', error);
    process.exit(1);
  });
}

export { seedDatabase };
export default seedDatabase;
