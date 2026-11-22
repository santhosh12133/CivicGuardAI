const { sequelize } = require('./db');
// Loads every model and association.
require('../models');

/**
 * Creates missing tables and adds missing columns.
 *
 * sequelize.sync() creates tables that don't exist but never changes existing
 * ones, so a database created by an older version would lack new columns
 * (for example issues.category). This adds them, using each attribute's
 * default for existing rows. It never removes or alters columns.
 *
 * @returns {Promise<string[]>} the "table.column" names that were added
 */
const RELAXED_COLUMNS = [
  ['users', 'email'],
  ['users', 'password'],
];

const syncSchema = async () => {
  await sequelize.sync();

  const queryInterface = sequelize.getQueryInterface();
  const added = [];
  for (const model of Object.values(sequelize.models)) {
    const table = model.getTableName();
    const existing = await queryInterface.describeTable(table);
    for (const attribute of Object.values(model.rawAttributes)) {
      const column = attribute.field || attribute.fieldName;
      if (existing[column] || attribute.primaryKey) continue;
      const { type, allowNull, defaultValue, references, onDelete, onUpdate, unique } = attribute;
      await queryInterface.addColumn(table, column, {
        type,
        unique: Boolean(unique),
        allowNull: allowNull !== false || defaultValue === undefined ? true : allowNull,
        defaultValue,
        references,
        onDelete,
        onUpdate,
      });
      added.push(`${typeof table === 'string' ? table : table.tableName}.${column}`);
    }
  }
  // Columns that became optional in later versions (Google- and phone-only
  // accounts have no password; phone-only accounts have no email).
  for (const [table, column] of RELAXED_COLUMNS) {
    const columns = await queryInterface.describeTable(table);
    if (columns[column] && columns[column].allowNull === false) {
      await sequelize.query(`ALTER TABLE "${table}" ALTER COLUMN "${column}" DROP NOT NULL`);
      added.push(`${table}.${column} (now optional)`);
    }
  }

  if (added.length) console.log('Updated database schema:', added.join(', '));
  return added;
};

module.exports = { syncSchema };
