const crypto = require("crypto");

// Deterministic UUIDs so seeders can reference each other's rows by key.
const seedId = (key) => {
  const h = crypto.createHash("sha1").update(`hrms-seed:${key}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

const json = (value) => JSON.stringify(value);

// Deletes the given ids from each table, in the order given.
const deleteIds = async (queryInterface, plan) => {
  for (const [table, ids] of plan) {
    if (ids.length) await queryInterface.bulkDelete(table, { id: ids });
  }
};

module.exports = { seedId, json, deleteIds };
