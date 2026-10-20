import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useTranslation, Trans } from "react-i18next";
import {
  MdOutlineChevronRight,
  MdOutlineArrowBack,
  MdOutlineArrowForward,
  MdCheck,
  MdClose,
  MdOutlineLayers,
  MdOutlinePerson,
  MdOutlineBusiness,
  MdOutlineInventory2,
  MdOutlineHandshake,
  MdOutlineSearch,
  MdOutlineSend,
  MdOutlineAdd,
  MdOutlineDescription,
  MdOutlineDataObject,
  MdOutlineDraw,
  MdOutlineVerifiedUser,
  MdOutlineMailOutline,
  MdOutlineEventNote,
  MdOutlineSaveAlt,
} from "react-icons/md";
import { listContractTemplates, lookupRecipients, createContracts } from "../../api/contracts";
import useApiQuery from "../../hooks/useApiQuery";
import { ContractTermFields } from "../contract/ContractTermModal";
import { useFormat } from "../../hooks/useFormat";
import { ScreenError, ScreenLoader } from "../../components/ScreenState";
import { toastApiError } from "../../utils/apiError";
import { serverErrors } from "../../utils/applyFieldErrors";

// Send wizard (plan decisions 18–25): template → recipients + terms → review, then Send or
// Save as draft. One contract per recipient; the API answers per recipient (SENT, DRAFT
// with a reason, or FAILED).

const STEPS = [
  { id: 1, labelKey: "wizard.steps.chooseTemplate" },
  { id: 2, labelKey: "wizard.steps.recipients" },
  { id: 3, labelKey: "wizard.steps.reviewSend" },
];

// Employee and Staffing Company are live; the others stay visible as "Coming soon" (decision 2).
const AUD = {
  EMPLOYEE: { labelKey: "audiences.employee", icon: MdOutlinePerson, chip: "bg-cyan-50 text-cyan-600" },
  STAFFING_COMPANY: { labelKey: "audiences.staffing", icon: MdOutlineBusiness, chip: "bg-indigo-50 text-indigo-600" },
  VENDOR: { labelKey: "audiences.vendor", icon: MdOutlineInventory2, chip: "bg-amber-50 text-amber-600", comingSoon: true },
  CLIENT: { labelKey: "audiences.client", icon: MdOutlineHandshake, chip: "bg-rose-50 text-rose-600", comingSoon: true },
  COLLABORATING_COMPANY: { labelKey: "audiences.collaborator", icon: MdOutlineHandshake, chip: "bg-teal-50 text-teal-600", comingSoon: true },
};

const AVATAR_COLORS = ["bg-cyan-100 text-cyan-700", "bg-violet-100 text-violet-700", "bg-amber-100 text-amber-700", "bg-emerald-100 text-emerald-700", "bg-rose-100 text-rose-700"];
const RATE_UNITS = ["HOURLY", "DAILY", "MONTHLY", "ANNUAL"];
const TERM_KEYS = ["start_date", "end_date", "renewal_due", "sign_by", "rate", "rate_unit", "currency", "notice_period_days"];

const initialsOf = (name = "") =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
const colorOf = (id = "") => AVATAR_COLORS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const inDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return ymd(d);
};
const isRealYmd = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && ymd(new Date(`${v}T00:00:00`)) === v;
const blank = (v) => v === undefined || v === null || String(v).trim() === "";

// Client-side checks with the server's texts (standards §7.3 "Draft / send"); rules that
// depend on the company's today (end in the past, sign-by range) are the server's.
const validateTerms = (t, v) => {
  const e = {};
  const msg = (k) => t(`wizard.terms.validation.${k}`);
  if (blank(v.start_date)) e.start_date = msg("startDateRequired");
  ["start_date", "end_date", "renewal_due"].forEach((k) => {
    if (!blank(v[k]) && !isRealYmd(v[k])) e[k] = msg("dateInvalid");
  });
  if (!e.start_date && !e.end_date && !blank(v.end_date) && v.end_date < v.start_date) e.end_date = msg("endBeforeStart");
  if (!blank(v.rate)) {
    const n = Number(v.rate);
    if (!(n > 0) || Math.abs(Math.round(n * 100) - n * 100) > 1e-6 || n > 9999999999.99) e.rate = msg("rateInvalid");
    else if (blank(v.rate_unit)) e.rate_unit = msg("rateUnitRequired");
  }
  if (!/^[A-Za-z]{3}$/.test(String(v.currency || "").trim())) e.currency = msg("currencyInvalid");
  if (!blank(v.notice_period_days)) {
    const n = Number(v.notice_period_days);
    if (!Number.isInteger(n) || n < 0 || n > 365) e.notice_period_days = msg("noticePeriodRange");
  }
  return e;
};

