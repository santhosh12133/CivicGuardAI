const { sequelize } = require('../config/db');
const { User, roles } = require('./User');
const { Issue, statuses } = require('./Issue');
const { IssueUpdate } = require('./IssueUpdate');
const { Photo } = require('./Photo');
const { Session } = require('./Session');
const { OtpCode } = require('./OtpCode');

// Who reported an issue.
Issue.belongsTo(User, { as: 'reporter', foreignKey: 'user_id', onDelete: 'SET NULL' });
User.hasMany(Issue, { as: 'issues', foreignKey: 'user_id', onDelete: 'SET NULL' });

// An issue's timeline; removed together with the issue.
Issue.hasMany(IssueUpdate, { as: 'updates', foreignKey: 'issue_id', onDelete: 'CASCADE' });
IssueUpdate.belongsTo(Issue, { foreignKey: 'issue_id', onDelete: 'CASCADE' });
IssueUpdate.belongsTo(User, { as: 'author', foreignKey: 'user_id', onDelete: 'SET NULL' });

// Signed-in devices; removed with the account.
Session.belongsTo(User, { foreignKey: 'user_id', onDelete: 'CASCADE' });
User.hasMany(Session, { foreignKey: 'user_id', onDelete: 'CASCADE' });

module.exports = {
  sequelize,
  User,
  Issue,
  IssueUpdate,
  Photo,
  Session,
  OtpCode,
  roles,
  statuses,
};
