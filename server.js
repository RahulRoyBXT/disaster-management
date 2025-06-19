import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server as socketIoServer } from 'socket.io';

dotenv.config();

import app from './src/App.js';

const PORT = process.env.PORT || 3000;

// Create HTTP server
const httpServer = createServer(app);

// Create Socket.IO server with CORS configuration
const io = new socketIoServer(httpServer, {
  cors: {
    origin: ['http://localhost:5173'],
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

// Listen for incoming connections
io.on('connection', socket => {
  console.log('🔌 New client connected:', socket.id);

  socket.on('disconnect', reason => {});

  socket.on('error', error => {
    console.error('🔌 Socket error:', error);
  });
});

// Start the HTTP server with Socket.IO (NOT app.listen!)
httpServer.listen(PORT, () => {
  console.log(`🔌 WebSocket server ready`);
  console.log(`🚀 Server running on port ${PORT}`);
});
