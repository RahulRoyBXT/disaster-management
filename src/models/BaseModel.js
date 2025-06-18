import { supabase } from '../config/database.js';
import { logger } from '../utils/logger.js';

/**
 * Base Model class that provides common database operations
 * All models should extend this class
 */
export class BaseModel {
  constructor(tableName) {
    this.tableName = tableName;
    this.supabase = supabase;
  }

  /**
   * Find a record by ID
   * @param {string} id - The record ID
   * @returns {Promise<Object|null>} The record or null if not found
   */
  async findById(id) {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // No record found
        }
        throw error;
      }

      return data;
    } catch (error) {
      logger.error(`Error finding ${this.tableName} by ID:`, error);
      throw error;
    }
  }

  /**
   * Find all records with optional filters
   * @param {Object} filters - Query filters
   * @param {Object} options - Query options (limit, offset, orderBy)
   * @returns {Promise<Array>} Array of records
   */
  async findAll(filters = {}, options = {}) {
    try {
      let query = this.supabase.from(this.tableName).select('*');

      // Apply filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      });

      // Apply ordering
      if (options.orderBy) {
        const { column, ascending = false } = options.orderBy;
        query = query.order(column, { ascending });
      }

      // Apply pagination
      if (options.limit) {
        query = query.limit(options.limit);
      }
      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      logger.error(`Error finding ${this.tableName} records:`, error);
      throw error;
    }
  }

  /**
   * Create a new record
   * @param {Object} data - The record data
   * @returns {Promise<Object>} The created record
   */
  async create(data) {
    try {
      const { data: result, error } = await this.supabase
        .from(this.tableName)
        .insert(data)
        .select()
        .single();

      if (error) {
        throw error;
      }

      logger.info(`Created ${this.tableName} record:`, result.id);
      return result;
    } catch (error) {
      logger.error(`Error creating ${this.tableName} record:`, error);
      throw error;
    }
  }

  /**
   * Update a record by ID
   * @param {string} id - The record ID
   * @param {Object} data - The update data
   * @returns {Promise<Object>} The updated record
   */
  async update(id, data) {
    try {
      const { data: result, error } = await this.supabase
        .from(this.tableName)
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      logger.info(`Updated ${this.tableName} record:`, id);
      return result;
    } catch (error) {
      logger.error(`Error updating ${this.tableName} record:`, error);
      throw error;
    }
  }

  /**
   * Delete a record by ID
   * @param {string} id - The record ID
   * @returns {Promise<boolean>} True if deleted successfully
   */
  async delete(id) {
    try {
      const { error } = await this.supabase.from(this.tableName).delete().eq('id', id);

      if (error) {
        throw error;
      }

      logger.info(`Deleted ${this.tableName} record:`, id);
      return true;
    } catch (error) {
      logger.error(`Error deleting ${this.tableName} record:`, error);
      throw error;
    }
  }

  /**
   * Count records with optional filters
   * @param {Object} filters - Query filters
   * @returns {Promise<number>} The count of records
   */
  async count(filters = {}) {
    try {
      let query = this.supabase.from(this.tableName).select('*', { count: 'exact', head: true });

      // Apply filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      });

      const { count, error } = await query;

      if (error) {
        throw error;
      }

      return count || 0;
    } catch (error) {
      logger.error(`Error counting ${this.tableName} records:`, error);
      throw error;
    }
  }

  /**
   * Check if a record exists by ID
   * @param {string} id - The record ID
   * @returns {Promise<boolean>} True if record exists
   */
  async exists(id) {
    try {
      const record = await this.findById(id);
      return record !== null;
    } catch (error) {
      logger.error(`Error checking if ${this.tableName} exists:`, error);
      throw error;
    }
  }

  /**
   * Execute raw SQL query
   * @param {string} query - The SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<any>} Query result
   */
  async executeRaw(query, params = []) {
    try {
      const { data, error } = await this.supabase.rpc('execute_sql', {
        query,
        params,
      });

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      logger.error(`Error executing raw query:`, error);
      throw error;
    }
  }
}

export default BaseModel;
