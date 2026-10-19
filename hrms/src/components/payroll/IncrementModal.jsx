import { useMemo, useState } from "react";
import { MdClose } from "react-icons/md";
import { useTranslation } from "react-i18next";
import CustomDropdown from "../CustomDropdown";
import CustomMonthPicker from "../CustomMonthPicker";
import useFiscalYear from "../../hooks/useFiscalYear";
import { DEPARTMENTS, DESIGNATIONS, matches } from "../../data/common";
import { ACTIVE_EMPLOYEES, PAYROLL_PROJECTS, saveIncrementBatch } from "../../data/groupE";
import { INCREMENT_APPLIES_TO, INCREMENT_TYPES, validateIncrement } from "../../utils/fyValidation/payroll";

const pad = (n) => String(n).padStart(2, "0");

// Pick several items: a searchable dropdown adds one, chips remove it.
function MultiPick({ label, placeholder, options, selected, onChange, onSearchChange, error }) {
  const { t } = useTranslation("payroll");
  const byId = new Map(options.map((o) => [String(o.value), o.label]));
  const [labels, setLabels] = useState({}); // keep labels of picked items when the options change
  const remaining = options.filter((o) => !selected.includes(Number(o.value)));
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
      <CustomDropdown
        value=""
        onChange={(e) => {
          const id = Number(e.target.value);
          if (!id || selected.includes(id)) return;
          setLabels((m) => ({ ...m, [id]: byId.get(String(id)) }));
          onChange([...selected, id]);
        }}
        options={remaining}
        placeholder={placeholder}
        isSearchable
        onSearchChange={onSearchChange}
        error={!!error}
      />
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selected.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-1 ps-2.5 pe-1 py-1 rounded-full bg-cyan-50 border border-cyan-100 text-xs font-medium text-cyan-800"
            >
              {labels[id] || byId.get(String(id)) || t("increments.modal.itemFallback", { id })}
              <button
                type="button"
                onClick={() => onChange(selected.filter((x) => x !== id))}
                className="p-0.5 rounded-full hover:bg-cyan-100"
                aria-label={t("increments.modal.remove")}
              >
                <MdClose className="text-sm" />
              </button>
            </span>
          ))}
        </div>
      )}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}

