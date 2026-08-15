function notFoundHandler(req, res, next) {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;

  const response = {
    success: false,
    message: err.message || 'Internal server error',
    error: {}
  };

  if (process.env.NODE_ENV === 'development') {
    response.error = {
      stack: err.stack
    };
  }

  if (statusCode === 401) {
    response.message = 'Authentication required';
  }

  if (statusCode === 403) {
    response.message = 'Access denied';
  }

  return res.status(statusCode).json(response);
}

module.exports = {
  notFoundHandler,
  errorHandler
};
