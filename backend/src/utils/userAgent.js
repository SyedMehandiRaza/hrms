// Short device name for the sessions list (D15): "Browser on OS", e.g. "Chrome on Windows".
// Only common browsers and systems are recognised; order matters because most browsers
// also claim to be Chrome/Safari (Edge and Opera before Chrome, Chrome before Safari)
// and iOS user agents say "like Mac OS X" (iOS before macOS, Android before Linux).
const BROWSERS = [
  ["Edge", /\bEdg(e|A|iOS)?\//],
  ["Opera", /\b(OPR|Opera|OPiOS)\//],
  ["Firefox", /\b(Firefox|FxiOS)\//],
  ["Chrome", /\b(Chrome|CriOS)\//],
  ["Safari", /\bVersion\/[\d.]+.*\bSafari\//],
];

const SYSTEMS = [
  ["Windows", /\bWindows\b/],
  ["iOS", /\b(iPhone|iPad|iPod)\b/],
  ["Android", /\bAndroid\b/],
  ["macOS", /\b(Macintosh|Mac OS X)\b/],
  ["Linux", /\bLinux\b/],
];

const UNKNOWN = "Unknown device";

const match = (list, ua) => (list.find(([, pattern]) => pattern.test(ua)) || [])[0];

const describeDevice = (userAgent) => {
  if (typeof userAgent !== "string" || !userAgent) return UNKNOWN;
  const browser = match(BROWSERS, userAgent);
  const os = match(SYSTEMS, userAgent);
  if (browser && os) return `${browser} on ${os}`;
  return browser || os || UNKNOWN;
};

module.exports = { describeDevice };
