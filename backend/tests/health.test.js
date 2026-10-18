const request = require("supertest");
const app = require("../src/app");

describe("GET /api/health", () => {
  it("returns 200 with status ok", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { status: "ok" } });
  });
});

describe("unknown routes", () => {
  it("returns 404 with the standard error shape", async () => {
    const res = await request(app).get("/api/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, message: "Route not found" });
  });
});
