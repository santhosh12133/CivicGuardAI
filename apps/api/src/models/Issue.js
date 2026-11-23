const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { CATEGORY_IDS, DEFAULT_CATEGORY } = require('../constants/categories');

const statuses = ['Open', 'In Progress', 'Resolved'];
// Triage priority, lowest to highest.
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];

const Issue = sequelize.define(
  'Issue',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    photo_url: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    resolved_photo_url: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    latitude: {
      type: DataTypes.DECIMAL(9, 6),
      allowNull: false,
      validate: {
        min: -90,
        max: 90,
      },
    },
    longitude: {
      type: DataTypes.DECIMAL(9, 6),
      allowNull: false,
      validate: {
        min: -180,
        max: 180,
      },
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // Perceptual hash of the uploaded image for duplicate/fake detection
    phash: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    // Flag to mark issues that require manual review (e.g. when EXIF GPS is missing)
    needs_review: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    // What kind of problem it is (see constants/categories.js). A string rather
    // than an ENUM so new categories need no database migration.
    category: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: DEFAULT_CATEGORY,
      validate: {
        isIn: [CATEGORY_IDS],
      },
    },
    // The citizen who reported it. Null for reports made before this was
    // recorded, or if the account is later removed.
    user_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(...statuses),
      allowNull: false,
      defaultValue: 'Open',
    },
    // Internal triage fields, visible to staff and admins only.
    // A string rather than an ENUM so adding a level needs no migration.
    priority: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: 'normal',
      validate: {
        isIn: [PRIORITIES],
      },
    },
    // The staff member or admin responsible. Null when unassigned or if the
    // account is removed.
    assigned_to: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    // Target date for resolving the issue (calendar date, no time).
    due_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
  },
  {
    tableName: 'issues',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    underscored: true,
  }
);

module.exports = {
  Issue,
  statuses,
  PRIORITIES,
};
