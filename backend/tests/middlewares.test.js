const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const Joi = require("joi");

process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "test-access-secret";

const requireAuth = require("../src/middlewares/requireAuth");
const requireRole = require("../src/middlewares/requireRole");
const validate = require("../src/middlewares/validate");
const language = require("../src/middlewares/language");
const errorHandler = require("../src/middlewares/errorHandler");
const ErrorHandler = require("../src/utils/ErrorHandler");
const { fieldErrorsFromJoi } = require("../src/utils/fieldErrors");
const { MESSAGES } = require("../src/constants/messages");

const loginSchema = Joi.object({
  email: Joi.string().trim().email().required().messages({
    "any.required": "emailRequired",
    "string.empty": "emailRequired",
    "string.email": "emailInvalid",
  }),
  password: Joi.string().required().messages({
    "any.required": "passwordRequired",
    "string.empty": "passwordRequired",
  }),
});

const buildApp = () => {
  const app = express();
  app.use(language);
  app.use(express.json());
  app.get("/protected", requireAuth, (req, res) => res.json({ success: true, data: req.user }));
  app.get("/admin-only", requireAuth, requireRole("ADMIN"), (req, res) => res.json({ success: true, data: {} }));
  app.post("/validated", validate(Joi.object({ name: Joi.string().min(2).required() })), (req, res) =>
    res.json({ success: true, data: req.body })
  );
  app.post("/login-like", validate(loginSchema), (req, res) => res.json({ success: true, data: req.body }));
  app.get("/lang", (req, res) => res.json({ success: true, data: { lang: req.lang } }));
  app.get("/boom", () => {
    throw new Error("secret internals");
  });
  app.get("/handled", (req, res, next) => next(new ErrorHandler("DEPARTMENT_NAME_TAKEN")));
  app.get("/handled-fields", (req, res, next) =>
    next(new ErrorHandler("VALIDATION_FAILED", { errors: { deptHeadId: "departmentHeadInvalid" } }))
  );
  app.use(errorHandler);
  return app;
};

const tokenFor = (payload, options = { expiresIn: "5m" }) =>
  jwt.sign(payload, process.env.JWT_ACCESS_SECRET, options);

describe("language", () => {
  const app = buildApp();

  it("defaults req.lang to en", async () => {
    const res = await request(app).get("/lang");
    expect(res.body.data.lang).toBe("en");
  });

  it("sets req.lang to ar for an Arabic Accept-Language", async () => {
    const res = await request(app).get("/lang").set("Accept-Language", "ar-SA,ar;q=0.9");
    expect(res.body.data.lang).toBe("ar");
  });
});

