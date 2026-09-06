const errorHandler = (err, req, res, next) => {
  console.error('Unhandled error:', err);

  const statusCode = err.statusCode || err.status || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  // Do not expose internal exception details in production. Validation and
  // explicitly created application errors may still provide their message.
  const message =
    statusCode >= 500 && isProduction
      ? 'Internal server error'
      : err.message || 'Internal server error';

  return res.status(statusCode).json({ message });
};

module.exports = errorHandler;
