import express from 'express';
import Joi from 'joi';
import { resourceModel } from '../models/index.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Validation schemas
const createResourceSchema = Joi.object({
  disaster_id: Joi.string().required(),
  name: Joi.string().required().min(1).max(200),
  location_name: Joi.string().optional().max(500),
  latitude: Joi.number().optional().min(-90).max(90),
  longitude: Joi.number().optional().min(-180).max(180),
  type: Joi.string().optional().max(100),
});

const updateResourceSchema = Joi.object({
  name: Joi.string().optional().min(1).max(200),
  location_name: Joi.string().optional().max(500),
  latitude: Joi.number().optional().min(-90).max(90),
  longitude: Joi.number().optional().min(-180).max(180),
  type: Joi.string().optional().max(100),
});

const querySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  disaster_id: Joi.string().optional(),
  type: Joi.string().optional(),
  search: Joi.string().optional().max(200),
  lat: Joi.number().optional().min(-90).max(90),
  lng: Joi.number().optional().min(-180).max(180),
  radius: Joi.number().optional().min(100).max(100000).default(10000), // meters
  include_disaster: Joi.boolean().default(false),
});

/**
 * GET /api/resources
 * Get all resources with filtering and pagination
 */
router.get('/', async (req, res) => {
  try {
    const { error, value } = querySchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    const { page, limit, disaster_id, type, search, lat, lng, radius, include_disaster } = value;
    const offset = (page - 1) * limit;

    let resources;
    let total;

    // Geographic search
    if (lat && lng) {
      resources = await resourceModel.findNearby(lat, lng, radius, type);
      total = resources.length;

      // Apply pagination to nearby results
      resources = resources.slice(offset, offset + limit);
    }
    // Text search
    else if (search) {
      resources = await resourceModel.search(search, { limit, offset });
      const allSearchResults = await resourceModel.search(search);
      total = allSearchResults.length;
    }
    // Get resources with disaster information
    else if (include_disaster) {
      const filters = {};
      if (disaster_id) filters.disaster_id = disaster_id;
      if (type) filters.type = type;

      resources = await resourceModel.findWithDisasterInfo(filters, {
        limit,
        offset,
        orderBy: { column: 'created_at', ascending: false },
      });

      total = await resourceModel.count(filters);
    }
    // Regular filtered query
    else {
      const filters = {};
      if (disaster_id) filters.disaster_id = disaster_id;
      if (type) filters.type = type;

      resources = await resourceModel.findAll(filters, {
        limit,
        offset,
        orderBy: { column: 'created_at', ascending: false },
      });

      total = await resourceModel.count(filters);
    }

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: resources,
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
    logger.error('Error fetching resources:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch resources',
    });
  }
});

/**
 * GET /api/resources/:id
 * Get a specific resource by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const resource = await resourceModel.findById(req.params.id);

    if (!resource) {
      return res.status(404).json({
        success: false,
        error: 'Resource not found',
      });
    }

    res.json({
      success: true,
      data: resource,
    });
  } catch (error) {
    logger.error('Error fetching resource:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch resource',
    });
  }
});

/**
 * POST /api/resources
 * Create a new resource
 */
router.post('/', async (req, res) => {
  try {
    const { error, value } = createResourceSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    // Verify disaster exists
    const { disasterModel } = await import('../models/index.js');
    const disaster = await disasterModel.findById(value.disaster_id);
    if (!disaster) {
      return res.status(404).json({
        success: false,
        error: 'Disaster not found',
      });
    }

    const resource = await resourceModel.createWithLocation(value);

    logger.info(`Created resource: ${resource.name} for disaster: ${value.disaster_id}`);

    res.status(201).json({
      success: true,
      data: resource,
      message: 'Resource created successfully',
    });
  } catch (error) {
    logger.error('Error creating resource:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create resource',
    });
  }
});

/**
 * PUT /api/resources/:id
 * Update a resource
 */
