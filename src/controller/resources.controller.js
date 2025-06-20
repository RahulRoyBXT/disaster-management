import { PrismaClient } from '../generated/prisma/index.js';
import { ApiError } from '../utils/apiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { locationToGeoCode } from '../utils/LocationToGeoCode.js';
import { rawLocationToLocationData } from '../utils/RawLocationToLocaionData.js';

const Prisma = new PrismaClient();

// helper to get io
const getIo = req => {
  const io = req.app.get('io');
  if (!io) {
    throw new ApiError(500, 'Socket.IO not available');
  }
  return io;
};

// resources_updated event

export const createResource = asyncHandler(async (req, res) => {
  // Get validated data from middleware
  const { disasterId, name, locationName, type } = req.validatedData || req.body;

  const cleanedLocation = await rawLocationToLocationData({ locationName });
  if (!cleanedLocation) {
    throw new ApiError(400, 'Invalid location');
  }

  const { lat: latitude, lng: longitude } = await locationToGeoCode(cleanedLocation);

  if (!latitude || !longitude) {
    throw new ApiError(400, 'Could not geocode the location');
  }

  const newResource = await Prisma.resource.create({
    data: {
      disasterId,
      name,
      locationName,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      type,
    },
  });

  const io = getIo(req);
  io.emit('resources_created', {
    event: 'resources_created',
    disasterId: disasterId,
    data: newResource,
    message: `New resource added to disaster ${disasterId}`,
    timestamp: new Date().toISOString(),
  });
  return res.status(201).json(new ApiResponse(201, newResource, 'New Resource Created'));
});

export const updateResource = asyncHandler(async (req, res) => {
  // Get validated data from middleware
  const { resourceId, name, locationName, type } = req.validatedData || req.body;

  const cleanedLocation = await rawLocationToLocationData({ locationName });

  if (!cleanedLocation) {
    throw new ApiError(400, 'Invalid location');
  }

  const { lat: latitude, lng: longitude } = await locationToGeoCode(cleanedLocation);

  if (!latitude || !longitude) {
    throw new ApiError(400, 'Could not geocode the location');
  }

  const updatedResource = await Prisma.resource.update({
    where: { id: resourceId },
    data: { name, locationName, type, latitude, longitude: parseFloat(longitude) },
  });

  if (!updatedResource) {
    throw new ApiError(404, 'Resource not found');
  }

  const io = getIo(req);
  io.emit('resources_updated', {
    event: 'resources_updated',
    disasterId: updatedResource.disasterId,
    data: updatedResource,
    message: `Resource updated in disaster ${updatedResource.disasterId}`,
    timestamp: new Date().toISOString(),
  });

  return res.status(200).json(new ApiResponse(200, updatedResource, 'Resource Updated'));
});

export const deleteResource = asyncHandler(async (req, res) => {
  // Get validated params from middleware
  const { id } = req.validatedParams || req.params;

  const resource = await Prisma.resource.findUnique({
    where: { id },
  });

  if (!resource) {
    throw new ApiError(404, 'Resource not found');
  }
  await Prisma.resource.delete({
    where: { id },
  });

  const io = getIo(req);
  io.emit('resources_deleted', {
    event: 'resources_deleted',
    resourceId: id,
    message: `Resource with ID ${id} deleted`,
    timestamp: new Date().toISOString(),
  });
  return res.status(200).json(new ApiResponse(200, null, 'Resource Deleted'));
});

export const getResourceById = asyncHandler(async (req, res) => {
  // Get validated params from middleware
  const { id } = req.validatedParams || req.params;

  const resource = await Prisma.resource.findUnique({
    where: { id },
  });

  if (!resource) {
    throw new ApiError(404, 'Resource not found');
  }

  return res.status(200).json(new ApiResponse(200, resource, 'Resource Retrieved'));
});

export const getAllResources = asyncHandler(async (req, res) => {
  const resources = await Prisma.resource.findMany();

  if (!resources || resources.length === 0) {
    return res.status(404).json(new ApiResponse(404, [], 'No Resources Found'));
  }
  return res.status(200).json(new ApiResponse(200, resources, 'All Resources Retrieved'));
});
export const getResourcesByDisasterId = asyncHandler(async (req, res) => {
  // Get validated params from middleware
  const { disasterId } = req.validatedParams || req.params;

  const resources = await Prisma.resource.findMany({
    where: { disasterId },
  });

  if (!resources || resources.length === 0) {
    return res.status(404).json(new ApiResponse(404, [], 'No Resources Found for this Disaster'));
  }
  return res.status(200).json(new ApiResponse(200, resources, 'Resources Retrieved for Disaster'));
});

/**
 * Get resources near a specific location
 * Implements geospatial query functionality using PostGIS
 */
export const getNearbyResources = asyncHandler(async (req, res) => {
  // Get validated data from middleware
  const { lat, lng, radius = 10000, disasterId } = req.validatedData || req.query; // radius in meters, default 10km

  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);
  const radiusInMeters = parseInt(radius);

  // Using raw SQL for geospatial query with PostGIS
  try {
    const nearbyResources = await Prisma.$queryRaw`
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
          ST_MakePoint(${longitude}, ${latitude})::geography
        ) as distance_meters
      FROM "Resource"
      WHERE ${disasterId ? Prisma.sql`"disasterId" = ${disasterId} AND` : Prisma.sql``}
        ST_DWithin(
          ST_MakePoint(longitude, latitude)::geography,
          ST_MakePoint(${longitude}, ${latitude})::geography,
          ${radiusInMeters}
        )
      ORDER BY distance_meters ASC
    `;

    if (!nearbyResources || nearbyResources.length === 0) {
      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            [],
            `No resources found within ${radiusInMeters} meters of the specified location`
          )
        );
    }

    // Format the response
    const formattedResources = nearbyResources.map(resource => ({
      ...resource,
      distance_meters: Math.round(parseFloat(resource.distance_meters)),
      distance_km: (parseFloat(resource.distance_meters) / 1000).toFixed(2),
    }));

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          resources: formattedResources,
          center: { latitude, longitude },
          radius_meters: radiusInMeters,
          count: formattedResources.length,
        },
        `Found ${formattedResources.length} resources within ${radiusInMeters} meters`
      )
    );
  } catch (error) {
    // Handle potential PostGIS errors
    if (error.message && error.message.includes('function st_')) {
      throw new ApiError(
        500,
        'Geospatial functions not available. PostGIS extension may not be enabled.'
      );
    }
    throw error;
  }
});
