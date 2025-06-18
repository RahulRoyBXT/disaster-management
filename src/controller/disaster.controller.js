import { asyncHandler } from '../utils/asyncHandler.js';
import {
  createDisasterSchema,
  querySchema,
  updateDisasterSchema,
} from '../validation/disaster.validation.js';

export const getAllDisasters = asyncHandler(async (req, res) => {
  try {
    const { error, value } = querySchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    const { page, limit, owner_id, tags, search, lat, lng, radius } = value;
    const offset = (page - 1) * limit;

    let disasters;
    let total;

    // Geographic search
    if (lat && lng) {
      disasters = await disasterModel.findNearby(lat, lng, radius);
      total = disasters.length;

      // Apply pagination to nearby results
      disasters = disasters.slice(offset, offset + limit);
    }
    // Tag-based search
    else if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim());
      disasters = await disasterModel.findByTags(tagArray);
      total = disasters.length;

      // Apply pagination
      disasters = disasters.slice(offset, offset + limit);
    }
    // Text search
    else if (search) {
      disasters = await disasterModel.search(search);
      total = disasters.length;

      // Apply pagination
      disasters = disasters.slice(offset, offset + limit);
    }
    // Regular filtered query
    else {
      const filters = {};
      if (owner_id) filters.owner_id = owner_id;

      disasters = await disasterModel.findAll(filters, {
        limit,
        offset,
        orderBy: { column: 'created_at', ascending: false },
      });

      total = await disasterModel.count(filters);
    }

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: disasters,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    logger.error('Error fetching disasters:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch disasters',
    });
  }
});

export const getDisasterById = asyncHandler(async (req, res) => {
  try {
    const disaster = await disasterModel.findById(req.params.id);

    if (!disaster) {
      return res.status(404).json({
        success: false,
        error: 'Disaster not found',
      });
    }

    res.json({
      success: true,
      data: disaster,
    });
  } catch (error) {
    logger.error('Error fetching disaster:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch disaster',
    });
  }
});

// Create Disaster
export const createDisaster = asyncHandler(async (req, res) => {
  try {
    const { error, value } = createDisasterSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    const disaster = await disasterModel.createWithLocation(value);

    // Add initial audit trail entry
    await disasterModel.addAuditTrail(disaster.id, 'created', value.owner_id);

    logger.info(`Created disaster: ${disaster.title} by ${value.owner_id}`);

    res.status(201).json({
      success: true,
      data: disaster,
      message: 'Disaster created successfully',
    });
  } catch (error) {
    logger.error('Error creating disaster:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create disaster',
    });
  }
});

// Update a disaster

export const updateDisaster = asyncHandler(async (req, res) => {
  try {
    const { error, value } = updateDisasterSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    // Check if disaster exists
    const existingDisaster = await disasterModel.findById(req.params.id);
    if (!existingDisaster) {
      return res.status(404).json({
        success: false,
        error: 'Disaster not found',
      });
    }

    // Prepare update data
    let updateData = { ...value };

    // Handle location update
    if (value.latitude && value.longitude) {
      updateData.location = `POINT(${value.longitude} ${value.latitude})`;
      delete updateData.latitude;
      delete updateData.longitude;
    }

    const updatedDisaster = await disasterModel.update(req.params.id, updateData);

    // Add audit trail entry
    await disasterModel.addAuditTrail(req.params.id, 'updated', req.body.updated_by || 'system');

    logger.info(`Updated disaster: ${req.params.id}`);

    res.json({
      success: true,
      data: updatedDisaster,
      message: 'Disaster updated successfully',
    });
  } catch (error) {
    logger.error('Error updating disaster:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update disaster',
    });
  }
});

// Delete a disaster

export const deleteDisaster = asyncHandler(async (req, res) => {
  try {
    const disaster = await disasterModel.findById(req.params.id);
    if (!disaster) {
      return res.status(404).json({
        success: false,
        error: 'Disaster not found',
      });
    }

    await disasterModel.delete(req.params.id);

    logger.info(`Deleted disaster: ${req.params.id}`);

    res.json({
      success: true,
      message: 'Disaster deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting disaster:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete disaster',
    });
  }
});

/**
 * GET /api/disasters/:id/reports
 * Get all reports for a specific disaster
 */
router.get('/:id/reports', async (req, res) => {
  try {
    const { reportModel } = await import('../models/index.js');

    const reports = await reportModel.findByDisaster(req.params.id, {
      limit: 50,
      orderBy: { column: 'created_at', ascending: false },
    });

    res.json({
      success: true,
      data: reports,
    });
  } catch (error) {
    logger.error('Error fetching disaster reports:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch reports',
    });
  }
});

/**
 * GET /api/disasters/:id/resources
 * Get all resources for a specific disaster
 */
router.get('/:id/resources', async (req, res) => {
  try {
    const { resourceModel } = await import('../models/index.js');

    const resources = await resourceModel.findByDisaster(req.params.id, {
      limit: 100,
      orderBy: { column: 'created_at', ascending: false },
    });

    res.json({
      success: true,
      data: resources,
    });
  } catch (error) {
    logger.error('Error fetching disaster resources:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch resources',
    });
  }
});

/**
 * GET /api/disasters/statistics
 * Get disaster statistics
 */
router.get('/statistics', async (req, res) => {
  try {
    const stats = await disasterModel.getStatistics();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Error fetching disaster statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
    });
  }
});

/**
 * POST /api/disasters/:id/audit
 * Add audit trail entry
 */
router.post('/:id/audit', async (req, res) => {
  try {
    const { action, user_id } = req.body;

    if (!action || !user_id) {
      return res.status(400).json({
        success: false,
        error: 'Action and user_id are required',
      });
    }

    const updatedDisaster = await disasterModel.addAuditTrail(req.params.id, action, user_id);

    res.json({
      success: true,
      data: updatedDisaster,
      message: 'Audit trail updated successfully',
    });
  } catch (error) {
    logger.error('Error adding audit trail:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add audit trail',
    });
  }
});

export default router;
