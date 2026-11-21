const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const issueRoutes = require('./routes/issueRoutes');
const errorHandler = require('./middleware/errorHandler');
const { createRateLimiter } = require('./middleware/rateLimiter');
const { sequelize } = require('./config/db');
const { UPLOADS_DIR, UPLOAD_NAME, findPhoto } = require('./utils/photoStore');

// Builds the Express application without opening a port or touching the
// database schema, so it can be started by server.js or by the test suite.
const createApp = () => {
  const app = express();
  const isProduction = process.env.NODE_ENV === 'production';
  app.disable('x-powered-by');
  if (isProduction) app.set('trust proxy', 1);

  const configuredOrigins = (process.env.CORS_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean);
  const corsOptions = {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (configuredOrigins.includes(origin)) return callback(null, true);
      if (!isProduction && configuredOrigins.length === 0) return callback(null, true);
      const error = new Error('Origin not allowed by CORS');
      error.statusCode = 403;
      return callback(error);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204,
  };

  app.use(cors(corsOptions));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (isProduction) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });

  // Global abuse protection. For multiple API instances, use a shared Redis-backed limiter.
  app.use(createRateLimiter({
    windowMs: 60 * 1000,
    max: 120,
    message: 'Too many requests. Please try again later.',
  }));

  // Evidence photos. The photos table is the durable copy (local files vanish
  // on restart/redeploy on hosts like Render's free tier). Files that exist
  // only on disk, from before photos were stored in the database, are still
  // served from the local folder.
  app.get('/uploads/:name', async (req, res, next) => {
    const { name } = req.params;
    if (!UPLOAD_NAME.test(name)) return res.status(404).json({ message: 'Photo not found' });
    res.set('Cache-Control', isProduction ? 'public, max-age=86400' : 'no-cache');
    try {
      const photo = await findPhoto(name);
      if (photo) {
        res.type(photo.mime_type);
        return res.send(photo.data);
      }
    } catch (error) {
      return next(error);
    }
    return res.sendFile(name, { root: UPLOADS_DIR, dotfiles: 'deny' }, (error) => {
      if (error && !res.headersSent) res.status(404).json({ message: 'Photo not found' });
    });
  });
  app.get('/', (req, res) => res.json({ service: 'CivicFix API', status: 'ok' }));
  app.get('/health', async (req, res) => {
    try {
      await sequelize.authenticate();
      return res.json({ status: 'ok', database: 'ok' });
    } catch (error) {
      return res.status(503).json({ status: 'degraded', database: 'unavailable' });
    }
  });
  app.use('/api/auth', authRoutes);
  app.use('/api/issues', issueRoutes);
  app.use(errorHandler);

  return app;
};

module.exports = { createApp };
