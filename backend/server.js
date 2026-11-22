const dotenv = require('dotenv');

dotenv.config();

const { createApp } = require('./src/app');
const { connectDB } = require('./src/config/db');
const { syncSchema } = require('./src/config/schema');

const isProduction = process.env.NODE_ENV === 'production';
const allowDatabaseSync = process.env.DB_SYNC === 'true';
const configuredOrigins = (process.env.CORS_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean);

const PORT = Number(process.env.PORT || 5000);
const startServer = async () => {
  try {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must be configured with at least 32 characters');
    if (isProduction && configuredOrigins.length === 0) {
      // Start anyway so the mobile app (which sends no Origin) works and the
      // admin portal URL can be added after it is deployed. Until then every
      // browser origin is refused.
      console.warn('CORS_ORIGINS is not set: the admin portal will be blocked until it is configured.');
    }
    await connectDB();

    // This project currently has no migration runner. Production keeps sync disabled by
    // default; DB_SYNC=true is an explicit bootstrap switch for first deployment.
    if (!isProduction || allowDatabaseSync) {
      await syncSchema();
    }

    const app = createApp();
    app.listen(PORT, '0.0.0.0', () => console.log(`CivicFix API listening on port ${PORT}`));
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};
startServer();
