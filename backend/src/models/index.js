const { sequelize } = require('../config/db');
const { User, roles } = require('./User');
const { Issue, statuses } = require('./Issue');
const { IssueUpdate } = require('./IssueUpdate');
const { Photo } = require('./Photo');

// Who reported an issue.
Issue.belongsTo(User, { as: 'reporter', foreignKey: 'user_id', onDelete: 'SET NULL' });
User.hasMany(Issue, { as: 'issues', foreignKey: 'user_id', onDelete: 'SET NULL' });

// An issue's timeline; removed together with the issue.
Issue.hasMany(IssueUpdate, { as: 'updates', foreignKey: 'issue_id', onDelete: 'CASCADE' });
IssueUpdate.belongsTo(Issue, { foreignKey: 'issue_id', onDelete: 'CASCADE' });
IssueUpdate.belongsTo(User, { as: 'author', foreignKey: 'user_id', onDelete: 'SET NULL' });

module.exports = {
  sequelize,
  User,
  Issue,
  IssueUpdate,
  Photo,
  roles,
  statuses,
};
