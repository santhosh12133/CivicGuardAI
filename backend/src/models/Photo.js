const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

// Uploaded evidence photos, stored in PostgreSQL so they survive restarts and
// redeploys on hosts with an ephemeral filesystem (e.g. Render's free tier).
// `name` is the generated upload filename, which is also the last segment of
// the issue's photo_url / resolved_photo_url (…/uploads/<name>).
const Photo = sequelize.define(
  'Photo',
  {
    name: {
      type: DataTypes.STRING(100),
      primaryKey: true,
    },
    mime_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    size: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    data: {
      type: DataTypes.BLOB,
      allowNull: false,
    },
  },
  {
    tableName: 'photos',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    underscored: true,
  }
);

module.exports = { Photo };
