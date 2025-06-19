import { PrismaClient } from '../generated/prisma/index.js';
import { ApiError } from '../utils/apiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const Prisma = new PrismaClient();

export const createResource = asyncHandler(async (req, res) => {
  const { disasterId, name, locationName, latitude, longitude, type } = req.body;
  if (!disasterId || !name || !locationName || !latitude || !longitude || !type) {
    throw new ApiError(400, 'All fields are required');
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
  return res.status(201).json(new ApiResponse(201, newResource, 'New Resource Created'));
});

export const updateResource = asyncHandler(async (req, res) => {
  const { resourceId, name, locationName, type } = req.body;
  if (!resourceId) {
    throw new ApiError(400, 'Resource ID is required');
  }
  const updatedResource = await Prisma.resource.update({
    where: { id: resourceId },
    data: { name, locationName, type },
  });
  return res.status(200).json(new ApiResponse(200, updatedResource, 'Resource Updated'));
});

export const deleteResource = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!id) {
    throw new ApiError(400, 'Resource ID is required');
  }
  await Prisma.resource.delete({
    where: { id },
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
  return res.status(200).json(new ApiResponse(200, resources, 'All Resources Retrieved'));
});
