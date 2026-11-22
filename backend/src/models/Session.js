const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

// A signed-in device or browser. The client holds a random refresh token;
// only its SHA-256 hash is stored. Short-lived access tokens (JWT) carry the
// session id, so revoking a session signs that device out at once.
const Session = sequelize.define(
  'Session',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    refresh_token_hash: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    // Hashes of refresh tokens this session already rotated away from. If one
    // is presented again, the token was copied: every session of the user is
    // revoked.
    previous_hashes: {
      type: DataTypes.ARRAY(DataTypes.STRING(64)),
      allowNull: false,
      defaultValue: [],
    },
    method: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'password',
    },
    user_agent: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    ip: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    last_used_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    revoked_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: 'sessions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    underscored: true,
  }
);

module.exports = { Session };
