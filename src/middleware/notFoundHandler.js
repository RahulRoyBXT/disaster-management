/**
 * 404 Not Found handler middleware
 * Handles requests to non-existent routes
 */
export const notFoundHandler = (req, res, next) => {
  const message = `Route ${req.originalUrl} not found`;

  res.status(404).json({
    success: false,
    error: {
      message,
      statusCode: 404,
      path: req.originalUrl,
      method: req.method,
      timestamp: new Date().toISOString(),
      availableEndpoints: {
        health: '/api/health',
        disasters: '/api/disasters',
        reports: '/api/reports',
        resources: '/api/resources',
        cache: '/api/cache',
      },
    },
  });
};

export default notFoundHandler;
