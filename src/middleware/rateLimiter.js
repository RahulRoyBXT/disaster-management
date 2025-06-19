import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger.js';

/**
 * Rate Limiting Configuration
 * Industry-standard rate limiting for API endpoints
 */

// General API rate limiting
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: 15 * 60, // 15 minutes in seconds
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip} on route: ${req.path}`);
    res.status(429).json({
      success: false,
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.round(req.rateLimit.resetTime / 1000),
    });
  },
});

// Strict rate limiting for external API calls (official updates, etc.)
export const externalApiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // limit each IP to 20 requests per hour for external API endpoints
  message: {
    success: false,
    error: 'Too many external API requests. Please try again later.',
    retryAfter: 60 * 60, // 1 hour in seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`External API rate limit exceeded for IP: ${req.ip} on route: ${req.path}`);
    res.status(429).json({
      success: false,
      error: 'Too many external API requests. Please try again later.',
      retryAfter: Math.round(req.rateLimit.resetTime / 1000),
    });
  },
});

// Authentication rate limiting
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 authentication requests per windowMs
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: 15 * 60, // 15 minutes in seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  handler: (req, res) => {
    logger.warn(`Auth rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      error: 'Too many authentication attempts, please try again later.',
      retryAfter: Math.round(req.rateLimit.resetTime / 1000),
    });
  },
});

// Create disaster rate limiting (prevent spam)
export const createDisasterLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 disaster creations per hour
  message: {
    success: false,
    error: 'Too many disaster reports created. Please try again later.',
    retryAfter: 60 * 60, // 1 hour in seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Create disaster rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      error: 'Too many disaster reports created. Please try again later.',
      retryAfter: Math.round(req.rateLimit.resetTime / 1000),
    });
  },
});

export default {
  generalLimiter,
  externalApiLimiter,
  authLimiter,
  createDisasterLimiter,
};
