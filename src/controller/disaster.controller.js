import { PrismaClient } from '../generated/prisma/index.js';
import { ApiError } from '../utils/apiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const Prisma = new PrismaClient();

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
    const { title, locationName, latitude, longitude, description, tags, auditTrail } = req.body;
    console.log(req.user.id);
    if (!title || !locationName || !latitude || !longitude || !description || !tags) {
      throw new ApiError(400, 'All fields are required');
    }
    const disaster = await Prisma.disaster.create({
      data: {
        title,
        ownerId: req.user.id,
        locationName,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        description,
        tags,
      },
    });
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
    res.status(200).json(new ApiResponse(200, updateDisaster, 'Disaster Updated'));
  } catch (error) {
    throw new ApiError(500, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to update disaster',
    });
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

/**
 * GET /api/disasters/:id/reports
 * Get all reports for a specific disaster
 */
// router.get('/:id/reports', async (req, res) => {
//   try {
//     const { reportModel } = await import('../models/index.js');

//     const reports = await reportModel.findByDisaster(req.params.id, {
//       limit: 50,
//       orderBy: { column: 'created_at', ascending: false },
//     });

//     res.json({
//       success: true,
//       data: reports,
//     });
//   } catch (error) {
//     logger.error('Error fetching disaster reports:', error);
//     res.status(500).json({
//       success: false,
//       error: 'Failed to fetch reports',
//     });
//   }
// });

// /**
//  * GET /api/disasters/:id/resources
//  * Get all resources for a specific disaster
//  */
// router.get('/:id/resources', async (req, res) => {
//   try {
//     const { resourceModel } = await import('../models/index.js');

//     const resources = await resourceModel.findByDisaster(req.params.id, {
//       limit: 100,
//       orderBy: { column: 'created_at', ascending: false },
//     });

//     res.json({
//       success: true,
//       data: resources,
//     });
//   } catch (error) {
//     logger.error('Error fetching disaster resources:', error);
//     res.status(500).json({
//       success: false,
//       error: 'Failed to fetch resources',
//     });
//   }
// });

// /**
//  * GET /api/disasters/statistics
//  * Get disaster statistics
//  */
// router.get('/statistics', async (req, res) => {
//   try {
//     const stats = await disasterModel.getStatistics();

//     res.json({
//       success: true,
//       data: stats,
//     });
//   } catch (error) {
//     logger.error('Error fetching disaster statistics:', error);
//     res.status(500).json({
//       success: false,
//       error: 'Failed to fetch statistics',
//     });
//   }
// });

// /**
//  * POST /api/disasters/:id/audit
//  * Add audit trail entry
//  */
// router.post('/:id/audit', async (req, res) => {
//   try {
//     const { action, user_id } = req.body;

//     if (!action || !user_id) {
//       return res.status(400).json({
//         success: false,
//         error: 'Action and user_id are required',
//       });
//     }

//     const updatedDisaster = await disasterModel.addAuditTrail(req.params.id, action, user_id);

//     res.json({
//       success: true,
//       data: updatedDisaster,
//       message: 'Audit trail updated successfully',
//     });
//   } catch (error) {
//     logger.error('Error adding audit trail:', error);
//     res.status(500).json({
//       success: false,
//       error: 'Failed to add audit trail',
//     });
//   }
// });
