const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const Joi = require("joi");

process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "test-access-secret";

const requireAuth = require("../src/middlewares/requireAuth");
const requireRole = require("../src/middlewares/requireRole");
const validate = require("../src/middlewares/validate");
const errorHandler = require("../src/middlewares/errorHandler");
const ErrorHandler = require("../src/utils/ErrorHandler");

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.get("/protected", requireAuth, (req, res) => res.json({ success: true, data: req.user }));
  app.get("/admin-only", requireAuth, requireRole("ADMIN"), (req, res) => res.json({ success: true, data: {} }));
  app.post(
    "/validated",
    validate(Joi.object({ name: Joi.string().min(2).required() })),
    (req, res) => res.json({ success: true, data: req.body })
  );
  app.get("/boom", () => {
    throw new Error("secret internals");
  });
  app.get("/handled", (req, res, next) => next(new ErrorHandler(409, "Already exists")));
  app.use(errorHandler);
  return app;
};

const tokenFor = (payload) => jwt.sign(payload, process.env.JWT_ACCESS_SECRET, { expiresIn: "5m" });

describe("requireAuth", () => {
  const app = buildApp();

  it("rejects a request without a token with 401", async () => {
    const res = await request(app).get("/protected");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: "Authentication required" });
  });

  it("rejects an invalid token with 401", async () => {
    const res = await request(app).get("/protected").set("Authorization", "Bearer not-a-token");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: "Invalid or expired token" });
  });

  it("accepts a valid token and exposes the payload on req.user", async () => {
    const res = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${tokenFor({ sub: "u1", accessLevel: "EMPLOYEE" })}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ sub: "u1", accessLevel: "EMPLOYEE" });
  });
});

describe("requireRole", () => {
  const app = buildApp();

  it("returns 403 when the access level is not allowed", async () => {
    const res = await request(app)
      .get("/admin-only")
      .set("Authorization", `Bearer ${tokenFor({ sub: "u1", accessLevel: "EMPLOYEE" })}`);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ success: false, message: "You do not have permission to perform this action" });
  });

  it("allows an allowed access level", async () => {
    const res = await request(app)
      .get("/admin-only")
      .set("Authorization", `Bearer ${tokenFor({ sub: "u1", accessLevel: "ADMIN" })}`);
    expect(res.status).toBe(200);
  });
});

describe("validate", () => {
  const app = buildApp();

  it("returns 400 with the first validation message", async () => {
    const res = await request(app).post("/validated").send({ name: "a" });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('"name" length must be at least 2 characters long');
  });

  it("passes valid bodies through", async () => {
    const res = await request(app).post("/validated").send({ name: "Sara" });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ name: "Sara" });
  });
});

describe("errorHandler", () => {
  const app = buildApp();

  it("hides unexpected errors behind a generic 500 message", async () => {
    const res = await request(app).get("/boom");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, message: "Internal server error" });
  });

  it("passes ErrorHandler status and message through", async () => {
    const res = await request(app).get("/handled");
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, message: "Already exists" });
  });
});
