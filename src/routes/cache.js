import express from 'express';
import { z } from 'zod';
import { validateRequest } from '../middleware/validation.middleware.js';
import { verifyJWT } from '../middleware/verifyToken.middleware.js';
import cacheMonitorService from '../services/cacheMonitorService.js';
import cacheService from '../services/cacheService.js';
import cacheTestingService from '../services/cacheTestingService.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Apply auth middleware for admin routes
router.use('/admin', verifyJWT);

// Validation schemas
const setCacheSchema = z.object({
  key: z.string().min(1).max(255),
  value: z.any(),
  ttl: z.number().int().min(1).max(86400).default(3600), // 1 second to 24 hours
});

const getCacheSchema = z.object({
  keys: z.union([z.string(), z.array(z.string())]).optional(),
});

const deleteCacheSchema = z.object({
  keys: z.union([z.string(), z.array(z.string()).min(1)]),
});

const ttlTestSchema = z.object({
  ttl: z.number().int().min(5).max(60).default(10),
});

/**
 * GET /api/cache
 * Get cache statistics or specific cache entries
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    try {
      const { keys } = req.query;

      // If no keys specified, return cache statistics
      if (!keys) {
        const stats = await cacheService.getStats();

        return res.status(200).json(
          new ApiResponse(
            200,
            {
              statistics: stats,
              message: 'Use ?keys=key1,key2 to get specific cache entries',
            },
            'Cache statistics retrieved'
          )
        );
      }

      // Handle multiple keys
      const keyArray = Array.isArray(keys) ? keys : keys.split(',').map(k => k.trim());
      const results = {};

      for (const key of keyArray) {
        try {
          const value = await cacheService.get(key);
          results[key] = value;
        } catch (error) {
          results[key] = null;
          logger.warn(`Failed to get cache key ${key}:`, error);
        }
      }

      return res.status(200).json(new ApiResponse(200, results, 'Cache entries retrieved'));
    } catch (error) {
      logger.error('Error fetching cache:', error);
      return res.status(500).json(new ApiResponse(500, null, 'Failed to fetch cache data'));
    }
  })
);

/**
 * GET /api/cache/:key
 * Get a specific cache entry by key
 */
router.get(
  '/:key',
  asyncHandler(async (req, res) => {
    try {
      const { key } = req.params;
      const value = await cacheService.get(key);

      if (value === null) {
        return res.status(404).json(new ApiResponse(404, null, 'Cache key not found or expired'));
      }

      return res.status(200).json(
        new ApiResponse(
          200,
          {
            key,
            value,
            retrieved_at: new Date().toISOString(),
          },
          'Cache entry retrieved'
        )
      );
    } catch (error) {
      logger.error('Error fetching cache key:', error);
      return res.status(500).json(new ApiResponse(500, null, 'Failed to fetch cache entry'));
    }
  })
);

/**
 * POST /api/cache
 * Set cache entries
 */
router.post(
  '/',
  validateRequest(setCacheSchema),
  asyncHandler(async (req, res) => {
    try {
      // Handle both single entry and batch operations
      if (Array.isArray(req.body)) {
        // Batch operation
        const entries = req.body;
        const results = [];

        for (const entry of entries) {
          try {
            const success = await cacheService.set(entry.key, entry.value, entry.ttl);
            results.push({
              key: entry.key,
              success: success,
            });
          } catch (error) {
            results.push({
              key: entry.key,
              success: false,
              error: error.message,
            });
          }
        }

        return res
          .status(200)
          .json(new ApiResponse(200, { results }, 'Batch cache operation completed'));
      } else {
        // Single entry
        const { key, value, ttl } = req.body;
        const success = await cacheService.set(key, value, ttl);

        if (!success) {
          return res.status(500).json(new ApiResponse(500, null, 'Failed to set cache entry'));
        }

        return res.status(200).json(
          new ApiResponse(
            200,
            {
              key,
              ttl,
              expires_at: new Date(Date.now() + ttl * 1000).toISOString(),
            },
            'Cache entry set successfully'
          )
        );
      }
    } catch (error) {
      logger.error('Error setting cache:', error);
      return res.status(500).json(new ApiResponse(500, null, 'Failed to set cache entry'));
    }
  })
);

