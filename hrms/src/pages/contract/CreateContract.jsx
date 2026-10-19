import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import {
  MdOutlineAssignment,
  MdOutlineEventNote,
  MdSend,
  MdInfoOutline,
  MdOutlineLightbulb,
  MdOutlineChevronRight,
} from "react-icons/md";

import CustomDropdown from "../../components/CustomDropdown";
import FieldError from "../../components/FieldError";
import { Spinner } from "../../components/Loader";
import { useFormat } from "../../hooks/useFormat";
import { validateContractTerm } from "../../utils/fyValidation/misc";
import { EMPLOYEES, matches } from "../../data/common";
import { LEGACY_CONTRACT_TEMPLATES, addLegacyContract } from "../../data/groupF";
import { ContractTermFields } from "./ContractTermModal";

// Send an employee contract from a template, with its term (start / end /
// renewal due). POST /contracts — limits mirror sendContractSchema.
const NAME_MAX = 255;
const NOTES_MAX = 2000;

const inputCls = (bad) =>
  `w-full px-4 py-2.5 border rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#20B2AA] transition-colors ${
    bad ? "border-red-400 bg-red-50" : "border-gray-200 bg-gray-50 focus:bg-white"
  }`;
const labelCls = "block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2";

const EMPTY = { template_id: "", employee_id: "", name: "", notes: "", start_date: "", end_date: "", renewal_due: "" };

