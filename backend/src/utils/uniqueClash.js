const { UniqueConstraintError } = require("sequelize");
const ErrorHandler = require("./ErrorHandler");

// Two saves at once can both pass a duplicate pre-check; the table's unique keys still
// stop the second. Runs save() and maps that error, by index name, to an error code:
// saveOrClash(() => Model.create(...), { uq_index_name: "SOME_NAME_TAKEN" }).
const saveOrClash = async (save, codesByIndex) => {
  try {
    return await save();
  } catch (err) {
    if (err instanceof UniqueConstraintError) {
      const text = [err.original && err.original.message, ...Object.keys(err.fields || {})].join(" ");
      const index = Object.keys(codesByIndex).find((key) => text.includes(key));
      if (index) throw new ErrorHandler(codesByIndex[index]);
    }
    throw err;
  }
};

module.exports = { saveOrClash };
