const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const roles = ['citizen', 'staff', 'admin'];

const User = sequelize.define(
  'User',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // Stored lower-case. Null for accounts created with a phone number only.
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    // E.164 format, e.g. +919876543210. Used for SMS one-time-code sign-in.
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      unique: true,
    },
    // Google account id ("sub") for "Sign in with Google".
    google_id: {
      type: DataTypes.STRING(64),
      allowNull: true,
      unique: true,
    },
    // bcrypt hash. Null for accounts that only sign in with Google or a phone code.
    password: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    role: {
      type: DataTypes.ENUM(...roles),
      allowNull: false,
      defaultValue: 'citizen',
    },
    // Lock-out after repeated wrong passwords.
    failed_logins: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    locked_until: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: 'users',
    timestamps: true,
    underscored: true,
  }
);

module.exports = {
  User,
  roles,
};
