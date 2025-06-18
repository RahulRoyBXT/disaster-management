import { BaseModel } from './BaseModel.js';
import { logger } from '../utils/logger.js';

/**
 * Cache Model
 * Handles all database operations for cache table
 */
export class CacheModel extends BaseModel {
  constructor() {
    super('cache');
  }

  /**
   * Get cached value by key
   * @param {string} key - Cache key
   * @returns {Promise<any|null>} Cached value or null if not found/expired
   */
  async get(key) {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('key', key)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // No record found
        }
        throw error;
      }

      // Check if cache has expired
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        // Delete expired cache entry
        await this.delete(key);
        return null;
      }

      return data.value;
    } catch (error) {
      logger.error('Error getting cache value:', error);
      return null; // Return null on error to prevent cache failures from breaking the app
    }
  }

  /**
   * Set cached value with expiration
   * @param {string} key - Cache key
   * @param {any} value - Value to cache (will be stored as JSONB)
   * @param {number} ttlSeconds - Time to live in seconds
   * @returns {Promise<boolean>} True if successful
   */
  async set(key, value, ttlSeconds = 3600) {
    try {
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

      const { error } = await this.supabase.from(this.tableName).upsert({
        key,
        value,
        expires_at: expiresAt,
      });

      if (error) {
        throw error;
      }

      logger.debug(`Cache set: ${key} (TTL: ${ttlSeconds}s)`);
      return true;
    } catch (error) {
      logger.error('Error setting cache value:', error);
      return false;
    }
  }

  /**
   * Delete cached value by key
   * @param {string|Array} keys - Cache key(s) to delete
   * @returns {Promise<boolean>} True if successful
   */
  async delete(keys) {
    try {
      const keyArray = Array.isArray(keys) ? keys : [keys];

      const { error } = await this.supabase.from(this.tableName).delete().in('key', keyArray);

      if (error) {
        throw error;
      }

      logger.debug(`Cache deleted: ${keyArray.join(', ')}`);
      return true;
    } catch (error) {
      logger.error('Error deleting cache value:', error);
      return false;
    }
  }

  /**
   * Check if cache key exists and is not expired
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} True if key exists and is valid
   */
  async has(key) {
    try {
      const value = await this.get(key);
      return value !== null;
    } catch (error) {
      logger.error('Error checking cache existence:', error);
      return false;
    }
  }

  /**
   * Get or set cache value (cache-aside pattern)
   * @param {string} key - Cache key
   * @param {Function} fetchFunction - Function to fetch data if cache miss
   * @param {number} ttlSeconds - Time to live in seconds
   * @returns {Promise<any>} Cached or fetched value
   */
  async getOrSet(key, fetchFunction, ttlSeconds = 3600) {
    try {
      // Try to get from cache first
      let value = await this.get(key);

      if (value !== null) {
        logger.debug(`Cache hit: ${key}`);
        return value;
      }

      // Cache miss - fetch data
      logger.debug(`Cache miss: ${key}`);
      value = await fetchFunction();

      // Store in cache
      await this.set(key, value, ttlSeconds);

      return value;
    } catch (error) {
      logger.error('Error in getOrSet cache operation:', error);
      // If cache fails, try to get data directly
      try {
        return await fetchFunction();
      } catch (fetchError) {
        logger.error('Error fetching data after cache failure:', fetchError);
        throw fetchError;
      }
    }
  }

  /**
   * Clean expired cache entries
   * @returns {Promise<number>} Number of entries deleted
   */
  async cleanExpired() {
    try {
      // First, count expired entries
      const { count } = await this.supabase
        .from(this.tableName)
        .select('*', { count: 'exact', head: true })
        .lt('expires_at', new Date().toISOString());

      if (count === 0) {
        return 0;
      }

      // Delete expired entries
      const { error } = await this.supabase
        .from(this.tableName)
        .delete()
        .lt('expires_at', new Date().toISOString());

      if (error) {
        throw error;
      }

      logger.info(`Cleaned ${count} expired cache entries`);
      return count || 0;
    } catch (error) {
      logger.error('Error cleaning expired cache:', error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   * @returns {Promise<Object>} Cache statistics
   */
  async getStatistics() {
    try {
      const total = await this.count();

      const { count: expired } = await this.supabase
        .from(this.tableName)
        .select('*', { count: 'exact', head: true })
        .lt('expires_at', new Date().toISOString());

      const active = total - (expired || 0);

      return {
        total,
        active,
        expired: expired || 0,
      };
    } catch (error) {
      logger.error('Error getting cache statistics:', error);
      return {
        total: 0,
        active: 0,
        expired: 0,
      };
    }
  }

  /**
   * Clear all cache entries
   * @returns {Promise<boolean>} True if successful
   */
  async clear() {
    try {
      const { error } = await this.supabase.from(this.tableName).delete().neq('key', ''); // Delete all records

      if (error) {
        throw error;
      }

      logger.info('Cache cleared successfully');
      return true;
    } catch (error) {
      logger.error('Error clearing cache:', error);
      return false;
    }
  }

  /**
   * Get cache keys matching a pattern
   * @param {string} pattern - Pattern to match (using SQL LIKE syntax)
   * @returns {Promise<Array>} Array of matching keys
   */
  async getKeys(pattern = '%') {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('key')
        .like('key', pattern);

      if (error) {
        throw error;
      }

      return data?.map(item => item.key) || [];
    } catch (error) {
      logger.error('Error getting cache keys:', error);
      return [];
    }
  }

  /**
   * Increment a numeric cache value
   * @param {string} key - Cache key
   * @param {number} increment - Amount to increment (default: 1)
   * @param {number} ttlSeconds - TTL for new keys
   * @returns {Promise<number>} New value after increment
   */
  async increment(key, increment = 1, ttlSeconds = 3600) {
    try {
      const currentValue = await this.get(key);
      const newValue = (typeof currentValue === 'number' ? currentValue : 0) + increment;

      await this.set(key, newValue, ttlSeconds);
      return newValue;
    } catch (error) {
      logger.error('Error incrementing cache value:', error);
      throw error;
    }
  }

  /**
   * Set cache value only if key doesn't exist
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttlSeconds - Time to live in seconds
   * @returns {Promise<boolean>} True if value was set
   */
  async setIfNotExists(key, value, ttlSeconds = 3600) {
    try {
      const exists = await this.has(key);
      if (exists) {
        return false;
      }

      return await this.set(key, value, ttlSeconds);
    } catch (error) {
      logger.error('Error setting cache if not exists:', error);
      return false;
    }
  }
}

export default CacheModel;