describe("requireAuth", () => {
  const app = buildApp();

  it("rejects a request without a token with 401 AUTH_REQUIRED", async () => {
    const res = await request(app).get("/protected");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, code: "AUTH_REQUIRED", message: "Please log in to continue." });
  });

  it("rejects a garbage token with 401 AUTH_REQUIRED", async () => {
    const res = await request(app).get("/protected").set("Authorization", "Bearer not-a-token");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, code: "AUTH_REQUIRED", message: "Please log in to continue." });
  });

  it("rejects an expired token with 401 AUTH_TOKEN_EXPIRED", async () => {
    const expired = tokenFor({ sub: "u1", exp: Math.floor(Date.now() / 1000) - 60 }, {});
    const res = await request(app).get("/protected").set("Authorization", `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      success: false,
      code: "AUTH_TOKEN_EXPIRED",
      message: "Your session has expired. Please log in again.",
    });
  });

  it("answers in Arabic when asked", async () => {
    const res = await request(app).get("/protected").set("Accept-Language", "ar");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, code: "AUTH_REQUIRED", message: MESSAGES.AUTH_REQUIRED.ar });
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

  it("returns 403 FORBIDDEN when the access level is not allowed", async () => {
    const res = await request(app)
      .get("/admin-only")
      .set("Authorization", `Bearer ${tokenFor({ sub: "u1", accessLevel: "EMPLOYEE" })}`);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ success: false, code: "FORBIDDEN", message: "You don't have permission to do this." });
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

  it("returns 400 VALIDATION_FAILED listing every invalid field", async () => {
    const res = await request(app).post("/login-like").send({ email: "not-an-email" });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false,
      code: "VALIDATION_FAILED",
      message: "Please fix the highlighted fields.",
      errors: { email: "Invalid email address", password: "Password is required" },
    });
  });

  it("returns the message and field messages in Arabic", async () => {
    const res = await request(app).post("/login-like").set("Accept-Language", "ar").send({ email: "not-an-email" });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false,
      code: "VALIDATION_FAILED",
      message: MESSAGES.VALIDATION_FAILED.ar,
      errors: { email: "البريد الإلكتروني غير صالح", password: "كلمة المرور مطلوبة" },
    });
  });

  it("treats empty strings as missing via the schema's keys", async () => {
    const res = await request(app).post("/login-like").send({ email: "", password: "" });
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual({ email: "Email is required", password: "Password is required" });
  });

  it("falls back to Joi's own text when a schema sets no message key", async () => {
    const res = await request(app).post("/validated").send({ name: "a" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_FAILED");
    expect(res.body.message).toBe("Please fix the highlighted fields.");
    expect(res.body.errors).toEqual({ name: '"name" length must be at least 2 characters long' });
  });

  it("passes valid bodies through, trimmed and stripped of unknown keys", async () => {
    const res = await request(app)
      .post("/login-like")
      .send({ email: "  sara@example.com ", password: "x", extra: true });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ email: "sara@example.com", password: "x" });
  });
});

describe("fieldErrorsFromJoi", () => {
  it("keeps only the first message per field and joins nested paths", () => {
    const schema = Joi.object({
      code: Joi.string()
        .min(5)
        .pattern(/^[a-z]+$/)
        .messages({ "string.min": "departmentCodeMax", "string.pattern.base": "departmentCodeNoEmoji" }),
      items: Joi.array().items(Joi.object({ label: Joi.string().required().messages({ "any.required": "nameRequired" }) })),
    });
    const { error } = schema.validate({ code: "A1", items: [{}, {}] }, { abortEarly: false });
    expect(fieldErrorsFromJoi(error)).toEqual({
      code: "departmentCodeMax",
      "items.0.label": "nameRequired",
      "items.1.label": "nameRequired",
    });
  });

  it("returns an empty map when there is no error", () => {
    expect(fieldErrorsFromJoi(undefined)).toEqual({});
  });
});

describe("ErrorHandler", () => {
  it("takes its status from the catalog", () => {
    const err = new ErrorHandler("DEPARTMENT_IN_USE");
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe("DEPARTMENT_IN_USE");
    expect(err.statusCode).toBe(409);
    expect(err.message).toBe("This department has employees and can't be deleted.");
    expect(err.errors).toBeUndefined();
  });

  it("carries a field error map", () => {
    const err = new ErrorHandler("VALIDATION_FAILED", { errors: { name: "departmentNameRequired" } });
    expect(err.statusCode).toBe(400);
    expect(err.errors).toEqual({ name: "departmentNameRequired" });
  });

  it("refuses a code that is not in the catalog", () => {
    expect(() => new ErrorHandler("NOT_A_CODE")).toThrow(/Unknown error code/);
  });
});

describe("errorHandler", () => {
  const app = buildApp();

  afterEach(() => jest.restoreAllMocks());

  it("hides unexpected errors behind 500 INTERNAL_ERROR and logs them", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    const res = await request(app).get("/boom");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      success: false,
      code: "INTERNAL_ERROR",
      message: "Something went wrong. Please try again.",
    });
    expect(JSON.stringify(res.body)).not.toMatch(/secret internals|at /);
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ message: "secret internals" }));
  });

  it("passes the ErrorHandler code, status and localized message through", async () => {
    const res = await request(app).get("/handled");
    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      success: false,
      code: "DEPARTMENT_NAME_TAKEN",
      message: "A department with this name already exists.",
    });

    const ar = await request(app).get("/handled").set("Accept-Language", "ar");
    expect(ar.status).toBe(409);
    expect(ar.body).toEqual({ success: false, code: "DEPARTMENT_NAME_TAKEN", message: MESSAGES.DEPARTMENT_NAME_TAKEN.ar });
  });

  it("translates field keys passed by a service", async () => {
    const res = await request(app).get("/handled-fields");
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual({ deptHeadId: "Select an active employee of this company." });
  });

  it("returns 400 INVALID_JSON for a malformed JSON body", async () => {
    const res = await request(app)
      .post("/login-like")
      .set("Content-Type", "application/json")
      .send('{"email": ');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, code: "INVALID_JSON", message: "Malformed JSON body" });
  });

  it("works without the language middleware (falls back to the header)", async () => {
    const bare = express();
    bare.get("/x", (req, res, next) => next(new ErrorHandler("NOT_FOUND")));
    bare.use(errorHandler);
    const res = await request(bare).get("/x").set("Accept-Language", "ar");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, code: "NOT_FOUND", message: MESSAGES.NOT_FOUND.ar });
  });
});
