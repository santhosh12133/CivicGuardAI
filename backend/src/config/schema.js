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
      const { type, allowNull, defaultValue, references, onDelete, onUpdate } = attribute;
      await queryInterface.addColumn(table, column, {
        type,
        allowNull: allowNull !== false || defaultValue === undefined ? true : allowNull,
        defaultValue,
        references,
        onDelete,
        onUpdate,
      });
      added.push(`${typeof table === 'string' ? table : table.tableName}.${column}`);
    }
  }
  if (added.length) console.log('Added database columns:', added.join(', '));
  return added;
};

module.exports = { syncSchema };
