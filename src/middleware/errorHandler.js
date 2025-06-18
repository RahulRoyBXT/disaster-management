import { logger } from '../utils/logger.js';

/**
 * Global error handler middleware
 * Catches and formats all errors in a consistent way
 */
export const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logger.error(`Error ${err.message}`, {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    stack: err.stack,
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = { message, statusCode: 404 };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    error = { message, statusCode: 400 };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors)
      .map(val => val.message)
      .join(', ');
    error = { message, statusCode: 400 };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = { message, statusCode: 401 };
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = { message, statusCode: 401 };
  }

  // Supabase errors
  if (err.code && err.message) {
    // Common Supabase error codes
    const supabaseErrors = {
      PGRST116: { message: 'Resource not found', statusCode: 404 },
      PGRST204: { message: 'Resource not found', statusCode: 404 },
      23505: { message: 'Duplicate entry', statusCode: 409 },
      23503: { message: 'Foreign key constraint violation', statusCode: 400 },
      23502: { message: 'Required field missing', statusCode: 400 },
      42501: { message: 'Insufficient permissions', statusCode: 403 },
    };

    if (supabaseErrors[err.code]) {
      error = supabaseErrors[err.code];
    }
  }

  // Rate limiting errors
  if (err.statusCode === 429) {
    error = {
      message: 'Too many requests, please try again later',
      statusCode: 429,
    };
  }

  // Default to 500 server error
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Server Error';

  // Prepare error response
  const errorResponse = {
    success: false,
    error: {
      message,
      statusCode,
      ...(process.env.NODE_ENV === 'development' && {
        stack: err.stack,
        details: error,
      }),
    },
  };

  // Add request context in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error.request = {
      method: req.method,
      url: req.url,
      params: req.params,
      query: req.query,
      body: req.body,
    };
  }

  res.status(statusCode).json(errorResponse);
};

export default errorHandler;