/**
 * DELETE /api/cache/:key
 * Delete a specific cache entry
 */
router.delete(
  '/:key',
  asyncHandler(async (req, res) => {
    try {
      const { key } = req.params;
      const success = await cacheService.delete(key);

      if (!success) {
        return res
          .status(404)
          .json(new ApiResponse(404, null, 'Cache key not found or already expired'));
      }

      return res
        .status(200)
        .json(new ApiResponse(200, { key }, 'Cache entry deleted successfully'));
    } catch (error) {
      logger.error('Error deleting cache key:', error);
      return res.status(500).json(new ApiResponse(500, null, 'Failed to delete cache entry'));
    }
  })
);

/**
 * POST /api/cache/admin/clean-expired
 * Clean all expired cache entries (admin only)
 */
router.post(
  '/admin/clean-expired',
  asyncHandler(async (req, res) => {
    try {
      const count = await cacheService.cleanExpired();
      return res
        .status(200)
        .json(
          new ApiResponse(200, { deleted_count: count }, `Cleaned ${count} expired cache entries`)
        );
    } catch (error) {
      logger.error('Error cleaning expired cache:', error);
      return res
        .status(500)
        .json(new ApiResponse(500, null, 'Failed to clean expired cache entries'));
    }
  })
);

/**
 * POST /api/cache/admin/test-ttl
 * Test cache TTL by creating a test entry with a short TTL (admin only)
 */
router.post(
  '/admin/test-ttl',
  validateRequest(ttlTestSchema),
  asyncHandler(async (req, res) => {
    try {
      const { ttl } = req.body;
      const testKey = `cache_test_${Date.now()}`;
      const testValue = {
        message: 'This is a test cache entry',
        created_at: new Date().toISOString(),
        ttl_seconds: ttl,
      };

      // Set the cache entry with the specified TTL
      await cacheService.set(testKey, testValue, ttl);

      return res.status(200).json(
        new ApiResponse(
          200,
          {
            key: testKey,
            value: testValue,
            ttl,
            expires_at: new Date(Date.now() + ttl * 1000).toISOString(),
            instructions: `Check this key in ${ttl} seconds to verify it has expired.`,
          },
          'TTL test initiated'
        )
      );
    } catch (error) {
      logger.error('Error testing cache TTL:', error);
      return res.status(500).json(new ApiResponse(500, null, 'Failed to test cache TTL'));
    }
  })
);

/**
 * POST /api/cache/admin/monitor/start
 * Start cache monitoring (admin only)
 */
router.post(
  '/admin/monitor/start',
  asyncHandler(async (req, res) => {
    try {
      const { interval } = req.body;
      cacheMonitorService.start(interval);

      return res.status(200).json(
        new ApiResponse(
          200,
          {
            monitoring_status: 'active',
            interval: cacheMonitorService.interval,
          },
          'Cache monitoring started'
        )
      );
    } catch (error) {
      logger.error('Error starting cache monitoring:', error);
      return res.status(500).json(new ApiResponse(500, null, 'Failed to start cache monitoring'));
    }
  })
);

/**
 * POST /api/cache/admin/monitor/stop
 * Stop cache monitoring (admin only)
 */
router.post(
  '/admin/monitor/stop',
  asyncHandler(async (req, res) => {
    try {
      cacheMonitorService.stop();

      return res.status(200).json(
        new ApiResponse(
          200,
          {
            monitoring_status: 'inactive',
          },
          'Cache monitoring stopped'
        )
      );
    } catch (error) {
      logger.error('Error stopping cache monitoring:', error);
      return res.status(500).json(new ApiResponse(500, null, 'Failed to stop cache monitoring'));
    }
  })
);

/**
 * GET /api/cache/admin/monitor/status
 * Get cache monitoring status and data (admin only)
 */
router.get(
  '/admin/monitor/status',
  asyncHandler(async (req, res) => {
    try {
      const options = {
        includeHistory: req.query.history !== 'false',
        historyHours: parseInt(req.query.history_hours) || 24,
        includeCurrentStats: req.query.current_stats !== 'false',
        includeRealTimeMetrics: req.query.real_time_metrics !== 'false',
      };

      const monitoringData = await cacheMonitorService.getMonitoringData(options);

      return res
        .status(200)
        .json(new ApiResponse(200, monitoringData, 'Cache monitoring data retrieved'));
    } catch (error) {
      logger.error('Error getting cache monitoring status:', error);
      return res
        .status(500)
        .json(new ApiResponse(500, null, 'Failed to get cache monitoring status'));
    }
  })
);

