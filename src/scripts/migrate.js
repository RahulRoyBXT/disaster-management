#!/usr/bin/env node

/**
 * Migration Runner CLI
 * Command-line interface for running database migrations
 */

import {
  runMigrations,
  runMigration,
  rollbackMigration,
  getMigrationStatus,
} from '../database/migrations/index.js';
import { logger } from '../utils/logger.js';
import { testConnection } from '../config/database.js';

const COMMANDS = {
  run: 'Run all pending migrations',
  'run <version>': 'Run a specific migration',
  'rollback <version>': 'Rollback a specific migration',
  status: 'Show migration status',
  help: 'Show this help message',
};

/**
 * Display help information
 */
function showHelp() {
  console.log('\n📚 Migration Runner CLI');
  console.log('Usage: npm run db:migrate <command> [options]\n');

  console.log('Available commands:');
  Object.entries(COMMANDS).forEach(([cmd, desc]) => {
    console.log(`  ${cmd.padEnd(20)} ${desc}`);
  });

  console.log('\nExamples:');
  console.log('  npm run db:migrate run          # Run all migrations');
  console.log('  npm run db:migrate run 001      # Run migration 001');
  console.log('  npm run db:migrate rollback 001 # Rollback migration 001');
  console.log('  npm run db:migrate status       # Show migration status');
}

/**
 * Main CLI function
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const version = args[1];

  // Show help if no command or help requested
  if (!command || command === 'help' || command === '-h' || command === '--help') {
    showHelp();
    return;
  }

  try {
    // Test database connection first
    logger.info('📡 Testing database connection...');
    const connected = await testConnection();

    if (!connected) {
      logger.error('❌ Failed to connect to database');
      process.exit(1);
    }

    // Execute command
    switch (command) {
      case 'run':
        if (version) {
          await handleRunSpecific(version);
        } else {
          await handleRunAll();
        }
        break;

      case 'rollback':
        if (!version) {
          logger.error('❌ Version required for rollback command');
          showHelp();
          process.exit(1);
        }
        await handleRollback(version);
        break;

      case 'status':
        await handleStatus();
        break;

      default:
        logger.error(`❌ Unknown command: ${command}`);
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    logger.error('❌ Migration command failed:', error);
    process.exit(1);
  }
}

/**
 * Handle running all migrations
 */
async function handleRunAll() {
  logger.info('🔄 Running all migrations...');

  const result = await runMigrations();

  console.log('\n✅ All migrations completed successfully!');
  console.log(`📊 Summary: ${result.migrationsRun} migrations executed`);

  result.results.forEach(migration => {
    console.log(
      `   • ${migration.version}: ${migration.queriesExecuted}/${migration.totalQueries} queries (${migration.duration})`
    );
  });
}

/**
 * Handle running a specific migration
 */
async function handleRunSpecific(version) {
  logger.info(`🔄 Running migration ${version}...`);

  const result = await runMigration(version);

  console.log(`\n✅ Migration ${version} completed successfully!`);
  console.log(
    `📊 Summary: ${result.queriesExecuted}/${result.totalQueries} queries executed (${result.duration})`
  );
}

/**
 * Handle rolling back a migration
 */
async function handleRollback(version) {
  logger.info(`🔄 Rolling back migration ${version}...`);

  const result = await rollbackMigration(version);

  console.log(`\n✅ Migration ${version} rollback completed successfully!`);
  console.log(`📊 Summary: Rollback completed in ${result.duration}`);
}

/**
 * Handle showing migration status
 */
async function handleStatus() {
  logger.info('📊 Getting migration status...');

  const status = await getMigrationStatus();

  console.log('\n📋 Migration Status:');
  console.log(`   • Total available migrations: ${status.total}`);

  console.log('\n📝 Available migrations:');
  status.available.forEach(migration => {
    console.log(`   • ${migration.version}: ${migration.name}`);
    if (migration.description) {
      console.log(`     ${migration.description}`);
    }
  });
}

// Run CLI if script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    logger.error('CLI error:', error);
    process.exit(1);
  });
}

export { main as migrationCLI };
