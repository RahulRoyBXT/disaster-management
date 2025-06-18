import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';

dotenv.config();

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase configuration. Please check your .env file.');
}

// Create Supabase client with enhanced configuration
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  db: {
    schema: 'public',
  },
  global: {
    headers: {
      'X-Client-Info': 'disaster-management-backend',
    },
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Database connection health check
export const testConnection = async () => {
  try {
    // Test basic connectivity
    const { data, error } = await supabase.from('disasters').select('count').limit(1);

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = table doesn't exist yet
      logger.error('Database connection failed:', error);
      return false;
    }

    logger.info('✅ Database connection successful');
    return true;
  } catch (err) {
    logger.error('Database connection error:', err);
    return false;
  }
};

// Enhanced health check with schema validation
export const validateDatabaseSchema = async () => {
  try {
    const requiredTables = ['disasters', 'reports', 'resources', 'cache'];
    const results = {};

    for (const table of requiredTables) {
      try {
        const { error } = await supabase.from(table).select('count').limit(1);

        results[table] = !error;
      } catch (err) {
        results[table] = false;
      }
    }

    const allTablesExist = Object.values(results).every(exists => exists);

    logger.info('📊 Schema validation results:', results);

    return {
      valid: allTablesExist,
      tables: results,
    };
  } catch (err) {
    logger.error('Schema validation failed:', err);
    return {
      valid: false,
      error: err.message,
    };
  }
};

// Execute raw SQL with error handling
export const executeSQL = async (query, params = []) => {
  try {
    logger.debug('Executing SQL query:', query.substring(0, 100) + '...');

    const { data, error } = await supabase.rpc('exec', {
      sql: query,
      params,
    });

    if (error) {
      logger.error('SQL execution error:', error);
      throw error;
    }

    return data;
  } catch (err) {
    logger.error('SQL execution failed:', err);
    throw err;
  }
};

// Geospatial query helper
export const executeGeospatialQuery = async (functionName, params = {}) => {
  try {
    logger.debug(`Executing geospatial function: ${functionName}`, params);

    const { data, error } = await supabase.rpc(functionName, params);

    if (error) {
      logger.error(`Geospatial query error (${functionName}):`, error);
      throw error;
    }

    return data;
  } catch (err) {
    logger.error(`Geospatial query failed (${functionName}):`, err);
    throw err;
  }
};

// Database statistics helper
export const getDatabaseStats = async () => {
  try {
    const stats = {};

    // Get table row counts
    const tables = ['disasters', 'reports', 'resources', 'cache'];

    for (const table of tables) {
      try {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });

        stats[table] = error ? 0 : count;
      } catch (err) {
        stats[table] = 0;
      }
    }

    // Get cache stats if available
    try {
      const cacheStats = await executeGeospatialQuery('get_cache_stats');
      stats.cache_details = cacheStats[0] || {};
    } catch (err) {
      logger.debug('Cache stats not available yet');
    }

    return stats;
  } catch (err) {
    logger.error('Failed to get database stats:', err);
    return {};
  }
};

export default supabase;
