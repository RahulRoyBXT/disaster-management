import { PrismaClient } from '../generated/prisma/index.js';
import { logger } from '../utils/logger.js';
import cacheService from './cacheService.js';

/**
 * Service for testing and verifying cache functionality
 */
class CacheTestService {
  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    return await cacheService.getStats();
  }

  /**
   * Test cache TTL by creating a test entry with a short TTL
   * @param {number} ttlSeconds - TTL in seconds
   * @returns {Object} - Test results
   */
  async testCacheTTL(ttlSeconds = 10) {
    try {
      const testKey = `cache_test_${Date.now()}`;
      const testValue = {
        message: 'This is a test cache entry',
        created_at: new Date().toISOString(),
        ttl_seconds: ttlSeconds,
      };

      logger.info(`Creating test cache entry with key: ${testKey} and TTL: ${ttlSeconds}s`);

      // Set the cache entry with the specified TTL
      await cacheService.set(testKey, testValue, ttlSeconds);

      // Verify it exists immediately
      const immediateCheck = await cacheService.get(testKey);

      // Wait half the TTL time and check again
      await new Promise(resolve => setTimeout(resolve, ttlSeconds * 500)); // Half TTL in ms
      const midwayCheck = await cacheService.get(testKey);

      // Wait until after TTL expires
      await new Promise(resolve => setTimeout(resolve, ttlSeconds * 600)); // Another 60% of TTL
      const expiredCheck = await cacheService.get(testKey);

      return {
        test_key: testKey,
        ttl_seconds: ttlSeconds,
        test_results: {
          immediate_exists: immediateCheck !== null,
          midway_exists: midwayCheck !== null,
          expired_exists: expiredCheck !== null,
          success: immediateCheck !== null && midwayCheck !== null && expiredCheck === null,
        },
        created_at: testValue.created_at,
        checked_at: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Error testing cache TTL:', error);
      return {
        error: error.message,
        success: false,
      };
    }
  }

  /**
   * Test cache with large data sets
   * @param {number} entries - Number of test entries to create
   * @returns {Object} - Performance metrics
   */
  async testCachePerformance(entries = 10) {
    try {
      const startTime = Date.now();
      const results = {
        entries_created: 0,
        write_time_ms: 0,
        read_time_ms: 0,
        avg_write_ms: 0,
        avg_read_ms: 0,
      };

      // Create multiple entries
      const writeStart = Date.now();
      for (let i = 0; i < entries; i++) {
        const key = `perf_test_${Date.now()}_${i}`;
        const value = {
          index: i,
          data: `Test data for entry ${i}`,
          timestamp: new Date().toISOString(),
          random_data: Array(50)
            .fill(0)
            .map(() => Math.random().toString(36).substring(2)),
        };

        await cacheService.set(key, value, 3600);
        results.entries_created++;
      }
      results.write_time_ms = Date.now() - writeStart;
      results.avg_write_ms = results.write_time_ms / results.entries_created;

      // Read the entries
      const readStart = Date.now();
      const keys = await this.prisma.cache.findMany({
        where: { key: { contains: 'perf_test_' } },
        select: { key: true },
        take: entries,
      });

      for (const { key } of keys) {
        await cacheService.get(key);
      }
      results.read_time_ms = Date.now() - readStart;
      results.avg_read_ms = results.read_time_ms / keys.length;

      results.total_time_ms = Date.now() - startTime;

      return results;
    } catch (error) {
      logger.error('Error testing cache performance:', error);
      return {
        error: error.message,
        success: false,
      };
    }
  }

  /**
   * Clean test cache entries
   */
  async cleanTestEntries() {
    try {
      const result = await this.prisma.cache.deleteMany({
        where: {
          OR: [{ key: { contains: 'cache_test_' } }, { key: { contains: 'perf_test_' } }],
        },
      });

      return {
        deleted_entries: result.count,
        success: true,
      };
    } catch (error) {
      logger.error('Error cleaning test cache entries:', error);
      return {
        error: error.message,
        success: false,
      };
    }
  }
}

export default new CacheTestService();
