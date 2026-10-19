import { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import {
  MdOutlineReceiptLong,
  MdArrowBack,
  MdOutlineVisibility,
  MdOutlineClear,
  MdOutlineDescription,
  MdOutlineFileDownload,
} from "react-icons/md";
import Pagination from "../../components/Pagination";
import CustomDropdown from "../../components/CustomDropdown";
import Loader from "../../components/Loader";
import useFiscalYear from "../../hooks/useFiscalYear";
import { useFormat } from "../../hooks/useFormat";
import { monthsOfFy } from "../../utils/fiscalYear";
import { STAFFING_BILLS, STAFFING_ANNUAL_STATEMENTS } from "../../data/groupH";
import { paginate } from "../../data/common";

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const money = (n, cur = "SAR") => `${cur} ${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const STATUS_STYLE = { APPROVED: "bg-blue-50 text-blue-700", PAID: "bg-green-50 text-green-700" };
const LIMIT = 10;
const ITEM_LIMIT = 25;
const STATEMENT_LIMIT = 5;
const ALL = "ALL";

export default function StaffingCompanyBilling() {
  const { t } = useTranslation("staffing");
  const { fmtDate } = useFormat();
  const fy = useFiscalYear();
  const monthLabel = (m) => t(`billing.months.${MONTHS[(m || 1) - 1]}`);
  const statusLabel = (s) => t(`billing.status.${s}`, { defaultValue: String(s || "").replace(/_/g, " ") });

  // Financial-year filter: defaults to the current FY ("ALL" = every year).
  const [pickedFy, setPickedFy] = useState(null);
  const fyKey = pickedFy ?? (fy.current?.year_key ? String(fy.current.year_key) : ALL);
  const [monthVal, setMonthVal] = useState("");
  const [page, setPage] = useState(1);
  const loading = false;
  const [bill, setBill] = useState(null);
  const [itemsPage, setItemsPage] = useState(1);
  const billLoading = false;

  // Annual statements (year-end documents), newest FY first.
  const [stPage, setStPage] = useState(1);
  const stLoading = false;
  const stPaged = paginate(STAFFING_ANNUAL_STATEMENTS, stPage, STATEMENT_LIMIT);
  const statements = { rows: stPaged.rows, total: stPaged.total, total_pages: stPaged.totalPages };

  const FY_OPTIONS = useMemo(
    () => [
      { label: t("billing.filters.allYears"), value: ALL },
      ...[...fy.years]
        .sort((a, b) => b.year_key - a.year_key)
        .map((y) => ({ label: y.label, value: String(y.year_key) })),
    ],
    [t, fy.years],
  );

  // A picked FY → its 12 months in FY order ("YYYY-MM"); all years → Jan…Dec.
  const MONTH_OPTIONS = useMemo(
    () => [
      { label: t("billing.filters.allMonths"), value: "" },
      ...(fyKey !== ALL
        ? monthsOfFy(fy.startMonth, Number(fyKey)).map((m) => ({
            label: `${t(`billing.months.${m.key}`)} ${m.year}`,
            value: m.value,
          }))
        : MONTHS.map((m, i) => ({ label: t(`billing.months.${m}`), value: String(i + 1) }))),
    ],
    [t, fyKey, fy.startMonth],
  );

  // Client-side FY / month filter + paging over the static invoices.
  const fyRange = fyKey !== ALL ? fy.years.find((y) => String(y.year_key) === fyKey) : null;
  const filteredBills = STAFFING_BILLS.filter((b) => {
    const ym = `${b.period.year}-${String(b.period.month).padStart(2, "0")}`;
    if (fyRange && !(ym >= fyRange.start_date.slice(0, 7) && ym <= fyRange.end_date.slice(0, 7))) return false;
    if (monthVal) {
      if (monthVal.includes("-")) return ym === monthVal;
      return b.period.month === Number(monthVal);
    }
    return true;
  });
  const billsPaged = paginate(filteredBills, page, LIMIT);
  const list = { rows: billsPaged.rows, total: billsPaged.total, total_pages: billsPaged.totalPages };

  // The bill with one page of its line items.
  const openBill = useCallback((id, p = 1) => {
    const found = STAFFING_BILLS.find((b) => b.id === id);
    if (!found) return;
    const items = paginate(found.items, p, ITEM_LIMIT);
    setBill({
      ...found,
      items: items.rows,
      items_pagination: { page: p, total_pages: items.totalPages, total: items.total, limit: ITEM_LIMIT },
    });
    setItemsPage(p);
  }, []);

  // Static build: statement files are not generated — just confirm.
  const fakeDownload = (e, label) => {
    e.preventDefault();
    toast.success(label);
  };

  // ── Detail ──
  if (bill) {
    const ip = bill.items_pagination || { page: 1, total_pages: 1, total: 0, limit: ITEM_LIMIT };
    return (
      <div className="space-y-5">
        <button onClick={() => setBill(null)} className="inline-flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-gray-900">
          <MdArrowBack className="rtl:rotate-180" /> {t("billing.backToInvoices")}
        </button>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-gray-100 bg-[#f8f9fc]">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <MdOutlineReceiptLong className="text-cyan-600" /> {t("billing.labourInvoice")}
              </h2>
              {bill.bill_no && (
                <p className="text-xs font-semibold text-cyan-700 mt-0.5"><span dir="ltr">{bill.bill_no}</span></p>
              )}
              <p className="text-xs text-gray-400 mt-0.5">
                {t("billing.detailMeta", { month: monthLabel(bill.period?.month), year: bill.period?.year, count: ip.total, amount: money(bill.total_amount, bill.currency) })}
              </p>
              {bill.paid_at && (
                <p className="text-xs text-green-700 mt-0.5">{t("billing.paidOn", { date: fmtDate(bill.paid_at) })}</p>
              )}
            </div>
            <span className={`inline-flex self-start sm:self-auto px-2.5 py-1 rounded-md text-[10px] font-bold uppercase ${STATUS_STYLE[bill.status] || "bg-gray-100 text-gray-600"}`}>
              {statusLabel(bill.status)}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-start text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {[t("billing.table.sno"), t("billing.table.employee"), t("billing.table.project"), t("billing.table.iqama"), t("billing.table.designation"), t("billing.table.workedHrs"), t("billing.table.otHrs"), t("billing.table.otAmount"), t("billing.table.amount")].map((h) => (
                    <th key={h} className="px-5 py-3 text-start text-[10px] font-bold text-gray-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {billLoading ? (
                  <tr><td colSpan={9} className="px-5 py-8 text-center text-gray-400">{t("billing.loading")}</td></tr>
                ) : (bill.items || []).length === 0 ? (
                  <tr><td colSpan={9} className="px-5 py-8 text-center text-gray-400">{t("billing.noLineItems")}</td></tr>
                ) : bill.items.map((it, i) => (
                  <tr key={it.id ?? i} className="hover:bg-gray-50/60">
                    <td className="px-5 py-3 text-gray-500">{(ip.page - 1) * (ip.limit || ITEM_LIMIT) + i + 1}</td>
                    <td className="px-5 py-3 font-semibold text-gray-900">{it.employee?.name || `#${it.employee?.id}`}</td>
                    <td className="px-5 py-3"><span className="inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold bg-cyan-50 text-cyan-700">{it.project?.name || "—"}</span></td>
                    <td className="px-5 py-3 text-gray-600">{it.iqama || "—"}</td>
                    <td className="px-5 py-3 text-gray-600">{it.designation || "—"}</td>
                    <td className="px-5 py-3 text-gray-700">{it.worked_hours ?? "—"}</td>
                    <td className="px-5 py-3 text-gray-700">{it.overtime_hours ?? 0}</td>
                    <td className="px-5 py-3 text-gray-700">{money(it.overtime_amount, bill.currency)}</td>
                    <td className="px-5 py-3 font-bold text-gray-900">{money(it.net, bill.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {ip.total_pages > 1 && (
            <div className="px-5 py-4 border-t border-gray-100">
              <Pagination page={ip.page || itemsPage} limit={ip.limit || ITEM_LIMIT} total={ip.total} totalPages={ip.total_pages} onPage={(p) => openBill(bill.id, p)} label={t("billing.pagination.lineItems")} activeClass="bg-cyan-600 text-white" containerClass="flex items-center justify-between gap-3" />
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── List ──
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
          <MdOutlineReceiptLong className="text-cyan-600" /> {t("billing.title")}
        </h1>
        <p className="text-sm text-gray-500 mt-1">{t("billing.subtitle")}</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap gap-3 items-center">
        <div className="w-full sm:w-44">
          <CustomDropdown
            value={fyKey}
            onChange={(e) => {
              setPickedFy(e.target.value);
              setMonthVal("");
              setPage(1);
            }}
            options={FY_OPTIONS}
            placeholder={t("billing.filters.allYears")}
            className="h-[42px]"
          />
        </div>
        <div className="w-full sm:w-44">
          <CustomDropdown
            value={monthVal}
            onChange={(e) => {
              setMonthVal(e.target.value);
              setPage(1);
            }}
            options={MONTH_OPTIONS}
            placeholder={t("billing.filters.allMonths")}
            className="h-[42px]"
          />
        </div>
        <button
          onClick={() => {
            setPickedFy(null);
            setMonthVal("");
            setPage(1);
          }}
          className="flex justify-center items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-2 rounded-lg font-medium text-sm transition-colors h-[42px]"
        >
          <MdOutlineClear className="text-lg" />
          {t("billing.filters.clear")}
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-start text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-[#f8f9fc]">
                {[t("billing.table.sno"), t("billing.table.billNo"), t("billing.table.period"), t("billing.table.lines"), t("billing.table.amount"), t("billing.table.status"), t("billing.table.action")].map((h) => (
                  <th key={h} className="px-5 py-3 text-start text-[10px] font-bold text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400">{t("billing.loading")}</td></tr>
              ) : list.rows.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-500">{t("billing.empty")}</td></tr>
              ) : list.rows.map((r, index) => (
                <tr key={r.id} className="hover:bg-gray-50/60 cursor-pointer" onClick={() => openBill(r.id, 1)}>
                  <td className="px-5 py-3 text-gray-500">{(page - 1) * LIMIT + index + 1}</td>
                  <td className="px-5 py-3 font-semibold text-cyan-700 whitespace-nowrap"><span dir="ltr">{r.bill_no || "—"}</span></td>
                  <td className="px-5 py-3 font-semibold text-gray-900">{monthLabel(r.period?.month)} {r.period?.year}</td>
                  <td className="px-5 py-3 text-gray-600">{r.employee_count ?? "—"}</td>
                  <td className="px-5 py-3 font-semibold text-gray-900">{money(r.total_amount, r.currency)}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${STATUS_STYLE[r.status] || "bg-gray-100 text-gray-600"}`}>{statusLabel(r.status)}</span>
                    {r.paid_at && (
                      <div className="text-[11px] text-green-700 mt-1 whitespace-nowrap">{t("billing.paidOn", { date: fmtDate(r.paid_at) })}</div>
                    )}
                  </td>
                  <td className="px-5 py-3"><button onClick={(e) => { e.stopPropagation(); openBill(r.id, 1); }} title={t("billing.view")} className="p-1.5 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg"><MdOutlineVisibility className="text-lg" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {list.total_pages > 1 && (
          <div className="px-5 py-4 border-t border-gray-100">
            <Pagination page={page} limit={LIMIT} total={list.total} totalPages={list.total_pages} onPage={setPage} label={t("billing.pagination.invoices")} activeClass="bg-cyan-600 text-white" containerClass="flex items-center justify-between gap-3" />
          </div>
        )}
      </div>

      {/* Annual statements — one per financial year, generated at year end */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <MdOutlineDescription className="text-cyan-600" /> {t("billing.statements.title")}
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">{t("billing.statements.hint")}</p>
        </div>
        {stLoading ? (
          <Loader className="py-10" />
        ) : statements.rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-gray-500">{t("billing.statements.empty")}</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {statements.rows.map((s) => (
              <li key={s.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{t("billing.statements.rowTitle", { label: s.label })}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {t("billing.statements.period", { from: fmtDate(s.start_date), to: fmtDate(s.end_date) })}
                    {s.generated_at ? ` · ${t("billing.statements.generated", { date: fmtDate(s.generated_at) })}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {s.pdf_download_url && (
                    <a
                      href={s.pdf_download_url}
                      onClick={(e) => fakeDownload(e, t("billing.statements.downloadPdf"))}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-700"
                    >
                      <MdOutlineFileDownload className="text-base" /> {t("billing.statements.downloadPdf")}
                    </a>
                  )}
                  {s.csv_download_url && (
                    <a
                      href={s.csv_download_url}
                      onClick={(e) => fakeDownload(e, t("billing.statements.downloadCsv"))}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-cyan-700 bg-cyan-50 border border-cyan-100 hover:bg-cyan-100"
                    >
                      <MdOutlineFileDownload className="text-base" /> {t("billing.statements.downloadCsv")}
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {statements.total_pages > 1 && (
          <div className="px-5 py-4 border-t border-gray-100">
            <Pagination page={stPage} limit={STATEMENT_LIMIT} total={statements.total} totalPages={statements.total_pages} onPage={setStPage} label={t("billing.pagination.statements")} activeClass="bg-cyan-600 text-white" containerClass="flex items-center justify-between gap-3" />
          </div>
        )}
      </div>
    </div>
  );
}
