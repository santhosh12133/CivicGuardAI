const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const authRoutes = require('./src/routes/authRoutes');
const issueRoutes = require('./src/routes/issueRoutes');
const errorHandler = require('./src/middleware/errorHandler');
const { createRateLimiter } = require('./src/middleware/rateLimiter');
const { connectDB, sequelize } = require('./src/config/db');

dotenv.config();

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
    return callback(new Error('Origin not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
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

app.use('/uploads', express.static(path.join(__dirname, 'uploads'), { index: false, dotfiles: 'deny', maxAge: isProduction ? '1d' : 0 }));
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

const PORT = Number(process.env.PORT || 5000);
const startServer = async () => {
  try {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must be configured with at least 32 characters');
    if (isProduction && configuredOrigins.length === 0) throw new Error('CORS_ORIGINS must be configured in production');
    await connectDB();
    if (!isProduction) await sequelize.sync();
    app.listen(PORT, '0.0.0.0', () => console.log(`CivicFix API listening on port ${PORT}`));
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};
startServer();
