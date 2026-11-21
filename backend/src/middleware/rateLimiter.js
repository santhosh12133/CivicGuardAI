// Simple in-process limiter for single-instance deployments. For a multi-instance
// production deployment, replace this with a shared Redis-backed limiter.
// Each limiter keeps its own counters, so a strict limit on sign-in endpoints
// does not share a budget with the general API limit.
const allBuckets = new Set();

const createRateLimiter = ({ windowMs, max, message, keyFor }) => {
  const buckets = new Map();
  allBuckets.add({ buckets, windowMs });

  return (req, res, next) => {
    const key = (keyFor && keyFor(req)) || req.ip || req.socket.remoteAddress || 'unknown';
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
  const now = Date.now();
  for (const { buckets, windowMs } of allBuckets) {
    for (const [key, bucket] of buckets.entries()) {
      if (now - bucket.startedAt > Math.max(windowMs, 15 * 60 * 1000)) buckets.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

module.exports = { createRateLimiter };
