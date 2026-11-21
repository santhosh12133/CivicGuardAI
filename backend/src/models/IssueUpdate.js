const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

// One entry in an issue's public timeline: the report itself, a status change,
// a note from staff, or a resolution photo. Citizens see these in the app.
const IssueUpdate = sequelize.define(
  'IssueUpdate',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    issue_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    // Who made the change (null if that account was removed).
    user_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    from_status: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    to_status: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    photo_url: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: 'issue_updates',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    underscored: true,
  }
);

module.exports = { IssueUpdate };
