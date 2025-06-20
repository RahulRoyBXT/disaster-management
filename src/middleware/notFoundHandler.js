// 404 Not Found handler middleware
//  Handles requests to non-existent routes

const notFoundHandler = (req, res, next) => {
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
        root: '/',
        users: '/api/v1/users',
        disasters: '/api/v1/disasters',
        resources: '/resources',
      },
    },
  });
};

export default notFoundHandler;
