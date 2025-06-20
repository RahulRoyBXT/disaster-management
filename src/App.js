import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import errorHandler from './middleware/errorHandler.js';
import notFoundHandler from './middleware/notFoundHandler.js';
import cacheRoutes from './routes/cache.js';
import disasterRoutes from './routes/disasters.routes.js';
import reportRoutes from './routes/report.routes.js';
import resourceRoute from './routes/resources.routes.js';
import userRoute from './routes/users.route.js';

// import helmet from 'helmet';
// import morgan from 'morgan';
// import rateLimit from 'express-rate-limit';
// import dotenv from 'dotenv';

const app = express();

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
    origin: 'http://127.0.0.1:5500' || process.env.CORS_ORIGIN,
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
app.use(cookieParser());
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

// Resources route
app.use('/api/v1/resources', resourceRoute);

// Reports route
app.use('/api/v1/reports', reportRoutes);

// Cache routes
app.use('/api/v1/cache', cacheRoutes);

// Health check routes
import healthRoutes from './routes/health.js';
app.use('/api/v1/health', healthRoutes);

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
app.use(notFoundHandler);
app.use(errorHandler);

// Export the app without starting it here
// The server will be started in server.js with Socket.IO integration
export default app;
