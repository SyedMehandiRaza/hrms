const crypto = require("crypto");

// Builds a minimal valid row for any model: fills every NOT NULL column that
// has no default, and creates required parent rows through their FKs.
const randomText = (length) =>
  crypto
    .randomBytes(Math.ceil(length / 2) + 4)
    .toString("hex")
    .slice(0, length);

let shortCode = 0;

const valueFor = (attr) => {
  const type = attr.type.key;
  switch (type) {
    case "CHAR":
      // Short codes (iso2, iso3, phone country): digits only, so never a real ISO code, and
      // unique within the run.
      if ((attr.type.options?.length || 255) <= 3) {
        shortCode += 1;
        return String(shortCode % 10 ** attr.type.options.length).padStart(attr.type.options.length, "0");
      }
    // falls through
    case "STRING": {
      const length = attr.type.options?.length || 255;
      return randomText(Math.min(length, 24));
    }
    case "TEXT":
      return "sample text";
    case "INTEGER":
    case "BIGINT":
    case "TINYINT":
    case "SMALLINT":
      return 1;
    case "DECIMAL":
      return 1;
    case "BOOLEAN":
      return true;
    case "DATEONLY":
      return "2026-01-15";
    case "DATE":
      return new Date();
    case "TIME":
      return "09:00:00";
    case "JSON":
      return {};
    case "ENUM":
      return attr.values[0];
    case "UUID":
      return crypto.randomUUID();
    default:
      throw new Error(`factory: no sample value for type ${type} (${attr.fieldName})`);
  }
};

const isAutoColumn = (name) => ["id", "created_at", "updated_at", "deleted_at", "createdAt", "updatedAt", "deletedAt"].includes(name);

const build = async (db, modelName, overrides = {}) => {
  const model = db[modelName];
  const values = {};

  for (const [name, attr] of Object.entries(model.rawAttributes)) {
    if (isAutoColumn(name) || name in overrides) continue;
    if (attr.allowNull !== false || attr.defaultValue !== undefined) continue;

    if (attr.references) {
      const parentTable = typeof attr.references === "string" ? attr.references : attr.references.model;
      const parent = Object.values(db.sequelize.models).find((m) => m.getTableName() === parentTable);
      if (!parent) throw new Error(`factory: no model for table ${parentTable}`);
      const parentRow = await build(db, parent.name);
      values[name] = parentRow.id;
    } else {
      values[name] = valueFor(attr);
    }
  }

  return model.create({ ...values, ...overrides });
};

module.exports = { build };
