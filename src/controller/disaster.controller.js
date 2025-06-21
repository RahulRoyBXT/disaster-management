import { PrismaClient } from '../generated/prisma/index.js';
import { ApiError } from '../utils/apiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { locationToGeoCode } from '../utils/LocationToGeoCode.js';
import { logger } from '../utils/logger.js';
import { rawLocationToLocationData } from '../utils/RawLocationToLocaionData.js';

const Prisma = new PrismaClient();

// Helper to get socket.io instance
const getSocket = req => {
  return req.app.get('io');
};

export const getAllDisasters = asyncHandler(async (req, res) => {
  const disaster = await Prisma.disaster.findMany();

  if (!disaster || disaster.length === 0) {
    throw new ApiError(400, 'No Disaster Found');
  }
  console.log('all disaster', disaster);
  res.status(200).json(new ApiResponse(200, disaster, 'Disaster fetched'));
});

export const getDisasterById = asyncHandler(async (req, res) => {
  const disasterId = req.params.id;
  if (!disasterId) {
    throw new ApiError(400, 'Disaster id is required');
  }
  const disaster = await Prisma.disaster.findUnique({
    where: {
      id: disasterId,
    },
  });
  if (!disaster) {
    throw new ApiError(404, 'No Disaster Found');
  }
  res.status(200).json(new ApiResponse(200, disaster, 'Disaster Found successfully'));
});

// Create Disaster
export const createDisaster = asyncHandler(async (req, res) => {
  const { title, locationName, description, tags } = req.body;
  console.log(req.user.id);
  if (!title || !locationName || !description || !tags) {
    throw new ApiError(400, 'All fields are required');
  }

  const FilteredLocationName = await rawLocationToLocationData({
    locationName: locationName.toString(),
    description: description.toString(),
  });

  if (!FilteredLocationName) {
    throw new ApiError(400, 'Invalid location name provided');
  }

  const { lat, lng } = await locationToGeoCode(FilteredLocationName);

  const disaster = await Prisma.disaster.create({
    data: {
      title,
      owner: {
        connect: { id: req.user.id },
      },
      locationName: FilteredLocationName,
      latitude: parseFloat(lat),
      longitude: parseFloat(lng),
      description,
      tags,
    },
  });

  // Emit disaster_created event using socket.io
  const io = getSocket(req);
  if (io) {
    io.emit('disaster_created', {
      event: 'disaster_created',
      data: disaster,
      message: `New disaster reported: ${disaster.title}`,
      timestamp: new Date().toISOString(),
    });
  }

  return res.status(201).json(new ApiResponse(201, disaster, 'Disaster Created successfully'));
});

// Update a disaster

export const updateDisaster = asyncHandler(async (req, res) => {
  try {
    const disasterId = req.params.id;
    const { description } = req.body;

    console.log(description);
    if (!description) {
      throw new ApiError(400, 'Nothing To Update');
    }
    if (!disasterId) {
      throw new ApiError(400, 'Disaster Id Not Found');
    }
    const disaster = await Prisma.disaster.findUnique({
      where: {
        id: disasterId,
      },
    });
    if (!disaster) {
      throw new ApiError(400, 'Invalid Disaster ID');
    }
    const updatedDisaster = await Prisma.disaster.update({
      where: {
        id: disasterId,
      },
      data: {
        description,
      },
    });

    // Emit disaster_updated
    const io = getSocket(req);
    if (io) {
      io.emit('disaster_updated', {
        event: 'disaster_updated',
        data: updatedDisaster,
        message: `Disaster updated: ${updatedDisaster.title}`,
        timestamp: new Date().toISOString(),
      });
    }

    res.status(200).json(new ApiResponse(200, updatedDisaster, 'Disaster Updated'));
  } catch (error) {
    throw new ApiError(500, error.message);
  }
});

// Delete a disaster

export const deleteDisaster = asyncHandler(async (req, res) => {
  try {
    const disasterId = req.params.id;
    if (!disasterId) {
      throw new ApiError(400, 'Disaster Id is Required');
    }
    const disaster = await Prisma.disaster.findUnique({
      where: {
        id: disasterId,
      },
    });
    if (!disaster) {
      throw new ApiError(400, 'Invalid Disaster Id');
    }
    const deletedDisaster = await Prisma.disaster.delete({
      where: {
        id: disasterId,
      },
    });

    // Emit disaster_deleted event using socket.io
    const io = getSocket(req);
    if (io) {
      io.emit('disaster_deleted', {
        event: 'disaster_deleted',
        data: deletedDisaster,
        message: `Disaster deleted: ${deletedDisaster.title}`,
        timestamp: new Date().toISOString(),
      });
    }

    res.status(204).json(new ApiResponse(204, deletedDisaster, 'Disaster deleted'));
  } catch (error) {
    res.status(500).json(new ApiError(500, error.message));
  }
});

