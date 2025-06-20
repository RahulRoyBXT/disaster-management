import { logger } from '../utils/logger.js';
import cacheService from './cacheService.js';

/**
 * Cache Cleanup Job
 * Periodically cleans expired cache entries to prevent database bloat
 */
class CacheCleanupJob {
  constructor() {
    this.interval = process.env.CACHE_CLEANUP_INTERVAL || 300000; // Default: 5 minutes
    this.isRunning = false;
    this.job = null;
    this.stats = {
      totalRuns: 0,
      totalCleaned: 0,
      lastRun: null,
      lastCleanedCount: 0,
      averageCleaned: 0,
    };
  }

  /**
   * Start the cleanup job
   */
  start() {
    if (this.isRunning) {
      logger.warn('Cache cleanup job is already running');
      return;
    }

    logger.info(`Starting cache cleanup job (interval: ${this.interval}ms)`);

    this.job = setInterval(async () => {
      await this.runCleanup();
    }, this.interval);

    this.isRunning = true;

    // Run an initial cleanup
    this.runCleanup();
  }

  /**
   * Stop the cleanup job
   */
  stop() {
    if (!this.isRunning) {
      logger.warn('Cache cleanup job is not running');
      return;
    }

    clearInterval(this.job);
    this.job = null;
    this.isRunning = false;

    logger.info('Cache cleanup job stopped');
  }

  /**
   * Run a single cleanup cycle
   */
  async runCleanup() {
    try {
      logger.info('Running cache cleanup cycle');

      const startTime = Date.now();
      const cleanedCount = await cacheService.cleanExpired();
      const duration = Date.now() - startTime;

      // Update stats
      this.stats.totalRuns++;
      this.stats.totalCleaned += cleanedCount;
      this.stats.lastRun = new Date().toISOString();
      this.stats.lastCleanedCount = cleanedCount;
      this.stats.averageCleaned = Math.round(this.stats.totalCleaned / this.stats.totalRuns);

      logger.info(`Cache cleanup completed: ${cleanedCount} entries removed (${duration}ms)`);

      return {
        cleanedCount,
        duration,
      };
    } catch (error) {
      logger.error('Error during cache cleanup:', error);
    }
  }

  /**
   * Get cleanup job statistics
   */
  getStats() {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      interval: this.interval,
      nextRunAt: this.isRunning
        ? new Date(Date.now() + this.getTimeUntilNextRun()).toISOString()
        : null,
    };
  }

  /**
   * Calculate time until next scheduled run
   */
  getTimeUntilNextRun() {
    if (!this.isRunning || !this.stats.lastRun) {
      return null;
    }

    const lastRunTime = new Date(this.stats.lastRun).getTime();
    const nextRunTime = lastRunTime + this.interval;
    const now = Date.now();

    return Math.max(0, nextRunTime - now);
  }
}

// Export a singleton instance
const cacheCleanupJob = new CacheCleanupJob();
export default cacheCleanupJob;