/**
 * GET /api/cache/admin/monitor/recommendations
 * Get cache optimization recommendations (admin only)
 */
router.get(
  '/admin/monitor/recommendations',
  asyncHandler(async (req, res) => {
    try {
      const recommendations = await cacheMonitorService.generateRecommendations();

      return res
        .status(200)
        .json(
          new ApiResponse(200, { recommendations }, 'Cache optimization recommendations generated')
        );
    } catch (error) {
      logger.error('Error generating cache recommendations:', error);
      return res
        .status(500)
        .json(new ApiResponse(500, null, 'Failed to generate cache recommendations'));
    }
  })
);

/**
 * POST /api/cache/admin/test/ttl
 * Run a comprehensive TTL test (admin only)
 */
router.post(
  '/admin/test/ttl',
  asyncHandler(async (req, res) => {
    try {
      const options = {
        shortTTL: parseInt(req.body.short_ttl) || 10,
        mediumTTL: parseInt(req.body.medium_ttl) || 30,
        longTTL: parseInt(req.body.long_ttl) || 60,
        checkInterval: parseInt(req.body.check_interval) || 5,
      };

      // Return immediately with a job ID
      const testId = Date.now().toString();

      // Start the test in the background
      res.status(202).json(
        new ApiResponse(
          202,
          {
            test_id: testId,
            options,
            status: 'running',
            check_status_url: `/api/cache/admin/test/status?test_id=${testId}`,
          },
          'TTL test started'
        )
      );

      // Run the test asynchronously
      cacheTestingService
        .runComprehensiveTTLTest(options)
        .then(results => {
          logger.info(`TTL test completed: ${testId}`, { success: results.success });
        })
        .catch(error => {
          logger.error(`TTL test failed: ${testId}`, error);
        });
    } catch (error) {
      logger.error('Error starting TTL test:', error);
      return res.status(500).json(new ApiResponse(500, null, 'Failed to start TTL test'));
    }
  })
);

/**
 * POST /api/cache/admin/test/performance
 * Run a cache performance test (admin only)
 */
router.post(
  '/admin/test/performance',
  asyncHandler(async (req, res) => {
    try {
      const options = {
        writeCount: parseInt(req.body.write_count) || 100,
        readCount: parseInt(req.body.read_count) || 100,
        payloadSizeBytes: parseInt(req.body.payload_size_bytes) || 1024,
        randomAccess: req.body.random_access !== 'false',
      };

      // Return immediately with a job ID
      const testId = Date.now().toString();

      // Start the test in the background
      res.status(202).json(
        new ApiResponse(
          202,
          {
            test_id: testId,
            options,
            status: 'running',
            check_status_url: `/api/cache/admin/test/status?test_id=${testId}`,
          },
          'Performance test started'
        )
      );

      // Run the test asynchronously
      cacheTestingService
        .testPerformance(options)
        .then(results => {
          logger.info(`Performance test completed: ${testId}`);
        })
        .catch(error => {
          logger.error(`Performance test failed: ${testId}`, error);
        });
    } catch (error) {
      logger.error('Error starting performance test:', error);
      return res.status(500).json(new ApiResponse(500, null, 'Failed to start performance test'));
    }
  })
);

/**
 * POST /api/cache/admin/test/cleanup
 * Clean up test data (admin only)
 */
router.post(
  '/admin/test/cleanup',
  asyncHandler(async (req, res) => {
    try {
      const testId = req.body.test_id || null;
      const result = await cacheTestingService.cleanupTestData(testId);

      return res
        .status(200)
        .json(
          new ApiResponse(200, result, `Cleaned up ${result.deleted_count} test cache entries`)
        );
    } catch (error) {
      logger.error('Error cleaning up test data:', error);
      return res.status(500).json(new ApiResponse(500, null, 'Failed to clean up test data'));
    }
  })
);

export default router;
