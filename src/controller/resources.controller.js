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
  const { disasterId, name, locationName, type } = req.body;
  if (!disasterId || !name || !locationName || !type) {
    throw new ApiError(400, 'All fields are required');
  }

  const cleanedLocation = await rawLocationToLocationData({ locationName });
  if (!cleanedLocation) {
    throw new ApiError(400, 'Invalid location');
  }

  const { latitude, longitude } = await locationToGeoCode(cleanedLocation);

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
  const { resourceId, name, locationName, type } = req.body;

  // make sure only given data is updated not all data and not given data is should as it is

  if (!resourceId) {
    throw new ApiError(400, 'Resource ID is required');
  }

  if (!name || !locationName || !type) {
    throw new ApiError(400, 'All fields are required');
  }
  const cleanedLocation = await rawLocationToLocationData({ locationName });
  if (!cleanedLocation) {
    throw new ApiError(400, 'Invalid location');
  }

  const { latitude, longitude } = await locationToGeoCode(cleanedLocation);

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
  const { id } = req.params;
  if (!id) {
    throw new ApiError(400, 'Resource ID is required');
  }
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
  const { id } = req.params;
  if (!id) {
    throw new ApiError(400, 'Resource ID is required');
  }
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
  const { disasterId } = req.params;
  if (!disasterId) {
    throw new ApiError(400, 'Disaster ID is required');
  }
  const resources = await Prisma.resource.findMany({
    where: { disasterId },
  });

  if (!resources || resources.length === 0) {
    return res.status(404).json(new ApiResponse(404, [], 'No Resources Found for this Disaster'));
  }
  return res.status(200).json(new ApiResponse(200, resources, 'Resources Retrieved for Disaster'));
});
