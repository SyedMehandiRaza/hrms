const fs = require("fs");
const path = require("path");

const ErrorHandler = require("../src/utils/ErrorHandler");
const errorHandler = require("../src/middlewares/errorHandler");
const { MESSAGES, FIELD_MESSAGES } = require("../src/constants/messages");

// Contract Studio messages (ticket contract-studio#02): every standards §7.3 code and field
// message is in the catalog, in English and Arabic, with {{placeholders}} filled per error.

const standards = fs.readFileSync(path.resolve(__dirname, "../../docs/standards.md"), "utf8").replace(/\r\n/g, "\n");
const section73 = standards.slice(standards.indexOf("### 7.3"));
const codes73 = [...section73.matchAll(/^\| `([A-Z_]+)` \| (\d{3}) \| (.+) \|$/gm)].map(([, code, status, en]) => ({
  code,
  status: Number(status),
  en,
}));

// Runs an error through the real error middleware and returns { status, body }.
const respond = (err, acceptLanguage) => {
  const res = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  errorHandler(err, { headers: { "accept-language": acceptLanguage } }, res, () => {});
  return { status: res.statusCode, body: res.body };
};

describe("Contract Studio codes (standards §7.3)", () => {
  it("parses the §7.3 table (sanity check)", () => {
    expect(codes73.length).toBe(22);
  });

  it.each(codes73.filter(({ en }) => !en.includes("{{")))(
    "$code answers $status with the exact English text",
    ({ code, status, en }) => {
      const { status: got, body } = respond(new ErrorHandler(code), "en");
      expect(got).toBe(status);
      expect(body).toEqual({ success: false, code, message: en });
    }
  );

  it.each(codes73.map(({ code }) => code))("%s answers in Arabic with the same code", (code) => {
    const { body } = respond(new ErrorHandler(code, { params: { fields: "x", number: "y" } }), "ar");
    expect(body.code).toBe(code);
    expect(body.message).toBe(
      MESSAGES[code].ar.replace("{{fields}}", "x").replace("{{number}}", "y")
    );
    expect(body.message).not.toMatch(/\{\{/);
  });

  it("names the missing values in CONTRACT_FIELD_MISSING", () => {
    const { status, body } = respond(new ErrorHandler("CONTRACT_FIELD_MISSING", { params: { fields: "Designation, Project" } }), "en");
    expect(status).toBe(400);
    expect(body.message).toBe("Some contract values are missing: Designation, Project.");
  });

  it("names the active contract in CONTRACT_ACTIVE_EXISTS", () => {
    const { status, body } = respond(new ErrorHandler("CONTRACT_ACTIVE_EXISTS", { params: { number: "CON-2026-0007" } }), "en");
    expect(status).toBe(409);
    expect(body.message).toBe(
      "This recipient already has an active contract of this type (CON-2026-0007). Revoke it or wait for it to finish."
    );
  });

  it("keeps the error's English text filled in for logs", () => {
    const err = new ErrorHandler("CONTRACT_FIELD_MISSING", { params: { fields: "Designation" } });
    expect(err.message).toBe("Some contract values are missing: Designation.");
  });
});

describe("Contract Studio field messages (standards §7.3 forms)", () => {
  const formTexts = [...new Set([...section73.split("| Form |")[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]))];
  const byEnglish = (text) => Object.entries(FIELD_MESSAGES).find(([, m]) => m.en === text);

  it("parses the form table (sanity check)", () => {
    expect(formTexts.length).toBeGreaterThanOrEqual(40);
  });

  it.each(formTexts)("%s is a field message with an Arabic text", (text) => {
    const entry = byEnglish(text);
    expect(entry).toBeDefined();
    expect(entry[1].ar.trim()).not.toBe("");
  });

  it("translates field messages inside a validation error", () => {
    const err = new ErrorHandler("VALIDATION_FAILED", { errors: { reason: "contractReasonMin" } });
    expect(respond(err, "en").body.errors).toEqual({ reason: "Reason must be at least 10 characters" });
    expect(respond(err, "ar").body.errors).toEqual({ reason: FIELD_MESSAGES.contractReasonMin.ar });
  });

  it("stores the auto-revoke reason text", () => {
    expect(byEnglish("Recipient is no longer active.")).toBeDefined();
  });
});
