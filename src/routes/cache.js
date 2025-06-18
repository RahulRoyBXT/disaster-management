import express from 'express';
import Joi from 'joi';
import { cacheModel } from '../models/index.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Validation schemas
const setCacheSchema = Joi.object({
  key: Joi.string().required().min(1).max(255),
  value: Joi.any().required(),
  ttl: Joi.number().integer().min(1).max(86400).default(3600), // 1 second to 24 hours
});

const getCacheSchema = Joi.object({
  keys: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).optional(),
});

const deleteCacheSchema = Joi.object({
  keys: Joi.alternatives().try(
    Joi.string().required(),
    Joi.array().items(Joi.string()).required().min(1)
  ),
});

/**
 * GET /api/cache
 * Get cache statistics or specific cache entries
 */
router.get('/', async (req, res) => {
  try {
    const { keys } = req.query;

    // If no keys specified, return cache statistics
    if (!keys) {
      const stats = await cacheModel.getStatistics();

      res.json({
        success: true,
        data: {
          statistics: stats,
          message: 'Use ?keys=key1,key2 to get specific cache entries',
        },
      });
      return;
    }

    // Handle multiple keys
    const keyArray = Array.isArray(keys) ? keys : keys.split(',').map(k => k.trim());
    const results = {};

    for (const key of keyArray) {
      try {
        const value = await cacheModel.get(key);
        results[key] = value;
      } catch (error) {
        results[key] = null;
        logger.warn(`Failed to get cache key ${key}:`, error);
      }
    }

    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    logger.error('Error fetching cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cache data',
    });
  }
});

/**
 * GET /api/cache/:key
 * Get a specific cache entry by key
 */
router.get('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const value = await cacheModel.get(key);

    if (value === null) {
      return res.status(404).json({
        success: false,
        error: 'Cache key not found or expired',
      });
    }

    res.json({
      success: true,
      data: {
        key,
        value,
        retrieved_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error fetching cache key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cache key',
    });
  }
});

/**
 * POST /api/cache
 * Set cache entries
 */
router.post('/', async (req, res) => {
  try {
    // Handle both single entry and batch operations
    if (Array.isArray(req.body)) {
      // Batch operation
      const entries = req.body;
      const results = [];

      for (const entry of entries) {
        const { error, value } = setCacheSchema.validate(entry);
        if (error) {
          results.push({
            key: entry.key || 'unknown',
            success: false,
            error: error.details[0].message,
          });
          continue;
        }

        try {
          const success = await cacheModel.set(value.key, value.value, value.ttl);
          results.push({
            key: value.key,
            success,
            ttl: value.ttl,
          });
        } catch (err) {
          results.push({
            key: value.key,
            success: false,
            error: err.message,
          });
        }
      }

      res.json({
        success: true,
        data: results,
        message: 'Batch cache operation completed',
      });
    } else {
      // Single entry
      const { error, value } = setCacheSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: error.details[0].message,
        });
      }

      const { key, value: cacheValue, ttl } = value;
      const success = await cacheModel.set(key, cacheValue, ttl);

      if (success) {
        logger.info(`Cache set: ${key} (TTL: ${ttl}s)`);
        res.status(201).json({
          success: true,
          data: {
            key,
            ttl,
            expires_at: new Date(Date.now() + ttl * 1000).toISOString(),
          },
          message: 'Cache entry created successfully',
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to set cache entry',
        });
      }
    }
  } catch (error) {
    logger.error('Error setting cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to set cache data',
    });
  }
});

/**
 * PUT /api/cache/:key
 * Update or create a specific cache entry
 */
