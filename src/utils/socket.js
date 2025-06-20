/**
 * Socket.IO utility functions for emitting real-time events
 */

/**
 * Get the Socket.IO instance from the request object
 * @param {Object} req - Express request object
 * @returns {Object|null} Socket.IO instance or null if not available
 */
export const getSocket = req => {
  if (!req || !req.app) return null;
  return req.app.get('io');
};

/**
 * Emit a real-time event through Socket.IO
 * @param {Object} req - Express request object
 * @param {string} event - Event name
 * @param {Object} data - Event data
 * @returns {boolean} True if event was emitted, false otherwise
 */
export const emitEvent = (req, event, data) => {
  const io = getSocket(req);
  if (!io) return false;

  io.emit(event, {
    ...data,
    timestamp: new Date().toISOString(),
  });

  return true;
};

/**
 * Get active socket connection count
 * @param {Object} req - Express request object
 * @returns {number} Number of connected sockets
 */
export const getConnectedClientCount = req => {
  const io = getSocket(req);
  if (!io) return 0;

  return Object.keys(io.sockets.sockets).length;
};

export default {
  getSocket,
  emitEvent,
  getConnectedClientCount,
};
