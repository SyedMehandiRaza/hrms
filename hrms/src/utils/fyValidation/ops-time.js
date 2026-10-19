// ─────────────────────────────────────────────────────────────────────────────
// Financial Year — time rules (attendance, corrections, overtime, shifts).
// Mirrors fyinder-backend-nodejs EXACTLY:
//   • week-off copy → backend newHrms/shift.service.js parseToFy / parseShiftIds
//     (to_fy: an integer 2000–2100; shift_ids: positive integers, at least one)
//   • closed period → backend newHrms/fiscalYear.service.js assertPeriodWritable
//     ("{{label}} is closed — reopen it to make changes", under the date field)
//   • shift name → utils/newHrms/shift.validation.js nameField (1–50 chars)
// Messages: fiscalYear:time.* (the backend's own EN / AR text).
// Change one side → change the other.
// ─────────────────────────────────────────────────────────────────────────────

export const TIME_LIMITS = {
  yearMin: 2000,
  yearMax: 2100,
  shiftNameMax: 50,
};

// parseToFy: a whole number between 2000 and 2100.
export const isValidToFy = (raw) => {
  if (raw === undefined || raw === null || raw === "") return false;
  const n = Number(raw);
  return Number.isInteger(n) && n >= TIME_LIMITS.yearMin && n <= TIME_LIMITS.yearMax;
};

// parseShiftIds (when sent): at least one, every id a positive integer.
export const isValidShiftIds = (list) =>
  Array.isArray(list) &&
  list.length > 0 &&
  list.every((x) => Number.isInteger(Number(x)) && Number(x) > 0);

// → { to_fy?, shift_ids? } messages for the week-off copy request.
export const validateWeekOffCopy = (t, { to_fy, shift_ids }) => {
  const errors = {};
  if (!isValidToFy(to_fy)) errors.to_fy = t("fiscalYear:time.validation.toFy");
  if (shift_ids !== undefined && !isValidShiftIds(shift_ids)) {
    errors.shift_ids = t("fiscalYear:time.validation.shiftIds");
  }
  return errors;
};

// react-hook-form `validate` for a request date: refuse a date that falls in a
// closed + locked financial year (the backend answers PeriodClosed under the
// same field). `lock` = useYearLock().
//   register("work_date", { validate: { closed: closedDateRule(t, lock, fy.years) } })
export const closedDateRule = (t, lock, years = []) => (value) => {
  if (!value || !lock?.isLockedDate?.(value)) return true;
  const d = String(value).slice(0, 10);
  const y = years.find((x) => x.is_locked && d >= x.start_date && d <= x.end_date);
  return t("fiscalYear:time.validation.periodClosed", { label: y?.label || lock.label });
};

// Shift timing change date (updateShiftSchema.effective_from + updateShiftService):
// "YYYY-MM-DD" (Joi pattern → "Enter a valid date"); today or later is always
// fine (later = scheduled); a past day only when its period is open — a closed
// + locked year is refused here, month locks are left to the server (409 under
// effective_from). Blank = today (the server's default).
export const SHIFT_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const shiftEffectiveFromRule = (t, { today, lock, years = [] }) => (value) => {
  if (value === undefined || value === null || value === "") return true;
  if (!SHIFT_DATE_PATTERN.test(String(value))) return t("fiscalYear:time.validation.dateInvalid");
  if (today && value < today) return closedDateRule(t, lock, years)(value);
  return true;
};

// react-hook-form rules for the shift name (createShiftSchema / updateShiftSchema).
export const shiftNameRules = (t) => ({
  validate: {
    required: (v) => !!String(v ?? "").trim() || t("fiscalYear:time.validation.shiftNameRequired"),
    max: (v) =>
      String(v ?? "").trim().length <= TIME_LIMITS.shiftNameMax ||
      t("fiscalYear:time.validation.shiftNameMax"),
  },
});
