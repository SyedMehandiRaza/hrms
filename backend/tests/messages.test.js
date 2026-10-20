const fs = require("fs");
const path = require("path");

const { MESSAGES, FIELD_MESSAGES } = require("../src/constants/messages");
const { resolveLang, translate } = require("../src/utils/i18n");

// The catalog must match docs/standards.md §7 word for word, so the doc is the
// single source of truth and this test catches any drift.
// Line endings normalised: the checkout may use CRLF (core.autocrlf).
const standards = fs.readFileSync(path.resolve(__dirname, "../../docs/standards.md"), "utf8").replace(/\r\n/g, "\n");

const section = (startHeading, endPattern) => {
  const start = standards.indexOf(startHeading);
  const rest = standards.slice(start + startHeading.length);
  const end = rest.search(endPattern);
  return end === -1 ? rest : rest.slice(0, end);
};

// §7.1 (shared codes) and §7.3 (Contract Studio codes).
const docCodes = [section("### 7.1", /^### /m), section("### 7.3", /^##? /m)]
  .join("\n")
  .split("\n")
  .map((line) => line.match(/^\| `([A-Z_]+)` \| (\d{3}) \| (.+) \|$/))
  .filter(Boolean)
  .map(([, code, status, en]) => ({ code, status: Number(status), en }));

const docFieldTexts = [...new Set([...section("### 7.2", /^##? /m).matchAll(/"([^"]+)"/g)].map((m) => m[1]))];

// UI translations: same English → the backend must reuse the UI's Arabic.
const localesDir = path.resolve(__dirname, "../../hrms/src/locales");
const flatten = (obj, prefix = "", out = {}) => {
  Object.entries(obj).forEach(([key, value]) => {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object") flatten(value, full, out);
    else out[full] = value;
  });
  return out;
};
const loadLocale = (lang) =>
  fs.readdirSync(path.join(localesDir, lang)).reduce((acc, file) => {
    const ns = path.basename(file, ".json");
    return { ...acc, ...flatten(JSON.parse(fs.readFileSync(path.join(localesDir, lang, file), "utf8")), ns) };
  }, {});
const uiEn = loadLocale("en");
const uiAr = loadLocale("ar");
const uiArabicFor = (english) =>
  Object.keys(uiEn)
    .filter((key) => uiEn[key] === english)
    .map((key) => uiAr[key])
    .filter(Boolean);

describe("message catalog (standards §7.1 and §7.3)", () => {
  it("parses the standards table (sanity check)", () => {
    expect(docCodes.length).toBeGreaterThanOrEqual(40);
  });

  it("has exactly the codes listed in standards §7.1 and §7.3", () => {
    expect(Object.keys(MESSAGES).sort()).toEqual(docCodes.map((c) => c.code).sort());
  });

  it.each(docCodes)("$code has status $status and the exact English text", ({ code, status, en }) => {
    expect(MESSAGES[code].status).toBe(status);
    expect(MESSAGES[code].en).toBe(en);
  });

  it.each(Object.keys(MESSAGES))("%s has an Arabic text", (code) => {
    expect(typeof MESSAGES[code].ar).toBe("string");
    expect(MESSAGES[code].ar.trim()).not.toBe("");
    expect(MESSAGES[code].ar).not.toBe(MESSAGES[code].en);
  });
});

describe("field messages (standards §7.2)", () => {
  const catalogEnglish = new Set([
    ...Object.values(FIELD_MESSAGES).map((m) => m.en),
    ...Object.values(MESSAGES).map((m) => m.en),
  ]);

  it("parses the standards table (sanity check)", () => {
    expect(docFieldTexts.length).toBeGreaterThanOrEqual(30);
  });

  it.each(docFieldTexts)("%s is in the catalog", (text) => {
    expect(catalogEnglish.has(text)).toBe(true);
  });

  it.each(Object.keys(FIELD_MESSAGES))("%s is a §7.2 text with an Arabic translation", (key) => {
    const { en, ar } = FIELD_MESSAGES[key];
    expect(docFieldTexts).toContain(en);
    expect(typeof ar).toBe("string");
    expect(ar.trim()).not.toBe("");
    expect(ar).not.toBe(en);
  });

  it("does not duplicate a top-level text as a field key", () => {
    const codeTexts = new Set(Object.values(MESSAGES).map((m) => m.en));
    Object.values(FIELD_MESSAGES).forEach(({ en }) => expect(codeTexts.has(en)).toBe(false));
  });
});

describe("Arabic reuse from the UI", () => {
  const entries = [
    ...Object.entries(MESSAGES),
    ...Object.entries(FIELD_MESSAGES),
  ].filter(([, { en }]) => uiArabicFor(en).length > 0);

  it("finds UI strings to reuse (sanity check)", () => {
    expect(entries.length).toBeGreaterThan(10);
  });

  it.each(entries)("%s reuses the UI's Arabic", (key, { en, ar }) => {
    expect(uiArabicFor(en)).toContain(ar);
  });
});

describe("resolveLang", () => {
  it.each([
    [undefined, "en"],
    ["", "en"],
    ["en", "en"],
    ["en-US,en;q=0.9", "en"],
    ["en-US,ar;q=0.8", "en"],
    ["fr", "en"],
    ["ar", "ar"],
    ["AR", "ar"],
    ["ar-SA,ar;q=0.9,en;q=0.8", "ar"],
    [" ar", "ar"],
  ])("%p → %s", (header, lang) => {
    expect(resolveLang(header)).toBe(lang);
  });
});

describe("translate", () => {
  it("resolves a code in both languages", () => {
    expect(translate("NOT_FOUND", "en")).toBe("The requested record was not found.");
    expect(translate("NOT_FOUND", "ar")).toBe(MESSAGES.NOT_FOUND.ar);
  });

  it("resolves a field key in both languages", () => {
    expect(translate("emailRequired", "en")).toBe("Email is required");
    expect(translate("emailRequired", "ar")).toBe("البريد الإلكتروني مطلوب");
  });

  it("falls back to English for an unknown language", () => {
    expect(translate("NOT_FOUND", "fr")).toBe("The requested record was not found.");
  });

  it("returns an unknown key unchanged", () => {
    expect(translate("not a key", "ar")).toBe("not a key");
  });
});
