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
  try {
    const disaster = await Prisma.disaster.findMany();

    if (!disaster || disaster.length === 0) {
      throw new ApiError(400, 'No Disaster Found');
    }
    console.log('all disaster', disaster);
    res.status(200).json(new ApiResponse(200, disaster, 'Disaster fetched'));
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch disasters',
    });
  }
});

export const getDisasterById = asyncHandler(async (req, res) => {
  try {
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
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch disaster',
    });
  }
});

// Create Disaster
export const createDisaster = asyncHandler(async (req, res) => {
  try {
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
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch disasters',
    });

    throw new ApiError(500, error.message);
  }
});

// Update a disaster

export const updateDisaster = asyncHandler(async (req, res) => {
  try {
    const disasterId = req.params.id;
    const { description } = req.body;
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
    res.status(500).json({
      success: false,
      error: 'Failed to delete disaster',
    });
  }
});

export const socialMedia = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, { post: '#floodrelief Need food in NYC', user: 'citizen1' }));
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
