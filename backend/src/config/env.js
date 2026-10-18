const path = require("path");
const dotenv = require("dotenv");

// Loads backend/.env (never read or logged directly).
dotenv.config({ path: path.resolve(__dirname, "../../.env"), quiet: true });

module.exports = process.env;
