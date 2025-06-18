import compression from 'compression';
import cors from 'cors';
import express from 'express';

import disasterRoutes from './routes/disasters.routes.js';
import userRoute from './routes/users.route.js';
const app = express();

// Will add it later

// import helmet from 'helmet';
// import morgan from 'morgan';
// import rateLimit from 'express-rate-limit';

// import dotenv from 'dotenv';

// import { logger } from './utils/logger.js';
// import { errorHandler } from './middleware/errorHandler.js';
// import { notFoundHandler } from './middleware/notFoundHandler.js';

// Import route modules
// import disasterRoutes from './routes/disasters.js';
// import reportRoutes from './routes/reports.js';
// import resourceRoutes from './routes/resources.js';
// import cacheRoutes from './routes/cache.js';
// import healthRoutes from './routes/health.js';

// Load environment variables
// dotenv.config();

// Security middleware
// app.use(
//   helmet({
//     contentSecurityPolicy: {
//       directives: {
//         defaultSrc: ["'self'"],
//         styleSrc: ["'self'", "'unsafe-inline'"],
//         scriptSrc: ["'self'"],
//         imgSrc: ["'self'", 'data:', 'https:'],
//       },
//     },
//   })
// );

// CORS configuration
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
    optionsSuccessStatus: 200,
  })
);

// Rate limiting
// const limiter = rateLimit({
//   windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
//   max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
//   message: {
//     error: 'Too many requests from this IP, please try again later.',
//     retryAfter: '15 minutes',
//   },
//   standardHeaders: true,
//   legacyHeaders: false,
// });
// app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Logging middleware
// app.use(
//   morgan('combined', {
//     stream: {
//       write: message => logger.info(message.trim()),
//     },
//   })
// );

// Health check endpoint
// app.use('/api/health', healthRoutes);

// API routes
// app.use('/api/disasters', disasterRoutes);
// app.use('/api/reports', reportRoutes);
// app.use('/api/resources', resourceRoutes);
// app.use('/api/cache', cacheRoutes);

// Routes
// user route
app.use('/api/v1/users', userRoute);

// Disaster route
app.use('/api/v1/disasters', disasterRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Disaster Management Backend API',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      disasters: '/api/disasters',
      reports: '/api/reports',
      resources: '/api/resources',
      cache: '/api/cache',
    },
  });
});

// Error handling middleware
// app.use(notFoundHandler);
// app.use(errorHandler);

// Start server
// const server = app.listen(PORT, () => {
//   logger.info(`🚀 Disaster Management Server running on port ${PORT}`);
//   logger.info(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
//   logger.info(`📊 Health check: http://localhost:${PORT}/api/health`);
// });

// // Graceful shutdown handling
// process.on('SIGTERM', () => {
//   logger.info('SIGTERM received, shutting down gracefully');
//   server.close(() => {
//     logger.info('Process terminated');
//     process.exit(0);
//   });
// });

// process.on('SIGINT', () => {
//   logger.info('SIGINT received, shutting down gracefully');
//   server.close(() => {
//     logger.info('Process terminated');
//     process.exit(0);
//   });
// });

export default app;
