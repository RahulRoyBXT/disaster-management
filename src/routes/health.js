import express from 'express';
import { testConnection } from '../config/database.js';
import { disasterModel, reportModel, resourceModel, cacheModel } from '../models/index.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/', async (req, res) => {
  try {
    const startTime = Date.now();

    // Test database connection
    const dbConnected = await testConnection();

    // Get basic statistics
    const [disasterCount, reportCount, resourceCount, cacheStats] = await Promise.all([
      disasterModel.count().catch(() => 0),
      reportModel.count().catch(() => 0),
      resourceModel.count().catch(() => 0),
      cacheModel.getStatistics().catch(() => ({ total: 0, active: 0, expired: 0 })),
    ]);

    const responseTime = Date.now() - startTime;

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
          cache: cacheStats,
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
    const startTime = Date.now();

    // Test each table individually
    const tableTests = await Promise.allSettled([
      disasterModel.count(),
      reportModel.count(),
      resourceModel.count(),
      cacheModel.count(),
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
    const startTime = Date.now();

    // Clean expired cache entries
    const cleanedCount = await cacheModel.cleanExpired();

    // Get cache statistics
    const stats = await cacheModel.getStatistics();

    const responseTime = Date.now() - startTime;

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      statistics: stats,
      cleanedExpiredEntries: cleanedCount,
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
    const cleared = await cacheModel.clear();

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

export default router;
