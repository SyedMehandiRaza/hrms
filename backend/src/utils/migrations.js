// Helpers for migrations that change a foreign-key column (MySQL).

// Drops whatever FK `table.column` has, sets the column's nullability, and adds FK `name`
// with the given ON DELETE. Needed because MySQL refuses NOT NULL on a column whose FK is
// ON DELETE SET NULL, and changeColumn() would add a second FK instead of replacing it.
const setForeignKey = async (queryInterface, { table, column, references, nullable, onDelete, name }) => {
  const q = (sql) => queryInterface.sequelize.query(sql);
  const [rows] = await q(
    `SELECT CONSTRAINT_NAME AS name FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table}' AND COLUMN_NAME = '${column}' AND REFERENCED_TABLE_NAME IS NOT NULL`
  );
  for (const row of rows) await q(`ALTER TABLE \`${table}\` DROP FOREIGN KEY \`${row.name}\``);
  await q(`ALTER TABLE \`${table}\` MODIFY \`${column}\` CHAR(36) BINARY ${nullable ? "NULL" : "NOT NULL"}`);
  await q(
    `ALTER TABLE \`${table}\` ADD CONSTRAINT \`${name}\` FOREIGN KEY (\`${column}\`) REFERENCES \`${references}\` (id) ON DELETE ${onDelete} ON UPDATE CASCADE`
  );
};

// Adds an index unless one with that name exists.
const addIndexOnce = async (queryInterface, table, fields, options) => {
  const [rows] = await queryInterface.sequelize.query(`SHOW INDEX FROM \`${table}\` WHERE Key_name = '${options.name}'`);
  if (!rows.length) await queryInterface.addIndex(table, fields, options);
};

module.exports = { setForeignKey, addIndexOnce };
