/**
 * Migration Runner
 * Handles execution and management of database migrations
 */

import { logger } from '../../config/database.js';
import { MIGRATION_001 } from './001_initial_setup.js';

/**
 * Available migrations in execution order
 */
const MIGRATIONS = [MIGRATION_001];

/**
 * Run all pending migrations
 */
export const runMigrations = async () => {
  logger.info('🔄 Starting database migrations...');

  try {
    const results = [];

    for (const migration of MIGRATIONS) {
      logger.info(`Running migration ${migration.version}: ${migration.name}`);

      const startTime = Date.now();
      const result = await migration.up();
      const duration = Date.now() - startTime;

      results.push({
        ...result,
        duration: `${duration}ms`,
      });

      logger.info(`✅ Migration ${migration.version} completed in ${duration}ms`);
    }

    logger.info('🎉 All migrations completed successfully!');

    return {
      success: true,
      migrationsRun: results.length,
      results: results,
    };
  } catch (error) {
    logger.error('❌ Migration failed:', error);
    throw error;
  }
};

/**
 * Run a specific migration
 */
export const runMigration = async version => {
  const migration = MIGRATIONS.find(m => m.version === version);

  if (!migration) {
    throw new Error(`Migration ${version} not found`);
  }

  logger.info(`Running specific migration ${version}: ${migration.name}`);

  try {
    const startTime = Date.now();
    const result = await migration.up();
    const duration = Date.now() - startTime;

    logger.info(`✅ Migration ${version} completed in ${duration}ms`);

    return {
      ...result,
      duration: `${duration}ms`,
    };
  } catch (error) {
    logger.error(`❌ Migration ${version} failed:`, error);
    throw error;
  }
};

/**
 * Rollback a specific migration
 */
export const rollbackMigration = async version => {
  const migration = MIGRATIONS.find(m => m.version === version);

  if (!migration) {
    throw new Error(`Migration ${version} not found`);
  }

  if (!migration.down) {
    throw new Error(`Migration ${version} does not support rollback`);
  }

  logger.info(`Rolling back migration ${version}: ${migration.name}`);

  try {
    const startTime = Date.now();
    const result = await migration.down();
    const duration = Date.now() - startTime;

    logger.info(`✅ Migration ${version} rollback completed in ${duration}ms`);

    return {
      ...result,
      duration: `${duration}ms`,
    };
  } catch (error) {
    logger.error(`❌ Migration ${version} rollback failed:`, error);
    throw error;
  }
};

/**
 * Get migration status
 */
export const getMigrationStatus = async () => {
  try {
    const availableMigrations = MIGRATIONS.map(m => ({
      version: m.version,
      name: m.name,
      description: m.description,
    }));

    return {
      available: availableMigrations,
      total: MIGRATIONS.length,
    };
  } catch (error) {
    logger.error('Failed to get migration status:', error);
    throw error;
  }
};

/**
 * Check if database needs migration
 */
export const checkMigrationStatus = async () => {
  // This would typically check against a migrations table
  // For now, we'll assume migrations are needed
  return {
    needsMigration: true,
    pendingMigrations: MIGRATIONS.length,
  };
};

export default {
  runMigrations,
  runMigration,
  rollbackMigration,
  getMigrationStatus,
  checkMigrationStatus,
};