router.put('/:id', async (req, res) => {
  try {
    const { error, value } = updateResourceSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    const existingResource = await resourceModel.findById(req.params.id);
    if (!existingResource) {
      return res.status(404).json({
        success: false,
        error: 'Resource not found',
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

    const updatedResource = await resourceModel.update(req.params.id, updateData);

    logger.info(`Updated resource: ${req.params.id}`);

    res.json({
      success: true,
      data: updatedResource,
      message: 'Resource updated successfully',
    });
  } catch (error) {
    logger.error('Error updating resource:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update resource',
    });
  }
});

/**
 * DELETE /api/resources/:id
 * Delete a resource
 */
router.delete('/:id', async (req, res) => {
  try {
    const resource = await resourceModel.findById(req.params.id);
    if (!resource) {
      return res.status(404).json({
        success: false,
        error: 'Resource not found',
      });
    }

    await resourceModel.delete(req.params.id);

    logger.info(`Deleted resource: ${req.params.id}`);

    res.json({
      success: true,
      message: 'Resource deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting resource:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete resource',
    });
  }
});

/**
 * GET /api/resources/types
 * Get all available resource types
 */
router.get('/types', async (req, res) => {
  try {
    const types = await resourceModel.getResourceTypes();

    res.json({
      success: true,
      data: types,
    });
  } catch (error) {
    logger.error('Error fetching resource types:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch resource types',
    });
  }
});

/**
 * GET /api/resources/statistics
 * Get resource statistics
 */
router.get('/statistics', async (req, res) => {
  try {
    const { disaster_id } = req.query;
    const stats = await resourceModel.getStatistics(disaster_id);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Error fetching resource statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
    });
  }
});

/**
 * GET /api/resources/nearby
 * Find nearby resources (alternative endpoint with explicit naming)
 */
router.get('/nearby', async (req, res) => {
  try {
    const schema = Joi.object({
      lat: Joi.number().required().min(-90).max(90),
      lng: Joi.number().required().min(-180).max(180),
      radius: Joi.number().optional().min(100).max(100000).default(10000),
      type: Joi.string().optional(),
      limit: Joi.number().integer().min(1).max(100).default(20),
    });

    const { error, value } = schema.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    const { lat, lng, radius, type, limit } = value;

    const nearbyResources = await resourceModel.findNearby(lat, lng, radius, type);

    // Apply limit
    const limitedResources = nearbyResources.slice(0, limit);

    res.json({
      success: true,
      data: limitedResources,
      total: nearbyResources.length,
      search: {
        latitude: lat,
        longitude: lng,
        radius: `${radius}m`,
        type: type || 'all',
      },
    });
  } catch (error) {
    logger.error('Error finding nearby resources:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to find nearby resources',
    });
  }
});

/**
 * GET /api/resources/by-disaster/:disasterId
 * Get all resources for a specific disaster
 */
router.get('/by-disaster/:disasterId', async (req, res) => {
  try {
    const { type } = req.query;

    let resources;
    if (type) {
      resources = await resourceModel.getByDisasterAndType(req.params.disasterId, type);
    } else {
      resources = await resourceModel.findByDisaster(req.params.disasterId);
    }

    res.json({
      success: true,
      data: resources,
      count: resources.length,
    });
  } catch (error) {
    logger.error('Error fetching disaster resources:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch disaster resources',
    });
  }
});

/**
 * PUT /api/resources/:id/location
 * Update resource location
 */
router.put('/:id/location', async (req, res) => {
  try {
    const schema = Joi.object({
      latitude: Joi.number().required().min(-90).max(90),
      longitude: Joi.number().required().min(-180).max(180),
      location_name: Joi.string().optional().max(500),
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    const { latitude, longitude, location_name } = value;

    const updatedResource = await resourceModel.updateLocation(
      req.params.id,
      latitude,
      longitude,
      location_name
    );

    logger.info(`Updated location for resource: ${req.params.id}`);

    res.json({
      success: true,
      data: updatedResource,
      message: 'Resource location updated successfully',
    });
  } catch (error) {
    logger.error('Error updating resource location:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update resource location',
    });
  }
});

export default router;
