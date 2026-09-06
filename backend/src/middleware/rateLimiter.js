const buckets = new Map();

// Simple in-process limiter for single-instance deployments. For a multi-instance
// production deployment, replace this with a shared Redis-backed limiter.
const createRateLimiter = ({ windowMs, max, message }) => {
  return (req, res, next) => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const current = buckets.get(key);

    if (!current || now - current.startedAt >= windowMs) {
      buckets.set(key, { startedAt: now, count: 1 });
      return next();
    }

    current.count += 1;
    if (current.count > max) {
      const retryAfter = Math.max(1, Math.ceil((windowMs - (now - current.startedAt)) / 1000));
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ message });
    }

    return next();
  };
};

// Prevent unbounded growth when the service is exposed for a long time.
setInterval(() => {
  const cutoff = Date.now() - 15 * 60 * 1000;
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.startedAt < cutoff) buckets.delete(key);
  }
}, 5 * 60 * 1000).unref();

module.exports = { createRateLimiter };
