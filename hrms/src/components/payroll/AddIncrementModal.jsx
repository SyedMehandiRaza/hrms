import { useMemo, useState } from "react";
import { MdClose, MdOutlineArrowForward } from "react-icons/md";
import { useTranslation } from "react-i18next";
import CustomDropdown from "../CustomDropdown";
import Ltr from "../Ltr";
import useFiscalYear from "../../hooks/useFiscalYear";
import { addEmployeeIncrement } from "../../data/groupE";
import {
  INCREMENT_APPLIES_TO,
  INCREMENT_TYPES,
  SINGLE_INCREMENT_LIMITS,
  previewIncrement,
  validateSingleIncrement,
} from "../../utils/fyValidation/payroll";

const money = (n, cur) =>
  n === null || n === undefined
    ? "—"
    : `${cur} ${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Add one employee's salary increment — applied at once (a new salary row from
// the 1st of the effective date's month). Mount it only while open.
//   <AddIncrementModal employeeId salary={current salary (salary API shape)}
//                      onClose onSaved={(increment) => …} />
export default function AddIncrementModal({ employeeId, salary, onClose, onSaved }) {
  const { t } = useTranslation("payroll");
  const fy = useFiscalYear();

  // The date may fall in any OPEN financial year (the backend refuses a
  // closed / locked one, a locked month and a month already paid).
  const openYears = fy.years.filter((y) => !y.is_locked && y.status !== "CLOSED");
  const minDate = openYears.length ? `${openYears.map((y) => y.start_date.slice(0, 7)).sort()[0]}-01` : undefined;
  const maxDate = openYears.length ? openYears.map((y) => y.end_date).sort().slice(-1)[0] : undefined;
  const initialDate = fy.today && (!minDate || fy.today >= minDate) && (!maxDate || fy.today <= maxDate) ? fy.today : minDate || "";

  const [form, setForm] = useState({
    type: "PERCENT",
    value: "",
    applies_to: "BASIC_ONLY",
    effective_date: initialDate,
    reason: "",
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const cur = salary?.currency || "INR";
  const mode = salary?.salary_calc_mode || "MONTHLY_FIXED";
  const lines = useMemo(
    () => [
      ...(salary?.earnings || []).map((l) => ({ ...l, type: "EARNING" })),
      ...(salary?.deductions || []).map((l) => ({ ...l, type: "DEDUCTION" })),
    ],
    [salary],
  );
  const preview = useMemo(
    () => previewIncrement({ lines, mode, type: form.type, value: form.value, applies_to: form.applies_to }),
    [lines, mode, form.type, form.value, form.applies_to],
  );

  const set = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => {
      if (!e[field]) return e;
      const next = { ...e };
      delete next[field];
      return next;
    });
  };

  const payload = () => ({
    type: form.type,
    value: String(form.value).trim(),
    applies_to: form.applies_to,
    effective_date: form.effective_date,
    reason: form.reason.trim(),
  });

  const save = async () => {
    const data = payload();
    const errs = validateSingleIncrement(t, data);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const saved = addEmployeeIncrement(employeeId, data);
      onSaved?.(saved);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = (err) =>
    `w-full h-[42px] border ${err ? "border-red-500" : "border-gray-200"} rounded-lg px-3 text-sm focus:outline-none focus:ring-1 ${err ? "focus:ring-red-500" : "focus:ring-cyan-500"}`;
  const basicLabel = mode === "HOURLY" ? t("addIncrement.hourlyRate") : t("addIncrement.basic");
  const changed = preview.newGross !== preview.oldGross || preview.newBasic !== preview.oldBasic;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh]" role="dialog" aria-modal="true">
        <div className="flex justify-between items-start gap-4 p-5 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{t("addIncrement.title")}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{t("addIncrement.subtitle")}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg" aria-label={t("addIncrement.cancel")}>
            <MdClose className="text-xl" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5">
          {/* Type + value */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                {t("addIncrement.type")} <span className="text-red-500">*</span>
              </label>
              <div className="inline-flex w-full border border-gray-200 rounded-lg overflow-hidden">
                {INCREMENT_TYPES.map((ty) => (
                  <button
                    key={ty}
                    type="button"
                    onClick={() => set("type", ty)}
                    className={`flex-1 h-[42px] text-sm font-semibold transition-colors border-e border-gray-200 last:border-e-0 ${
                      form.type === ty ? "bg-cyan-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {t(`increments.type.${ty}`)}
                  </button>
                ))}
              </div>
              {errors.type && <p className="text-red-500 text-xs mt-1">{errors.type}</p>}
            </div>
            <div>
              <label htmlFor="inc-value" className="block text-sm font-semibold text-gray-700 mb-1.5">
                {form.type === "PERCENT" ? t("addIncrement.percent") : t("addIncrement.amount")} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="inc-value"
                  type="text"
                  inputMode="decimal"
                  value={form.value}
                  onChange={(e) => set("value", e.target.value)}
                  placeholder={form.type === "PERCENT" ? "5" : "500.00"}
                  className={`${inputCls(errors.value)} pe-10`}
                  dir="ltr"
                />
                <span className="absolute end-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">
                  {form.type === "PERCENT" ? "%" : "+"}
                </span>
              </div>
              {errors.value && <p className="text-red-500 text-xs mt-1">{errors.value}</p>}
            </div>
          </div>

          {/* Applies to + effective date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t("addIncrement.appliesTo")}</label>
              <CustomDropdown
                value={form.applies_to}
                onChange={(e) => set("applies_to", e.target.value)}
                options={INCREMENT_APPLIES_TO.map((a) => ({ value: a, label: t(`increments.appliesTo.${a}`) }))}
                error={!!errors.applies_to}
                disabled={form.type === "AMOUNT"}
              />
              <p className="text-xs text-gray-400 mt-1">
                {form.type === "AMOUNT" ? t("increments.modal.amountHint") : t(`increments.modal.appliesHint.${form.applies_to}`)}
              </p>
              {errors.applies_to && <p className="text-red-500 text-xs mt-1">{errors.applies_to}</p>}
            </div>
            <div>
              <label htmlFor="inc-date" className="block text-sm font-semibold text-gray-700 mb-1.5">
                {t("addIncrement.effectiveDate")} <span className="text-red-500">*</span>
              </label>
              <input
                id="inc-date"
                type="date"
                value={form.effective_date}
                min={minDate}
                max={maxDate}
                onChange={(e) => set("effective_date", e.target.value)}
                className={inputCls(errors.effective_date)}
                dir="ltr"
              />
              <p className="text-xs text-gray-400 mt-1">{t("addIncrement.effectiveHint")}</p>
              {errors.effective_date && <p className="text-red-500 text-xs mt-1">{errors.effective_date}</p>}
            </div>
          </div>

          {/* Live preview */}
          <div className="border border-gray-100 rounded-xl p-4 bg-gray-50/60">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">{t("addIncrement.preview")}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { k: "basic", label: basicLabel, oldV: preview.oldBasic, newV: preview.newBasic },
                { k: "gross", label: t("addIncrement.gross"), oldV: preview.oldGross, newV: preview.newGross },
              ].map((row) => (
                <div key={row.k} className="bg-white border border-gray-100 rounded-lg px-3 py-2.5" data-testid={`preview-${row.k}`}>
                  <p className="text-xs text-gray-500">{row.label}</p>
                  <p className="text-sm font-semibold text-gray-900 mt-0.5 flex flex-wrap items-center gap-1.5">
                    <Ltr>{money(row.oldV, cur)}</Ltr>
                    <MdOutlineArrowForward className="text-gray-400 rtl:rotate-180" />
                    <Ltr><span className={changed ? "text-green-700" : ""}>{money(row.newV, cur)}</span></Ltr>
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Reason */}
          <div>
            <label htmlFor="inc-reason" className="block text-sm font-semibold text-gray-700 mb-1.5">
              {t("addIncrement.reason")} <span className="text-red-500">*</span>
            </label>
            <textarea
              id="inc-reason"
              rows={3}
              value={form.reason}
              maxLength={SINGLE_INCREMENT_LIMITS.reasonMax}
              onChange={(e) => set("reason", e.target.value)}
              placeholder={t("addIncrement.reasonPlaceholder")}
              className={`w-full border ${errors.reason ? "border-red-500" : "border-gray-200"} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 ${errors.reason ? "focus:ring-red-500" : "focus:ring-cyan-500"}`}
            />
            <div className="flex justify-between gap-2">
              {errors.reason ? <p className="text-red-500 text-xs mt-1">{errors.reason}</p> : <span />}
              <span className="text-xs text-gray-400 mt-1"><Ltr>{`${form.reason.trim().length}/${SINGLE_INCREMENT_LIMITS.reasonMax}`}</Ltr></span>
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-gray-100 bg-gray-50 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <button type="button" onClick={onClose} disabled={saving} className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-900 disabled:opacity-50">
            {t("addIncrement.cancel")}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="px-5 py-2.5 bg-cyan-600 text-white text-sm font-semibold rounded-lg hover:bg-cyan-700 disabled:opacity-50"
          >
            {saving ? t("addIncrement.saving") : t("addIncrement.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
