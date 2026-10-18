const { execSync } = require("child_process");
const path = require("path");

// Rebuild the test database from scratch on every run: proves every
// migration's up() and down() work, and gives the tests a clean schema.
module.exports = async () => {
  const opts = {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, NODE_ENV: "test" },
    stdio: "pipe",
  };
  execSync("npx sequelize-cli db:migrate:undo:all", opts);
  execSync("npx sequelize-cli db:migrate", opts);
};
