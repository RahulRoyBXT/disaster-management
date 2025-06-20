import { ApiError } from '../utils/apiError.js';
import { logger } from '../utils/logger.js';

/**
 * Global error handler middleware
 * Catches and formats all errors in a consistent way
 */
const errorHandler = (err, req, res, next) => {
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

  // Check for Prisma errors
  if (err.name === 'PrismaClientKnownRequestError') {
    // Handle specific Prisma error codes
    if (err.code === 'P2002') {
      const message = 'Unique constraint violation';
      error = { message, statusCode: 409 };
    } else if (err.code === 'P2025') {
      const message = 'Record not found';
      error = { message, statusCode: 404 };
    } else if (err.code === 'P2003') {
      const message = 'Foreign key constraint violation';
      error = { message, statusCode: 400 };
    } else {
      const message = 'Database error';
      error = { message, statusCode: 500 };
    }
  }

  // Handle validation errors
  if (err.name === 'ValidationError') {
    const message = err.errors ? Object.values(err.errors).join(', ') : 'Validation error';
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

  // Handle custom ApiError instances
  if (err instanceof ApiError) {
    error = {
      message: err.message,
      statusCode: err.statusCode,
      errors: err.errors,
    };
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
        details: error.errors || error,
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

  return res.status(statusCode).json(errorResponse);
};

export default errorHandler;
