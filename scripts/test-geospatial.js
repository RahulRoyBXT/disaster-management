/**
 * Comprehensive Geospatial Testing Script
 *
 * This script tests both API endpoints and direct Prisma/PostGIS queries for
 * geospatial functionality in the Disaster Response Coordination Platform.
 *
 * Features:
 * - Tests API endpoints for nearby resources and disasters
 * - Direct PostGIS queries through Prisma
 * - Performance comparisons between PostGIS and JavaScript calculations
 * - Batch testing with multiple coordinates
 * - Detailed reporting of results
 *
 * Run with Node.js: node test-geospatial.js
 */

import chalk from 'chalk'; // For colored console output
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { performance } from 'perf_hooks';
import readline from 'readline';
import { PrismaClient } from '../src/generated/prisma/index.js';

// Initialize environment variables
dotenv.config();

// Initialize Prisma client
const prisma = new PrismaClient();

// Setup readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Default API URL
const API_URL = process.env.API_URL || 'http://localhost:8000/api/v1';
let authToken = '';

// Sample test coordinates for different cities worldwide
const TEST_LOCATIONS = [
  { name: 'New York', lat: 40.7128, lng: -74.006 },
  { name: 'London', lat: 51.5074, lng: -0.1278 },
  { name: 'Tokyo', lat: 35.6762, lng: 139.6503 },
  { name: 'Sydney', lat: -33.8688, lng: 151.2093 },
  { name: 'Rio de Janeiro', lat: -22.9068, lng: -43.1729 },
];

/**
 * Authenticate with the API to get a JWT token
 */