export const socialMedia = asyncHandler(async (req, res) => {
  try {
    const disasterId = req.params.id;
    const { refresh = false } = req.query;

    if (!disasterId) {
      throw new ApiError(400, 'Disaster ID is required');
    }

    // Get the disaster to understand its type and location
    const disaster = await Prisma.disaster.findUnique({
      where: { id: disasterId },
    });

    if (!disaster) {
      throw new ApiError(404, 'Disaster not found');
    }

    // Import services dynamically to avoid circular imports
    const { default: cacheService } = await import('../services/cacheService.js');

    // Create cache key for social media reports
    const cacheKey = `social_media_${disasterId}`;

    // Check if refresh is requested or cache doesn't exist
    if (refresh === 'true') {
      await cacheService.delete(cacheKey);
      logger.info(`Cache refreshed for social media reports: ${disasterId}`);
    }

    // Use cache service with getOrSet pattern
    const socialMediaReports = await cacheService.getOrSet(
      cacheKey,
      async () => {
        logger.info(`Fetching fresh social media reports for disaster: ${disasterId}`);
        // Mock social media API - in a real app, this would call Twitter API or similar

        // Add a slight delay to simulate API call
        await new Promise(resolve => setTimeout(resolve, 500));

        // Generate a random number of reports between 3 and 10
        const reportCount = Math.floor(Math.random() * 8) + 3;
        const reports = [];

        // Create hashtags from disaster tags
        const hashtags = disaster.tags.map(tag => `#${tag}relief`).join(' ');

        // Generate realistic social media posts
        const messages = [
          `Need food and water in ${disaster.locationName}`,
          `Offering shelter space in ${disaster.locationName} for those affected`,
          `SOS! Medical supplies needed urgently in ${disaster.locationName}`,
          `Volunteers needed at ${disaster.locationName} community center`,
          `Road blocked near ${disaster.locationName}, seek alternate routes`,
          `Power outage reported in ${disaster.locationName}`,
          `Temporary shelter set up at ${disaster.locationName} high school`,
          `Drinking water distribution at ${disaster.locationName} park`,
          `Rescue teams active in ${disaster.locationName}`,
          `Mobile charging station available at ${disaster.locationName} community center`,
        ];

        const usernames = [
          'citizen1',
          'localhelper',
          'emergencyResponse',
          'reliefWorker',
          'communityLead',
          'volunteerCoord',
          'rescueTeam',
          'weatherAlert',
          'newsUpdates',
          'officialResponse',
        ];

        // Generate reports with proper priority detection
        for (let i = 0; i < reportCount; i++) {
          // Randomly select a message
          const messageIndex = Math.floor(Math.random() * messages.length);
          const message = messages[messageIndex];

          // Determine priority based on content
          let priority = 'medium';
          if (
            message.includes('SOS') ||
            message.includes('urgently') ||
            message.includes('emergency')
          ) {
            priority = 'high';
          } else if (message.includes('offering') || message.includes('available')) {
            priority = 'low';
          }

          // Create random coordinates near the disaster
          const latOffset = (Math.random() - 0.5) * 0.05;
          const lngOffset = (Math.random() - 0.5) * 0.05;

          // Create random timestamp within the last 24 hours
          const hoursAgo = Math.floor(Math.random() * 24);
          const timestamp = new Date(Date.now() - hoursAgo * 3600000).toISOString();

          // Add report
          reports.push({
            post: `${hashtags} ${message}`,
            user: usernames[Math.floor(Math.random() * usernames.length)],
            timestamp: timestamp,
            coordinates: {
              lat: disaster.latitude + latOffset,
              lng: disaster.longitude + lngOffset,
            },
            priority: priority,
            source: 'mock_twitter_api',
          });
        }

        // Sort reports by timestamp (newest first)
        reports.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        return {
          disaster_id: disasterId,
          location: disaster.locationName,
          disaster_type: disaster.tags[0] || 'emergency',
          reports: reports,
          last_updated: new Date().toISOString(),
          count: reports.length,
          sources: ['twitter', 'mock_api'],
          metadata: {
            refresh_interval: 3600, // seconds
            ttl_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
          },
        };
      },
      3600 // 1 hour TTL
    );

    // Emit social_media_updated event using socket.io
    const io = getSocket(req);
    if (io) {
      io.emit('social_media_updated', {
        event: 'social_media_updated',
        disaster_id: disasterId,
        data: {
          count: socialMediaReports.count,
          last_updated: socialMediaReports.last_updated,
        },
        message: `Social media reports available for ${disaster.title}`,
        timestamp: new Date().toISOString(),
      });
    }

    // Log structured information
    logger.info(`Social media reports served for disaster: ${disasterId}`, {
      disaster_id: disasterId,
      disaster_title: disaster.title,
      location: disaster.locationName,
      reports_count: socialMediaReports.reports?.length || 0,
      cached: !refresh,
    });

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          socialMediaReports,
          `Social media reports fetched successfully (${
            socialMediaReports.reports?.length || 0
          } reports)`
        )
      );
  } catch (error) {
    logger.error('Error fetching social media reports:', {
      disaster_id: req.params.id,
      error: error.message,
      stack: error.stack,
    });

    // Return fallback data in case of complete failure
    const fallbackData = {
      disaster_id: req.params.id,
      reports: [
        {
          post: '#floodrelief Need food in affected area',
          user: 'citizen1',
          timestamp: new Date().toISOString(),
          priority: 'medium',
        },
      ],
      last_updated: new Date().toISOString(),
      count: 1,
      error: true,
    };

    return res
      .status(200)
      .json(new ApiResponse(200, fallbackData, 'Social media reports temporarily unavailable'));
  }
});