// Create / edit a salary increment batch (DRAFT). Mount it only while open
// (key it per batch) — the form starts from `batch` or the defaults.
//   <IncrementModal key={…} batch={null|batch} onClose onSaved={(batch) => …} />
export default function IncrementModal({ batch, onClose, onSaved }) {
  const { t } = useTranslation("payroll");
  const fy = useFiscalYear();

  // The effective month may be any month of an OPEN financial year (the
  // backend refuses a closed / locked one) — a free calendar limited to them.
  const openYears = fy.years.filter((y) => !y.is_locked && y.status !== "CLOSED");
  const minMonth = openYears.length ? openYears.map((y) => y.start_date.slice(0, 7)).sort()[0] : undefined;
  const maxMonth = openYears.length ? openYears.map((y) => y.end_date.slice(0, 7)).sort().slice(-1)[0] : undefined;
  const fallbackMonth =
    (!minMonth || fy.defaultMonth >= minMonth) && (!maxMonth || fy.defaultMonth <= maxMonth)
      ? fy.defaultMonth
      : minMonth || fy.defaultMonth;

  const [form, setForm] = useState(() => ({
    title: batch?.title || "",
    type: batch?.type || "PERCENT",
    value: batch ? String(batch.value) : "",
    applies_to: batch?.applies_to || "BASIC_ONLY",
    month: batch ? `${batch.effective_year}-${pad(batch.effective_month)}` : fallbackMonth,
    department_ids: batch?.filters?.department_ids || [],
    project_ids: batch?.filters?.project_ids || [],
    designation_ids: batch?.filters?.designation_ids || [],
    employee_ids: batch?.filters?.employee_ids || [],
  }));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const departments = DEPARTMENTS;
  const designations = DESIGNATIONS;
  const projects = PAYROLL_PROJECTS;
  const [empSearch, setEmpSearch] = useState("");
  // Employees: searched on the client (today's staff).
  const employees = ACTIVE_EMPLOYEES.filter((e) => matches(e, empSearch.trim(), ["full_name", "employee_code"]));

  const set = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => {
      if (!e[field] && !(field === "month" && e.effective_month) && !field.endsWith("_ids")) return e;
      const next = { ...e };
      delete next[field];
      if (field === "month") delete next.effective_month;
      if (field.endsWith("_ids")) delete next.filters;
      return next;
    });
  };

  const payload = useMemo(() => {
    const filters = {};
    for (const k of ["department_ids", "project_ids", "designation_ids", "employee_ids"]) {
      if (form[k].length) filters[k] = form[k];
    }
    const [y, m] = (form.month || "").split("-");
    return {
      title: form.title.trim(),
      type: form.type,
      value: String(form.value).trim(),
      applies_to: form.applies_to,
      effective_month: m ? Number(m) : "",
      effective_year: y ? Number(y) : "",
      filters: Object.keys(filters).length ? filters : null,
    };
  }, [form]);

  const save = async () => {
    const errs = validateIncrement(t, payload);
    if (errs.effective_year && !errs.effective_month) errs.effective_month = errs.effective_year;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const saved = saveIncrementBatch(batch?.id, payload);
      onSaved?.(saved);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = (err) =>
    `w-full h-[42px] border ${err ? "border-red-500" : "border-gray-200"} rounded-lg px-3 text-sm focus:outline-none focus:ring-1 ${err ? "focus:ring-red-500" : "focus:ring-cyan-500"}`;
  const opt = (rows, nameKeys) =>
    rows.map((r) => ({ value: String(r.id), label: nameKeys.map((k) => r[k]).find(Boolean) || `#${r.id}` }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="flex justify-between items-start gap-4 p-5 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {batch ? t("increments.modal.editTitle") : t("increments.modal.createTitle")}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">{t("increments.modal.subtitle")}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg" aria-label={t("increments.modal.cancel")}>
            <MdClose className="text-xl" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              {t("increments.modal.title")} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              maxLength={150}
              onChange={(e) => set("title", e.target.value)}
              placeholder={t("increments.modal.titlePlaceholder")}
              className={inputCls(errors.title)}
            />
            {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
          </div>

          {/* Type + value */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                {t("increments.modal.type")} <span className="text-red-500">*</span>
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
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                {form.type === "PERCENT" ? t("increments.modal.percent") : t("increments.modal.amount")}{" "}
                <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
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

          {/* Applies to + effective month */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t("increments.modal.appliesTo")}</label>
              <CustomDropdown
                value={form.applies_to}
                onChange={(e) => set("applies_to", e.target.value)}
                options={INCREMENT_APPLIES_TO.map((a) => ({ value: a, label: t(`increments.appliesTo.${a}`) }))}
                error={!!errors.applies_to}
              />
              <p className="text-xs text-gray-400 mt-1">
                {form.type === "AMOUNT" ? t("increments.modal.amountHint") : t(`increments.modal.appliesHint.${form.applies_to}`)}
              </p>
              {errors.applies_to && <p className="text-red-500 text-xs mt-1">{errors.applies_to}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                {t("increments.modal.effectiveMonth")} <span className="text-red-500">*</span>
              </label>
              <CustomMonthPicker
                value={form.month}
                onChange={(val) => set("month", val)}
                fyBound={false}
                min={minMonth}
                max={maxMonth}
                className={`w-full h-[42px] ${errors.effective_month ? "border-red-500" : ""}`}
                containerClassName="w-full"
              />
              <p className="text-xs text-gray-400 mt-1">{t("increments.modal.effectiveHint")}</p>
              {errors.effective_month && <p className="text-red-500 text-xs mt-1">{errors.effective_month}</p>}
            </div>
          </div>

          {/* Who — every filter narrows the set; none = all direct employees */}
          <div className="border border-gray-100 rounded-xl p-4 space-y-4 bg-gray-50/50">
            <div>
              <p className="text-sm font-bold text-gray-900">{t("increments.modal.whoTitle")}</p>
              <p className="text-xs text-gray-500 mt-0.5">{t("increments.modal.whoHint")}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <MultiPick
                label={t("increments.modal.departments")}
                placeholder={t("increments.modal.allDepartments")}
                options={opt(departments, ["name", "department_name"])}
                selected={form.department_ids}
                onChange={(v) => set("department_ids", v)}
              />
              <MultiPick
                label={t("increments.modal.designations")}
                placeholder={t("increments.modal.allDesignations")}
                options={opt(designations, ["name", "designation_name", "title"])}
                selected={form.designation_ids}
                onChange={(v) => set("designation_ids", v)}
              />
              <MultiPick
                label={t("increments.modal.projects")}
                placeholder={t("increments.modal.allProjects")}
                options={opt(projects, ["project_name", "name"])}
                selected={form.project_ids}
                onChange={(v) => set("project_ids", v)}
              />
              <MultiPick
                label={t("increments.modal.employees")}
                placeholder={t("increments.modal.allEmployees")}
                options={opt(employees, ["full_name", "name"])}
                selected={form.employee_ids}
                onChange={(v) => set("employee_ids", v)}
                onSearchChange={setEmpSearch}
              />
            </div>
            {errors.filters && <p className="text-red-500 text-xs">{errors.filters}</p>}
          </div>
        </div>

        <div className="p-5 border-t border-gray-100 bg-gray-50 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <button type="button" onClick={onClose} disabled={saving} className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-900 disabled:opacity-50">
            {t("increments.modal.cancel")}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="px-5 py-2.5 bg-cyan-600 text-white text-sm font-semibold rounded-lg hover:bg-cyan-700 disabled:opacity-50"
          >
            {saving ? t("increments.modal.saving") : batch ? t("increments.modal.saveEdit") : t("increments.modal.saveCreate")}
          </button>
        </div>
      </div>
    </div>
  );
}
