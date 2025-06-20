import { logger } from '../utils/logger.js';
import cacheService from './cacheService.js';

/**
 * Service for monitoring cache health, usage, and performance
 */
class CacheMonitorService {
  constructor() {
    this.monitoringEnabled = false;
    this.interval = 3600000; // Default: 1 hour
    this.monitoringJob = null;
    this.stats = {
      history: [],
      maxHistoryLength: 24, // Keep 24 hours of history
    };
  }

  /**
   * Start cache monitoring
   * @param {number} intervalMs - Monitoring interval in milliseconds
   */
  start(intervalMs = this.interval) {
    if (this.monitoringEnabled) {
      logger.warn('Cache monitoring is already running');
      return;
    }

    this.interval = intervalMs;
    logger.info(`Starting cache monitoring (interval: ${this.interval}ms)`);

    this.monitoringJob = setInterval(async () => {
      await this.collectStats();
    }, this.interval);

    this.monitoringEnabled = true;

    // Collect initial stats
    this.collectStats();
  }

  /**
   * Stop cache monitoring
   */
  stop() {
    if (!this.monitoringEnabled) {
      logger.warn('Cache monitoring is not running');
      return;
    }

    clearInterval(this.monitoringJob);
    this.monitoringJob = null;
    this.monitoringEnabled = false;

    logger.info('Cache monitoring stopped');
  }

  /**
   * Collect cache statistics
   */
  async collectStats() {
    try {
      const timestamp = new Date().toISOString();
      const cacheStats = await cacheService.getStats();

      // Add stats to history
      this.stats.history.push({
        timestamp,
        stats: cacheStats,
      });

      // Trim history if needed
      if (this.stats.history.length > this.stats.maxHistoryLength) {
        this.stats.history = this.stats.history.slice(-this.stats.maxHistoryLength);
      }

      logger.debug('Cache stats collected', { timestamp, cacheStats });

      return cacheStats;
    } catch (error) {
      logger.error('Error collecting cache stats:', error);
    }
  }

  /**
   * Get cache monitoring data
   * @param {Object} options - Options for retrieving stats
   * @returns {Object} - Monitoring data
   */
  async getMonitoringData(options = {}) {
    const {
      includeHistory = true,
      historyHours = 24,
      includeCurrentStats = true,
      includeRealTimeMetrics = true,
    } = options;

    const result = {
      monitoring_status: this.monitoringEnabled ? 'active' : 'inactive',
      monitoring_interval_ms: this.interval,
      timestamp: new Date().toISOString(),
    };

    // Add current stats if requested
    if (includeCurrentStats) {
      result.current_stats = await cacheService.getStats();
    }

    // Add history if requested
    if (includeHistory) {
      const historyLimit = Math.min(this.stats.history.length, historyHours);
      result.history = this.stats.history.slice(-historyLimit);

      // Calculate trends if we have enough history
      if (result.history.length >= 2) {
        const oldestStats = result.history[0].stats;
        const newestStats = result.history[result.history.length - 1].stats;

        result.trends = {
          entries_change: newestStats.total_entries - oldestStats.total_entries,
          entries_change_percent:
            oldestStats.total_entries > 0
              ? ((newestStats.total_entries - oldestStats.total_entries) /
                  oldestStats.total_entries) *
                100
              : 0,
          hit_ratio_change: newestStats.hit_ratio - oldestStats.hit_ratio,
          period_hours: historyLimit,
        };
      }
    }

    // Add real-time metrics if requested
    if (includeRealTimeMetrics) {
      // Calculate active entries percentage
      result.real_time_metrics = {
        active_entries_percent: result.current_stats
          ? (result.current_stats.active_entries / result.current_stats.total_entries) * 100
          : 0,
        utilization_score: await this.calculateUtilizationScore(),
        health_status: await this.getHealthStatus(),
      };
    }

    return result;
  }

  /**
   * Calculate cache utilization score (0-100)
   * @returns {number} - Utilization score
   */
  async calculateUtilizationScore() {
    const stats = await cacheService.getStats();

    // A simple utilization score based on hit ratio and active entries
    const hitRatioWeight = 0.7;
    const activeEntriesWeight = 0.3;

    const hitRatioScore = stats.hit_ratio * 100;
    const activeEntriesScore =
      stats.total_entries > 0 ? (stats.active_entries / stats.total_entries) * 100 : 0;

    return Math.round(hitRatioScore * hitRatioWeight + activeEntriesScore * activeEntriesWeight);
  }

  /**
   * Get cache health status
   * @returns {string} - Health status (excellent, good, fair, poor)
   */
  async getHealthStatus() {
    const utilizationScore = await this.calculateUtilizationScore();

    if (utilizationScore >= 90) return 'excellent';
    if (utilizationScore >= 70) return 'good';
    if (utilizationScore >= 50) return 'fair';
    return 'poor';
  }

  /**
   * Generate cache optimization recommendations
   * @returns {Array} - List of recommendations
   */
  async generateRecommendations() {
    const stats = await cacheService.getStats();
    const recommendations = [];

    // Check hit ratio
    if (stats.hit_ratio < 0.5) {
      recommendations.push({
        type: 'warning',
        metric: 'hit_ratio',
        message:
          'Low cache hit ratio detected. Consider adjusting cache TTLs or warm up frequently accessed data.',
      });
    }

    // Check expired entries ratio
    const expiredRatio = stats.expired_entries / stats.total_entries;
    if (expiredRatio > 0.3) {
      recommendations.push({
        type: 'warning',
        metric: 'expired_entries',
        message: 'High percentage of expired entries. Verify cleanup job is running properly.',
      });
    }

    // If very few entries
    if (stats.total_entries < 10) {
      recommendations.push({
        type: 'info',
        metric: 'total_entries',
        message: 'Very few cache entries. Cache system may be underutilized.',
      });
    }

    // If everything looks good
    if (recommendations.length === 0) {
      recommendations.push({
        type: 'success',
        metric: 'overall',
        message: 'Cache system is healthy and operating efficiently.',
      });
    }

    return recommendations;
  }
}

export default new CacheMonitorService();
