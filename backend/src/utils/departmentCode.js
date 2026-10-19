const CODE_MAX = 50;

// Derives a department code from its name: uppercased, max 50 chars. If the code is
// already taken in the company (case-insensitive), appends "-2", "-3", ... while
// keeping the result within 50 chars. Used to backfill departments without a code.
const deriveDepartmentCode = (name, takenCodes) => {
  const taken = new Set(takenCodes.filter(Boolean).map((code) => code.toUpperCase()));
  const base = String(name).trim().toUpperCase();
  let code = base.slice(0, CODE_MAX);
  for (let n = 2; taken.has(code); n += 1) {
    const suffix = `-${n}`;
    code = `${base.slice(0, CODE_MAX - suffix.length)}${suffix}`;
  }
  return code;
};

module.exports = { deriveDepartmentCode, CODE_MAX };
