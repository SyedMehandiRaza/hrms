import { useEffect, useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { toast } from "react-toastify";
import {
  MdAdd,
  MdOutlinePayments,
  MdOutlineCheckCircle,
  MdOutlineCancel,
  MdOutlineVisibility,
  MdClose,
  MdOutlineInbox,
  MdOutlineSkipNext,
  MdOutlineMoreVert,
  MdOutlineEditNote,
  MdSearch,
  MdOutlineClear,
} from "react-icons/md";
import { paginate } from "../../data/common";
import {
  actLoanSkip,
  approveLoan,
  listLoans,
  listSkipRequests,
  rejectLoan,
  requestLoanModification,
} from "../../data/groupE";
import { LOAN_STATUS_STYLES, fmtMoney, fmtDate, previewEmi } from "./loanUi";
import ApplyLoanModal from "./ApplyLoanModal";
import { useNavigate, useSearchParams } from "react-router-dom";
import Pagination from "../../components/Pagination";
import { useTranslation, Trans } from "react-i18next";
import useFiscalYear from "../../hooks/useFiscalYear";
import useYearLock from "../../hooks/useYearLock";

// Status filter ids of the All-loans tab (the API's loan statuses + ALL).
const LOAN_STATUS_FILTERS = ["ALL", "PENDING", "MODIFICATION_REQUESTED", "ACTIVE", "COMPLETED", "REJECTED"];

// A page number that falls back to 1 whenever `key` (tab / filters / year) changes.
function useKeyedPage(key) {
  const [state, setState] = useState({ key, page: 1 });
  const page = state.key === key ? state.page : 1;
  const set = (p) => setState({ key, page: typeof p === "function" ? p(page) : p });
  return [page, set];
}

export default function LoanApprovals() {
  const { t } = useTranslation("loans");
  // ?status=PENDING (e.g. a year-end readiness "Fix" link) preselects the
  // All-loans filter instead of the "pending if any" default.
  const [searchParams] = useSearchParams();
  const urlStatus = (() => {
    const s = String(searchParams.get("status") || "").toUpperCase();
    return LOAN_STATUS_FILTERS.includes(s) ? s : "";
  })();
  const [tick, setTick] = useState(0);
  // Pending counts (tab badges) + the default filters ("pending if any").
  const pendingLoansCount = tick >= 0 ? listLoans({ status: "PENDING" }).length : 0;
  const pendingSkipsCount = tick >= 0 ? listSkipRequests({ status: "PENDING" }).length : 0;

  const [tab, setTab] = useState("all");
  const loaded = true;
  const [approving, setApproving] = useState(null);
  const [newOpen, setNewOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState(() => urlStatus || (pendingLoansCount > 0 ? "PENDING" : "ALL"));
  const [skipFilter, setSkipFilter] = useState(() => (pendingSkipsCount > 0 ? "PENDING" : "ALL"));
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const canApprove = true;
  const [rejecting, setRejecting] = useState(null);
  const [modifying, setModifying] = useState(null);
  const navigate = useNavigate();
  const fy = useFiscalYear();
  // Read-only while a closed + locked year is selected; a skip request also
  // when its installment falls in a locked year (the backend refuses both).
  const lock = useYearLock();
  const canAct = canApprove && !lock.locked;

  const [limit] = useState(10);
  // Pages go back to 1 whenever the tab / filter / search / year changes.
  const [pageLoans, setPageLoans] = useKeyedPage(`${tab}|${statusFilter}|${debouncedSearchQuery}|${fy.version}`);
  const [pageSkips, setPageSkips] = useKeyedPage(`${tab}|${skipFilter}|${debouncedSearchQuery}|${fy.version}`);

  // Static lists, filtered + paged on the client.
  const loansPg = paginate(
    tick >= 0 ? listLoans({ scope: "all", status: statusFilter === "ALL" ? undefined : statusFilter, search: debouncedSearchQuery }) : [],
    pageLoans,
    limit,
  );
  const loans = loansPg.rows;
  const totalLoans = loansPg.total;
  const totalPagesLoans = loansPg.totalPages;
  const skipsPg = paginate(
    tick >= 0 ? listSkipRequests({ status: skipFilter === "ALL" ? undefined : skipFilter, search: debouncedSearchQuery }) : [],
    pageSkips,
    limit,
  );
  const skips = skipsPg.rows;
  const totalSkips = skipsPg.total;
  const totalPagesSkips = skipsPg.totalPages;

  const switchTab = (t) => {
    setTab(t);
    setSearchQuery("");
    setDebouncedSearchQuery("");
    setPageLoans(1);
    setPageSkips(1);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleClearFilters = () => {
    setSearchQuery("");
    if (tab === "all") setStatusFilter("ALL");
    if (tab === "skips") setSkipFilter("ALL");
  };

  const refresh = () => setTick((n) => n + 1);

  const actSkip = async (skip, kind) => {
    actLoanSkip(skip.id, kind);
    toast.success(kind === "approve" ? t("toast.skipApproved") : t("toast.skipRejected"));
    refresh();
  };

  const levelChip = (loan) => {
    const total = loan.meta?.total_levels || 1;
    const done = loan.meta?.approved_levels || 0;
    if (total <= 1) return null;
    return (
      <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-600">
        {t("approvals.levelChip", { done, total })}
      </span>
    );
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">{t("approvals.title")}</h1>
          <p className="text-gray-500 mt-1 text-sm">{t("approvals.subtitle")}</p>
        </div>
        {!lock.locked && (
        <button
          onClick={() => setNewOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-[#20B2AA] to-cyan-500 hover:from-[#1C9D96] hover:to-cyan-600 rounded-lg shadow-sm shadow-cyan-200 transition-all"
        >
          <MdAdd className="text-lg" /> {t("approvals.newLoanForEmployee")}
        </button>
        )}
      </div>

      {/* tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        {[
          { id: "all", label: t("approvals.tabs.all"), badge: pendingLoansCount },
          { id: "skips", label: t("approvals.tabs.skips"), badge: pendingSkipsCount },
        ].map((tb) => (
          <button
            key={tb.id}
            onClick={() => switchTab(tb.id)}
            className={`relative px-4 py-2.5 text-sm font-medium ${tab === tb.id ? "text-cyan-600" : "text-gray-500 hover:text-gray-800"}`}
          >
            {tb.label}
            {tb.badge > 0 && (
              <span className="ml-1.5 text-[11px] px-1.5 py-0.5 rounded-full bg-cyan-50 text-cyan-600 font-bold">{tb.badge}</span>
            )}
            {tab === tb.id && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-cyan-600 rounded-full" />}
          </button>
        ))}
      </div>

      {!loaded ? (
        <div className="py-16 text-center text-sm text-gray-400">{t("common.loading")}</div>
      ) : tab === "all" ? (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: "ALL", label: t("approvals.filters.all") },
                { id: "PENDING", label: t("approvals.filters.pending") },
                { id: "MODIFICATION_REQUESTED", label: t("approvals.filters.needsChanges") },
                { id: "ACTIVE", label: t("approvals.filters.approved") },
                { id: "COMPLETED", label: t("approvals.filters.completed") },
                { id: "REJECTED", label: t("approvals.filters.rejected") },
              ].map((f) => {
              return (
                <button
                  key={f.id}
                  onClick={() => setStatusFilter(f.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${statusFilter === f.id
                      ? "bg-cyan-50 border-cyan-200 text-cyan-700"
                      : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}
                >
                  {f.label}
                </button>
              );
            })}
            </div>
            <SearchBar value={searchQuery} onChange={setSearchQuery} onClear={handleClearFilters} />
          </div>
          <LoanTable
            heading={null}
            loans={loans}
            emptyText={t("approvals.emptyLoans")}
            levelChip={levelChip}
            onView={(id) => navigate(`/admin/loan-approvals/${id}`)}
            onApprove={canAct ? setApproving : undefined}
            onReject={canAct ? setRejecting : undefined}
            onModify={canAct ? setModifying : undefined}
          />
          {loans.length > 0 && (
            <Pagination
              page={pageLoans}
              totalPages={totalPagesLoans}
              total={totalLoans}
              limit={limit}
              onPage={setPageLoans}
              label={t("pagination.loans")}
            />
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: "ALL", label: t("approvals.filters.all") },
                { id: "PENDING", label: t("approvals.filters.pending") },
                { id: "APPROVED", label: t("approvals.filters.approved") },
                { id: "REJECTED", label: t("approvals.filters.rejected") },
              ].map((f) => {
              return (
                <button
                  key={f.id}
                  onClick={() => setSkipFilter(f.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${skipFilter === f.id
                      ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                      : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}
                >
                  {f.label}
                </button>
              );
            })}
            </div>
            <SearchBar value={searchQuery} onChange={setSearchQuery} onClear={handleClearFilters} />
          </div>
          <SkipTable 
            skips={skips} 
            onAct={canApprove ? actSkip : undefined}
            isLocked={(s) => lock.isLockedDate(s.installment?.due_date)}
            onView={(id) => navigate(`/admin/loan-approvals/${id}`)} 
          />
          {skips.length > 0 && (
            <Pagination
              page={pageSkips}
              totalPages={totalPagesSkips}
              total={totalSkips}
              limit={limit}
              onPage={setPageSkips}
              label={t("pagination.skipRequests")}
            />
          )}
        </div>
      )}

      {approving && <ApproveModal loan={approving} onClose={() => setApproving(null)} onDone={refresh} />}
      {rejecting && <RejectModal loan={rejecting} onClose={() => setRejecting(null)} onDone={refresh} />}
      {modifying && <RequestModificationModal loan={modifying} onClose={() => setModifying(null)} onDone={refresh} />}
      {newOpen && <ApplyLoanModal onBehalf onClose={() => setNewOpen(false)} onCreated={refresh} />}
    </div>
  );
}

function SearchBar({ value, onChange, onClear }) {
  const { t } = useTranslation("loans");
  return (
    <div className="flex items-center gap-2 w-full sm:w-auto">
      <div className="relative w-full sm:w-auto flex-1">
        <MdSearch className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
        <input
          type="text"
          placeholder={t("approvals.searchPlaceholder")}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="ps-9 pe-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#20B2AA] focus:border-transparent w-full sm:w-64 transition-all"
        />
      </div>
      <button
        onClick={onClear}
        className="w-full sm:w-auto flex justify-center items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-2 rounded-lg font-medium text-sm transition-colors h-[42px]"
      >
        <MdOutlineClear className="text-lg" />
        {t("common.clearFilters")}
      </button>
    </div>
  );
}

function ActionMenu({ onView, onApprove, onReject, onModify, status }) {
  const { t } = useTranslation("loans");
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target) &&
        menuRef.current && !menuRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    
    const handleScroll = () => setOpen(false);

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("scroll", handleScroll, true);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("scroll", handleScroll, true);
    };
  }, [open]);

  const toggle = (e) => {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 4,
        left: rect.right - 144, // 144px is w-36
      });
    }
    setOpen(!open);
  };

  return (
    <>
      <button 
        ref={btnRef}
        onClick={toggle}
        className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
      >
        <MdOutlineMoreVert className="text-xl" />
      </button>
      
      {open && createPortal(
        <div 
          ref={menuRef}
          style={{ position: 'fixed', top: coords.top, left: coords.left }}
          className="w-36 bg-white rounded-lg shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] border border-gray-100 z-[9999] py-1.5"
        >
          {onView && (
            <button
              onClick={() => { setOpen(false); onView(); }}
              className="w-full text-left px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-cyan-600 flex items-center gap-2.5 transition-colors"
            >
              <MdOutlineVisibility className="text-lg text-cyan-500" /> {t("actions.view")}
            </button>
          )}
          {onApprove && status === "PENDING" && (
            <button
              onClick={() => { setOpen(false); onApprove(); }}
              className="w-full text-left px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-emerald-600 flex items-center gap-2.5 transition-colors"
            >
              <MdOutlineCheckCircle className="text-lg text-emerald-500" /> {t("actions.approve")}
            </button>
          )}
          {onModify && status === "PENDING" && (
            <button
              onClick={() => { setOpen(false); onModify(); }}
              className="w-full text-left px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-orange-600 flex items-center gap-2.5 transition-colors"
            >
              <MdOutlineEditNote className="text-lg text-orange-500" /> {t("actions.requestChanges")}
            </button>
          )}
          {onReject && status === "PENDING" && (
            <button
              onClick={() => { setOpen(false); onReject(); }}
              className="w-full text-left px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-rose-600 flex items-center gap-2.5 transition-colors"
            >
              <MdOutlineCancel className="text-lg text-rose-500" /> {t("actions.reject")}
            </button>
          )}
        </div>,
        document.body
      )}
    </>
  );
}

function LoanTable({ heading, loans, emptyText, levelChip, onView, onApprove, onReject, onModify }) {
  const { t } = useTranslation("loans");
  const statusLabel = (s) => t(`status.${LOAN_STATUS_STYLES[s] ? s : "PENDING"}`);
  return (
    <div>
      {heading && <h3 className="text-sm font-bold text-gray-900 mb-2">{heading}</h3>}
      {loans.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-10 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center mb-3">
            <MdOutlineInbox className="text-2xl text-gray-300" />
          </div>
          <p className="text-sm text-gray-500">{emptyText}</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[820px]">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  {[t("table.loan"), t("table.employee"), t("table.amount"), t("table.installments"), t("table.status"), t("table.action")].map((h) => (
                    <th key={h} className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loans.map((l) => {
                  const st = LOAN_STATUS_STYLES[l.status] || LOAN_STATUS_STYLES.PENDING;
                  return (
                    <tr key={l.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center"><MdOutlinePayments className="text-base" /></div>
                          <p className="font-semibold text-gray-900 text-sm">{l.loan_number || t("common.loanFallback", { id: l.id })}</p>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-600">{l.employee?.full_name || `#${l.employee_id}`}</td>
                      <td className="px-5 py-3.5 text-sm text-gray-700">{fmtMoney(l.approved_amount ?? l.requested_amount)}</td>
                      <td className="px-5 py-3.5 text-sm text-gray-500">{l.approved_installments ?? l.requested_installments}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${st.chip}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />{statusLabel(l.status)}
                        </span>
                        {levelChip && levelChip(l)}
                      </td>
                      <td className="px-5 py-3.5">
                        <ActionMenu
                          status={l.status}
                          onView={() => onView(l.id)}
                          onApprove={onApprove ? () => onApprove(l) : null}
                          onReject={onReject ? () => onReject(l) : null}
                          onModify={onModify ? () => onModify(l) : null}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function SkipTable({ skips, onAct, onView, isLocked = () => false }) {
  const { t } = useTranslation("loans");
  if (skips.length === 0) return null;
  return (
    <div>
      <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
        <MdOutlineSkipNext className="text-indigo-500" /> {t("approvals.skipRequestsHeading")}
        <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-bold">{skips.length}</span>
      </h3>
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[720px]">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                {[t("table.loan"), t("table.employee"), t("table.emiNo"), t("table.due"), t("table.reason"), t("table.status"), t("table.action")].map((h) => (
                  <th key={h} className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {skips.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50/70 transition-colors">
                  <td className="px-5 py-3.5">
                    <button onClick={() => onView(s.loan?.id)} className="font-semibold text-gray-900 text-sm hover:text-cyan-600">
                      {s.loan?.loan_number || t("common.loanFallback", { id: s.loan_id })}
                    </button>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-600">{s.loan?.employee?.full_name || "—"}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-700">#{s.installment?.installment_no}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-500">{fmtDate(s.installment?.due_date)}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-500 truncate max-w-[200px]">{s.reason || "—"}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      s.status === "PENDING" ? "bg-amber-50 text-amber-600 border border-amber-200" :
                      s.status === "APPROVED" ? "bg-emerald-50 text-emerald-600 border border-emerald-200" :
                      "bg-rose-50 text-rose-600 border border-rose-200"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        s.status === "PENDING" ? "bg-amber-500" :
                        s.status === "APPROVED" ? "bg-emerald-500" :
                        "bg-rose-500"
                      }`} />
                      {t(`skipStatus.${s.status}`, { defaultValue: s.status })}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <ActionMenu 
                      status={s.status}
                      onView={() => onView(s.loan?.id)}
                      onApprove={onAct && !isLocked(s) ? () => onAct(s, "approve") : null}
                      onReject={onAct && !isLocked(s) ? () => onAct(s, "reject") : null}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// approve modal: read-only terms (the approver can no longer edit them — a
// wrong installment count is sent back via "Request changes"). Approve as-is.
function ApproveModal({ loan, onClose, onDone }) {
  const { t } = useTranslation("loans");
  const [saving, setSaving] = useState(false);
  const amount = Number(loan.approved_amount ?? loan.requested_amount);
  const installments = Number(loan.approved_installments ?? loan.requested_installments);
  const { emi, last } = useMemo(() => previewEmi(amount, installments), [amount, installments]);
  const total = loan.meta?.total_levels || 1;
  const nextLevel = (loan.meta?.approved_levels || 0) + 1;

  const approve = async () => {
    setSaving(true);
    try {
      approveLoan(loan.id);
      toast.success(total > 1 && nextLevel < total ? t("toast.levelApproved", { level: nextLevel }) : t("toast.loanApproved"));
      onDone?.();
      onClose?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900">{t("approve.title", { loan: loan.loan_number || t("common.loanFallback", { id: loan.id }) })}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><MdClose className="text-xl" /></button>
        </div>
        <div className="p-5 space-y-4">
          {total > 1 && (
            <div className="text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
              {t("approve.levelOf", { level: nextLevel, total })}
            </div>
          )}
          <p className="text-xs text-gray-500">
            <Trans t={t} i18nKey="approve.note" components={{ hl: <span className="font-semibold text-orange-600" /> }} />
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">{t("approve.amount")}</label>
              <div className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-900">{fmtMoney(amount)}</div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">{t("approve.installments")}</label>
              <div className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-900">{installments}</div>
            </div>
          </div>
          {emi > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">{t("approve.monthlyEmi")}</p>
                <p className="text-xl font-bold text-gray-900">{fmtMoney(emi)}</p>
              </div>
              <p className="text-[11px] text-gray-500 text-right">{t("approve.emisCount", { n: installments })}<br />{t("approve.last", { amount: fmtMoney(last) })}</p>
            </div>
          )}
        </div>
        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900">{t("common.cancel")}</button>
          <button onClick={approve} disabled={saving}
            className="px-5 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-60">
            {saving ? t("approve.approving") : total > 1 && nextLevel < total ? t("approve.approveLevel", { level: nextLevel }) : t("approve.approveGenerate")}
          </button>
        </div>
      </div>
    </div>
  );
}

function RejectModal({ loan, onClose, onDone }) {
  const { t } = useTranslation("loans");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const reject = async () => {
    setSaving(true);
    try {
      rejectLoan(loan.id, reason);
      toast.success(t("toast.loanRejected"));
      onDone?.();
      onClose?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900">{t("reject.title", { loan: loan.loan_number || t("common.loanFallback", { id: loan.id }) })}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors">
            <MdClose className="text-xl" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">{t("reject.reasonOptional")}</label>
            <textarea
              rows="3"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("reject.reasonPlaceholder")}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white resize-none"
            />
          </div>
        </div>
        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-2 bg-gray-50/50">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors">{t("common.cancel")}</button>
          <button onClick={reject} disabled={saving}
            className="px-5 py-2 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-60 transition-colors shadow-sm shadow-rose-200">
            {saving ? t("reject.rejecting") : t("reject.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

// Send the loan back to the employee to correct the terms (replaces the old
// "approver edits installments" flow). Reason required; suggested amount /
// installments are optional hints that pre-fill the employee's re-apply form.
function RequestModificationModal({ loan, onClose, onDone }) {
  const { t } = useTranslation("loans");
  const [reason, setReason] = useState("");
  const [installments, setInstallments] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!reason.trim()) return toast.error(t("toast.reasonRequired"));
    setSaving(true);
    try {
      requestLoanModification(loan.id, {
        reason: reason.trim(),
        ...(Number(installments) >= 1 ? { suggested_installments: Number(installments) } : {}),
        ...(Number(amount) > 0 ? { suggested_amount: Number(amount) } : {}),
      });
      toast.success(t("toast.sentBack"));
      onDone?.();
      onClose?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900">{t("modify.title", { loan: loan.loan_number || t("common.loanFallback", { id: loan.id }) })}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><MdClose className="text-xl" /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-gray-500">
            {t("modify.description")}
          </p>
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">{t("modify.reason")} <span className="text-rose-500">*</span></label>
            <textarea rows="3" value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder={t("modify.reasonPlaceholder")}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">{t("modify.suggestedInstallments")}</label>
              <input type="number" min="1" max="240" value={installments} onChange={(e) => setInstallments(e.target.value)} placeholder={t("common.optional")}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">{t("modify.suggestedAmount")}</label>
              <input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={t("common.optional")}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white" />
            </div>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-2 bg-gray-50/50">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900">{t("common.cancel")}</button>
          <button onClick={submit} disabled={saving}
            className="px-5 py-2 text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 rounded-lg disabled:opacity-60 shadow-sm shadow-orange-200">
            {saving ? t("modify.sending") : t("modify.sendBack")}
          </button>
        </div>
      </div>
    </div>
  );
}
