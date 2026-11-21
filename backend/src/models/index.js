const { sequelize } = require('../config/db');
const { User, roles } = require('./User');
const { Issue, statuses } = require('./Issue');
const { Photo } = require('./Photo');

module.exports = {
  sequelize,
  User,
  Issue,
  Photo,
  roles,
  statuses,
};