export default function CreateContract() {
  const { t } = useTranslation("contracts");
  const navigate = useNavigate();
  const { fmtDate } = useFormat();

  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const templates = { loaded: true, rows: LEGACY_CONTRACT_TEMPLATES.filter((x) => x.status !== "ARCHIVED") };
  const [employees, setEmployees] = useState({ loaded: true, rows: EMPLOYEES });
  // kept apart from the list: a later search may drop it from the options
  const [employee, setEmployee] = useState(null);

  // client-side search over the static staff list
  const onEmployeeSearch = (q) => {
    const search = String(q || "").trim();
    setEmployees({ loaded: true, rows: EMPLOYEES.filter((x) => matches(x, search, ["full_name", "employee_code", "email"])) });
  };

  // Same rules as the backend (required ids, max lengths, term dates).
  const validate = (v) => {
    const out = validateContractTerm(t, v);
    if (!v.template_id) out.template_id = t("create.validation.templateRequired");
    if (!v.employee_id) out.employee_id = t("create.validation.employeeRequired");
    if (v.name.trim().length > NAME_MAX) out.name = t("create.validation.nameMax", { max: NAME_MAX });
    if (v.notes.trim().length > NOTES_MAX) out.notes = t("create.validation.notesMax", { max: NOTES_MAX });
    return out;
  };

  const change = (field, value) => {
    const next = { ...values, [field]: value };
    setValues(next);
    setErrors(touched ? validate(next) : { ...errors, [field]: undefined });
  };

  const template = templates.rows.find((x) => String(x.id) === String(values.template_id));

  const submit = async (e) => {
    e.preventDefault();
    setTouched(true);
    const errs = validate(values);
    setErrors(errs);
    if (Object.keys(errs).length || saving) return;
    setSaving(true);
    try {
      addLegacyContract({
        template_id: Number(values.template_id),
        name: values.name.trim() || template?.name || "",
        notes: values.notes.trim(),
        start_date: values.start_date || null,
        end_date: values.end_date || null,
        renewal_due: values.renewal_due || null,
        recipients: [
          {
            id: Date.now(),
            employee_id: Number(values.employee_id),
            recipient_name: employee?.full_name || null,
            recipient_email: employee?.email || null,
            role: "PRIMARY_SIGNER",
            status: "SENT",
          },
        ],
      });
      toast.success(t("create.sent"));
      navigate("/admin/contracts");
    } finally {
      setSaving(false);
    }
  };

  const hasErrors = Object.values(errors).some(Boolean);
  const termText = values.start_date
    ? values.end_date
      ? `${fmtDate(values.start_date)} – ${fmtDate(values.end_date)}`
      : t("details.indefiniteRange", { start: fmtDate(values.start_date) })
    : "—";

  return (
    <form noValidate onSubmit={submit} className="space-y-6 pb-10 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-sm flex-wrap mb-2">
            <Link to="/admin/contracts" className="text-gray-400 hover:text-cyan-600 transition-colors">
              {t("title")}
            </Link>
            <MdOutlineChevronRight className="text-gray-300 rtl:rotate-180" />
            <span className="text-cyan-600 font-semibold">{t("create.breadcrumb")}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{t("create.title")}</h1>
          <p className="text-sm text-gray-500">{t("create.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/admin/contracts")}
          className="px-5 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors self-start"
        >
          {t("create.cancel")}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6 min-w-0">
          {/* Basic information */}
          <section className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-6 text-gray-900">
              <MdOutlineAssignment className="text-xl text-[#20B2AA]" />
              <h2 className="text-base font-bold">{t("create.basicInformation")}</h2>
            </div>
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="min-w-0">
                  <label className={labelCls}>
                    {t("create.template")} <span className="text-red-500">*</span>
                  </label>
                  <CustomDropdown
                    value={values.template_id}
                    onChange={(e) => change("template_id", e.target.value)}
                    error={!!errors.template_id}
                    disabled={!templates.loaded || saving}
                    placeholder={templates.loaded ? t("create.selectTemplate") : t("create.loading")}
                    options={templates.rows.map((x) => ({ label: x.name, value: String(x.id) }))}
                  />
                  <FieldError message={errors.template_id} />
                  {templates.loaded && !templates.rows.length && (
                    <p className="text-xs text-gray-400 mt-1.5">{t("create.noTemplates")}</p>
                  )}
                </div>
                <div className="min-w-0">
                  <label className={labelCls}>
                    {t("create.employeeSelection")} <span className="text-red-500">*</span>
                  </label>
                  <CustomDropdown
                    value={values.employee_id}
                    onChange={(e) => {
                      const picked = employees.rows.find((x) => String(x.id) === String(e.target.value));
                      if (picked) setEmployee(picked);
                      change("employee_id", e.target.value);
                    }}
                    error={!!errors.employee_id}
                    disabled={!employees.loaded || saving}
                    isSearchable
                    onSearchChange={onEmployeeSearch}
                    placeholder={employees.loaded ? t("create.selectEmployee") : t("create.loading")}
                    options={[
                      ...(employee && !employees.rows.some((x) => String(x.id) === String(employee.id))
                        ? [{ label: employee.full_name || `#${employee.id}`, value: String(employee.id) }]
                        : []),
                      ...employees.rows.map((x) => ({ label: x.full_name || `#${x.id}`, value: String(x.id) })),
                    ]}
                  />
                  <FieldError message={errors.employee_id} />
                </div>
              </div>
              <div>
                <label htmlFor="contract-name" className={labelCls}>
                  {t("create.contractNameOptional")}
                </label>
                <input
                  id="contract-name"
                  type="text"
                  value={values.name}
                  maxLength={NAME_MAX}
                  disabled={saving}
                  onChange={(e) => change("name", e.target.value)}
                  placeholder={template?.name || t("create.contractNamePlaceholder")}
                  aria-invalid={!!errors.name}
                  className={inputCls(!!errors.name)}
                />
                <FieldError message={errors.name} />
              </div>
            </div>
          </section>

          {/* Term */}
          <section className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-2 text-gray-900">
              <MdOutlineEventNote className="text-xl text-[#20B2AA]" />
              <h2 className="text-base font-bold">{t("details.contractDates")}</h2>
            </div>
            <p className="text-xs text-gray-500 mb-5">{t("term.hint")}</p>
            <ContractTermFields values={values} errors={errors} onChange={change} disabled={saving} />
          </section>

          {/* Notes */}
          <section className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-6 text-gray-900">
              <MdOutlineAssignment className="text-xl text-[#20B2AA]" />
              <h2 className="text-base font-bold">{t("create.additionalNotes")}</h2>
            </div>
            <textarea
              rows="4"
              value={values.notes}
              maxLength={NOTES_MAX}
              disabled={saving}
              onChange={(e) => change("notes", e.target.value)}
              placeholder={t("create.notesPlaceholder")}
              aria-invalid={!!errors.notes}
              className={`${inputCls(!!errors.notes)} resize-none`}
            />
            <div className="flex items-start justify-between gap-3">
              <FieldError message={errors.notes} />
              <span className="ms-auto text-[11px] text-gray-400 mt-1.5 shrink-0">
                {values.notes.trim().length}/{NOTES_MAX}
              </span>
            </div>
          </section>
        </div>

        {/* Summary */}
        <div className="space-y-6">
          <div className="bg-[#1e293b] text-white rounded-xl p-6 shadow-md border border-slate-700">
            <h2 className="text-lg font-bold text-white mb-6">{t("create.summary.title")}</h2>
            <dl className="space-y-4 mb-8">
              {[
                [t("create.template"), template?.name || "—"],
                [t("details.employee"), employee?.full_name || "—"],
                [t("details.contractDates"), termText],
                [t("term.renewalDue"), values.renewal_due ? fmtDate(values.renewal_due) : "—"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between items-start gap-3 pb-4 border-b border-slate-600/50">
                  <dt className="text-sm text-slate-400 shrink-0">{k}</dt>
                  <dd className="text-sm font-semibold text-white text-end break-words min-w-0">{v}</dd>
                </div>
              ))}
            </dl>
            <button
              type="submit"
              disabled={saving || hasErrors}
              className="w-full flex items-center justify-center gap-2 bg-[#20B2AA] hover:bg-[#1C9D96] text-white py-3 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? <Spinner size="sm" className="border-white border-t-transparent" /> : <MdSend className="text-lg rtl:-scale-x-100" />}
              {saving ? t("create.sending") : t("create.sendContract")}
            </button>
            <div className="flex items-start gap-2 mt-6 text-slate-400">
              <MdInfoOutline className="text-lg shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed">{t("create.sendNote")}</p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2 text-blue-800">
              <MdOutlineLightbulb className="text-lg" />
              <h3 className="text-xs font-bold uppercase tracking-wider">{t("create.bestPractice.title")}</h3>
            </div>
            <p className="text-xs text-blue-600/80 leading-relaxed">{t("create.bestPractice.body")}</p>
          </div>
        </div>
      </div>
    </form>
  );
}
