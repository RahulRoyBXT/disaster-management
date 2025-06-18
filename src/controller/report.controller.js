import { PrismaClient } from '../generated/prisma/index.js';
import { ApiError } from '../utils/apiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const Prisma = new PrismaClient();

export const createReport = asyncHandler(async (req, res) => {
  const { disasterId, content } = req.body;
  const file = req.file;

  if (!disasterId || !content || !file) {
    throw new ApiError(400, 'Missing required fields');
  }

  const report = await Prisma.report.create({
    data: {
      disasterId,
      content,
      imageUrl: file.path, // Assuming file.path contains the URL or path to the uploaded image
      ownerId: req.user.id, // Assuming req.user.id contains the ID of the user creating the report
    },
  });

  return res.status(201).json(new ApiResponse(200, report, 'Report created successfully'));
});

export const getReport = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id) {
    throw new ApiError(400, 'Report ID is required');
  }

  const report = await Prisma.report.findUnique({
    where: { id },
    include: {
      user: true, // Include user details if needed
      disaster: true, // Include disaster details if needed
    },
  });

  if (!report) {
    throw new ApiError(404, 'Report not found');
  }

  return res.status(200).json(new ApiResponse(200, report, 'Report retrieved successfully'));
});

export const updateReport = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;

  if (!id || !content) {
    throw new ApiError(400, 'Missing required fields');
  }

  const report = await Prisma.report.update({
    where: { id },
    data: { content },
  });

  return res.status(200).json(new ApiResponse(200, report, 'Report updated successfully'));
});

export const deleteReport = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id) {
    throw new ApiError(400, 'Report ID is required');
  }

  const report = await Prisma.report.delete({
    where: { id },
  });

  return res.status(200).json(new ApiResponse(200, report, 'Report deleted successfully'));
});