async function login() {
  try {
    console.log(chalk.blue('🔑 Authenticating with the API...'));
    console.log(chalk.blue(`Trying to connect to: ${API_URL}/users/login`));

    // First, check if the server is reachable
    try {
      const pingResponse = await fetch(`${API_URL}`, {
        method: 'GET',
        timeout: 5000,
      }).catch(e => {
        throw new Error(`Server unreachable: ${e.message}`);
      });

      if (!pingResponse.ok) {
        throw new Error(`Server returned ${pingResponse.status}: ${pingResponse.statusText}`);
      }

      console.log(chalk.green('✅ Server is reachable!'));
    } catch (pingError) {
      console.error(chalk.red('❌ Server connection error:'), pingError.message);
      console.log(chalk.yellow('\n⚠️ The API server appears to be offline or not reachable.'));
      console.log(chalk.yellow('Make sure your server is running with:'));
      console.log(chalk.cyan('   npm run dev'));
      console.log(
        chalk.yellow('\nFalling back to direct Prisma queries only (API tests will be skipped)...')
      );
      return false;
    }

    // Now try to authenticate
    const response = await fetch(`${API_URL}/users/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'Test@123',
      }),
    });

    const data = await response.json();
    if (data.success && data.data && data.data.token) {
      authToken = data.data.token;
      console.log(chalk.green('✅ Login successful!'));
      return true;
    } else {
      console.error(chalk.red('❌ Login failed:'), data.message || 'Unknown error');
      return false;
    }
  } catch (error) {
    console.error(chalk.red('❌ Error during login:'), error.message);
    return false;
  }
}

/**
 * Test the API endpoint for nearby resources
 */
async function testNearbyResources(lat, lng, radius) {
  try {
    console.log(
      chalk.blue(`\n🔍 Testing API: Nearby Resources at (${lat}, ${lng}) within ${radius}m`)
    );

    const startTime = performance.now();
    const response = await fetch(
      `${API_URL}/resources/nearby?lat=${lat}&lng=${lng}&radius=${radius}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      }
    );
    const endTime = performance.now();
    const executionTime = (endTime - startTime).toFixed(2);

    const data = await response.json();

    if (data.success) {
      console.log(chalk.green(`✅ Found ${data.data.count} resources in ${executionTime}ms`));
      if (data.data.resources && data.data.resources.length > 0) {
        console.log(chalk.cyan('\nResources found:'));
        data.data.resources.forEach((resource, index) => {
          console.log(`${index + 1}. ${resource.name} (${resource.distance_km} km away)`);
        });
      }
      return { success: true, count: data.data.count, executionTime };
    } else {
      console.error(chalk.red('❌ Error fetching nearby resources:'), data.message);
      return { success: false, error: data.message, executionTime };
    }
  } catch (error) {
    console.error(chalk.red('❌ Error testing nearby resources:'), error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test the API endpoint for nearby disasters
 */
async function testNearbyDisasters(lat, lng, radius, tags) {
  try {
    console.log(
      chalk.blue(
        `\n🔍 Testing API: Nearby Disasters at (${lat}, ${lng}) within ${radius}m${
          tags ? ` with tags: ${tags}` : ''
        }`
      )
    );

    let url = `${API_URL}/disasters/nearby?lat=${lat}&lng=${lng}&radius=${radius}`;
    if (tags) {
      url += `&tags=${tags}`;
    }

    const startTime = performance.now();
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
    });
    const endTime = performance.now();
    const executionTime = (endTime - startTime).toFixed(2);

    const data = await response.json();

    if (data.success) {
      console.log(chalk.green(`✅ Found ${data.data.count} disasters in ${executionTime}ms`));
      if (data.data.disasters && data.data.disasters.length > 0) {
        console.log(chalk.cyan('\nDisasters found:'));
        data.data.disasters.forEach((disaster, index) => {
          console.log(`${index + 1}. ${disaster.title} (${disaster.distance_km} km away)`);
        });
      }
      return { success: true, count: data.data.count, executionTime };
    } else {
      console.error(chalk.red('❌ Error fetching nearby disasters:'), data.message);
      return { success: false, error: data.message, executionTime };
    }
  } catch (error) {
    console.error(chalk.red('❌ Error testing nearby disasters:'), error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test direct PostGIS query for nearby resources via Prisma
 */
async function testDirectPostGISResourcesQuery(lat, lng, radius, postGISAvailable) {
  try {
    console.log(
      chalk.blue(
        `\n🔍 Testing Direct PostGIS: Nearby Resources at (${lat}, ${lng}) within ${radius}m`
      )
    );

    let nearbyResources;
    let executionTime;
    const startTime = performance.now();

    if (postGISAvailable) {
      // Use PostGIS if available
      nearbyResources = await prisma.$queryRaw`
        SELECT 
          id, 
          name, 
          "locationName", 
          latitude, 
          longitude, 
          type, 
          "disasterId",
          ST_Distance(
            ST_MakePoint(longitude, latitude)::geography,
            ST_MakePoint(${lng}, ${lat})::geography
          ) as distance_meters
        FROM "Resource"
        WHERE
          ST_DWithin(
            ST_MakePoint(longitude, latitude)::geography,
            ST_MakePoint(${lng}, ${lat})::geography,
            ${radius}
          )
        ORDER BY distance_meters ASC
      `;
    } else {
      // Fall back to JavaScript calculation if PostGIS is not available
      console.log(
        chalk.yellow('PostGIS not available, using JavaScript Haversine calculation instead')
      );

      // Get all resources
      const allResources = await prisma.resource.findMany();

      // Calculate distances using Haversine formula
      nearbyResources = allResources
        .map(resource => {
          const distance = haversineDistance(
            parseFloat(lat),
            parseFloat(lng),
            resource.latitude,
            resource.longitude
          );

          return {
            ...resource,
            distance_meters: distance,
          };
        })
        .filter(resource => resource.distance_meters <= parseFloat(radius))
        .sort((a, b) => a.distance_meters - b.distance_meters);
    }

    const endTime = performance.now();
    executionTime = (endTime - startTime).toFixed(2);

    console.log(
      chalk.green(
        `✅ Found ${nearbyResources.length} resources in ${executionTime}ms (${
          postGISAvailable ? 'Direct PostGIS' : 'JS Fallback'
        })`
      )
    );

    if (nearbyResources && nearbyResources.length > 0) {
      console.log(
        chalk.cyan(`\nResources found (${postGISAvailable ? 'Direct PostGIS' : 'JS Fallback'}):`)
      );
      nearbyResources.forEach((resource, index) => {
        const distanceKm = (parseFloat(resource.distance_meters) / 1000).toFixed(2);
        console.log(`${index + 1}. ${resource.name} (${distanceKm} km away)`);
      });
    }

    return {
      success: true,
      count: nearbyResources.length,
      executionTime,
      results: nearbyResources.map(r => ({
        ...r,
        distance_km: (parseFloat(r.distance_meters) / 1000).toFixed(2),
      })),
    };
  } catch (error) {
    console.error(chalk.red('❌ Error in direct PostGIS query:'), error.message);

    // Check for common PostGIS-related errors
    if (
      error.message &&
      (error.message.includes('function st_') ||
        error.message.includes('type "geography" does not exist') ||
        error.message.includes('operator does not exist: point'))
    ) {
      console.error(
        chalk.red(
          '❌ PostGIS functions not available or not working correctly. Make sure PostGIS extension is properly enabled in your database.'
        )
      );
      console.log(chalk.yellow('\nTo properly set up PostGIS in Supabase:'));
      console.log(chalk.cyan('1. Go to the Supabase dashboard'));
      console.log(chalk.cyan('2. Navigate to the SQL Editor'));
      console.log(chalk.cyan('3. Run the following SQL commands:'));
      console.log(chalk.cyan('   CREATE EXTENSION IF NOT EXISTS postgis;'));
      console.log(chalk.cyan('   CREATE EXTENSION IF NOT EXISTS postgis_topology;'));
      console.log(chalk.cyan('   CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;'));
      console.log(chalk.cyan('   CREATE EXTENSION IF NOT EXISTS postgis_tiger_geocoder;'));

      console.log(chalk.yellow('\nRetrying with JavaScript Haversine calculation...'));

      try {
        // Fall back to JavaScript calculation
        // Get all resources
        const allResources = await prisma.resource.findMany();

        // Calculate distances using Haversine formula
        const nearbyResources = allResources
          .map(resource => {
            const distance = haversineDistance(
              parseFloat(lat),
              parseFloat(lng),
              resource.latitude,
              resource.longitude
            );

            return {
              ...resource,
              distance_meters: distance,
            };
          })
          .filter(resource => resource.distance_meters <= parseFloat(radius))
          .sort((a, b) => a.distance_meters - b.distance_meters);

        console.log(
          chalk.green(
            `✅ Found ${nearbyResources.length} resources using JavaScript Haversine fallback`
          )
        );

        if (nearbyResources && nearbyResources.length > 0) {
          console.log(chalk.cyan('\nResources found (JS Fallback):'));
          nearbyResources.forEach((resource, index) => {
            const distanceKm = (parseFloat(resource.distance_meters) / 1000).toFixed(2);
            console.log(`${index + 1}. ${resource.name} (${distanceKm} km away)`);
          });
        }

        return {
          success: true,
          count: nearbyResources.length,
          executionTime: 'N/A (JS Fallback)',
          results: nearbyResources.map(r => ({
            ...r,
            distance_km: (parseFloat(r.distance_meters) / 1000).toFixed(2),
          })),
        };
      } catch (fallbackError) {
        console.error(
          chalk.red('❌ Error in JavaScript fallback calculation:'),
          fallbackError.message
        );
        return {
          success: false,
          error: `PostGIS failed and JavaScript fallback also failed: ${fallbackError.message}`,
        };
      }
    }

    return { success: false, error: error.message };
  }
}

/**
 * Test direct PostGIS query for nearby disasters via Prisma
 */
async function testDirectPostGISDisastersQuery(lat, lng, radius, tags = [], postGISAvailable) {
  try {
    console.log(
      chalk.blue(
        `\n🔍 Testing Direct PostGIS: Nearby Disasters at (${lat}, ${lng}) within ${radius}m${
          tags.length ? ` with tags: ${tags.join(', ')}` : ''
        }`
      )
    );

    const startTime = performance.now();
    let nearbyDisasters;

    if (postGISAvailable) {
      // Use PostGIS if available
      if (tags && tags.length > 0) {
        nearbyDisasters = await prisma.$queryRaw`
          SELECT 
            id, 
            title, 
            "locationName", 
            latitude, 
            longitude, 
            description,
            tags,
            "ownerId",
            ST_Distance(
              ST_MakePoint(longitude, latitude)::geography,
              ST_MakePoint(${lng}, ${lat})::geography
            ) as distance_meters
          FROM "Disaster"
          WHERE 
            ST_DWithin(
              ST_MakePoint(longitude, latitude)::geography,
              ST_MakePoint(${lng}, ${lat})::geography,
              ${radius}
            )
            AND tags && ${tags}
          ORDER BY distance_meters ASC
        `;
      } else {
        nearbyDisasters = await prisma.$queryRaw`
          SELECT 
            id, 
            title, 
            "locationName", 
            latitude, 
            longitude, 
            description,
            tags,
            "ownerId",
            ST_Distance(
              ST_MakePoint(longitude, latitude)::geography,
              ST_MakePoint(${lng}, ${lat})::geography
            ) as distance_meters
          FROM "Disaster"
          WHERE 
            ST_DWithin(
              ST_MakePoint(longitude, latitude)::geography,
              ST_MakePoint(${lng}, ${lat})::geography,
              ${radius}
            )
          ORDER BY distance_meters ASC
        `;
      }
    } else {
      // Fall back to JavaScript calculation if PostGIS is not available
      console.log(
        chalk.yellow('PostGIS not available, using JavaScript Haversine calculation instead')
      );

      // Get all disasters
      const allDisasters = await prisma.disaster.findMany();

      // Calculate distances using Haversine formula and filter by tags if needed
      nearbyDisasters = allDisasters
        .map(disaster => {
          const distance = haversineDistance(
            parseFloat(lat),
            parseFloat(lng),
            disaster.latitude,
            disaster.longitude
          );

          return {
            ...disaster,
            distance_meters: distance,
          };
        })
        .filter(disaster => {
          // Filter by distance
          const withinDistance = disaster.distance_meters <= parseFloat(radius);

          // Filter by tags if specified
          if (tags && tags.length > 0) {
            return withinDistance && disaster.tags.some(tag => tags.includes(tag));
          }

          return withinDistance;
        })
        .sort((a, b) => a.distance_meters - b.distance_meters);
    }

    const endTime = performance.now();
    const executionTime = (endTime - startTime).toFixed(2);

    console.log(
      chalk.green(
        `✅ Found ${nearbyDisasters.length} disasters in ${executionTime}ms (Direct PostGIS)`
      )
    );

    if (nearbyDisasters && nearbyDisasters.length > 0) {
      console.log(chalk.cyan('\nDisasters found (Direct PostGIS):'));
      nearbyDisasters.forEach((disaster, index) => {
        const distanceKm = (parseFloat(disaster.distance_meters) / 1000).toFixed(2);
        console.log(`${index + 1}. ${disaster.title} (${distanceKm} km away)`);
      });
    }

    return {
      success: true,
      count: nearbyDisasters.length,
      executionTime,
      results: nearbyDisasters.map(d => ({
        ...d,
        distance_km: (parseFloat(d.distance_meters) / 1000).toFixed(2),
      })),
    };
  } catch (error) {
    console.error(chalk.red('❌ Error in direct PostGIS query:'), error.message);

    // Check for common PostGIS-related errors
    if (
      error.message &&
      (error.message.includes('function st_') ||
        error.message.includes('type "geography" does not exist') ||
        error.message.includes('operator does not exist: point'))
    ) {
      console.error(
        chalk.red(
          '❌ PostGIS functions not available or not working correctly. Make sure PostGIS extension is properly enabled in your database.'
        )
      );
      console.log(chalk.yellow('\nTo properly set up PostGIS in Supabase:'));
      console.log(chalk.cyan('1. Go to the Supabase dashboard'));
      console.log(chalk.cyan('2. Navigate to the SQL Editor'));
      console.log(chalk.cyan('3. Run the following SQL commands:'));
      console.log(chalk.cyan('   CREATE EXTENSION IF NOT EXISTS postgis;'));
      console.log(chalk.cyan('   CREATE EXTENSION IF NOT EXISTS postgis_topology;'));
      console.log(chalk.cyan('   CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;'));
      console.log(chalk.cyan('   CREATE EXTENSION IF NOT EXISTS postgis_tiger_geocoder;'));

      console.log(chalk.yellow('\nRetrying with JavaScript Haversine calculation...'));

      try {
        // Fall back to JavaScript calculation
        // Get all disasters
        const allDisasters = await prisma.disaster.findMany();

        // Calculate distances using Haversine formula and filter by tags if needed
        const nearbyDisasters = allDisasters
          .map(disaster => {
            const distance = haversineDistance(
              parseFloat(lat),
              parseFloat(lng),
              disaster.latitude,
              disaster.longitude
            );

            return {
              ...disaster,
              distance_meters: distance,
            };
          })
          .filter(disaster => {
            // Filter by distance
            const withinDistance = disaster.distance_meters <= parseFloat(radius);

            // Filter by tags if specified
            if (tags && tags.length > 0) {
              return withinDistance && disaster.tags.some(tag => tags.includes(tag));
            }

            return withinDistance;
          })
          .sort((a, b) => a.distance_meters - b.distance_meters);

        console.log(
          chalk.green(
            `✅ Found ${nearbyDisasters.length} disasters using JavaScript Haversine fallback`
          )
        );

        if (nearbyDisasters && nearbyDisasters.length > 0) {
          console.log(chalk.cyan('\nDisasters found (JS Fallback):'));
          nearbyDisasters.forEach((disaster, index) => {
            const distanceKm = (parseFloat(disaster.distance_meters) / 1000).toFixed(2);
            console.log(`${index + 1}. ${disaster.title} (${distanceKm} km away)`);
          });
        }

        return {
          success: true,
          count: nearbyDisasters.length,
          executionTime: 'N/A (JS Fallback)',
          results: nearbyDisasters.map(d => ({
            ...d,
            distance_km: (parseFloat(d.distance_meters) / 1000).toFixed(2),
          })),
        };
      } catch (fallbackError) {
        console.error(
          chalk.red('❌ Error in JavaScript fallback calculation:'),
          fallbackError.message
        );
        return {
          success: false,
          error: `PostGIS failed and JavaScript fallback also failed: ${fallbackError.message}`,
        };
      }
    }

    return { success: false, error: error.message };
  }
}

/**
 * Calculate distance using the Haversine formula (JS implementation)
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Test JavaScript-based Haversine calculation for resources
 */
async function testJavaScriptHaversineResources(lat, lng, radius) {
  try {
    console.log(
      chalk.blue(
        `\n🔍 Testing JavaScript Haversine: Nearby Resources at (${lat}, ${lng}) within ${radius}m`
      )
    );

    const startTime = performance.now();

    // Get all resources first
    const allResources = await prisma.resource.findMany();

    // Calculate distances using Haversine formula
    const resourcesWithDistance = allResources.map(resource => {
      const distance = haversineDistance(
        parseFloat(lat),
        parseFloat(lng),
        resource.latitude,
        resource.longitude
      );

      return {
        ...resource,
        distance_meters: distance,
        distance_km: (distance / 1000).toFixed(2),
      };
    });

    // Filter by radius and sort by distance
    const nearbyResources = resourcesWithDistance
      .filter(resource => resource.distance_meters <= parseFloat(radius))
      .sort((a, b) => a.distance_meters - b.distance_meters);

    const endTime = performance.now();
    const executionTime = (endTime - startTime).toFixed(2);

    console.log(
      chalk.green(
        `✅ Found ${nearbyResources.length} resources in ${executionTime}ms (JS Haversine)`
      )
    );

    if (nearbyResources && nearbyResources.length > 0) {
      console.log(chalk.cyan('\nResources found (JS Haversine):'));
      nearbyResources.forEach((resource, index) => {
        console.log(`${index + 1}. ${resource.name} (${resource.distance_km} km away)`);
      });
    }

    return {
      success: true,
      count: nearbyResources.length,
      executionTime,
      results: nearbyResources,
    };
  } catch (error) {
    console.error(chalk.red('❌ Error in JavaScript Haversine calculation:'), error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Compare the performance of different geospatial query methods
 */
async function runPerformanceComparison(
  lat,
  lng,
  radius,
  apiAvailable = true,
  postGISAvailable = true
) {
  console.log(chalk.yellow('\n📊 PERFORMANCE COMPARISON'));
  console.log(chalk.yellow('======================'));

  // Test API endpoint if available
  let apiResult = { executionTime: 'N/A', count: 0, success: false };
  if (apiAvailable) {
    apiResult = await testNearbyResources(lat, lng, radius);
  } else {
    console.log(chalk.yellow('Skipping API endpoint test (server not available)'));
  }

  // Test direct PostGIS query
  const postgisResult = await testDirectPostGISResourcesQuery(lat, lng, radius, postGISAvailable);

  // Test JavaScript Haversine
  const haversineResult = await testJavaScriptHaversineResources(lat, lng, radius);

  console.log(chalk.yellow('\n📊 SUMMARY'));
  console.log('---------------------------------------');

  if (apiAvailable) {
    console.log(`API Endpoint:       ${apiResult.executionTime}ms (${apiResult.count} results)`);
  } else {
    console.log(`API Endpoint:       N/A (server not available)`);
  }

  if (postGISAvailable) {
    console.log(
      `Direct PostGIS:     ${postgisResult.executionTime}ms (${postgisResult.count} results)`
    );
  } else {
    console.log(`Direct PostGIS:     N/A (PostGIS not available, using JS fallback)`);
  }

  console.log(
    `JS Haversine:       ${haversineResult.executionTime}ms (${haversineResult.count} results)`
  );
  console.log('---------------------------------------');

  // Determine the fastest method
  const methods = [];

  if (apiAvailable && apiResult.executionTime !== 'N/A' && apiResult.success) {
    methods.push({ name: 'API Endpoint', time: parseFloat(apiResult.executionTime) });
  }

  if (postGISAvailable && postgisResult.executionTime !== 'N/A' && postgisResult.success) {
    methods.push({ name: 'Direct PostGIS', time: parseFloat(postgisResult.executionTime) });
  }

  if (haversineResult.success) {
    methods.push({ name: 'JS Haversine', time: parseFloat(haversineResult.executionTime) });
  }

  if (methods.length > 0) {
    methods.sort((a, b) => a.time - b.time);
    console.log(chalk.green(`Fastest method: ${methods[0].name} (${methods[0].time}ms)`));
  } else {
    console.log(chalk.yellow('No successful performance comparisons available.'));
  }

  return {
    api: apiResult,
    postgis: postgisResult,
    haversine: haversineResult,
    fastest: methods.length > 0 ? methods[0].name : 'None',
  };
}

/**
 * Run a batch test with multiple locations
 */
async function runBatchTest(radius, apiAvailable = false, postGISAvailable = false) {
  console.log(chalk.yellow('\n🌎 BATCH TESTING MULTIPLE LOCATIONS'));
  console.log(chalk.yellow('================================='));

  const results = [];
  for (const location of TEST_LOCATIONS) {
    console.log(
      chalk.cyan(`\nTesting location: ${location.name} (${location.lat}, ${location.lng})`)
    );

    // Test direct PostGIS query for resources
    const resourcesResult = await testDirectPostGISResourcesQuery(
      location.lat,
      location.lng,
      radius,
      postGISAvailable
    );

    // Test direct PostGIS query for disasters
    const disastersResult = await testDirectPostGISDisastersQuery(
      location.lat,
      location.lng,
      radius,
      [],
      postGISAvailable
    );

    results.push({
      location: location.name,
      coordinates: { lat: location.lat, lng: location.lng },
      resources: {
        count: resourcesResult.count,
        executionTime: resourcesResult.executionTime,
      },
      disasters: {
        count: disastersResult.count,
        executionTime: disastersResult.executionTime,
      },
    });
  }

  console.log(chalk.yellow('\n📊 BATCH TEST SUMMARY'));
  console.log('---------------------------------------');
  results.forEach(result => {
    console.log(
      `${result.location}: ${result.resources.count} resources, ${result.disasters.count} disasters`
    );
  });
  console.log('---------------------------------------');

  return results;
}

/**
 * Create a test resource at a specific location
 */
async function createTestResource(name, lat, lng, disasterId, type = 'shelter') {
  try {
    console.log(chalk.blue(`\n📍 Creating test resource: ${name} at (${lat}, ${lng})`));

    const resource = await prisma.resource.create({
      data: {
        name,
        locationName: `Test Location for ${name}`,
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
        type,
        disasterId,
      },
    });

    console.log(chalk.green(`✅ Created test resource: ${resource.name} (ID: ${resource.id})`));
    return resource;
  } catch (error) {
    console.error(chalk.red('❌ Error creating test resource:'), error.message);
    return null;
  }
}

/**
 * Create a test disaster at a specific location
 */
async function createTestDisaster(title, lat, lng, ownerId, tags = ['test']) {
  try {
    console.log(chalk.blue(`\n📍 Creating test disaster: ${title} at (${lat}, ${lng})`));

    const disaster = await prisma.disaster.create({
      data: {
        title,
        locationName: `Test Location for ${title}`,
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
        description: `Test disaster for geospatial queries: ${title}`,
        tags,
        ownerId,
      },
    });

    console.log(chalk.green(`✅ Created test disaster: ${disaster.title} (ID: ${disaster.id})`));
    return disaster;
  } catch (error) {
    console.error(chalk.red('❌ Error creating test disaster:'), error.message);
    return null;
  }
}

/**
 * Retrieve and print test data from the database
 */
async function getTestData() {
  try {
    console.log(chalk.yellow('\n📊 DATABASE STATISTICS'));
    console.log(chalk.yellow('======================'));

    const resourceCount = await prisma.resource.count();
    const disasterCount = await prisma.disaster.count();
    const userCount = await prisma.user.count();

    console.log(`Resources: ${resourceCount}`);
    console.log(`Disasters: ${disasterCount}`);
    console.log(`Users: ${userCount}`);

    if (resourceCount === 0 || disasterCount === 0) {
      console.log(chalk.yellow('\n⚠️ Warning: Low data volume may affect test results'));
    }

    return { resources: resourceCount, disasters: disasterCount, users: userCount };
  } catch (error) {
    console.error(chalk.red('❌ Error retrieving test data:'), error.message);
    return null;
  }
}

/**
 * Create some test data if none exists
 */
async function createTestDataIfNeeded() {
  console.log(chalk.blue('\n🔍 Checking if test data needs to be created...'));

  const resourceCount = await prisma.resource.count();

  if (resourceCount === 0) {
    console.log(chalk.yellow('No resources found in database. Creating test data...'));

    try {
      // First, make sure we have at least one disaster to link to
      let testDisasterId;

      const disasters = await prisma.disaster.findMany({ take: 1 });
      if (disasters && disasters.length > 0) {
        testDisasterId = disasters[0].id;
        console.log(chalk.blue(`Found existing disaster ID to use: ${testDisasterId}`));
      } else {
        // If no disasters exist, we need to find a user to create one
        const users = await prisma.user.findMany({ take: 1 });
        if (!users || users.length === 0) {
          console.log(chalk.red('❌ No users found. Cannot create test data.'));
          return false;
        }

        const testUserId = users[0].id;

        // Create a test disaster
        const testDisaster = await prisma.disaster.create({
          data: {
            title: 'Test Disaster for Geospatial Queries',
            locationName: 'New York City',
            latitude: 40.7128,
            longitude: -74.006,
            description: 'This is a test disaster created for geospatial testing',
            tags: ['test', 'flood', 'emergency'],
            ownerId: testUserId,
          },
        });

        testDisasterId = testDisaster.id;
        console.log(
          chalk.green(`✅ Created test disaster: ${testDisaster.title} (ID: ${testDisaster.id})`)
        );
      }

      // Now create test resources in different locations
      const testResources = await Promise.all([
        // Create resources in New York
        createTestResource('Test Shelter NYC', 40.7128, -74.006, testDisasterId, 'shelter'),
        createTestResource('Test Hospital NYC', 40.7589, -73.9851, testDisasterId, 'hospital'),
        createTestResource('Test Food Bank NYC', 40.7282, -73.9942, testDisasterId, 'food'),

        // Create resources in other test locations
        createTestResource('Test Shelter London', 51.5074, -0.1278, testDisasterId, 'shelter'),
        createTestResource('Test Shelter Tokyo', 35.6762, 139.6503, testDisasterId, 'shelter'),
        createTestResource('Test Shelter Sydney', -33.8688, 151.2093, testDisasterId, 'shelter'),
        createTestResource('Test Shelter Rio', -22.9068, -43.1729, testDisasterId, 'shelter'),
      ]);

      const successfulCreations = testResources.filter(r => r !== null);
      console.log(chalk.green(`✅ Created ${successfulCreations.length} test resources`));

      return true;
    } catch (error) {
      console.error(chalk.red('❌ Error creating test data:'), error.message);
      return false;
    }
  } else {
    console.log(
      chalk.green(`✅ Found ${resourceCount} existing resources. No need to create test data.`)
    );
    return true;
  }
}

/**
 * Check if PostGIS extension is available in the database
 */
async function isPostGISAvailable() {
  try {
    console.log(chalk.blue('🔍 Checking if PostGIS is available...'));

    // First, try with a more generic query that should work even if PostGIS isn't fully set up
    try {
      const result = await prisma.$queryRaw`
        SELECT 1 as test_result
        WHERE EXISTS (
          SELECT 1 FROM pg_extension WHERE extname = 'postgis'
        )
      `;

      const isAvailable = result && result.length > 0;

      if (isAvailable) {
        // Even if the extension exists, let's verify it's working properly
        try {
          // Try a basic PostGIS function
          await prisma.$queryRaw`SELECT ST_MakePoint(0, 0)::geography`;
          console.log(chalk.green('✅ PostGIS extension is available and working correctly'));
          return true;
        } catch (postgisError) {
          console.log(chalk.yellow('⚠️ PostGIS extension is installed but not working correctly'));
          console.log(chalk.yellow(`Error: ${postgisError.message}`));

          if (postgisError.message.includes('type "geography" does not exist')) {
            console.log(
              chalk.yellow(
                'The geography type is not available. This might be due to an incomplete PostGIS installation.'
              )
            );
          }

          console.log(chalk.yellow('\nTo properly set up PostGIS in Supabase:'));
          console.log(chalk.cyan('1. Go to the Supabase dashboard'));
          console.log(chalk.cyan('2. Navigate to the SQL Editor'));
          console.log(chalk.cyan('3. Run the following SQL commands:'));
          console.log(chalk.cyan('   CREATE EXTENSION IF NOT EXISTS postgis;'));
          console.log(chalk.cyan('   CREATE EXTENSION IF NOT EXISTS postgis_topology;'));
          console.log(chalk.cyan('   CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;'));
          console.log(chalk.cyan('   CREATE EXTENSION IF NOT EXISTS postgis_tiger_geocoder;'));

          return false;
        }
      } else {
        console.log(chalk.yellow('⚠️ PostGIS extension is not enabled in your database'));
        console.log(
          chalk.yellow('Falling back to JavaScript Haversine calculations for geospatial queries')
        );
        console.log(chalk.yellow('\nTo enable PostGIS in Supabase:'));
        console.log(chalk.cyan('1. Go to the Supabase dashboard'));
        console.log(chalk.cyan('2. Navigate to the SQL Editor'));
        console.log(chalk.cyan('3. Run the following SQL command:'));
        console.log(chalk.cyan('   CREATE EXTENSION IF NOT EXISTS postgis;'));

        return false;
      }
    } catch (error) {
      console.error(chalk.red('❌ Error checking PostGIS availability:'), error.message);
      console.log(
        chalk.yellow('Falling back to JavaScript Haversine calculations for geospatial queries')
      );

      if (error.message.includes('permission denied')) {
        console.log(
          chalk.yellow(
            '\nPermission error detected. You may need admin privileges to check for extensions.'
          )
        );
        console.log(chalk.yellow('Trying an alternative method to check PostGIS...'));

        try {
          // Try with a more basic query that might work with limited permissions
          await prisma.$queryRaw`SELECT 1`;
          console.log(
            chalk.yellow(
              'Database connection successful, but PostGIS status could not be determined.'
            )
          );
          console.log(chalk.yellow('Assuming PostGIS is NOT available as a precaution.'));
        } catch (basicError) {
          console.error(chalk.red('❌ Basic database query also failed:'), basicError.message);
          console.log(
            chalk.red(
              'Database connection issues detected. Please check your database configuration.'
            )
          );
        }
      }

      return false;
    }
  } catch (error) {
    console.error(chalk.red('❌ Unexpected error checking PostGIS availability:'), error.message);
    console.log(
      chalk.yellow('Falling back to JavaScript Haversine calculations for geospatial queries')
    );
    return false;
  }
}

/**
 * Run the main test suite
 */
async function runTests() {
  console.log(chalk.green('🌍 GEOSPATIAL QUERY TEST SUITE'));
  console.log(chalk.green('============================='));
  console.log(`API URL: ${API_URL}`);
  // Get database statistics
  await getTestData();

  // Create test data if needed
  await createTestDataIfNeeded();

  // Refresh database statistics after potentially creating test data
  await getTestData();

  // Login to get auth token (only needed for API tests)
  const loggedIn = await login();
  const apiAvailable = loggedIn;

  if (!loggedIn) {
    console.log(
      chalk.yellow('Proceeding with direct Prisma tests only. API tests will be skipped.')
    );
  }

  // Create test data if none exists
  const testDataCreated = await createTestDataIfNeeded();

  // Check PostGIS availability
  const postGISAvailable = await isPostGISAvailable();

  // Interactive mode or batch mode selection
  rl.question('Run in batch mode with predefined locations? (y/n, default: n): ', answer => {
    const batchMode = answer.toLowerCase() === 'y';

    if (batchMode) {
      rl.question('Enter radius in meters for batch tests (default: 50000): ', async radius => {
        const radiusValue = radius || '50000';
        console.log(chalk.cyan(`\nRunning batch tests with radius: ${radiusValue}m`));
        await runBatchTest(radiusValue, apiAvailable, postGISAvailable);
        rl.question('Run performance comparison tests? (y/n, default: n): ', async answer => {
          if (answer.toLowerCase() === 'y') {
            await runPerformanceComparison(
              TEST_LOCATIONS[0].lat,
              TEST_LOCATIONS[0].lng,
              radiusValue,
              apiAvailable,
              postGISAvailable
            );
          }

          console.log(chalk.green('\n✅ Tests completed!'));
          rl.close();
        });
      });
    } else {
      rl.question('Enter latitude (default: 40.7128): ', lat => {
        const latitude = lat || '40.7128';

        rl.question('Enter longitude (default: -74.0060): ', lng => {
          const longitude = lng || '-74.0060';

          rl.question('Enter radius in meters (default: 50000): ', radius => {
            const radiusValue = radius || '50000';

            rl.question(
              'Enter tags for disaster filtering (comma-separated, optional): ',
              async tags => {
                console.log(
                  chalk.cyan(
                    `\nTesting with coordinates: (${latitude}, ${longitude}) and radius: ${radiusValue}m`
                  )
                );

                // Test API endpoints if API is available
                if (apiAvailable) {
                  await testNearbyResources(latitude, longitude, radiusValue);
                  await testNearbyDisasters(latitude, longitude, radiusValue, tags);
                } else {
                  console.log(chalk.yellow('Skipping API tests (server not available)'));
                }

                // Test direct PostGIS queries (always available)
                await testDirectPostGISResourcesQuery(
                  latitude,
                  longitude,
                  radiusValue,
                  postGISAvailable
                );

                const tagArray = tags ? tags.split(',').map(tag => tag.trim()) : [];
                await testDirectPostGISDisastersQuery(
                  latitude,
                  longitude,
                  radiusValue,
                  tagArray,
                  postGISAvailable
                );

                // Test JavaScript Haversine implementation (always available)
                await testJavaScriptHaversineResources(latitude, longitude, radiusValue);

                // Run performance comparison
                rl.question(
                  'Run performance comparison tests? (y/n, default: n): ',
                  async answer => {
                    if (answer.toLowerCase() === 'y') {
                      await runPerformanceComparison(
                        latitude,
                        longitude,
                        radiusValue,
                        apiAvailable,
                        postGISAvailable
                      );
                    }

                    console.log(chalk.green('\n✅ Tests completed!'));
                    rl.close();
                  }
                );
              }
            );
          });
        });
      });
    }
  });
}

// Run the test suite
runTests();
