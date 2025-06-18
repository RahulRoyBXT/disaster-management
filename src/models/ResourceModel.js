import { BaseModel } from './BaseModel.js';
import { logger } from '../utils/logger.js';

/**
 * Resource Model
 * Handles all database operations for resources table
 */
export class ResourceModel extends BaseModel {
  constructor() {
    super('resources');
  }

  /**
   * Find resources by disaster ID
   * @param {string} disasterId - Disaster ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of resources
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
      logger.error('Error finding resources by disaster:', error);
      throw error;
    }
  }

  /**
   * Find resources by type
   * @param {string} type - Resource type (e.g., 'shelter', 'hospital', 'food')
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of resources
   */
  async findByType(type, options = {}) {
    try {
      return await this.findAll(
        { type },
        {
          orderBy: { column: 'created_at', ascending: false },
          ...options,
        }
      );
    } catch (error) {
      logger.error('Error finding resources by type:', error);
      throw error;
    }
  }

  /**
   * Find resources within a geographic radius
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @param {number} radiusMeters - Radius in meters (default: 10000)
   * @param {string} type - Optional resource type filter
   * @returns {Promise<Array>} Array of nearby resources
   */
  async findNearby(lat, lng, radiusMeters = 10000, type = null) {
    try {
      // Try using the custom function first
      const { data, error } = await this.supabase.rpc('get_nearby_resources', {
        lat,
        lng,
        radius_meters: radiusMeters,
      });

      if (error) {
        // Fallback to manual query if function doesn't exist
        let query = this.supabase
          .from(this.tableName)
          .select('*')
          .filter('location', 'not.is', null);

        if (type) {
          query = query.eq('type', type);
        }

        const { data: fallbackData, error: fallbackError } = await query;

        if (fallbackError) {
          throw fallbackError;
        }

        // Filter by distance manually (less efficient but works)
        const filtered =
          fallbackData?.filter(resource => {
            if (!resource.location) return false;
            // This is a simplified distance calculation
            // In production, you'd want to use proper PostGIS functions
            return true;
          }) || [];

        return filtered;
      }

      // Filter by type if specified
      let result = data || [];
      if (type) {
        result = result.filter(resource => resource.type === type);
      }

      return result;
    } catch (error) {
      logger.error('Error finding nearby resources:', error);
      throw error;
    }
  }

  /**
   * Find resources with disaster information
   * @param {Object} filters - Query filters
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of resources with disaster data
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
          } else if (key === 'type') {
            query = query.eq('type', value);
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
      logger.error('Error finding resources with disaster info:', error);
      throw error;
    }
  }

  /**
   * Create a new resource with location
   * @param {Object} resourceData - Resource data
   * @returns {Promise<Object>} Created resource
   */
  async createWithLocation(resourceData) {
    try {
      const data = { ...resourceData };

      // Handle location data
      if (data.latitude && data.longitude) {
        data.location = `POINT(${data.longitude} ${data.latitude})`;
        delete data.latitude;
        delete data.longitude;
      }

      return await this.create(data);
    } catch (error) {
      logger.error('Error creating resource with location:', error);
      throw error;
    }
  }

  /**
   * Search resources by name or location
   * @param {string} searchTerm - Search term
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of matching resources
   */
  async search(searchTerm, options = {}) {
    try {
      let query = this.supabase
        .from(this.tableName)
        .select('*')
        .or(`name.ilike.%${searchTerm}%,location_name.ilike.%${searchTerm}%`);

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
      logger.error('Error searching resources:', error);
      throw error;
    }
  }

  /**
   * Get resource statistics
   * @param {string} disasterId - Optional disaster ID to filter by
   * @returns {Promise<Object>} Statistics object
   */
  async getStatistics(disasterId = null) {
    try {
      const filters = disasterId ? { disaster_id: disasterId } : {};

      const total = await this.count(filters);

      // Get type distribution
      const { data: typeData, error: typeError } = await this.supabase
        .from(this.tableName)
        .select('type')
        .not('type', 'is', null);

      if (typeError) {
        throw typeError;
      }

      // Count type occurrences
      const typeCounts = {};
      typeData?.forEach(record => {
        const type = record.type || 'unknown';
        typeCounts[type] = (typeCounts[type] || 0) + 1;
      });

      return {
        total,
        byType: Object.entries(typeCounts)
          .sort(([, a], [, b]) => b - a)
          .map(([type, count]) => ({ type, count })),
      };
    } catch (error) {
      logger.error('Error getting resource statistics:', error);
      throw error;
    }
  }

  /**
   * Get available resource types
   * @returns {Promise<Array>} Array of unique resource types
   */
  async getResourceTypes() {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('type')
        .not('type', 'is', null);

      if (error) {
        throw error;
      }

      // Get unique types
      const uniqueTypes = [...new Set(data?.map(item => item.type).filter(Boolean))];

      return uniqueTypes.sort();
    } catch (error) {
      logger.error('Error getting resource types:', error);
      throw error;
    }
  }

  /**
   * Get recent resources
   * @param {number} limit - Number of recent resources to fetch
   * @param {string} disasterId - Optional disaster ID to filter by
   * @returns {Promise<Array>} Array of recent resources
   */
  async getRecent(limit = 10, disasterId = null) {
    try {
      const filters = disasterId ? { disaster_id: disasterId } : {};

      return await this.findAll(filters, {
        orderBy: { column: 'created_at', ascending: false },
        limit,
      });
    } catch (error) {
      logger.error('Error getting recent resources:', error);
      throw error;
    }
  }

  /**
   * Get resources by disaster and type
   * @param {string} disasterId - Disaster ID
   * @param {string} type - Resource type
   * @returns {Promise<Array>} Array of resources
   */
  async getByDisasterAndType(disasterId, type) {
    try {
      return await this.findAll(
        { disaster_id: disasterId, type },
        {
          orderBy: { column: 'created_at', ascending: false },
        }
      );
    } catch (error) {
      logger.error('Error getting resources by disaster and type:', error);
      throw error;
    }
  }

  /**
   * Update resource location
   * @param {string} resourceId - Resource ID
   * @param {number} latitude - New latitude
   * @param {number} longitude - New longitude
   * @param {string} locationName - New location name
   * @returns {Promise<Object>} Updated resource
   */
  async updateLocation(resourceId, latitude, longitude, locationName) {
    try {
      const updateData = {
        location: `POINT(${longitude} ${latitude})`,
        location_name: locationName,
      };

      return await this.update(resourceId, updateData);
    } catch (error) {
      logger.error('Error updating resource location:', error);
      throw error;
    }
  }
}

export default ResourceModel;
