const db = require("../src/models");
const { build } = require("./helpers/factory");

afterAll(async () => {
  await db.sequelize.close();
});

describe("User password field", () => {
  it("is excluded from default queries", async () => {
    const user = await build(db, "User", { password: "hashed-secret" });
    const found = await db.User.findByPk(user.id);
    expect(found.get("password")).toBeUndefined();
    expect(found.toJSON()).not.toHaveProperty("password");
  });

  it("is available through the withPassword scope", async () => {
    const user = await build(db, "User", { password: "hashed-secret" });
    const found = await db.User.scope("withPassword").findByPk(user.id);
    expect(found.get("password")).toBe("hashed-secret");
  });
});
