#!/usr/bin/env node

/**
 * Database Setup Script
 * Sets up the complete database schema using modular migrations
 */

import { testConnection, validateDatabaseSchema, getDatabaseStats } from '../config/database.js';
import { runMigrations, getMigrationStatus } from '../database/migrations/index.js';
import { SCHEMA_METADATA } from '../database/index.js';
import { logger } from '../utils/logger.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Main setup function
 */
async function setupDatabase() {
  logger.info('🚀 Starting database setup...');

  try {
    // Step 1: Test database connection
    logger.info('📡 Testing database connection...');
    const connectionOk = await testConnection();

    if (!connectionOk) {
      throw new Error('Failed to connect to database. Please check your Supabase configuration.');
    }

    // Step 2: Check current migration status
    logger.info('🔍 Checking migration status...');
    const migrationStatus = await getMigrationStatus();
    logger.info(`Found ${migrationStatus.total} available migrations`);

    // Step 3: Run migrations
    logger.info('🔄 Running database migrations...');
    const migrationResults = await runMigrations();

    logger.info(`✅ Successfully ran ${migrationResults.migrationsRun} migrations`);

    // Step 4: Validate schema
    logger.info('✅ Validating database schema...');
    const schemaValidation = await validateDatabaseSchema();

    if (!schemaValidation.valid) {
      logger.warn('⚠️  Some schema validation issues found:', schemaValidation.tables);
    } else {
      logger.info('✅ Database schema validation passed');
    }

    // Step 5: Get database statistics
    logger.info('📊 Gathering database statistics...');
    const stats = await getDatabaseStats();

    // Step 6: Display setup summary
    displaySetupSummary(migrationResults, schemaValidation, stats);

    logger.info('🎉 Database setup completed successfully!');

    return {
      success: true,
      migrations: migrationResults,
      schema: schemaValidation,
      stats: stats,
      metadata: SCHEMA_METADATA,
    };
  } catch (error) {
    logger.error('❌ Database setup failed:', error);

    // Display troubleshooting information
    displayTroubleshootingInfo(error);

    process.exit(1);
  }
}

/**
 * Display setup summary
 */
function displaySetupSummary(migrationResults, schemaValidation, stats) {
  console.log('\n' + '='.repeat(60));
  console.log('📋 DATABASE SETUP SUMMARY');
  console.log('='.repeat(60));

  console.log('\n🔄 Migration Results:');
  console.log(`   • Migrations executed: ${migrationResults.migrationsRun}`);
  migrationResults.results.forEach(result => {
    console.log(
      `   • ${result.version}: ${result.queriesExecuted}/${result.totalQueries} queries (${result.duration})`
    );
  });

  console.log('\n📊 Schema Validation:');
  console.log(`   • Overall status: ${schemaValidation.valid ? '✅ VALID' : '❌ INVALID'}`);
  Object.entries(schemaValidation.tables || {}).forEach(([table, exists]) => {
    console.log(`   • ${table}: ${exists ? '✅' : '❌'}`);
  });

  console.log('\n📈 Database Statistics:');
  Object.entries(stats).forEach(([key, value]) => {
    if (typeof value === 'object') {
      console.log(`   • ${key}:`);
      Object.entries(value).forEach(([subKey, subValue]) => {
        console.log(`     - ${subKey}: ${subValue}`);
      });
    } else {
      console.log(`   • ${key}: ${value} records`);
    }
  });

  console.log('\n🛠️  Schema Metadata:');
  console.log(`   • Version: ${SCHEMA_METADATA.version}`);
  console.log(`   • Tables: ${Object.keys(SCHEMA_METADATA.tables).length}`);
  console.log(`   • Functions: ${Object.values(SCHEMA_METADATA.functions).flat().length}`);
  console.log(`   • Extensions: ${SCHEMA_METADATA.extensions.join(', ')}`);

  console.log('\n' + '='.repeat(60));
}

/**
 * Display troubleshooting information
 */
function displayTroubleshootingInfo(error) {
  console.log('\n' + '!'.repeat(60));
  console.log('🔧 TROUBLESHOOTING INFORMATION');
  console.log('!'.repeat(60));

  console.log('\n❌ Error Details:');
  console.log(`   • ${error.message}`);

  console.log('\n🔍 Common Issues and Solutions:');
  console.log('   1. Invalid Supabase credentials:');
  console.log('      → Check SUPABASE_URL and SUPABASE_ANON_KEY in .env file');
  console.log('   2. Missing PostGIS extension:');
  console.log('      → Enable PostGIS in your Supabase project dashboard');
  console.log('   3. Insufficient permissions:');
  console.log('      → Ensure your Supabase key has necessary permissions');
  console.log('   4. Network connectivity issues:');
  console.log('      → Check your internet connection and firewall settings');

  console.log('\n📋 Environment Check:');
  console.log(`   • SUPABASE_URL: ${process.env.SUPABASE_URL ? '✅ Set' : '❌ Missing'}`);
  console.log(`   • SUPABASE_ANON_KEY: ${process.env.SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`   • Node.js version: ${process.version}`);

  console.log('\n' + '!'.repeat(60));
}

/**
 * Command line interface
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  // Script is being run directly
  setupDatabase()
    .then(() => {
      process.exit(0);
    })
    .catch(error => {
      logger.error('Setup script failed:', error);
      process.exit(1);
    });
}

export default setupDatabase;
