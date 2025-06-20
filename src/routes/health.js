import express from 'express';
import { testConnection } from '../config/database.js';
import { PrismaClient } from '../generated/prisma/index.js';
import cacheService from '../services/cacheService.js';
import cacheTestService from '../services/cacheTestService.js';
import { logger } from '../utils/logger.js';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/', async (req, res) => {
  try {
    const startTime = Date.now();

    // Test database connection
    const dbConnected = await testConnection(); // Get basic statistics
    const [disasterCount, reportCount, resourceCount, cacheStats] = await Promise.all([
      prisma.disaster.count().catch(() => 0),
      prisma.report.count().catch(() => 0),
      prisma.resource.count().catch(() => 0),
      prisma.cache
        .aggregate({
          _count: { key: true },
          _sum: { access_count: true },
          _avg: { access_count: true },
        })
        .catch(() => ({
          _count: { key: 0 },
          _sum: { access_count: 0 },
          _avg: { access_count: 0 },
        })),
    ]);

    const responseTime = Date.now() - startTime;

    // Format cache stats in a more readable way
    const formattedCacheStats = {
      total: cacheStats._count?.key || 0,
      active: cacheStats._count?.key || 0, // We'll calculate active vs expired in a more complete implementation
      totalAccesses: cacheStats._sum?.access_count || 0,
      averageAccesses: cacheStats._avg?.access_count || 0,
    };

    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      responseTime: `${responseTime}ms`,
      database: {
        connected: dbConnected,
        statistics: {
          disasters: disasterCount,
          reports: reportCount,
          resources: resourceCount,
          cache: formattedCacheStats,
        },
      },
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        memoryUsage: {
          ...process.memoryUsage(),
          formatted: {
            rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
            heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
          },
        },
      },
    };

    // If database is not connected, return 503
    if (!dbConnected) {
      return res.status(503).json({
        ...healthData,
        status: 'unhealthy',
        error: 'Database connection failed',
      });
    }

    res.json(healthData);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

/**
 * GET /api/health/database
 * Detailed database health check
 */
router.get('/database', async (req, res) => {
  try {
    const startTime = Date.now(); // Test each table individually
    const tableTests = await Promise.allSettled([
      prisma.disaster.count(),
      prisma.report.count(),
      prisma.resource.count(),
      prisma.cache.count(),
    ]);

    const responseTime = Date.now() - startTime;

    const tableStatus = {
      disasters: tableTests[0].status === 'fulfilled' ? 'healthy' : 'error',
      reports: tableTests[1].status === 'fulfilled' ? 'healthy' : 'error',
      resources: tableTests[2].status === 'fulfilled' ? 'healthy' : 'error',
      cache: tableTests[3].status === 'fulfilled' ? 'healthy' : 'error',
    };

    const allHealthy = Object.values(tableStatus).every(status => status === 'healthy');

    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      tables: tableStatus,
      counts: {
        disasters: tableTests[0].status === 'fulfilled' ? tableTests[0].value : 0,
        reports: tableTests[1].status === 'fulfilled' ? tableTests[1].value : 0,
        resources: tableTests[2].status === 'fulfilled' ? tableTests[2].value : 0,
        cache: tableTests[3].status === 'fulfilled' ? tableTests[3].value : 0,
      },
      errors: tableTests
        .map((test, index) => ({
          table: ['disasters', 'reports', 'resources', 'cache'][index],
          error: test.status === 'rejected' ? test.reason.message : null,
        }))
        .filter(item => item.error),
    });
  } catch (error) {
    logger.error('Database health check failed:', error);
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

/**
 * GET /api/health/cache
 * Cache system health check and cleanup
 */
router.get('/cache', async (req, res) => {
  try {
    const startTime = Date.now(); // Clean expired cache entries
    const cleanedCount = await prisma.cache
      .deleteMany({
        where: {
          expires_at: {
            lt: new Date(),
          },
        },
      })
      .then(result => result.count)
      .catch(() => 0);

    // Get cache statistics
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

    // Check if TTL is working properly (only if requested)
    let ttlTestResult = null;
    if (req.query.ttl_test === 'true') {
      ttlTestResult = await cacheTestService.testCacheTTL(5); // 5-second TTL
    }

    const responseTime = Date.now() - startTime;

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      statistics: stats,
      cleanedExpiredEntries: cleanedCount,
      operations_test: {
        set: setResult,
        get: getValue !== null,
        value_integrity: valueMatches,
        delete: true,
      },
      ttl_test: ttlTestResult,
    });
  } catch (error) {
    logger.error('Cache health check failed:', error);
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

/**
 * POST /api/health/cache/clear
 * Clear all cache entries (admin endpoint)
 */
router.post('/cache/clear', async (req, res) => {
  try {
    const cleared = await prisma.cache
      .deleteMany()
      .then(() => true)
      .catch(() => false);

    if (cleared) {
      res.json({
        success: true,
        message: 'Cache cleared successfully',
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to clear cache',
      });
    }
  } catch (error) {
    logger.error('Cache clear failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/health/cache/ttl-test
 * Run a full TTL test to verify cache expiration works correctly
 */
router.get('/cache/ttl-test', async (req, res) => {
  try {
    const ttlSeconds = parseInt(req.query.ttl) || 10;

    // Start the test
    const result = await cacheTestService.testCacheTTL(ttlSeconds);

    res.json({
      success: result.test_results.success,
      test_key: result.test_key,
      ttl_seconds: result.ttl_seconds,
      test_results: result.test_results,
      created_at: result.created_at,
      checked_at: result.checked_at,
      message: result.test_results.success
        ? 'TTL expiration is working correctly'
        : 'TTL expiration test failed',
    });
  } catch (error) {
    logger.error('Cache TTL test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Cache TTL test failed',
    });
  }
});

export default router;
