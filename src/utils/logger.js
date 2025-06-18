import winston from 'winston';

// Define log levels and colors
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Add colors to winston
winston.addColors(logColors);

// Define format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
);

// Define format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.uncolorize(),
  winston.format.json()
);

// Define transports
const transports = [
  // Console transport
  new winston.transports.Console({
    level: process.env.LOG_LEVEL || 'info',
    format: consoleFormat,
  }),

  // File transport for errors
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    format: fileFormat,
  }),

  // File transport for all logs
  new winston.transports.File({
    filename: 'logs/combined.log',
    format: fileFormat,
  }),
];

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels: logLevels,
  format: fileFormat,
  transports,
  exitOnError: false,
});

// Handle uncaught exceptions and unhandled rejections
logger.exceptions.handle(new winston.transports.File({ filename: 'logs/exceptions.log' }));

logger.rejections.handle(new winston.transports.File({ filename: 'logs/rejections.log' }));

// Create logs directory if it doesn't exist
import { existsSync, mkdirSync } from 'fs';
if (!existsSync('logs')) {
  mkdirSync('logs');
}

// Export logger
export { logger };
export default logger;