export const getAllReports = asyncHandler(async (req, res) => {
  try {
    const disasterId = req.params.id;
    if (!disasterId) {
      throw new ApiError(400, 'Disaster id is required');
    }
    const reports = await Prisma.report.findMany({
      where: {
        disasterId: disasterId,
      },
      include: {
        user: true, // Include user details if needed
      },
    });

    if (!reports || reports.length === 0) {
      throw new ApiError(404, 'No reports found for this disaster');
    }

    res.status(200).json(new ApiResponse(200, reports, 'Reports fetched successfully'));
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch reports',
    });
  }
});

export const getOfficialUpdates = asyncHandler(async (req, res) => {
  try {
    const disasterId = req.params.id;
    const { refresh = false } = req.query;

    if (!disasterId) {
      throw new ApiError(400, 'Disaster ID is required');
    }

    // Get the disaster to understand its type and location
    const disaster = await Prisma.disaster.findUnique({
      where: { id: disasterId },
    });

    if (!disaster) {
      throw new ApiError(404, 'Disaster not found');
    }

    // Import services dynamically to avoid circular imports
    const { default: cacheService } = await import('../services/cacheService.js');
    const { default: officialUpdatesService } = await import(
      '../services/officialUpdatesService.js'
    );

    // Create cache key for official updates
    const cacheKey = `official_updates_${disasterId}`;

    // Check if refresh is requested or cache doesn't exist
    if (refresh === 'true') {
      await cacheService.delete(cacheKey);
      logger.info(`Cache refreshed for official updates: ${disasterId}`);
    }

    // Use cache service with getOrSet pattern
    const officialUpdates = await cacheService.getOrSet(
      cacheKey,
      async () => {
        logger.info(`Fetching fresh official updates for disaster: ${disasterId}`);
        return await officialUpdatesService.fetchAllOfficialUpdates(disaster);
      },
      3600 // 1 hour TTL
    );

    // Emit real-time update via WebSocket
    const io = getSocket(req);
    if (io) {
      io.emit('official_updates_fetched', {
        event: 'official_updates_fetched',
        disaster_id: disasterId,
        data: officialUpdates,
        message: `Official updates available for ${disaster.title}`,
        timestamp: new Date().toISOString(),
      });
    }

    // Log structured information
    logger.info(`Official updates served for disaster: ${disasterId}`, {
      disaster_id: disasterId,
      disaster_title: disaster.title,
      location: disaster.locationName,
      updates_count: officialUpdates.updates?.length || 0,
      sources_count: officialUpdates.source_count || 0,
      cached: !refresh,
    });

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          officialUpdates,
          `Official updates fetched successfully (${
            officialUpdates.updates?.length || 0
          } updates from ${officialUpdates.source_count || 0} sources)`
        )
      );
  } catch (error) {
    logger.error('Error fetching official updates:', {
      disaster_id: req.params.id,
      error: error.message,
      stack: error.stack,
    });

    // Return fallback data in case of complete failure
    const fallbackData = {
      disaster_id: req.params.id,
      location: 'Unknown',
      disaster_type: 'emergency',
      updates: [
        {
          source: 'System',
          title: 'Official Updates Temporarily Unavailable',
          content:
            'We are currently unable to fetch official updates. Please check government websites directly for the latest information.',
          url: 'https://www.ready.gov',
          timestamp: new Date().toISOString(),
          priority: 'medium',
        },
      ],
      last_updated: new Date().toISOString(),
      source_count: 1,
      error: true,
    };

    res
      .status(200)
      .json(new ApiResponse(200, fallbackData, 'Official updates service temporarily unavailable'));
  }
});

