const fs = require('fs');
const { Sequelize } = require('sequelize');
require('dotenv').config();

// Connection settings come either from one URL (DATABASE_URL; Render, Neon,
// local) or from separate parts (DB_HOST, DB_PORT, DB_NAME, DB_USER,
// DB_PASSWORD; AWS, where the password is injected from Secrets Manager and
// may contain characters that would need escaping in a URL).
const rawDatabaseUrl = process.env.DATABASE_URL;
const host = process.env.DB_HOST;

if (!rawDatabaseUrl && !host) {
  throw new Error('Set DATABASE_URL, or DB_HOST with DB_NAME, DB_USER and DB_PASSWORD');
}

// SSL is needed for most hosted databases when connecting from outside their
// private network: Render's *external* URL, Neon, Supabase, and Amazon RDS
// (which requires it). Turn it on with DATABASE_SSL=true or sslmode=require in
// the URL. Render's *internal* URL (what the API uses inside Render) does not
// need it.
const sslModeInUrl = /[?&]sslmode=(require|verify-ca|verify-full)\b/.test(rawDatabaseUrl || '');
const sslRequested = process.env.DATABASE_SSL === 'true' || sslModeInUrl;

// Sequelize copies URL query parameters such as sslmode into the driver
// options, where they would replace the SSL settings below (dropping the CA
// and verification choice). This file handles sslmode itself, so remove it.
const withoutSslMode = (url) => {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete('sslmode');
    return parsed.toString();
  } catch {
    return url;
  }
};
const databaseUrl = withoutSslMode(rawDatabaseUrl);

const dialectOptions = { application_name: 'CivicFixBackend' };
if (sslRequested) {
  dialectOptions.ssl = {
    require: true,
    // Some providers use certificates Node does not trust by default. Prefer
    // DATABASE_SSL_CA (a PEM bundle, e.g. Amazon RDS's, shipped in the Docker
    // image); set DATABASE_SSL_REJECT_UNAUTHORIZED=false only as a last resort.
    rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false',
  };
  if (process.env.DATABASE_SSL_CA) {
    dialectOptions.ssl.ca = fs.readFileSync(process.env.DATABASE_SSL_CA, 'utf8');
  }
}

const options = {
  dialect: 'postgres',
  logging: false,
  dialectOptions,
};

const sequelize = databaseUrl
  ? new Sequelize(databaseUrl, options)
  : new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
      ...options,
      host,
      port: Number(process.env.DB_PORT || 5432),
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
