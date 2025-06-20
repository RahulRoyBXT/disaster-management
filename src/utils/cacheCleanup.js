import { PrismaClient } from '../generated/prisma/index.js';
import { logger } from './logger.js';

/**
 * Utility to clean up expired cache entries
 * This can be used in a background process or called periodically
 */

const prisma = new PrismaClient();

export const cleanExpiredCache = async () => {
  try {
    const result = await prisma.cache.deleteMany({
      where: {
        expires_at: {
          lt: new Date(),
        },
      },
    });

    if (result.count > 0) {
      logger.info(`Cleaned ${result.count} expired cache entries`);
    }

    return {
      success: true,
      count: result.count,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Error cleaning expired cache:', error);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
};

export const getCacheStatistics = async () => {
  try {
    const stats = await prisma.cache.aggregate({
      _count: { key: true },
      _sum: { access_count: true },
      _avg: { access_count: true },
    });

    const expiredCount = await prisma.cache.count({
      where: {
        expires_at: {
          lt: new Date(),
        },
      },
    });

    return {
      total_entries: stats._count?.key || 0,
      expired_entries: expiredCount,
      active_entries: (stats._count?.key || 0) - expiredCount,
      total_accesses: stats._sum?.access_count || 0,
      average_accesses: Math.round(stats._avg?.access_count || 0),
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Error getting cache statistics:', error);
    return {
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
};

export default { cleanExpiredCache, getCacheStatistics };
