import { PrismaClient } from '../generated/prisma/index.js';
import { logger } from '../utils/logger.js';
import cacheService from './cacheService.js';

/**
 * Service for comprehensive cache testing
 */
class CacheTestingService {
  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Run a comprehensive TTL test with multiple timeframes
   * @param {Object} options - Test options
   * @returns {Object} - Test results
   */
  async runComprehensiveTTLTest(options = {}) {
    const {
      shortTTL = 10, // 10 seconds
      mediumTTL = 30, // 30 seconds
      longTTL = 60, // 1 minute
      checkInterval = 5, // Check every 5 seconds
    } = options;

    const testId = Date.now().toString();
    const testResults = {
      test_id: testId,
      started_at: new Date().toISOString(),
      completed: false,
      options: { shortTTL, mediumTTL, longTTL, checkInterval },
      entries: {},
      checkpoints: [],
    };

    // Create test entries
    const testEntries = [
      { key: `ttl_test_${testId}_short`, ttl: shortTTL, label: 'short' },
      { key: `ttl_test_${testId}_medium`, ttl: mediumTTL, label: 'medium' },
      { key: `ttl_test_${testId}_long`, ttl: longTTL, label: 'long' },
    ];

    // Create all test entries
    for (const entry of testEntries) {
      const value = {
        test_id: testId,
        label: entry.label,
        ttl: entry.ttl,
        created_at: new Date().toISOString(),
        data: `Test data for ${entry.label} TTL (${entry.ttl}s)`,
      };

      await cacheService.set(entry.key, value, entry.ttl);

      testResults.entries[entry.label] = {
        key: entry.key,
        ttl: entry.ttl,
        value,
        checkpoints: [],
      };
    }

    logger.info(`Comprehensive TTL test started (ID: ${testId})`);

    // Run checks at intervals until all TTLs have expired
    const maxDuration = longTTL + 10; // Add buffer
    const startTime = Date.now();

    // Schedule checks at regular intervals
    for (let elapsed = 0; elapsed <= maxDuration; elapsed += checkInterval) {
      await new Promise(resolve => setTimeout(resolve, elapsed === 0 ? 500 : checkInterval * 1000));

      const currentElapsed = Math.round((Date.now() - startTime) / 1000);
      const checkpoint = {
        elapsed_seconds: currentElapsed,
        timestamp: new Date().toISOString(),
        entries: {},
      };

      // Check all entries
      for (const entry of testEntries) {
        const value = await cacheService.get(entry.key);
        const exists = value !== null;

        checkpoint.entries[entry.label] = {
          exists,
          expected_exists: currentElapsed < entry.ttl,
          value: exists ? value : null,
        };

        testResults.entries[entry.label].checkpoints.push({
          elapsed_seconds: currentElapsed,
          exists,
          expected_exists: currentElapsed < entry.ttl,
        });
      }

      testResults.checkpoints.push(checkpoint);

      // If all entries have expired, we can end early
      if (currentElapsed > longTTL && !Object.values(checkpoint.entries).some(e => e.exists)) {
        break;
      }
    }

    // Add final statistics
    testResults.completed = true;
    testResults.completed_at = new Date().toISOString();
    testResults.duration_seconds = Math.round((Date.now() - startTime) / 1000);

    // Determine success (entries expired when expected)
    testResults.success = true;
    for (const entryLabel in testResults.entries) {
      const entry = testResults.entries[entryLabel];
      const lastCheckpoint = entry.checkpoints[entry.checkpoints.length - 1];

      if (lastCheckpoint && lastCheckpoint.exists) {
        testResults.success = false;
        break;
      }
    }

    logger.info(
      `Comprehensive TTL test completed (ID: ${testId}, Success: ${testResults.success})`
    );

    return testResults;
  }

  /**
   * Test cache performance with read/write operations
   * @param {Object} options - Test options
   * @returns {Object} - Performance results
   */
  async testPerformance(options = {}) {
    const {
      writeCount = 100,
      readCount = 100,
      payloadSizeBytes = 1024, // 1KB
      randomAccess = true,
    } = options;

    const testId = Date.now().toString();
    const results = {
      test_id: testId,
      started_at: new Date().toISOString(),
      options: { writeCount, readCount, payloadSizeBytes, randomAccess },
      write_performance: {},
      read_performance: {},
      keys: [],
    };

    // Generate test data
    const generateTestData = (size, index) => {
      // Create a string of approximately the requested size
      const baseString = 'X'.repeat(Math.ceil(size / 10));
      const repeated = baseString.repeat(10);

      return {
        test_id: testId,
        index,
        timestamp: new Date().toISOString(),
        payload: repeated.substring(0, size),
      };
    };

    // Write test
    const writeStart = Date.now();
    for (let i = 0; i < writeCount; i++) {
      const key = `perf_test_${testId}_${i}`;
      const data = generateTestData(payloadSizeBytes, i);

      await cacheService.set(key, data, 3600); // 1 hour TTL
      results.keys.push(key);
    }
    const writeEnd = Date.now();

    // Read test
    const readStart = Date.now();
    let hits = 0;
    let misses = 0;

    for (let i = 0; i < readCount; i++) {
      let key;

      if (randomAccess) {
        // Random access pattern
        const randomIndex = Math.floor(Math.random() * writeCount);
        key = `perf_test_${testId}_${randomIndex}`;
      } else {
        // Sequential access pattern
        const index = i % writeCount;
        key = `perf_test_${testId}_${index}`;
      }

      const value = await cacheService.get(key);
      if (value !== null) {
        hits++;
      } else {
        misses++;
      }
    }
    const readEnd = Date.now();

    // Calculate performance metrics
    results.write_performance = {
      total_time_ms: writeEnd - writeStart,
      operations: writeCount,
      operations_per_second: Math.round((writeCount * 1000) / (writeEnd - writeStart)),
      average_operation_ms: (writeEnd - writeStart) / writeCount,
    };

    results.read_performance = {
      total_time_ms: readEnd - readStart,
      operations: readCount,
      operations_per_second: Math.round((readCount * 1000) / (readEnd - readStart)),
      average_operation_ms: (readEnd - readStart) / readCount,
      hit_ratio: hits / readCount,
      hits,
      misses,
    };

    results.completed_at = new Date().toISOString();
    results.total_duration_ms = readEnd - writeStart;

    logger.info(`Cache performance test completed (ID: ${testId})`);
    return results;
  }

  /**
   * Clean up test data
   * @param {string} testId - The test ID to clean up (optional)
   * @returns {Object} - Cleanup results
   */
  async cleanupTestData(testId = null) {
    try {
      const whereClause = testId
        ? { key: { contains: `_${testId}_` } }
        : {
            OR: [
              { key: { contains: 'ttl_test_' } },
              { key: { contains: 'perf_test_' } },
              { key: { contains: 'cache_test_' } },
            ],
          };

      const result = await this.prisma.cache.deleteMany({
        where: whereClause,
      });

      logger.info(
        `Cleaned up ${result.count} test cache entries${testId ? ` for test ${testId}` : ''}`
      );

      return {
        deleted_count: result.count,
        test_id: testId || 'all',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Error cleaning up test cache data:', error);
      throw error;
    }
  }
}

export default new CacheTestingService();
