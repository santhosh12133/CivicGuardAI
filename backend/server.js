const dotenv = require('dotenv');

dotenv.config();

const { createApp } = require('./src/app');
const { connectDB, sequelize } = require('./src/config/db');

const isProduction = process.env.NODE_ENV === 'production';
const allowDatabaseSync = process.env.DB_SYNC === 'true';
const configuredOrigins = (process.env.CORS_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean);

const PORT = Number(process.env.PORT || 5000);
const startServer = async () => {
  try {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must be configured with at least 32 characters');
    if (isProduction && configuredOrigins.length === 0) throw new Error('CORS_ORIGINS must be configured in production');
    await connectDB();

    // This project currently has no migration runner. Production keeps sync disabled by
    // default; DB_SYNC=true is an explicit bootstrap switch for first deployment.
    if (!isProduction || allowDatabaseSync) {
      await sequelize.sync();
    }

    const app = createApp();
    app.listen(PORT, '0.0.0.0', () => console.log(`CivicFix API listening on port ${PORT}`));
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};
startServer();
