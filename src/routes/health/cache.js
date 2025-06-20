import express from 'express';
import cacheService from '../services/cacheService.js';
import cacheTestService from '../services/cacheTestService.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/v1/health/cache
 * Check cache health status
 */
router.get(
  '/cache',
  asyncHandler(async (req, res) => {
    try {
      // Get cache stats
      const stats = await cacheService.getStats();

      // Test basic cache operations
      const testKey = `health_check_${Date.now()}`;
      const testValue = { message: 'Health check test', timestamp: new Date().toISOString() };

      // Test set operation
      const setResult = await cacheService.set(testKey, testValue, 60);

      // Test get operation
      const getValue = await cacheService.get(testKey);

      // Test if retrieved value matches
      const valueMatches = JSON.stringify(getValue) === JSON.stringify(testValue);

      // Clean up test key
      await cacheService.delete(testKey);

      // Check if TTL is working properly
      const ttlTestResult = await cacheTestService.testCacheTTL(5); // 5-second TTL

      return res.status(200).json(
        new ApiResponse(
          200,
          {
            cache_status: 'online',
            operations_test: {
              set: setResult,
              get: getValue !== null,
              value_integrity: valueMatches,
              delete: true,
            },
            ttl_test: ttlTestResult,
            stats: {
              total_entries: stats.total_entries,
              active_entries: stats.active_entries,
              expired_entries: stats.expired_entries,
              hit_ratio: stats.hit_ratio,
            },
            timestamp: new Date().toISOString(),
          },
          'Cache health check completed'
        )
      );
    } catch (error) {
      logger.error('Cache health check failed:', error);

      return res.status(500).json(
        new ApiResponse(
          500,
          {
            cache_status: 'error',
            error: error.message,
            timestamp: new Date().toISOString(),
          },
          'Cache health check failed'
        )
      );
    }
  })
);

export default router;
