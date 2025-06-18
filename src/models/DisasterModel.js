import { BaseModel } from './BaseModel.js';
import { logger } from '../utils/logger.js';

/**
 * Disaster Model
 * Handles all database operations for disasters table
 */
export class DisasterModel extends BaseModel {
  constructor() {
    super('disasters');
  }

  /**
   * Find disasters within a geographic radius
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @param {number} radiusMeters - Radius in meters (default: 50000)
   * @returns {Promise<Array>} Array of nearby disasters
   */
  async findNearby(lat, lng, radiusMeters = 50000) {
    try {
      const { data, error } = await this.supabase.rpc('get_nearby_disasters', {
        lat,
        lng,
        radius_meters: radiusMeters,
      });

      if (error) {
        // Fallback to manual query if function doesn't exist
        const { data: fallbackData, error: fallbackError } = await this.supabase
          .from(this.tableName)
          .select(
            `
            *,
            ST_Distance(
              location,
              ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)
            ) as distance_meters
          `
          )
          .filter('location', 'not.is', null);

        if (fallbackError) {
          throw fallbackError;
        }

        return fallbackData || [];
      }

      return data || [];
    } catch (error) {
      logger.error('Error finding nearby disasters:', error);
      throw error;
    }
  }

  /**
   * Find disasters by tags
   * @param {Array} tags - Array of tags to search for
   * @returns {Promise<Array>} Array of disasters matching tags
   */
  async findByTags(tags) {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .overlaps('tags', tags)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      logger.error('Error finding disasters by tags:', error);
      throw error;
    }
  }

  /**
   * Find disasters by owner
   * @param {string} ownerId - Owner user ID
   * @returns {Promise<Array>} Array of disasters owned by user
   */
  async findByOwner(ownerId) {
    try {
      return await this.findAll(
        { owner_id: ownerId },
        {
          orderBy: { column: 'created_at', ascending: false },
        }
      );
    } catch (error) {
      logger.error('Error finding disasters by owner:', error);
      throw error;
    }
  }

  /**
   * Search disasters by title or description
   * @param {string} searchTerm - Search term
   * @returns {Promise<Array>} Array of matching disasters
   */
  async search(searchTerm) {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      logger.error('Error searching disasters:', error);
      throw error;
    }
  }

  /**
   * Create a new disaster with location
   * @param {Object} disasterData - Disaster data
   * @returns {Promise<Object>} Created disaster
   */
  async createWithLocation(disasterData) {
    try {
      const data = { ...disasterData };

      // Handle location data
      if (data.latitude && data.longitude) {
        data.location = `POINT(${data.longitude} ${data.latitude})`;
        delete data.latitude;
        delete data.longitude;
      }

      return await this.create(data);
    } catch (error) {
      logger.error('Error creating disaster with location:', error);
      throw error;
    }
  }

  /**
   * Add audit trail entry to disaster
   * @param {string} disasterId - Disaster ID
   * @param {string} action - Action performed
   * @param {string} userId - User who performed action
   * @returns {Promise<Object>} Updated disaster
   */
  async addAuditTrail(disasterId, action, userId) {
    try {
      const disaster = await this.findById(disasterId);
      if (!disaster) {
        throw new Error('Disaster not found');
      }

      const auditEntry = {
        action,
        user_id: userId,
        timestamp: new Date().toISOString(),
      };

      const updatedAuditTrail = [...(disaster.audit_trail || []), auditEntry];

      return await this.update(disasterId, {
        audit_trail: updatedAuditTrail,
      });
    } catch (error) {
      logger.error('Error adding audit trail:', error);
      throw error;
    }
  }

  /**
   * Get disaster statistics
   * @returns {Promise<Object>} Statistics object
   */
  async getStatistics() {
    try {
      const total = await this.count();

      const { data: tagStats, error: tagError } = await this.supabase
        .from(this.tableName)
        .select('tags')
        .not('tags', 'is', null);

      if (tagError) {
        throw tagError;
      }

      // Count tag occurrences
      const tagCounts = {};
      tagStats?.forEach(record => {
        record.tags?.forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      });

      return {
        total,
        topTags: Object.entries(tagCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([tag, count]) => ({ tag, count })),
      };
    } catch (error) {
      logger.error('Error getting disaster statistics:', error);
      throw error;
    }
  }

  /**
   * Get recent disasters
   * @param {number} limit - Number of recent disasters to fetch
   * @returns {Promise<Array>} Array of recent disasters
   */
  async getRecent(limit = 10) {
    try {
      return await this.findAll(
        {},
        {
          orderBy: { column: 'created_at', ascending: false },
          limit,
        }
      );
    } catch (error) {
      logger.error('Error getting recent disasters:', error);
      throw error;
    }
  }
}

export default DisasterModel;
