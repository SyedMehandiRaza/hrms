import { useState, useCallback } from "react";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import {
  MdOutlineReceiptLong,
  MdOutlineBusiness,
  MdOutlineBolt,
  MdOutlineSend,
  MdOutlineVisibility,
  MdArrowBack,
  MdCheck,
  MdClose,
  MdOutlinePaid,
} from "react-icons/md";
import useFiscalYear from "../../hooks/useFiscalYear";
import useYearLock from "../../hooks/useYearLock";
import useFyResetState from "../../hooks/useFyResetState";
import FieldError from "../../components/FieldError";
import Can from "../../components/Can";
import { MODULES, ACTIONS } from "../../constants/permissions";
import ConfirmationModal from "../../components/ConfirmationModal";
import { useFormat } from "../../hooks/useFormat";
import Pagination from "../../components/Pagination";
import CustomMonthPicker from "../../components/CustomMonthPicker";
import CustomDropdown from "../../components/CustomDropdown";
import { paginate } from "../../data/common";
import {
  STAFFING_COMPANIES,
  generateAllStaffingBills,
  generateStaffingBill,
  getStaffingBill,
  listStaffingBills,
  updateStaffingBill,
} from "../../data/groupE";

const money = (n, cur = "SAR") => `${cur} ${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const STATUS_STYLE = {
  DRAFT: "bg-gray-100 text-gray-600",
  PENDING_APPROVAL: "bg-amber-50 text-amber-700",
  APPROVED: "bg-blue-50 text-blue-700",
  REJECTED: "bg-red-50 text-red-700",
  PAID: "bg-green-50 text-green-700",
};
const STATUSES = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "PAID"];
const billPeriod = (b) => `${b?.period?.year}-${String(b?.period?.month || 1).padStart(2, "0")}`;
const HIST_LIMIT = 10;
const ITEM_LIMIT = 25;

export default function StaffingBilling() {
  const { t } = useTranslation("payroll");
  const statusText = (s) => t(`status.${s}`, { defaultValue: String(s || "").replace(/_/g, " ") });
  const companies = STAFFING_COMPANIES;
  const fy = useFiscalYear();
  const lock = useYearLock();
  const { fmtDate } = useFormat();
  const [companyId, setCompanyId] = useState("ALL");
  // A month of the selected FY; back to its default when the year changes.
  const [month, setMonth] = useFyResetState(fy.defaultMonth, fy.version);
  // A server refusal for the month (period_month, e.g. PeriodClosed) → under the picker.
  const [monthError, setMonthError] = useFyResetState("", fy.version);
  const [generating, setGenerating] = useState(false);

  // History (FY-scoped)
  const [histTick, setHistTick] = useState(0);
  const [histPage, setHistPage] = useFyResetState(1, fy.version);
  const [histCompany, setHistCompany] = useState("");
  const [histStatus, setHistStatus] = useState("");
  const [payFor, setPayFor] = useState(null);
  const histLoading = false;

  // Selected bill detail (with server-paginated items)
  const [bill, setBill] = useState(null);
  const [itemsPage, setItemsPage] = useState(1);
  const billLoading = false;
  const [submitting, setSubmitting] = useState(false);

  // History (FY-scoped) — company / status filters + paging on the static bills.
  const histAll = histTick >= 0
    ? listStaffingBills({
      ...(histCompany ? { staffing_company_id: Number(histCompany) } : {}),
      ...(histStatus ? { status: histStatus } : {}),
    }).filter((b) => fy.inFy(billPeriod(b)))
    : [];
  const histPg = paginate(histAll, histPage, HIST_LIMIT);
  const history = { rows: histPg.rows, total: histPg.total, total_pages: histPg.totalPages };
  const loadHistory = () => setHistTick((n) => n + 1);

  const openBill = useCallback((id, page = 1) => {
    setBill(getStaffingBill(id, page, ITEM_LIMIT));
    setItemsPage(page);
  }, []);

  const handleGenerate = async () => {
    if (!month || lock.locked) return;
    const [y, m] = month.split("-").map(Number);
    setMonthError("");
    setGenerating(true);
    try {
      if (companyId === "ALL") {
        const r = generateAllStaffingBills(y, m);
        const gen = r?.generated || 0;
        const skip = r?.skipped || 0;
        if (gen === 0 && skip > 0) {
          toast.info(skip === 1 ? t("billing.toast.allExistOne", { count: skip }) : t("billing.toast.allExistMany", { count: skip }));
        } else if (gen > 0 && skip > 0) {
          toast.success(gen === 1 ? t("billing.toast.generatedSkippedOne", { count: gen, skipped: skip }) : t("billing.toast.generatedSkippedMany", { count: gen, skipped: skip }));
        } else if (gen > 0) {
          toast.success(gen === 1 ? t("billing.toast.generatedOne", { count: gen }) : t("billing.toast.generatedMany", { count: gen }));
        } else {
          toast.info(t("billing.toast.noCompanies"));
        }
        setBill(null);
        setHistPage(1);
        loadHistory();
      } else {
        const created = generateStaffingBill(Number(companyId), y, m);
        toast.success(t("billing.toast.generated"));
        loadHistory();
        openBill(created.id, 1);
      }
    } finally {
      setGenerating(false);
    }
  };

  const submit = async () => {
    if (!bill) return;
    setSubmitting(true);
    try {
      updateStaffingBill(bill.id, { status: "PENDING_APPROVAL" });
      toast.success(t("billing.toast.submitted"));
      openBill(bill.id, itemsPage);
      loadHistory();
    } finally {
      setSubmitting(false);
    }
  };

  const runAction = async (fn, okMsg) => {
    if (!bill) return;
    setSubmitting(true);
    try {
      fn();
      toast.success(okMsg);
      openBill(bill.id, itemsPage);
      loadHistory();
    } finally {
      setSubmitting(false);
    }
  };

  const approve = () => runAction(() => updateStaffingBill(bill.id, { status: "APPROVED" }), t("billing.toast.approved"));
  const reject = () => {
    const reason = window.prompt(t("billing.rejectPrompt"));
    if (reason == null) return;
    if (!reason.trim()) return toast.error(t("billing.toast.reasonRequired"));
    runAction(() => updateStaffingBill(bill.id, { status: "REJECTED", reject_reason: reason.trim() }), t("billing.toast.rejected"));
  };
  const sendToPortal = () => runAction(() => updateStaffingBill(bill.id, { sent_to_portal: true }), t("billing.toast.sent"));
  // Paying is allowed even when the bill's period is closed (backend rule).
  const confirmPaid = async () => {
    await runAction(() => updateStaffingBill(bill.id, { status: "PAID", paid_at: new Date().toISOString() }), t("billing.toast.paid"));
    setPayFor(null);
  };

  // ── Bill detail view ──
  if (bill) {
    const ip = bill.items_pagination || { page: 1, total_pages: 1, total: 0 };
    const billLocked = lock.isLockedDate(billPeriod(bill));
    const billLockTitle = billLocked ? lock.titleFor(billPeriod(bill)) : undefined;
    return (
      <div className="space-y-5">
        <button onClick={() => setBill(null)} className="inline-flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-gray-900">
          <MdArrowBack /> {t("billing.detail.back")}
        </button>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-gray-100 bg-[#f8f9fc]">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <MdOutlineBusiness className="text-cyan-600" /> {bill.staffing_company?.name || t("billing.detail.companyFallback")}
              </h2>
              {bill.bill_no && (
                <p className="text-xs font-semibold text-cyan-700 mt-0.5"><span dir="ltr">{bill.bill_no}</span></p>
              )}
              <p className="text-xs text-gray-400 mt-0.5">
                {t("billing.detail.meta", { month: t(`monthsShort.${bill.period?.month || 1}`), year: bill.period?.year, count: ip.total, amount: money(bill.total_amount, bill.currency) })}
              </p>
              {bill.paid_at && (
                <p className="text-xs text-green-700 mt-0.5">{t("billing.detail.paidOn", { date: fmtDate(bill.paid_at) })}</p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex px-2.5 py-1 rounded-md text-[10px] font-bold uppercase ${STATUS_STYLE[bill.status] || "bg-gray-100 text-gray-600"}`}>
                {statusText(bill.status)}
              </span>
              {bill.sent_to_portal && (
                <span className="inline-flex px-2.5 py-1 rounded-md text-[10px] font-bold uppercase bg-green-50 text-green-700">{t("billing.detail.sentToPortal")}</span>
              )}
              {bill.status === "DRAFT" && (
                <button onClick={submit} disabled={submitting || billLocked} title={billLockTitle} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed">
                  <MdOutlineSend className="text-base" /> {submitting ? t("billing.detail.submitting") : t("billing.detail.submit")}
                </button>
              )}
              {bill.can_act && (
                <>
                  <button onClick={approve} disabled={submitting || billLocked} title={billLockTitle} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold text-green-700 bg-green-50 border border-green-200 hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed">
                    <MdCheck className="text-base" /> {t("billing.detail.approve")}
                  </button>
                  <button onClick={reject} disabled={submitting || billLocked} title={billLockTitle} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed">
                    <MdClose className="text-base" /> {t("billing.detail.reject")}
                  </button>
                </>
              )}
              {bill.can_send && (
                <button onClick={sendToPortal} disabled={submitting || billLocked} title={billLockTitle} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed">
                  <MdOutlineSend className="text-base" /> {t("billing.detail.sendToPortal")}
                </button>
              )}
              {bill.status === "APPROVED" && (
                <Can module={MODULES.STAFFING_COMPANY} action={ACTIONS.UPDATE}>
                  <button onClick={() => setPayFor(bill)} disabled={submitting} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold text-green-700 bg-green-50 border border-green-200 hover:bg-green-100 disabled:opacity-50">
                    <MdOutlinePaid className="text-base" /> {t("billing.detail.markPaid")}
                  </button>
                </Can>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {[t("billing.detail.table.sn"), t("billing.detail.table.employee"), t("billing.detail.table.project"), t("billing.detail.table.idNumber"), t("billing.detail.table.designation"), t("billing.detail.table.workedHrs"), t("billing.detail.table.gross"), t("billing.detail.table.otHrs"), t("billing.detail.table.otAmount"), t("billing.detail.table.net")].map((h) => (
                    <th key={h} className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {billLoading ? (
                  <tr><td colSpan={10} className="px-5 py-8 text-center text-gray-400">{t("billing.loading")}</td></tr>
                ) : (bill.items || []).length === 0 ? (
                  <tr><td colSpan={10} className="px-5 py-8 text-center text-gray-400">{t("billing.detail.empty")}</td></tr>
                ) : bill.items.map((it, i) => (
                  <tr key={it.id} className="hover:bg-gray-50/60">
                    <td className="px-5 py-3 text-gray-500">{(ip.page - 1) * (ip.limit || ITEM_LIMIT) + i + 1}</td>
                    <td className="px-5 py-3 font-semibold text-gray-900">{it.employee?.name || `#${it.employee?.id}`}</td>
                    <td className="px-5 py-3"><span className="inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold bg-cyan-50 text-cyan-700">{it.project?.name || "—"}</span></td>
                    <td className="px-5 py-3 text-gray-600">{it.iqama || "—"}</td>
                    <td className="px-5 py-3 text-gray-600">{it.designation || "—"}</td>
                    <td className="px-5 py-3 text-gray-700">{it.worked_hours ?? "—"}</td>
                    <td className="px-5 py-3 text-gray-700">{money(it.gross, bill.currency)}</td>
                    <td className="px-5 py-3 text-gray-700">{it.overtime_hours ?? 0}</td>
                    <td className="px-5 py-3 text-gray-700">{money(it.overtime_amount, bill.currency)}</td>
                    <td className="px-5 py-3 font-bold text-gray-900">{money(it.net, bill.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-4 border-t border-gray-100">
            <Pagination page={ip.page} limit={ip.limit || ITEM_LIMIT} total={ip.total} totalPages={ip.total_pages || 1} onPage={(p) => openBill(bill.id, p)} label={t("billing.detail.paginationLabel")} activeClass="bg-cyan-600 text-white" containerClass="flex flex-col sm:flex-row items-center justify-between gap-3" />
          </div>
        </div>

        <ConfirmationModal
          isOpen={!!payFor}
          onClose={() => (submitting ? null : setPayFor(null))}
          onConfirm={confirmPaid}
          title={t("billing.paidConfirm.title")}
          message={t("billing.paidConfirm.message", { bill: bill.bill_no || `#${bill.id}`, amount: money(bill.total_amount, bill.currency) })}
          confirmText={t("billing.paidConfirm.confirm")}
          isLoading={submitting}
        />
      </div>
    );
  }

  // ── List / generate view ──
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
          <MdOutlineReceiptLong className="text-cyan-600" /> {t("billing.title")}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {t("billing.subtitle")}
        </p>
      </div>

      {/* Generate panel */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">{t("billing.company")}</label>
            <div className="relative z-10">
              <MdOutlineBusiness className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg pointer-events-none z-10" />
              <CustomDropdown
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                options={[
                  { value: "ALL", label: t("billing.allCompanies") },
                  ...companies.map((c) => ({ value: c.id, label: c.name }))
                ]}
                className="h-[46px] ps-10"
                isSearchable={true}
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">{t("billing.month")}</label>
            <CustomMonthPicker
              value={month}
              onChange={(val) => {
                setMonth(val);
                setMonthError("");
              }}
              containerClassName="w-full"
              className="w-full h-[46px]"
            />
            <FieldError message={monthError} />
          </div>
          <button onClick={handleGenerate} disabled={generating || lock.locked} title={lock.title} className="h-[46px] flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-5 rounded-lg text-sm font-bold disabled:opacity-60 disabled:cursor-not-allowed">
            <MdOutlineBolt className="text-lg" />
            {generating ? t("billing.generating") : companyId === "ALL" ? t("billing.generateAll") : t("billing.generate")}
          </button>
        </div>
        {companyId === "ALL" && <p className="text-xs text-amber-600 mt-3 font-medium">{t("billing.allNote")}</p>}
      </div>

      {/* History */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-gray-900">{t("billing.history.title")}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{t("billing.history.hint")}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="w-full sm:w-56">
              <CustomDropdown
                value={histCompany}
                onChange={(e) => { setHistCompany(e.target.value); setHistPage(1); }}
                options={[{ value: "", label: t("billing.allCompanies") }, ...companies.map((c) => ({ value: String(c.id), label: c.name }))]}
                isSearchable={true}
              />
            </div>
            <div className="w-full sm:w-48">
              <CustomDropdown
                value={histStatus}
                onChange={(e) => { setHistStatus(e.target.value); setHistPage(1); }}
                options={[{ value: "", label: t("billing.history.allStatuses") }, ...STATUSES.map((s) => ({ value: s, label: statusText(s) }))]}
              />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-start text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-[#f8f9fc]">
                {[t("billing.history.table.sn"), t("billing.history.table.billNo"), t("billing.history.table.company"), t("billing.history.table.period"), t("billing.history.table.lines"), t("billing.history.table.amount"), t("billing.history.table.status"), t("billing.history.table.action")].map((h) => (
                  <th key={h} className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {histLoading ? (
                <tr><td colSpan={8} className="px-5 py-8 text-center text-gray-400">{t("billing.loading")}</td></tr>
              ) : history.rows.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-8 text-center text-gray-500">{t("billing.history.empty")}</td></tr>
              ) : history.rows.map((r, idx) => (
                <tr key={r.id} className="hover:bg-gray-50/60 cursor-pointer" onClick={() => openBill(r.id, 1)}>
                  <td className="px-5 py-3 text-gray-500 font-medium">{(histPage - 1) * HIST_LIMIT + idx + 1}</td>
                  <td className="px-5 py-3 font-semibold text-cyan-700 whitespace-nowrap"><span dir="ltr">{r.bill_no || "—"}</span></td>
                  <td className="px-5 py-3 font-semibold text-gray-900">{r.staffing_company?.name || `#${r.staffing_company?.id}`}</td>
                  <td className="px-5 py-3 text-gray-600">{t(`monthsShort.${r.period?.month || 1}`)} {r.period?.year}</td>
                  <td className="px-5 py-3 text-gray-600">{r.employee_count ?? "—"}</td>
                  <td className="px-5 py-3 font-semibold text-gray-900">{money(r.total_amount, r.currency)}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${STATUS_STYLE[r.status] || "bg-gray-100 text-gray-600"}`}>{statusText(r.status)}</span>
                    {r.paid_at && (
                      <div className="text-[11px] text-green-700 mt-1 whitespace-nowrap">{t("billing.history.paidOn", { date: fmtDate(r.paid_at) })}</div>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <button onClick={(e) => { e.stopPropagation(); openBill(r.id, 1); }} className="p-1.5 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg">
                      <MdOutlineVisibility className="text-lg" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-4 border-t border-gray-100">
          <Pagination page={histPage} limit={HIST_LIMIT} total={history.total} totalPages={history.total_pages || 1} onPage={setHistPage} label={t("billing.history.paginationLabel")} activeClass="bg-cyan-600 text-white" containerClass="flex flex-col sm:flex-row items-center justify-between gap-3" />
        </div>
      </div>
    </div>
  );
}
