const request = require("supertest");
const app = require("../src/app");
const { MESSAGES } = require("../src/constants/messages");

describe("GET /api/health", () => {
  it("returns 200 with status ok", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { status: "ok" } });
  });
});

describe("unknown routes", () => {
  it("returns 404 NOT_FOUND with the standard error shape", async () => {
    const res = await request(app).get("/api/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, code: "NOT_FOUND", message: "The requested record was not found." });
  });

  it("answers in Arabic for Accept-Language: ar", async () => {
    const res = await request(app).get("/api/does-not-exist").set("Accept-Language", "ar");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, code: "NOT_FOUND", message: MESSAGES.NOT_FOUND.ar });
  });
});

describe("malformed JSON", () => {
  it("returns 400 INVALID_JSON through the real app", async () => {
    const res = await request(app)
      .post("/api/health")
      .set("Content-Type", "application/json")
      .send("{not json");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, code: "INVALID_JSON", message: "Malformed JSON body" });
  });
});