const inputCls = (bad) =>
  `w-full px-3 py-2.5 bg-gray-50 border rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 ${bad ? "border-red-500" : "border-gray-200"}`;
const FieldError = ({ message }) => (message ? <p className="text-red-500 text-xs mt-1">{message}</p> : null);

export default function NewContractWizard() {
  const { t } = useTranslation("contractStudio");
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { fmtDate } = useFormat();

  const templatesQuery = useApiQuery(() => listContractTemplates({ limit: 100, status: "ACTIVE" }), []);
  const templates = useMemo(() => templatesQuery.data?.items || [], [templatesQuery.data]);

  const [step, setStep] = useState(1);
  const [templateId, setTemplateId] = useState(params.get("template") || null);
  const [audienceFilter, setAudienceFilter] = useState(null); // null → follow the chosen template
  const [selected, setSelected] = useState([]); // recipients
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [projectId, setProjectId] = useState("");
  const [staffingCompanyId, setStaffingCompanyId] = useState("");
  const [submitting, setSubmitting] = useState(null); // "SEND" | "DRAFT" while a request runs
  const inFlight = useRef(false);
  const [result, setResult] = useState(null);

  const [term, setTerm] = useState({ start_date: "", end_date: "", renewal_due: "", sign_by: inDays(7), rate: "", rate_unit: "", currency: "SAR", notice_period_days: "" });
  const [termErrors, setTermErrors] = useState({});
  const [termTouched, setTermTouched] = useState(false);
  const changeTerm = (field, value) => {
    const next = { ...term, [field]: value };
    setTerm(next);
    // live re-check once the user tried to continue; drop a server error on edit
    setTermErrors(termTouched ? validateTerms(t, next) : { ...termErrors, [field]: undefined });
  };

  useEffect(() => {
    const timer = setTimeout(() => setQuery(queryInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [queryInput]);

  const template = templates.find((x) => x.id === templateId) || null;
  const audience = template?.audience_type || audienceFilter || "EMPLOYEE";
  const shownAudience = audienceFilter || template?.audience_type || "EMPLOYEE";
  const aud = AUD[audience];
  const audLabel = t(aud.labelKey);
  const visibleTemplates = templates.filter((x) => x.audience_type === shownAudience);

  const recipientsQuery = useApiQuery(
    () => (template ? lookupRecipients({ audience, q: query, projectId, staffingCompanyId, limit: 100 }) : Promise.resolve(null)),
    [template?.id, audience, query, projectId, staffingCompanyId],
  );
  // Filter options from the unfiltered list (projects and staffing companies of the employees).
  const optionsQuery = useApiQuery(
    () => (template && audience === "EMPLOYEE" ? lookupRecipients({ audience, limit: 100 }) : Promise.resolve(null)),
    [template?.id, audience],
  );
  const options = useMemo(() => {
    const projects = new Map();
    const staffing = new Map();
    (optionsQuery.data?.items || []).forEach((r) => {
      if (r.project) projects.set(r.project.id, r.project.name);
      if (r.staffingCompany) staffing.set(r.staffingCompany.id, r.staffingCompany.name);
    });
    return { projects: [...projects], staffing: [...staffing] };
  }, [optionsQuery.data]);
  const recipientList = recipientsQuery.data?.items || [];

  const toggle = (r) =>
    setSelected((prev) => (prev.find((x) => x.id === r.id) ? prev.filter((x) => x.id !== r.id) : [...prev, r]));
  const selectAll = () =>
    setSelected((prev) => {
      const next = [...prev];
      recipientList.forEach((r) => {
        if (!next.find((x) => x.id === r.id)) next.push(r);
      });
      return next;
    });

  // picking a template resets the recipients (the audience may change)
  const chooseTemplate = (tpl) => {
    setTemplateId(tpl.id);
    setSelected([]);
    setProjectId("");
    setStaffingCompanyId("");
  };
  const chooseAudience = (key) => {
    if (AUD[key].comingSoon) return;
    setAudienceFilter(key);
    if (template && template.audience_type !== key) {
      setTemplateId(null);
      setSelected([]);
    }
  };

  const canNext = step === 1 ? !!template : step === 2 ? selected.length > 0 : true;
  const goNext = () => {
    if (!canNext) {
      toast.error(step === 1 ? t("wizard.toast.pickTemplate") : t("wizard.toast.selectRecipient"));
      return;
    }
    if (step === 2) {
      // never advance with term errors — they show under their inputs
      setTermTouched(true);
      const errs = validateTerms(t, term);
      setTermErrors(errs);
      if (Object.keys(errs).length) return;
    }
    setStep((s) => Math.min(3, s + 1));
  };
  const goBack = () => (step === 1 ? navigate("/admin/new-contracts") : setStep((s) => s - 1));

  const submit = async (mode) => {
    if (!template || selected.length === 0 || inFlight.current) return;
    const errs = validateTerms(t, term);
    if (Object.keys(errs).length) {
      setTermTouched(true);
      setTermErrors(errs);
      setStep(2);
      return;
    }
    inFlight.current = true; // a double click sends one request
    setSubmitting(mode);
    try {
      const data = await createContracts({
        mode,
        templateId: template.id,
        recipientIds: selected.map((r) => r.id),
        start_date: term.start_date,
        end_date: term.end_date || null,
        renewal_due: term.renewal_due || null,
        sign_by: term.sign_by || null,
        rate: blank(term.rate) ? null : Number(term.rate),
        rate_unit: blank(term.rate) ? null : term.rate_unit || null,
        currency: term.currency.trim().toUpperCase(),
        notice_period_days: blank(term.notice_period_days) ? null : Number(term.notice_period_days),
      });
      setResult(data);
    } catch (err) {
      // Term errors from the server go back under their inputs.
      const fieldErrs = serverErrors(err).filter((e) => TERM_KEYS.includes(e.field));
      if (fieldErrs.length) {
        setTermErrors(Object.fromEntries(fieldErrs.map((e) => [e.field, e.message])));
        setStep(2);
      } else {
        toastApiError(err, t("wizard.toast.sendFailed"));
      }
    } finally {
      inFlight.current = false;
      setSubmitting(null);
    }
  };

  if (templatesQuery.error) return <ScreenError error={templatesQuery.error} onRetry={templatesQuery.reload} />;
  if (!templatesQuery.data) return <ScreenLoader />;

  return (
    <div className="pb-10">
      {/* breadcrumb */}
      <div className="mb-6">
        <div className="flex items-center gap-1.5 text-sm mb-2">
          <Link to="/admin/new-contracts" className="text-gray-400 hover:text-cyan-600 transition-colors">{t("wizard.breadcrumb.contracts")}</Link>
          <MdOutlineChevronRight className="text-gray-300" />
          <span className="text-cyan-600 font-semibold">{t("wizard.breadcrumb.sendContract")}</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{template ? template.name : t("wizard.title")}</h1>
        <p className="text-sm text-gray-500 mt-1">{t("wizard.subtitle")}</p>
      </div>

      {/* stepper */}
      <div className="bg-white border border-gray-200 rounded-2xl px-4 sm:px-6 py-4 mb-6">
        <div className="flex items-center">
          {STEPS.map((s, i) => {
            const done = step > s.id;
            const active = step === s.id;
            return (
              <React.Fragment key={s.id}>
                <button onClick={() => s.id < step && setStep(s.id)} className={`flex items-center gap-2.5 ${s.id < step ? "cursor-pointer" : "cursor-default"}`}>
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                    done ? "bg-cyan-600 text-white" : active ? "bg-cyan-50 text-cyan-600 ring-2 ring-cyan-500" : "bg-gray-100 text-gray-400"
                  }`}>
                    {done ? <MdCheck /> : s.id}
                  </span>
                  <span className={`hidden sm:block text-sm font-semibold ${active ? "text-gray-900" : done ? "text-gray-600" : "text-gray-400"}`}>{t(s.labelKey)}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <div className="flex-1 mx-2 sm:mx-4 h-0.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full bg-cyan-500 transition-all duration-500 ${step > s.id ? "w-full" : "w-0"}`} />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* ── STEP 1: choose template ── */}
      {step === 1 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          {/* audience */}
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">{t("wizard.audience.title")}</p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-6">
            {Object.entries(AUD).map(([key, a]) => {
              const Icon = a.icon;
              const on = shownAudience === key;
              return (
                <button
                  key={key}
                  data-testid={`audience-${key}`}
                  onClick={() => chooseAudience(key)}
                  disabled={a.comingSoon}
                  className={`relative flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                    a.comingSoon
                      ? "border-gray-100 text-gray-300 cursor-not-allowed"
                      : on
                        ? "border-cyan-400 ring-2 ring-cyan-100 bg-cyan-50/30 text-gray-900"
                        : "border-gray-200 text-gray-700 hover:border-cyan-300"
                  }`}
                >
                  <Icon className="text-lg" /> <span className="truncate">{t(a.labelKey)}</span>
                  {a.comingSoon && (
                    <span className="absolute -top-2 end-2 px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-[9px] font-bold uppercase tracking-wider">
                      {t("audiences.comingSoon")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <MdOutlineLayers className="text-xl text-[#20B2AA]" />
              <h2 className="text-base font-bold text-gray-900">{t("wizard.template.title")}</h2>
            </div>
            <button
              onClick={() => navigate("/admin/new-contracts/templates/build")}
              className="flex items-center gap-1.5 text-sm font-semibold text-cyan-600 hover:text-cyan-700"
            >
              <MdOutlineAdd /> {t("wizard.template.newTemplate")}
            </button>
          </div>

          {visibleTemplates.length === 0 ? (
            <div className="border border-dashed border-gray-300 rounded-xl p-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center mx-auto mb-4">
                <MdOutlineDescription className="text-3xl text-gray-300" />
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-1">{t("wizard.template.emptyTitle")}</h3>
              <p className="text-sm text-gray-500 max-w-sm mx-auto mb-5">{t("wizard.template.emptyDescription")}</p>
              <button
                onClick={() => navigate("/admin/new-contracts/templates/build")}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#20B2AA] hover:bg-[#1C9D96] rounded-lg"
              >
                <MdOutlineAdd /> {t("actions.createTemplate")}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleTemplates.map((tpl) => {
                const a = AUD[tpl.audience_type] || AUD.EMPLOYEE;
                const AudIcon = a.icon;
                const on = templateId === tpl.id;
                const counts = tpl.field_counts || {};
                return (
                  <button
                    key={tpl.id}
                    data-testid="wizard-template"
                    onClick={() => chooseTemplate(tpl)}
                    className={`text-left rounded-2xl border-2 p-4 transition-all ${
                      on ? "border-cyan-400 ring-2 ring-cyan-100 bg-cyan-50/30" : "border-gray-200 hover:border-cyan-300 hover:shadow-md"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${a.chip}`}>
                        <AudIcon className="text-xs" /> {t(a.labelKey)}
                      </span>
                      {on && <MdCheck className="text-cyan-600 text-lg" />}
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900 truncate">{tpl.name}</h3>
                    <p className="text-[11px] text-gray-400 mt-0.5 truncate">{tpl.document?.name || t("wizard.template.noDocument")}</p>
                    <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100 text-[11px] text-gray-500">
                      <span className="inline-flex items-center gap-1"><MdOutlineDataObject className="text-cyan-500" /> {t("wizard.template.columns", { count: counts.DB_COLUMN || 0 })}</span>
                      <span className="inline-flex items-center gap-1"><MdOutlineDraw className="text-violet-500" /> {t("wizard.template.sign", { count: counts.SIGNATURE || 0 })}</span>
                      <span className="ml-auto">{t("common.fieldsCount", { count: tpl.field_count })}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── STEP 2: recipients ── */}
      {step === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-900 mb-1">{t("wizard.recipients.title")}</h2>
                <p className="text-sm text-gray-500"><Trans t={t} i18nKey="wizard.recipients.subtitle" values={{ audience: audLabel }} components={{ b: <b /> }} /></p>
              </div>
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${aud.chip}`}>
                <aud.icon className="text-sm" /> {audLabel}
              </span>
            </div>

            {audience === "EMPLOYEE" && (
              <div className="p-4 border-b border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{t("wizard.recipients.project")}</label>
                  <select
                    value={projectId}
                    data-testid="filter-project"
                    onChange={(e) => setProjectId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="">{t("wizard.recipients.allProjects")}</option>
                    {options.projects.map(([id, name]) => (
                      <option key={id} value={id}>{name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{t("wizard.recipients.staffingCompany")}</label>
                  <select
                    value={staffingCompanyId}
                    data-testid="filter-staffing"
                    onChange={(e) => setStaffingCompanyId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="">{t("wizard.recipients.allStaffing")}</option>
                    {options.staffing.map(([id, name]) => (
                      <option key={id} value={id}>{name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="p-4">
              <div className="relative">
                <MdOutlineSearch className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg pointer-events-none" />
                <input
                  value={queryInput}
                  onChange={(e) => setQueryInput(e.target.value)}
                  placeholder={t("wizard.recipients.filterPlaceholder")}
                  className="w-full ps-10 pe-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
                />
              </div>
            </div>

            {/* select-all */}
            <div className="flex items-center justify-between px-5 pb-3">
              <span className="text-xs text-gray-400">
                <span className="font-semibold text-gray-600">{recipientList.length}</span> {t("wizard.recipients.shown")} ·{" "}
                <span className="font-semibold text-cyan-600">{selected.length}</span> {t("wizard.recipients.selected")}
              </span>
              <div className="flex items-center gap-2">
                <button onClick={selectAll} className="text-xs font-semibold text-cyan-600 hover:text-cyan-700">{t("wizard.recipients.selectAll")}</button>
                <span className="text-gray-200">|</span>
                <button onClick={() => setSelected([])} className="text-xs font-semibold text-gray-400 hover:text-gray-600">{t("actions.clear")}</button>
              </div>
            </div>

            <div className="max-h-[460px] overflow-y-auto custom-scrollbar divide-y divide-gray-50">
              {recipientsQuery.error ? (
                <ScreenError error={recipientsQuery.error} onRetry={recipientsQuery.reload} />
              ) : (
                recipientList.map((r) => {
                  const on = selected.some((x) => x.id === r.id);
                  const inactive = r.status === "INACTIVE";
                  const meta = r.project?.name || r.staffingCompany?.name;
                  return (
                    <button
                      key={r.id}
                      data-testid="recipient-row"
                      onClick={() => toggle(r)}
                      className={`w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors ${on ? "bg-cyan-50/50" : "hover:bg-gray-50"}`}
                    >
                      <span className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${on ? "bg-cyan-600 border-cyan-600 text-white" : "border-gray-300"}`}>
                        {on && <MdCheck className="text-sm" />}
                      </span>
                      <span className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${colorOf(r.id)}`}>{initialsOf(r.name)}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate ${inactive ? "text-gray-400" : "text-gray-900"}`}>{r.name}</p>
                        <p className="text-[11px] text-gray-400">{r.code || "—"}{r.staffingCompany && r.project ? ` · ${r.staffingCompany.name}` : ""}</p>
                      </div>
                      {inactive ? (
                        <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{t("wizard.recipients.inactive")}</span>
                      ) : (
                        meta && <span className="hidden sm:inline text-[11px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{meta}</span>
                      )}
                    </button>
                  );
                })
              )}
              {!recipientsQuery.error && recipientList.length === 0 && (
                <div className="px-5 py-12 text-center text-sm text-gray-400">
                  {recipientsQuery.loading ? "…" : t("wizard.recipients.noRecords", { audience: audLabel.toLowerCase() })}
                </div>
              )}
            </div>
          </div>

          {/* selected panel */}
          <aside className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-900">{t("wizard.recipients.selectedTitle")}</h3>
                <span className="text-xs font-bold text-white bg-cyan-600 rounded-full px-2 py-0.5">{selected.length}</span>
              </div>
              {selected.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center mx-auto mb-3">
                    <MdOutlinePerson className="text-2xl text-gray-300" />
                  </div>
                  <p className="text-xs text-gray-400">{t("wizard.recipients.noneSelected")}</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[360px] overflow-y-auto custom-scrollbar pr-1">
                  {selected.map((r) => (
                    <div key={r.id} className="p-3 rounded-xl border border-gray-200">
                      <div className="flex items-center gap-2.5 mb-2.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold ${colorOf(r.id)}`}>{initialsOf(r.name)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{r.name}</p>
                          <p className="text-[11px] text-gray-400 truncate">{r.code || ""}</p>
                        </div>
                        <button onClick={() => toggle(r)} className="text-gray-300 hover:text-rose-500"><MdClose /></button>
                      </div>
                      {/* One primary signer per contract for now (decision 19). */}
                      <select
                        value="PRIMARY_SIGNER"
                        disabled
                        data-testid="recipient-role"
                        className="w-full text-xs px-2.5 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-500 cursor-not-allowed"
                      >
                        <option value="PRIMARY_SIGNER">{t("roles.primarySigner")}</option>
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-gray-900 mb-3">{t("wizard.recipients.signingLogic")}</h3>
              <label className="flex items-center justify-between cursor-not-allowed opacity-60" data-testid="signing-order">
                <span className="text-sm text-gray-600">{t("wizard.recipients.signInOrder")}</span>
                <span className="relative w-10 rounded-full bg-gray-200" style={{ height: "22px" }} aria-disabled="true">
                  <span className="absolute top-0.5 left-0.5 w-[18px] h-[18px] rounded-full bg-white shadow" />
                </span>
              </label>
              <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">{t("wizard.review.parallel")}</p>
            </div>
          </aside>

          {/* contract terms */}
          <section className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl p-5 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <MdOutlineEventNote className="text-xl text-[#20B2AA]" />
              <h3 className="text-base font-bold text-gray-900">{t("contracts:details.contractDates")}</h3>
            </div>
            <p className="text-xs text-gray-500 mb-4">{t("contracts:term.hint")}</p>
            <ContractTermFields values={term} errors={termErrors} onChange={changeTerm} disabled={!!submitting} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
              <div className="min-w-0">
                <label htmlFor="term-sign_by" className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">{t("wizard.terms.signBy")}</label>
                <input id="term-sign_by" type="date" value={term.sign_by} onChange={(e) => changeTerm("sign_by", e.target.value)} className={inputCls(!!termErrors.sign_by)} />
                <FieldError message={termErrors.sign_by} />
              </div>
              <div className="min-w-0">
                <label htmlFor="term-rate" className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">{t("wizard.terms.rate")}</label>
                <input id="term-rate" type="number" step="0.01" min="0" value={term.rate} onChange={(e) => changeTerm("rate", e.target.value)} className={inputCls(!!termErrors.rate)} />
                <FieldError message={termErrors.rate} />
              </div>
              <div className="min-w-0">
                <label htmlFor="term-rate_unit" className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">{t("wizard.terms.rateUnit")}</label>
                <select id="term-rate_unit" value={term.rate_unit} onChange={(e) => changeTerm("rate_unit", e.target.value)} className={inputCls(!!termErrors.rate_unit)}>
                  <option value="">{t("wizard.terms.rateUnitPlaceholder")}</option>
                  {RATE_UNITS.map((u) => (
                    <option key={u} value={u}>{t(`wizard.terms.units.${u}`)}</option>
                  ))}
                </select>
                <FieldError message={termErrors.rate_unit} />
              </div>
              <div className="min-w-0">
                <label htmlFor="term-currency" className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">{t("wizard.terms.currency")}</label>
                <input id="term-currency" maxLength={3} value={term.currency} onChange={(e) => changeTerm("currency", e.target.value.toUpperCase())} className={inputCls(!!termErrors.currency)} />
                <FieldError message={termErrors.currency} />
              </div>
              <div className="min-w-0">
                <label htmlFor="term-notice" className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">{t("wizard.terms.noticePeriod")}</label>
                <input id="term-notice" type="number" min="0" max="365" step="1" value={term.notice_period_days} onChange={(e) => changeTerm("notice_period_days", e.target.value)} className={inputCls(!!termErrors.notice_period_days)} />
                <FieldError message={termErrors.notice_period_days} />
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ── STEP 3: review & send ── */}
      {step === 3 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <section className="bg-white border border-gray-200 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-5">
                <MdOutlineVerifiedUser className="text-xl text-[#20B2AA]" />
                <h2 className="text-base font-bold text-gray-900">{t("wizard.review.title")}</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ReviewItem label={t("wizard.review.template")} value={template?.name || "—"} />
                <ReviewItem label={t("wizard.review.for")} value={audLabel} />
                <ReviewItem label={t("wizard.review.document")} value={template?.document?.name || "—"} />
                <ReviewItem label={t("wizard.review.fields")} value={String(template?.field_count ?? 0)} />
                <ReviewItem label={t("wizard.review.recipients")} value={String(selected.length)} />
                <ReviewItem label={t("wizard.review.signing")} value={t("wizard.review.parallel")} />
                <ReviewItem
                  label={t("contracts:details.contractDates")}
                  value={
                    term.start_date
                      ? term.end_date
                        ? `${fmtDate(term.start_date)} – ${fmtDate(term.end_date)}`
                        : t("contracts:details.indefiniteRange", { start: fmtDate(term.start_date) })
                      : "—"
                  }
                />
                <ReviewItem label={t("contracts:term.renewalDue")} value={term.renewal_due ? fmtDate(term.renewal_due) : "—"} />
                <ReviewItem label={t("wizard.terms.signBy")} value={term.sign_by ? fmtDate(term.sign_by) : "—"} />
                <ReviewItem
                  label={t("wizard.terms.rate")}
                  value={blank(term.rate) ? "—" : `${term.currency} ${Number(term.rate).toFixed(2)} / ${t(`wizard.terms.units.${term.rate_unit}`)}`}
                />
                <ReviewItem label={t("wizard.terms.noticePeriod")} value={blank(term.notice_period_days) ? "—" : String(term.notice_period_days)} />
              </div>
            </section>

            <section className="bg-white border border-gray-200 rounded-2xl p-6">
              <h3 className="text-sm font-bold text-gray-900 mb-4">{t("wizard.review.recipients")}</h3>
              <div className="space-y-2.5 max-h-[340px] overflow-y-auto custom-scrollbar pr-1">
                {selected.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100">
                    <span className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold ${colorOf(r.id)}`}>{initialsOf(r.name)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{r.name}</p>
                      <p className="text-[11px] text-gray-400 truncate">{r.code || ""}</p>
                    </div>
                    <span className="text-[11px] font-semibold text-cyan-700 bg-cyan-50 px-2.5 py-1 rounded-full">{t("roles.primarySigner")}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* send panel */}
          <aside className="space-y-4">
            <div className="bg-[#1e293b] text-white rounded-2xl p-6 shadow-md border border-slate-700 lg:sticky lg:top-4">
              <h2 className="text-lg font-bold mb-5">{t("wizard.review.readyToSend")}</h2>
              <div className="space-y-3 mb-6">
                <div className="flex justify-between items-center pb-3 border-b border-slate-600/50">
                  <span className="text-sm text-slate-400">{t("wizard.review.recipients")}</span>
                  <span className="text-sm font-semibold">{selected.length}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-slate-600/50">
                  <span className="text-sm text-slate-400">{t("wizard.review.fields")}</span>
                  <span className="text-sm font-semibold">{template?.field_count ?? 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-400">{t("wizard.review.delivery")}</span>
                  <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-300 text-[10px] font-bold tracking-wider rounded">{t("wizard.review.deliveryValue")}</span>
                </div>
              </div>
              <button
                onClick={() => submit("SEND")}
                disabled={!!submitting}
                data-testid="wizard-send"
                className="w-full flex items-center justify-center gap-2 bg-[#20B2AA] hover:bg-[#1C9D96] disabled:opacity-70 text-white py-3 rounded-lg text-sm font-bold transition-colors"
              >
                {submitting === "SEND" ? (
                  <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> {t("wizard.review.sending")}</>
                ) : (
                  <><MdOutlineSend className="text-lg" /> {t("wizard.review.sendToPortal")}</>
                )}
              </button>
              <button
                onClick={() => submit("DRAFT")}
                disabled={!!submitting}
                data-testid="wizard-save-draft"
                className="w-full flex items-center justify-center gap-2 mt-3 border border-slate-500 hover:bg-slate-700 disabled:opacity-70 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors"
              >
                <MdOutlineSaveAlt className="text-lg" /> {submitting === "DRAFT" ? t("wizard.review.savingDraft") : t("wizard.review.saveDraft")}
              </button>
              <div className="flex items-start gap-2 mt-5 text-slate-400">
                <MdOutlineMailOutline className="text-lg flex-shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">{t("wizard.review.deliveryNote")}</p>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* footer nav */}
      <div className="flex items-center justify-between mt-6 bg-white border border-gray-200 rounded-2xl px-5 py-4">
        <button onClick={goBack} className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors">
          <MdOutlineArrowBack /> {step === 1 ? t("actions.cancel") : t("actions.back")}
        </button>
        {step < 3 ? (
          <button
            onClick={goNext}
            className={`flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white rounded-lg transition-all ${
              canNext ? "bg-gradient-to-r from-[#20B2AA] to-cyan-500 hover:from-[#1C9D96] hover:to-cyan-600 shadow-sm shadow-cyan-200" : "bg-gray-300 cursor-not-allowed"
            }`}
          >
            {t("actions.continue")} <MdOutlineArrowForward />
          </button>
        ) : (
          <button onClick={() => submit("SEND")} disabled={!!submitting} className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-[#20B2AA] hover:bg-[#1C9D96] rounded-lg transition-colors disabled:opacity-70">
            <MdOutlineSend /> {t("actions.send")}
          </button>
        )}
      </div>

      {result && <ResultDialog result={result} onDone={() => navigate("/admin/new-contracts")} />}
    </div>
  );
}

// Per-recipient outcome (decision 25): "N sent, M saved as draft" + the blocked names and reasons.
function ResultDialog({ result, onDone }) {
  const { t } = useTranslation("contractStudio");
  const blocked = result.results.filter((r) => r.result !== "SENT" && r.code);
  const summary = t("wizard.result.summary", { sent: result.sent, drafts: result.drafts }) + (result.failed > 0 ? t("wizard.result.failed", { failed: result.failed }) : "");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div role="dialog" data-testid="send-result" className="relative bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <MdCheck className="text-2xl text-[#20B2AA]" />
          <h2 className="text-lg font-bold text-gray-900" data-testid="send-summary">{summary}</h2>
        </div>
        {blocked.length > 0 && (
          <ul className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar mb-4">
            {blocked.map((r, i) => (
              <li key={r.contractId || i} className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-sm">
                <p className="font-semibold text-gray-900">{r.recipientName}</p>
                <p className="text-gray-600 text-xs mt-0.5">{r.message}</p>
              </li>
            ))}
          </ul>
        )}
        <button onClick={onDone} className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-[#20B2AA] hover:bg-[#1C9D96] rounded-lg">
          {t("wizard.result.goToContracts")}
        </button>
      </div>
    </div>
  );
}

function ReviewItem({ label, value }) {
  return (
    <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm font-semibold text-gray-900 truncate">{value}</p>
    </div>
  );
}
