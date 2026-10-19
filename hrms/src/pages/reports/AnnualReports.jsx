import { useCallback, useEffect, useMemo, useState } from "react";
import { matches, paginate } from "../../data/common";
import { REPORT_EMPLOYEES, YEAR_DOCUMENTS, generateYearDocs } from "../../data/groupA";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import {
  MdDescription,
  MdDownload,
  MdOutlineEmail,
  MdOutlineVisibility,
  MdPlaylistAdd,
  MdRefresh,
  MdSearch,
} from "react-icons/md";

import Loader from "../../components/Loader";
import CustomDropdown from "../../components/CustomDropdown";
import FieldError from "../../components/FieldError";
import Pagination from "../../components/Pagination";
import YearStatusBadge from "../../components/fiscalYear/YearStatusBadge";
import { CardHeader, EmptyState, ErrorBox } from "../../components/yearEnd/shared";
import { DATETIME_OPTS, cardCls, labelCls, primaryBtn, secondaryBtn } from "../../components/yearEnd/styles";
import JobProgress from "../../components/yearEnd/JobProgress";
import { YEAR_DOC_TYPES, check } from "../../utils/fyValidation/core";
import FyLoadError from "../../components/fiscalYear/FyLoadError";
import useFiscalYear from "../../hooks/useFiscalYear";
import { useCan } from "../../hooks/usePermission";
import { useFormat } from "../../hooks/useFormat";

const PER_PAGE = 10;

// Toast / message for a finished job.
const jobOutcome = (job, t) =>
  !job || job.status !== "FAILED"
    ? { ok: true, text: t("annualReports.generatedToast", { count: job ? job.done : 0 }) }
    : { ok: false, text: t("annualReports.jobFailed", { count: job.failed || 0 }) };

