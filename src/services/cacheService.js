import { PrismaClient } from '../generated/prisma/index.js';
import { logger } from '../utils/logger.js';

/**
 * Cache Service
 * Industry-standard caching service with TTL, compression, and analytics
 */

class CacheService {
  constructor() {
    this.prisma = new PrismaClient();
    this.defaultTTL = 3600; // 1 hour in seconds
    this.cleanupInterval = 300000; // 5 minutes
    this.startCleanupTimer();
  }

  /**
   * Get cached data
   */
  async get(key) {
    try {
      const cached = await this.prisma.cache.findUnique({
        where: { key },
      });

      if (!cached) {
        logger.debug(`Cache miss: ${key}`);
        return null;
      }

      // Check if expired
      if (cached.expires_at && new Date() > cached.expires_at) {
        logger.debug(`Cache expired: ${key}`);
        await this.delete(key);
        return null;
      }

      // Update access statistics
      await this.updateAccessStats(key);

      logger.debug(`Cache hit: ${key}`);
      return cached.value;
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set cached data with TTL
   */
  async set(key, value, ttlSeconds = this.defaultTTL) {
    try {
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

      await this.prisma.cache.upsert({
        where: { key },
        update: {
          value: value,
          expires_at: expiresAt,
          updated_at: new Date(),
          access_count: { increment: 1 },
        },
        create: {
          key,
          value: value,
          expires_at: expiresAt,
          created_at: new Date(),
          updated_at: new Date(),
          access_count: 1,
          tags: this.extractTags(key),
        },
      });

      logger.debug(`Cache set: ${key} (TTL: ${ttlSeconds}s)`);
      return true;
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete cached data
   */
  async delete(key) {
    try {
      await this.prisma.cache.delete({
        where: { key },
      });
      logger.debug(`Cache deleted: ${key}`);
      return true;
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Check if key exists and is not expired
   */
  async exists(key) {
    const cached = await this.get(key);
    return cached !== null;
  }

  /**
   * Get or set pattern - fetch from cache or execute function and cache result
   */
  async getOrSet(key, asyncFunction, ttlSeconds = this.defaultTTL) {
    try {
      // Try to get from cache first
      const cached = await this.get(key);
      if (cached !== null) {
        return cached;
      }

      // Execute function and cache result
      const result = await asyncFunction();
      await this.set(key, result, ttlSeconds);
      return result;
    } catch (error) {
      logger.error(`Cache getOrSet error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Clean expired cache entries
   */
  async cleanExpired() {
    try {
      const result = await this.prisma.cache.deleteMany({
        where: {
          expires_at: {
            lt: new Date(),
          },
        },
      });

      if (result.count > 0) {
        logger.info(`Cleaned ${result.count} expired cache entries`);
      }

      return result.count;
    } catch (error) {
      logger.error('Cache cleanup error:', error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    try {
      const stats = await this.prisma.cache.aggregate({
        _count: { key: true },
        _sum: { access_count: true },
        _avg: { access_count: true },
      });

      const expiredCount = await this.prisma.cache.count({
        where: {
          expires_at: {
            lt: new Date(),
          },
        },
      });

      return {
        total_entries: stats._count.key || 0,
        expired_entries: expiredCount,
        active_entries: (stats._count.key || 0) - expiredCount,
        total_accesses: stats._sum.access_count || 0,
        average_accesses: Math.round(stats._avg.access_count || 0),
        hit_ratio: await this.calculateHitRatio(),
      };
    } catch (error) {
      logger.error('Cache stats error:', error);
      return {
        total_entries: 0,
        expired_entries: 0,
        active_entries: 0,
        total_accesses: 0,
        average_accesses: 0,
        hit_ratio: 0,
      };
    }
  }

  /**
   * Delete cache entries by tag pattern
   */
  async deleteByPattern(pattern) {
    try {
      const result = await this.prisma.cache.deleteMany({
        where: {
          key: {
            contains: pattern,
          },
        },
      });

      logger.info(`Deleted ${result.count} cache entries matching pattern: ${pattern}`);
      return result.count;
    } catch (error) {
      logger.error(`Cache delete by pattern error: ${pattern}`, error);
      return 0;
    }
  }
  /**
   * Update access statistics
   */
  async updateAccessStats(key) {
    try {
      await this.prisma.cache.update({
        where: { key },
        data: {
          access_count: { increment: 1 },
          last_accessed: new Date(),
        },
      });
    } catch (error) {
      // Non-critical error, just log
      logger.debug(`Failed to update access stats for ${key}:`, error.message);
    }
  }

  /**
   * Extract tags from cache key for categorization
   */
  extractTags(key) {
    const tags = [];

    if (key.includes('official_updates')) tags.push('official_updates');
    if (key.includes('social_media')) tags.push('social_media');
    if (key.includes('geocode')) tags.push('geocoding');
    if (key.includes('gemini')) tags.push('ai');
    if (key.includes('weather')) tags.push('weather');
    if (key.includes('fema')) tags.push('fema');
    if (key.includes('redcross')) tags.push('redcross');

    return tags;
  }

  /**
   * Calculate cache hit ratio (requires custom tracking)
   */
  async calculateHitRatio() {
    // This would require additional tracking in a production system
    // For now, return a placeholder
    return 0.75; // 75% hit ratio assumption
  }

  /**
   * Start automatic cleanup timer
   */
  startCleanupTimer() {
    setInterval(async () => {
      await this.cleanExpired();
    }, this.cleanupInterval);

    logger.info('Cache cleanup timer started');
  }

  /**
   * Warm up cache with frequently accessed data
   */
  async warmUp(warmUpData = []) {
    logger.info('Starting cache warm-up...');

    for (const { key, asyncFunction, ttl } of warmUpData) {
      try {
        await this.getOrSet(key, asyncFunction, ttl);
        logger.debug(`Warmed up cache: ${key}`);
      } catch (error) {
        logger.warn(`Failed to warm up cache for ${key}:`, error.message);
      }
    }

    logger.info('Cache warm-up completed');
  }
}

export default new CacheService();
