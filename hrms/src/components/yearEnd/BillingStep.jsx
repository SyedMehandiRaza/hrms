import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { MdAccountBalance, MdChevronRight, MdDownload, MdSearch } from "react-icons/md";

import Pagination from "../Pagination";
import { TableLoader } from "../Loader";
import { CardHeader, EmptyState, ErrorBox } from "./shared";
import { DATETIME_OPTS, cardCls, primaryBtn, secondaryBtn } from "./styles";
import { getYearStaffingBills, listYearDocuments } from "../../data/groupG";
import { runReportJob } from "./reportJob";
import JobProgress from "./JobProgress";
import { useFormat } from "../../hooks/useFormat";

const OPEN = ["DRAFT", "PENDING_APPROVAL"];
const PER_PAGE = 10;
const STATEMENT_TYPES = ["STAFFING_STATEMENT", "LOAN_STATEMENT"];
// the statements of the FY (one per staffing company + the loan statement)
const loadStatements = (yearKey) =>
  listYearDocuments(yearKey, STATEMENT_TYPES).filter((x) => STATEMENT_TYPES.includes(x.doc_type));

// Staffing companies' bills in the FY + loan / staffing statements.
export default function BillingStep({ yearKey, readOnly }) {
  const { t } = useTranslation("fiscalYear");
  const { fmtNumber, fmtDate } = useFormat();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(null);
  const [job, setJob] = useState(null);

  // all bills of the FY + its statements (static)
  const bills = useMemo(() => getYearStaffingBills(yearKey), [yearKey]);
  const [docs, setDocs] = useState(() => loadStatements(yearKey));
  const loading = false;
  const error = null;

  const companies = useMemo(() => {
    const map = new Map();
    for (const b of bills) {
      const id = b.staffing_company?.id;
      const row = map.get(id) || { id, name: b.staffing_company?.name || `#${id}`, total: 0, open: 0, done: 0, amount: 0, currency: b.currency };
      row.total += 1;
      if (OPEN.includes(b.status)) row.open += 1;
      else if (b.status === "APPROVED" || b.status === "PAID") row.done += 1;
      row.amount += Number(b.total_amount) || 0;
      map.set(id, row);
    }
    return [...map.values()].sort((a, b) => b.open - a.open || a.name.localeCompare(b.name));
  }, [bills]);

  const filtered = companies.filter((c) => !search.trim() || c.name.toLowerCase().includes(search.trim().toLowerCase()));
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const rows = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  const generate = async (type) => {
    setBusy(type);
    try {
      const done = await runReportJob(yearKey, { types: [type] }, { onProgress: setJob });
      if (done && done.status === "FAILED") toast.error(t("annualReports.jobFailed", { count: done.failed || 0 }));
      else toast.success(t("payrollStep.generatedToast"));
      setDocs(loadStatements(yearKey));
    } catch {
      toast.error(t("ui.genericError"));
    } finally {
      setBusy(null);
      setJob(null);
    }
  };

  const nameOf = (doc) =>
    doc.staffing_company_id
      ? companies.find((c) => Number(c.id) === Number(doc.staffing_company_id))?.name || `#${doc.staffing_company_id}`
      : t("annualReports.company");

  return (
    <div className="space-y-5">
      <ErrorBox message={error} />
      <section className={`${cardCls} overflow-hidden`}>
        <CardHeader
          title={t("billingStep.billsTitle")}
          subtitle={t("billingStep.billsSubtitle")}
          actions={
            <button
              type="button"
              onClick={() => {
                navigate("/admin/staffing-billing");
              }}
              className={secondaryBtn}
            >
              {t("billingStep.openBilling")} <MdChevronRight className="rtl:rotate-180" />
            </button>
          }
        />
        <div className="px-4 pt-4">
          <div className="relative sm:max-w-xs">
            <MdSearch className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={t("billingStep.search")}
              className="w-full border border-gray-200 rounded-lg ps-9 pe-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-none focus:border-transparent"
            />
          </div>
        </div>
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                {["company", "bills", "open", "approved", "amount"].map((c) => (
                  <th key={c} className="px-4 py-3 text-start font-semibold whitespace-nowrap">
                    {t(`billingStep.cols.${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <TableLoader colSpan={5} />
              ) : !rows.length ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState title={t("billingStep.empty")} />
                  </td>
                </tr>
              ) : (
                rows.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3 font-semibold text-gray-900">{c.name}</td>
                    <td className="px-4 py-3">{fmtNumber(c.total)}</td>
                    <td className="px-4 py-3">
                      {c.open ? (
                        <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-red-50 text-red-700">{fmtNumber(c.open)}</span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-emerald-700">{fmtNumber(c.done)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {fmtNumber(c.amount, { maximumFractionDigits: 2 })} {c.currency || ""}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > PER_PAGE && (
          <Pagination page={safePage} totalPages={totalPages} total={filtered.length} limit={PER_PAGE} onPage={setPage} />
        )}
      </section>

      <section className={`${cardCls} overflow-hidden`}>
        <CardHeader
          icon={MdAccountBalance}
          title={t("billingStep.statementsTitle")}
          subtitle={t("billingStep.statementsSubtitle")}
          actions={
            !readOnly &&
            STATEMENT_TYPES.map((type) => (
              <button key={type} type="button" disabled={!!busy} onClick={() => generate(type)} className={type === "LOAN_STATEMENT" ? primaryBtn : secondaryBtn}>
                {busy === type ? t("payrollStep.generating") : t("billingStep.generate", { type: t(`docType.${type}`) })}
              </button>
            ))
          }
        />
        {job && <JobProgress job={job} className="mx-5 mt-4" />}
        {loading ? null : !docs.length ? (
          <EmptyState title={t("billingStep.noStatements")} />
        ) : (
          <ul className="divide-y divide-gray-100">
            {docs.map((d) => (
              <li key={d.id} className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">
                    {t(`docType.${d.doc_type}`)} · {nameOf(d)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {t("annualReports.generatedAt", { date: fmtDate(d.generated_at, DATETIME_OPTS), version: d.version })}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <a href={d.pdf_download_url} onClick={(e) => { e.preventDefault(); toast.success(t("annualReports.pdf")); }} target="_blank" rel="noreferrer" className={secondaryBtn}>
                    <MdDownload /> {t("annualReports.pdf")}
                  </a>
                  {d.csv_download_url && (
                    <a href={d.csv_download_url} onClick={(e) => { e.preventDefault(); toast.success(t("annualReports.csv")); }} target="_blank" rel="noreferrer" className={secondaryBtn}>
                      <MdDownload /> {t("annualReports.csv")}
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