// ── Generate panel ────────────────────────────────────────────────────────────
function GeneratePanel({ onGenerate }) {
  const { t } = useTranslation("fiscalYear");
  const [types, setTypes] = useState([]);
  const [employeeId, setEmployeeId] = useState("");
  const [send, setSend] = useState(false);
  const [empSearch, setEmpSearch] = useState("");
  // client-side employee search (the list caps at 100)
  const employees = useMemo(
    () => REPORT_EMPLOYEES.filter((e) => matches(e, empSearch.trim(), ["full_name", "country_emp_id"])).slice(0, 100),
    [empSearch],
  );
  const [errors, setErrors] = useState({});
  const [general, setGeneral] = useState(null);
  const saving = false;
  const job = null;

  const toggle = (type) => {
    setTypes((s) => (s.includes(type) ? s.filter((x) => x !== type) : [...s, type]));
    setErrors((e) => ({ ...e, types: null }));
    setGeneral(null);
  };

  const submit = (e) => {
    e.preventDefault();
    const key = check.types(types);
    if (key) {
      setErrors({ types: t(`validation.${key}`) });
      return;
    }
    setGeneral(null);
    const done = onGenerate({ types, ...(employeeId ? { employee_id: Number(employeeId) } : {}), send });
    const out = jobOutcome(done, t);
    if (out.ok) toast.success(out.text);
    else setGeneral(out.text);
  };

  const allSelected = types.length === YEAR_DOC_TYPES.length;

  return (
    <section className={`${cardCls} overflow-hidden`}>
      <CardHeader icon={MdPlaylistAdd} title={t("annualReports.generateTitle")} subtitle={t("annualReports.generateSubtitle")} />
      <form onSubmit={submit} noValidate className="p-5 sm:p-6 space-y-5">
        <ErrorBox message={general} />
        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className={labelCls.replace("mb-1.5", "mb-0")}>{t("annualReports.types")}</span>
            <button
              type="button"
              onClick={() => {
                setTypes(allSelected ? [] : [...YEAR_DOC_TYPES]);
                setErrors((x) => ({ ...x, types: null }));
              }}
              className="text-xs font-semibold text-cyan-700 hover:text-cyan-800"
            >
              {allSelected ? t("annualReports.clearAll") : t("annualReports.selectAll")}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {YEAR_DOC_TYPES.map((type) => (
              <label
                key={type}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition ${
                  types.includes(type) ? "border-cyan-500 bg-cyan-50 text-cyan-800" : "border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
              >
                <input type="checkbox" checked={types.includes(type)} onChange={() => toggle(type)} className="accent-cyan-600" />
                {t(`docType.${type}`)}
              </label>
            ))}
          </div>
          <FieldError message={errors.types} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className={labelCls}>{t("annualReports.employee")}</label>
            <CustomDropdown
              value={employeeId}
              isSearchable
              onSearchChange={setEmpSearch}
              error={!!errors.employee_id}
              onChange={(e) => {
                setEmployeeId(e.target.value);
                setErrors((x) => ({ ...x, employee_id: null }));
              }}
              options={[
                { value: "", label: t("annualReports.allEmployees") },
                ...employees.map((emp) => ({
                  value: String(emp.id),
                  label: `${emp.full_name}${emp.country_emp_id ? ` (${emp.country_emp_id})` : ""}`,
                })),
              ]}
            />
            <FieldError message={errors.employee_id} />
            <p className="text-xs text-gray-400 mt-1.5">{t("annualReports.employeeHelp")}</p>
          </div>
          <div>
            <label className="flex items-start gap-2.5 mt-6 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={send} onChange={(e) => setSend(e.target.checked)} className="accent-cyan-600 mt-0.5" />
              <span>
                <span className="font-semibold">{t("annualReports.sendLabel")}</span>
                <span className="block text-xs text-gray-500">{t("annualReports.sendHelp")}</span>
              </span>
            </label>
            <FieldError message={errors.send} />
          </div>
        </div>
        <JobProgress job={job} />
        <div className="flex justify-end">
          <button type="submit" disabled={saving || !!errors.types} className={primaryBtn}>
            {saving ? t("annualReports.generating") : t("annualReports.generate")}
          </button>
        </div>
      </form>
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AnnualReports() {
  const { t } = useTranslation("fiscalYear");
  const { fmtDate } = useFormat();
  const fy = useFiscalYear();
  const can = useCan();
  const canGenerate = can("financial_year", "update");
  const yearKey = fy.selected;

  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState(""); // debounced search sent to the server
  // the page resets when the year changes
  const [pageState, setPageState] = useState({ y: yearKey, p: 1 });
  const page = pageState.y === yearKey ? pageState.p : 1;
  const setPage = (p) => setPageState({ y: yearKey, p });
  const [mailing, setMailing] = useState(null);

  useEffect(() => {
    const id = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  // Client-side page / type / search over the static documents.
  const [allDocs, setAllDocs] = useState(YEAR_DOCUMENTS);
  const res = useMemo(() => {
    const q = query.toLowerCase();
    const rows = allDocs
      .filter((d) => d.year_key === yearKey)
      .filter((d) => !type || d.doc_type === type)
      .filter(
        (d) =>
          !q ||
          matches(d.employee || {}, q, ["full_name"]) ||
          matches(d.staffing_company || {}, q, ["name"]) ||
          d.doc_type.toLowerCase().includes(q),
      );
    return paginate(rows, page, PER_PAGE);
  }, [allDocs, yearKey, type, query, page]);
  const docs = res.rows;
  const total = res.total;
  const totalPages = res.totalPages;
  const filtering = !!(type || query);
  const loading = false;
  const error = null;
  const load = () => {};
  const generate = (payload) => {
    const out = generateYearDocs(allDocs, yearKey, payload);
    setAllDocs(out.docs);
    return out.job;
  };

  const subjectOf = useCallback(
    (d) => {
      if (d.employee_id) return d.employee?.full_name || t("annualReports.employeeId", { id: d.employee_id });
      if (d.staffing_company_id) return d.staffing_company?.name || t("annualReports.companyId", { id: d.staffing_company_id });
      return t("annualReports.company");
    },
    [t],
  );

  const groups = YEAR_DOC_TYPES.map((dt) => ({ type: dt, rows: docs.filter((d) => d.doc_type === dt) })).filter((g) => g.rows.length);

  const email = (d) => {
    setMailing(null);
    const now = new Date().toISOString();
    setAllDocs((rows) => rows.map((r) => (r.id === d.id ? { ...r, sent_at: now } : r)));
    toast.success(t("annualReports.sentToast"));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">{t("annualReports.title")}</h1>
            {fy.year && <YearStatusBadge year={fy.year} className="text-xs" />}
          </div>
          <p className="text-gray-400 mt-1 text-sm">{t("annualReports.subtitle", { label: fy.label })}</p>
        </div>
        <button type="button" onClick={load} disabled={loading} className={secondaryBtn}>
          <MdRefresh className={loading ? "animate-spin" : ""} /> {t("annualReports.refresh")}
        </button>
      </div>

      {canGenerate && yearKey && <GeneratePanel key={yearKey} onGenerate={generate} />}

      <section className={`${cardCls} overflow-hidden`}>
        <CardHeader
          icon={MdDescription}
          title={t("annualReports.listTitle")}
          subtitle={t("annualReports.listSubtitle")}
        />
        <div className="px-4 sm:px-6 pt-4 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <MdSearch className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={t("annualReports.search")}
              className="w-full border border-gray-200 rounded-lg ps-9 pe-3 py-2.5 text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-none focus:border-transparent"
            />
          </div>
          <div className="sm:w-60">
            <CustomDropdown
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setPage(1);
              }}
              options={[
                { value: "", label: t("annualReports.allTypes") },
                ...YEAR_DOC_TYPES.map((dt) => ({ value: dt, label: t(`docType.${dt}`) })),
              ]}
            />
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {fy.failed ? (
            <FyLoadError className="!py-8" />
          ) : !yearKey || loading ? (
            <Loader />
          ) : error ? (
            <ErrorBox message={error} />
          ) : !groups.length ? (
            <EmptyState
              title={filtering ? t("annualReports.noMatch") : t("annualReports.empty", { label: fy.label })}
              hint={!filtering && canGenerate ? t("annualReports.emptyHint") : undefined}
            />
          ) : (
            <div className="space-y-5">
              {groups.map((g) => (
                <div key={g.type}>
                  <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">{t(`docType.${g.type}`)}</h3>
                  <ul className="divide-y divide-gray-100 border border-gray-200 rounded-xl">
                    {g.rows.map((d) => (
                      <li key={d.id} className="px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{subjectOf(d)}</p>
                          <p className="text-xs text-gray-400">
                            {t("annualReports.generatedAt", { date: fmtDate(d.generated_at, DATETIME_OPTS), version: d.version })}
                            {d.sent_at ? ` · ${t("annualReports.sentAt", { date: fmtDate(d.sent_at, DATETIME_OPTS) })}` : ""}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 shrink-0">
                          <a href={d.pdf_url} target="_blank" rel="noreferrer" className={secondaryBtn}>
                            <MdOutlineVisibility /> {t("annualReports.view")}
                          </a>
                          <a href={d.pdf_download_url} target="_blank" rel="noreferrer" className={secondaryBtn}>
                            <MdDownload /> {t("annualReports.pdf")}
                          </a>
                          {d.csv_download_url && (
                            <a href={d.csv_download_url} target="_blank" rel="noreferrer" className={secondaryBtn}>
                              <MdDownload /> {t("annualReports.csv")}
                            </a>
                          )}
                          {canGenerate && d.doc_type === "ANNUAL_PAY_STATEMENT" && d.employee_id && (
                            <button type="button" onClick={() => email(d)} disabled={mailing === d.id} className={secondaryBtn}>
                              <MdOutlineEmail /> {mailing === d.id ? t("annualReports.sending") : t("annualReports.email")}
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
        {!loading && totalPages > 1 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            limit={PER_PAGE}
            onPage={setPage}
            label={t("annualReports.documentsLabel")}
          />
        )}
      </section>
    </div>
  );
}
