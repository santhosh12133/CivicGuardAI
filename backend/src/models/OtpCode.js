const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

// One-time codes: SMS sign-in codes, password-reset codes sent by email, and
// the short-lived hand-over codes used after "Sign in with Google". Only a
// hash of the code is stored.
const OtpCode = sequelize.define(
  'OtpCode',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    purpose: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    // Phone number, lower-case email, or user id, depending on purpose.
    target: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    code_hash: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    consumed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: 'otp_codes',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    underscored: true,
    indexes: [{ fields: ['purpose', 'target'] }],
  }
);

module.exports = { OtpCode };
