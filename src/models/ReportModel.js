import { BaseModel } from './BaseModel.js';
import { logger } from '../utils/logger.js';

/**
 * Report Model
 * Handles all database operations for reports table
 */
export class ReportModel extends BaseModel {
  constructor() {
    super('reports');
  }

  /**
   * Find reports by disaster ID
   * @param {string} disasterId - Disaster ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of reports
   */
  async findByDisaster(disasterId, options = {}) {
    try {
      return await this.findAll(
        { disaster_id: disasterId },
        {
          orderBy: { column: 'created_at', ascending: false },
          ...options,
        }
      );
    } catch (error) {
      logger.error('Error finding reports by disaster:', error);
      throw error;
    }
  }

  /**
   * Find reports by user ID
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of reports
   */
  async findByUser(userId, options = {}) {
    try {
      return await this.findAll(
        { user_id: userId },
        {
          orderBy: { column: 'created_at', ascending: false },
          ...options,
        }
      );
    } catch (error) {
      logger.error('Error finding reports by user:', error);
      throw error;
    }
  }

  /**
   * Find reports by verification status
   * @param {string} status - Verification status ('pending', 'verified', 'fake')
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of reports
   */
  async findByVerificationStatus(status, options = {}) {
    try {
      const validStatuses = ['pending', 'verified', 'fake'];
      if (!validStatuses.includes(status)) {
        throw new Error(`Invalid verification status: ${status}`);
      }

      return await this.findAll(
        { verification_status: status },
        {
          orderBy: { column: 'created_at', ascending: false },
          ...options,
        }
      );
    } catch (error) {
      logger.error('Error finding reports by verification status:', error);
      throw error;
    }
  }

  /**
   * Get reports with disaster information
   * @param {Object} filters - Query filters
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of reports with disaster data
   */
  async findWithDisasterInfo(filters = {}, options = {}) {
    try {
      let query = this.supabase.from(this.tableName).select(`
          *,
          disasters (
            id,
            title,
            location_name,
            tags
          )
        `);

      // Apply filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (key === 'disaster_id') {
            query = query.eq('disaster_id', value);
          } else if (key === 'user_id') {
            query = query.eq('user_id', value);
          } else if (key === 'verification_status') {
            query = query.eq('verification_status', value);
          }
        }
      });

      // Apply ordering
      if (options.orderBy) {
        const { column, ascending = false } = options.orderBy;
        query = query.order(column, { ascending });
      } else {
        query = query.order('created_at', { ascending: false });
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
      logger.error('Error finding reports with disaster info:', error);
      throw error;
    }
  }

  /**
   * Update verification status
   * @param {string} reportId - Report ID
   * @param {string} status - New verification status
   * @param {string} verifiedBy - User who verified the report
   * @returns {Promise<Object>} Updated report
   */
  async updateVerificationStatus(reportId, status, verifiedBy) {
    try {
      const validStatuses = ['pending', 'verified', 'fake'];
      if (!validStatuses.includes(status)) {
        throw new Error(`Invalid verification status: ${status}`);
      }

      const updateData = {
        verification_status: status,
        verified_at: new Date().toISOString(),
        verified_by: verifiedBy,
      };

      return await this.update(reportId, updateData);
    } catch (error) {
      logger.error('Error updating verification status:', error);
      throw error;
    }
  }

  /**
   * Search reports by content
   * @param {string} searchTerm - Search term
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of matching reports
   */
  async search(searchTerm, options = {}) {
    try {
      let query = this.supabase
        .from(this.tableName)
        .select('*')
        .ilike('content', `%${searchTerm}%`);

      // Apply ordering
      if (options.orderBy) {
        const { column, ascending = false } = options.orderBy;
        query = query.order(column, { ascending });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      // Apply pagination
      if (options.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      logger.error('Error searching reports:', error);
      throw error;
    }
  }

  /**
   * Get report statistics
   * @param {string} disasterId - Optional disaster ID to filter by
   * @returns {Promise<Object>} Statistics object
   */
  async getStatistics(disasterId = null) {
    try {
      const filters = disasterId ? { disaster_id: disasterId } : {};

      const [total, pending, verified, fake] = await Promise.all([
        this.count(filters),
        this.count({ ...filters, verification_status: 'pending' }),
        this.count({ ...filters, verification_status: 'verified' }),
        this.count({ ...filters, verification_status: 'fake' }),
      ]);

      return {
        total,
        pending,
        verified,
        fake,
        verificationRate: total > 0 ? (((verified + fake) / total) * 100).toFixed(2) : 0,
      };
    } catch (error) {
      logger.error('Error getting report statistics:', error);
      throw error;
    }
  }

  /**
   * Get recent reports
   * @param {number} limit - Number of recent reports to fetch
   * @param {string} disasterId - Optional disaster ID to filter by
   * @returns {Promise<Array>} Array of recent reports
   */
  async getRecent(limit = 10, disasterId = null) {
    try {
      const filters = disasterId ? { disaster_id: disasterId } : {};

      return await this.findAll(filters, {
        orderBy: { column: 'created_at', ascending: false },
        limit,
      });
    } catch (error) {
      logger.error('Error getting recent reports:', error);
      throw error;
    }
  }

  /**
   * Get reports pending verification
   * @param {number} limit - Number of reports to fetch
   * @returns {Promise<Array>} Array of pending reports
   */
  async getPendingVerification(limit = 50) {
    try {
      return await this.findByVerificationStatus('pending', { limit });
    } catch (error) {
      logger.error('Error getting pending verification reports:', error);
      throw error;
    }
  }

  /**
   * Bulk update verification status
   * @param {Array} reportIds - Array of report IDs
   * @param {string} status - New verification status
   * @param {string} verifiedBy - User who verified the reports
   * @returns {Promise<Array>} Array of updated reports
   */
  async bulkUpdateVerificationStatus(reportIds, status, verifiedBy) {
    try {
      const validStatuses = ['pending', 'verified', 'fake'];
      if (!validStatuses.includes(status)) {
        throw new Error(`Invalid verification status: ${status}`);
      }

      const updateData = {
        verification_status: status,
        verified_at: new Date().toISOString(),
        verified_by: verifiedBy,
      };

      const { data, error } = await this.supabase
        .from(this.tableName)
        .update(updateData)
        .in('id', reportIds)
        .select();

      if (error) {
        throw error;
      }

      logger.info(`Bulk updated ${reportIds.length} reports to status: ${status}`);
      return data || [];
    } catch (error) {
      logger.error('Error bulk updating verification status:', error);
      throw error;
    }
  }
}

export default ReportModel;
