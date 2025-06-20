import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server as socketIoServer } from 'socket.io';
import cacheService from './src/services/cacheService.js';
import { logger } from './src/utils/logger.js';

dotenv.config();

import app from './src/App.js';

const PORT = process.env.PORT || 3000;

// Create HTTP server
const httpServer = createServer(app);

// Create Socket.IO server with CORS configuration
const io = new socketIoServer(httpServer, {
  cors: {
    origin: ['http://localhost:5173', 'http://127.0.0.1:5500'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 20000, // 20 seconds
  pingInterval: 25000, // 25 seconds
  allowEIO3: true, // Allow EIO v3 for compatibility
  maxHttpBufferSize: 1e8, // 100 MB
  perMessageDeflate: {
    threshold: 1024, // Compress messages larger than 1 KB
    zlib: {
      flush: import('zlib').Z_SYNC_FLUSH, // Use sync flush for better performance
    },
  },
});

// Attach Socket.IO to the Express app
app.set('io', io);

// Cache cleanup job
const cacheCleanupJob = {
  interval: null,
  start() {
    this.interval = setInterval(async () => {
      const count = await cacheService.cleanExpired();
      if (count > 0) {
        logger.info(`Cache cleanup job removed ${count} expired entries`);
      }
    }, 300000); // 5 minutes
  },
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  },
};

// Cache monitoring service
const cacheMonitorService = {
  interval: null,
  start(intervalMs = 60000) {
    this.interval = setInterval(async () => {
      try {
        const stats = await cacheService.getStats();
        logger.debug('Cache monitoring stats:', stats);
      } catch (error) {
        logger.error('Cache monitoring error:', error);
      }
    }, intervalMs);
    logger.info(`Cache monitoring started with ${intervalMs}ms interval`);
  },
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      logger.info('Cache monitoring stopped');
    }
  },
};

// Listen for incoming connections
io.on('connection', socket => {
  logger.info('🔌 New client connected:', socket.id);

  socket.on('disconnect', reason => {
    logger.info(`🔌 Client disconnected (${reason}):`, socket.id);
  });

  socket.on('error', error => {
    logger.error('🔌 Socket error:', error);
  });
});

// Start the HTTP server with Socket.IO (NOT app.listen!)
httpServer.listen(PORT, () => {
  logger.info(`🔌 WebSocket server ready`);
  logger.info(`🚀 Disaster Management Server running on port ${PORT}`);
  logger.info(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`� Health check: http://localhost:${PORT}/api/v1/health`);

  // Start the cache cleanup job
  cacheCleanupJob.start();
  logger.info('♻️ Cache cleanup job started');

  // Start cache monitoring
  cacheMonitorService.start();
  logger.info('📊 Cache monitoring started');
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');

  // Stop the cache cleanup job
  cacheCleanupJob.stop();
  logger.info('♻️ Cache cleanup job stopped');

  // Stop cache monitoring
  cacheMonitorService.stop();
  logger.info('� Cache monitoring stopped');

  httpServer.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');

  // Stop the cache cleanup job
  cacheCleanupJob.stop();
  logger.info('♻️ Cache cleanup job stopped');

  // Stop cache monitoring
  cacheMonitorService.stop();
  logger.info('📊 Cache monitoring stopped');

  httpServer.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});
