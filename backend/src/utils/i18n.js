const { MESSAGES, FIELD_MESSAGES } = require("../constants/messages");

const LANGS = ["en", "ar"];

// Accept-Language → "ar" when it starts with "ar" (e.g. "ar-SA,ar;q=0.9"), otherwise "en".
const resolveLang = (header) =>
  String(header || "")
    .trim()
    .toLowerCase()
    .startsWith("ar")
    ? "ar"
    : "en";

// Replaces {{name}} with params.name; placeholders without a value stay as they are.
const fill = (text, params) =>
  params ? text.replace(/\{\{(\w+)\}\}/g, (match, name) => (params[name] === undefined ? match : String(params[name]))) : text;

// Translates an error code or a field message key. Unknown keys come back
// unchanged, so a raw text (e.g. Joi's default message) still reaches the client.
const translate = (key, lang = "en", params) => {
  const entry = MESSAGES[key] || FIELD_MESSAGES[key];
  if (!entry) return key;
  return fill(entry[LANGS.includes(lang) ? lang : "en"], params);
};

module.exports = { resolveLang, translate, fill };