/**
 * Get disasters near a specific location
 * Implements geospatial query functionality using PostGIS
 */
export const getNearbyDisasters = asyncHandler(async (req, res) => {
  // Get validated data from middleware
  const { lat, lng, radius = 50000, tags } = req.validatedData || req.query; // radius in meters, default 50km

  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);
  const radiusInMeters = parseInt(radius);

  let tagArray = [];
  if (tags) {
    tagArray = tags.split(',').map(tag => tag.trim());
  }

  // Using raw SQL for geospatial query with PostGIS
  try {
    let nearbyDisasters;

    if (tagArray.length > 0) {
      // Query with tag filtering
      nearbyDisasters = await Prisma.$queryRaw`
        SELECT 
          id, 
          title, 
          "locationName", 
          latitude, 
          longitude, 
          description,
          tags,
          "ownerId",
          created_at,
          updated_at,
          ST_Distance(
            ST_MakePoint(longitude, latitude)::geography,
            ST_MakePoint(${longitude}, ${latitude})::geography
          ) as distance_meters
        FROM "Disaster"
        WHERE 
          ST_DWithin(
            ST_MakePoint(longitude, latitude)::geography,
            ST_MakePoint(${longitude}, ${latitude})::geography,
            ${radiusInMeters}
          )
          AND tags && ${tagArray}
        ORDER BY distance_meters ASC
      `;
    } else {
      // Query without tag filtering
      nearbyDisasters = await Prisma.$queryRaw`
        SELECT 
          id, 
          title, 
          "locationName", 
          latitude, 
          longitude, 
          description,
          tags,
          "ownerId",
          created_at,
          updated_at,
          ST_Distance(
            ST_MakePoint(longitude, latitude)::geography,
            ST_MakePoint(${longitude}, ${latitude})::geography
          ) as distance_meters
        FROM "Disaster"
        WHERE 
          ST_DWithin(
            ST_MakePoint(longitude, latitude)::geography,
            ST_MakePoint(${longitude}, ${latitude})::geography,
            ${radiusInMeters}
          )
        ORDER BY distance_meters ASC
      `;
    }

    if (!nearbyDisasters || nearbyDisasters.length === 0) {
      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            [],
            `No disasters found within ${radiusInMeters} meters of the specified location`
          )
        );
    }

    // Format the response
    const formattedDisasters = nearbyDisasters.map(disaster => ({
      ...disaster,
      distance_meters: Math.round(parseFloat(disaster.distance_meters)),
      distance_km: (parseFloat(disaster.distance_meters) / 1000).toFixed(2),
    }));

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          disasters: formattedDisasters,
          center: { latitude, longitude },
          radius_meters: radiusInMeters,
          count: formattedDisasters.length,
          tags: tagArray.length > 0 ? tagArray : null,
        },
        `Found ${formattedDisasters.length} disasters within ${radiusInMeters} meters`
      )
    );
  } catch (error) {
    logger.error(`Error in getNearbyDisasters: ${error.message}`, { error });
    // Handle potential PostGIS errors
    if (error.message?.includes('function st_')) {
      throw new ApiError(
        500,
        'Geospatial functions not available. PostGIS extension may not be enabled.'
      );
    }
    throw error;
  }
});
