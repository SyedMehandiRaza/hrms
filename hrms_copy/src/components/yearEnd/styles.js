// Shared look for the Financial Year screens (settings tab, year-end wizard,
// annual reports) — same classes as the exit settings / modals.

export const inputCls = (err) =>
  `w-full border rounded-lg px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-cyan-500 focus:outline-none focus:border-transparent transition disabled:bg-gray-50 disabled:text-gray-400 ${
    err ? "border-red-400 bg-red-50" : "border-gray-200 bg-white"
  }`;
export const labelCls = "block text-xs font-semibold text-gray-500 mb-1.5";
export const primaryBtn =
  "inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-cyan-600 hover:bg-cyan-700 text-white transition disabled:opacity-50 disabled:cursor-not-allowed";
export const secondaryBtn =
  "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed";
export const dangerBtn =
  "inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-700 text-white transition disabled:opacity-50 disabled:cursor-not-allowed";
export const cardCls = "bg-white border border-gray-200 rounded-xl";

// "YYYY-MM-DD" → formatted without a timezone shift.
export const DATE_OPTS = { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" };
export const DATETIME_OPTS = { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" };

// Pull an array out of the app's assorted list envelopes.
export const toArr = (res) => {
  const d = res?.data ?? res;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data;
  if (Array.isArray(d?.data?.data)) return d.data.data;
  if (Array.isArray(d?.rows)) return d.rows;
  if (Array.isArray(d?.data?.rows)) return d.data.rows;
  return [];
};
