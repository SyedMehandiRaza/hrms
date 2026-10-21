const { execSync } = require("child_process");
const path = require("path");

// Rebuild the test database from scratch on every run: proves every
// migration's up() and down() work, and gives the tests a clean schema.
// A failing step prints sequelize-cli's own output (which migration, which SQL error).
module.exports = async () => {
  const opts = {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, NODE_ENV: "test" },
    stdio: "pipe",
  };
  const run = (command) => {
    try {
      execSync(command, opts);
    } catch (err) {
      const output = [err.stdout, err.stderr].filter(Boolean).map(String).join("\n");
      throw new Error(`${command} failed:\n${output.split("\n").slice(-40).join("\n")}`);
    }
  };
  run("npx sequelize-cli db:migrate:undo:all");
  run("npx sequelize-cli db:migrate");
};
