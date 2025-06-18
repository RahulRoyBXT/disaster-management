import express from 'express';
import Joi from 'joi';
import { reportModel } from '../models/index.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Validation schemas
const createReportSchema = Joi.object({
  disaster_id: Joi.string().required(),
  user_id: Joi.string().required().min(1).max(100),
  content: Joi.string().optional().max(2000),
  image_url: Joi.string().uri().optional(),
  verification_status: Joi.string().valid('pending', 'verified', 'fake').default('pending'),
});

const updateReportSchema = Joi.object({
  content: Joi.string().optional().max(2000),
  image_url: Joi.string().uri().optional(),
  verification_status: Joi.string().valid('pending', 'verified', 'fake').optional(),
});

const querySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  disaster_id: Joi.string().optional(),
  user_id: Joi.string().optional(),
  verification_status: Joi.string().valid('pending', 'verified', 'fake').optional(),
  search: Joi.string().optional().max(200),
  include_disaster: Joi.boolean().default(false),
});

const verificationSchema = Joi.object({
  status: Joi.string().valid('pending', 'verified', 'fake').required(),
  verified_by: Joi.string().required().min(1).max(100),
});

/**
 * GET /api/reports
 * Get all reports with filtering and pagination
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

    const { page, limit, disaster_id, user_id, verification_status, search, include_disaster } =
      value;
    const offset = (page - 1) * limit;

    let reports;
    let total;

    // Search by content
    if (search) {
      reports = await reportModel.search(search, { limit, offset });
      // Get total count for search
      const allSearchResults = await reportModel.search(search);
      total = allSearchResults.length;
    }
    // Get reports with disaster information
    else if (include_disaster) {
      const filters = {};
      if (disaster_id) filters.disaster_id = disaster_id;
      if (user_id) filters.user_id = user_id;
      if (verification_status) filters.verification_status = verification_status;

      reports = await reportModel.findWithDisasterInfo(filters, {
        limit,
        offset,
        orderBy: { column: 'created_at', ascending: false },
      });

      total = await reportModel.count(filters);
    }
    // Regular filtered query
    else {
      const filters = {};
      if (disaster_id) filters.disaster_id = disaster_id;
      if (user_id) filters.user_id = user_id;
      if (verification_status) filters.verification_status = verification_status;

      reports = await reportModel.findAll(filters, {
        limit,
        offset,
        orderBy: { column: 'created_at', ascending: false },
      });

      total = await reportModel.count(filters);
    }

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: reports,
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
    logger.error('Error fetching reports:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch reports',
    });
  }
});

/**
 * GET /api/reports/:id
 * Get a specific report by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const report = await reportModel.findById(req.params.id);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found',
      });
    }

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    logger.error('Error fetching report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch report',
    });
  }
});

/**
 * POST /api/reports
 * Create a new report
 */
router.post('/', async (req, res) => {
  try {
    const { error, value } = createReportSchema.validate(req.body);
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

    const report = await reportModel.create(value);

    logger.info(
      `Created report: ${report.id} for disaster: ${value.disaster_id} by user: ${value.user_id}`
    );

    res.status(201).json({
      success: true,
      data: report,
      message: 'Report created successfully',
    });
  } catch (error) {
    logger.error('Error creating report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create report',
    });
  }
});

/**
 * PUT /api/reports/:id
 * Update a report
 */
router.put('/:id', async (req, res) => {
  try {
    const { error, value } = updateReportSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    const existingReport = await reportModel.findById(req.params.id);
    if (!existingReport) {
      return res.status(404).json({
        success: false,
        error: 'Report not found',
      });
    }

    const updatedReport = await reportModel.update(req.params.id, value);

    logger.info(`Updated report: ${req.params.id}`);

    res.json({
      success: true,
      data: updatedReport,
      message: 'Report updated successfully',
    });
  } catch (error) {
    logger.error('Error updating report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update report',
    });
  }
});

/**
 * DELETE /api/reports/:id
 * Delete a report
 */
router.delete('/:id', async (req, res) => {
  try {
    const report = await reportModel.findById(req.params.id);
    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found',
      });
    }

    await reportModel.delete(req.params.id);

    logger.info(`Deleted report: ${req.params.id}`);

    res.json({
      success: true,
      message: 'Report deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete report',
    });
  }
});

/**
 * PUT /api/reports/:id/verify
 * Update report verification status
 */
router.put('/:id/verify', async (req, res) => {
  try {
    const { error, value } = verificationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    const { status, verified_by } = value;

    const updatedReport = await reportModel.updateVerificationStatus(
      req.params.id,
      status,
      verified_by
    );

    logger.info(
      `Updated verification status for report ${req.params.id} to ${status} by ${verified_by}`
    );

    res.json({
      success: true,
      data: updatedReport,
      message: `Report ${status} successfully`,
    });
  } catch (error) {
    logger.error('Error updating report verification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update verification status',
    });
  }
});

/**
 * POST /api/reports/bulk-verify
 * Bulk update verification status for multiple reports
 */
router.post('/bulk-verify', async (req, res) => {
  try {
    const schema = Joi.object({
      report_ids: Joi.array().items(Joi.string()).required().min(1),
      status: Joi.string().valid('pending', 'verified', 'fake').required(),
      verified_by: Joi.string().required().min(1).max(100),
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    const { report_ids, status, verified_by } = value;

    const updatedReports = await reportModel.bulkUpdateVerificationStatus(
      report_ids,
      status,
      verified_by
    );

    logger.info(`Bulk updated ${report_ids.length} reports to ${status} by ${verified_by}`);

    res.json({
      success: true,
      data: updatedReports,
      message: `${report_ids.length} reports ${status} successfully`,
    });
  } catch (error) {
    logger.error('Error bulk updating report verification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to bulk update verification status',
    });
  }
});

/**
 * GET /api/reports/statistics
 * Get report statistics
 */
router.get('/statistics', async (req, res) => {
  try {
    const { disaster_id } = req.query;
    const stats = await reportModel.getStatistics(disaster_id);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Error fetching report statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
    });
  }
});

/**
 * GET /api/reports/pending-verification
 * Get reports pending verification
 */
router.get('/pending-verification', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const pendingReports = await reportModel.getPendingVerification(parseInt(limit));

    res.json({
      success: true,
      data: pendingReports,
      count: pendingReports.length,
    });
  } catch (error) {
    logger.error('Error fetching pending verification reports:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending reports',
    });
  }
});

/**
 * GET /api/reports/by-user/:userId
 * Get all reports by a specific user
 */
router.get('/by-user/:userId', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const reports = await reportModel.findByUser(req.params.userId, {
      limit: parseInt(limit),
      offset,
    });

    const total = await reportModel.count({ user_id: req.params.userId });
    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      data: reports,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1,
      },
    });
  } catch (error) {
    logger.error('Error fetching user reports:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user reports',
    });
  }
});

export default router;