router.put('/:key', async (req, res) => {
  try {
    const schema = Joi.object({
      value: Joi.any().required(),
      ttl: Joi.number().integer().min(1).max(86400).default(3600),
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    const { key } = req.params;
    const { value: cacheValue, ttl } = value;

    const success = await cacheModel.set(key, cacheValue, ttl);

    if (success) {
      logger.info(`Cache updated: ${key} (TTL: ${ttl}s)`);
      res.json({
        success: true,
        data: {
          key,
          ttl,
          expires_at: new Date(Date.now() + ttl * 1000).toISOString(),
        },
        message: 'Cache entry updated successfully',
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to update cache entry',
      });
    }
  } catch (error) {
    logger.error('Error updating cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update cache data',
    });
  }
});

/**
 * DELETE /api/cache
 * Delete cache entries
 */
router.delete('/', async (req, res) => {
  try {
    const { error, value } = deleteCacheSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    const { keys } = value;
    const success = await cacheModel.delete(keys);

    if (success) {
      const keyArray = Array.isArray(keys) ? keys : [keys];
      logger.info(`Cache deleted: ${keyArray.join(', ')}`);

      res.json({
        success: true,
        data: {
          deleted_keys: keyArray,
          count: keyArray.length,
        },
        message: 'Cache entries deleted successfully',
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to delete cache entries',
      });
    }
  } catch (error) {
    logger.error('Error deleting cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete cache data',
    });
  }
});

/**
 * DELETE /api/cache/:key
 * Delete a specific cache entry
 */
router.delete('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const success = await cacheModel.delete(key);

    if (success) {
      logger.info(`Cache deleted: ${key}`);
      res.json({
        success: true,
        data: {
          deleted_key: key,
        },
        message: 'Cache entry deleted successfully',
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to delete cache entry',
      });
    }
  } catch (error) {
    logger.error('Error deleting cache key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete cache key',
    });
  }
});

/**
 * POST /api/cache/clear
 * Clear all cache entries
 */
router.post('/clear', async (req, res) => {
  try {
    const success = await cacheModel.clear();

    if (success) {
      logger.info('All cache cleared');
      res.json({
        success: true,
        message: 'All cache entries cleared successfully',
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to clear cache',
      });
    }
  } catch (error) {
    logger.error('Error clearing cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache',
    });
  }
});

/**
 * POST /api/cache/cleanup
 * Clean expired cache entries
 */
router.post('/cleanup', async (req, res) => {
  try {
    const cleanedCount = await cacheModel.cleanExpired();

    res.json({
      success: true,
      data: {
        cleaned_entries: cleanedCount,
      },
      message: `Cleaned ${cleanedCount} expired cache entries`,
    });
  } catch (error) {
    logger.error('Error cleaning cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clean expired cache entries',
    });
  }
});

/**
 * GET /api/cache/keys
 * Get cache keys matching a pattern
 */
router.get('/keys', async (req, res) => {
  try {
    const { pattern = '%' } = req.query;
    const keys = await cacheModel.getKeys(pattern);

    res.json({
      success: true,
      data: {
        keys,
        count: keys.length,
        pattern,
      },
    });
  } catch (error) {
    logger.error('Error fetching cache keys:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cache keys',
    });
  }
});

/**
 * POST /api/cache/:key/increment
 * Increment a numeric cache value
 */
router.post('/:key/increment', async (req, res) => {
  try {
    const schema = Joi.object({
      increment: Joi.number().default(1),
      ttl: Joi.number().integer().min(1).max(86400).default(3600),
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
    }

    const { key } = req.params;
    const { increment, ttl } = value;

    const newValue = await cacheModel.increment(key, increment, ttl);

    res.json({
      success: true,
      data: {
        key,
        value: newValue,
        increment,
      },
      message: 'Cache value incremented successfully',
    });
  } catch (error) {
    logger.error('Error incrementing cache value:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to increment cache value',
    });
  }
});

/**
 * HEAD /api/cache/:key
 * Check if cache key exists
 */
router.head('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const exists = await cacheModel.has(key);

    if (exists) {
      res.status(200).end();
    } else {
      res.status(404).end();
    }
  } catch (error) {
    logger.error('Error checking cache existence:', error);
    res.status(500).end();
  }
});

export default router;
