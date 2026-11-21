const { Sequelize } = require('sequelize');
require('dotenv').config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set in the environment variables');
}

// SSL is needed for most hosted databases when connecting from outside their
// private network: Render's *external* URL (e.g. running scripts from your
// laptop), Neon, Supabase, etc. Turn it on with DATABASE_SSL=true or by
// putting sslmode=require in the URL. Render's *internal* URL (what the API
// uses inside Render) does not need it.
const sslRequested =
  process.env.DATABASE_SSL === 'true' || /[?&]sslmode=(require|verify-ca|verify-full)/.test(databaseUrl);

const dialectOptions = { application_name: 'CivicFixBackend' };
if (sslRequested) {
  dialectOptions.ssl = {
    require: true,
    // Some providers use certificates Node does not trust by default. Set
    // DATABASE_SSL_REJECT_UNAUTHORIZED=false only if the connection fails
    // with a certificate error.
    rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false',
  };
}

const sequelize = new Sequelize(databaseUrl, {
  dialect: 'postgres',
  logging: false,
  dialectOptions,
});

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established');
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error.message);
    throw error;
  }
};

module.exports = {
  sequelize,
  connectDB,
};
