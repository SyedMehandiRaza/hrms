// Locale-aware date/number formatting.
// Default keeps LATIN numerals even in Arabic (business-friendly, IDs/amounts
// stay readable) while localizing month names. Flip USE_ARABIC_NUMERALS to
// true for Arabic-Indic digits (٠١٢…).
const USE_ARABIC_NUMERALS = false;

const localeFor = (lng) =>
  lng === "ar" ? (USE_ARABIC_NUMERALS ? "ar" : "ar-u-nu-latn") : "en-US";

export const formatDate = (value, lng = "en", options) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat(
    localeFor(lng),
    options || { year: "numeric", month: "short", day: "2-digit" },
  ).format(d);
};

export const formatNumber = (value, lng = "en", options) => {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return new Intl.NumberFormat(localeFor(lng), options).format(n);
};
