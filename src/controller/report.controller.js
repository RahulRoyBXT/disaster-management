import { PrismaClient } from '../generated/prisma/index.js';
import { ApiError } from '../utils/apiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const Prisma = new PrismaClient();

// TODO: check all controller

export const getAllReports = asyncHandler(async (req, res) => {
  const reports = await Prisma.report.findMany({
    where: {},
    include: {
      user: true,
      disaster: true,
    },
  });

  if (!reports || reports.length === 0) {
    throw new ApiError(404, 'No reports found');
  }

  return res.status(200).json(new ApiResponse(200, reports, 'Reports retrieved successfully'));
});

export const createReport = asyncHandler(async (req, res) => {
  // Get validated data from middleware
  const { disasterId, content, imageURL } = req.validatedData || req.body;
  // const file = req.file;

  // if (!file) {
  //   throw new ApiError(400, 'Image file is required');
  // }

  const report = await Prisma.report.create({
    data: {
      content,
      imageUrl: imageURL, // Assuming file.path contains the URL or path to the uploaded image
      disaster: {
        connect: { id: disasterId }, // Connect the report to the disaster
      },
      user: {
        connect: { id: req.user.id }, // Connect the report to the user
      },
    },
  });

  return res.status(201).json(new ApiResponse(200, report, 'Report created successfully'));
});

export const getReport = asyncHandler(async (req, res) => {
  // Get validated params from middleware
  const { id } = req.validatedParams || req.params;

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
  // Get validated data and params from middleware
  const { id } = req.validatedParams || req.params;
  const { content, imageUrl, locationName, title } = req.validatedData || req.body;

  const report = await Prisma.report.update({
    where: { id },
    data: { content, imageUrl, locationName, title },
  });

  return res.status(200).json(new ApiResponse(200, report, 'Report updated successfully'));
});

export const deleteReport = asyncHandler(async (req, res) => {
  // Get validated params from middleware
  const { id } = req.validatedParams || req.params;

  const report = await Prisma.report.delete({
    where: { id },
  });

  return res.status(200).json(new ApiResponse(200, report, 'Report deleted successfully'));
});
