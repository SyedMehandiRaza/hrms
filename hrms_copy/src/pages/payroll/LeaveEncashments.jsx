import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import {
  MdAddCircleOutline,
  MdCheck,
  MdClose,
  MdOutlineCancel,
  MdOutlineClear,
  MdOutlinePayments,
  MdSearch,
} from "react-icons/md";
import CustomDropdown from "../../components/CustomDropdown";
import CustomMonthPicker from "../../components/CustomMonthPicker";
import ConfirmationModal from "../../components/ConfirmationModal";
import FieldError from "../../components/FieldError";
import LevelProgress from "../../components/LevelProgress";
import Loader, { TableLoader, Spinner } from "../../components/Loader";
import Ltr from "../../components/Ltr";
import Pagination from "../../components/Pagination";
import RequestEncashmentModal from "../../components/leave/encashment/RequestEncashmentModal";
import { EncashAmount, EncashMonth, EncashStatusBadge } from "../../components/leave/encashment/encashmentUi";
import useFiscalYear from "../../hooks/useFiscalYear";
import useYearLock from "../../hooks/useYearLock";
import { useFormat } from "../../hooks/useFormat";
import { DEPARTMENTS, paginate } from "../../data/common";
import { actOnEncashment, cancelEncashment, listEncashments } from "../../data/groupE";
import { ENCASHMENT_STATUSES } from "../../utils/fyValidation/encashment";

const PAGE_SIZE = 10;
const COMMENT_MAX = 500;

// Payroll → Leave Encashment (owner / LEAVE approvers / LEAVE:update).
// List with filters (status, payout month, department, search; the header year
// = ?fy), approve / reject through the approvals engine (only the approver
// whose turn it is), raise on behalf, cancel (pending, or approved and not yet
// in a processed payroll — the days go back and the pay line is removed).
export default function LeaveEncashments() {
  const { t } = useTranslation("leaves");
  const { fmtDate } = useFormat();
  const fy = useFiscalYear();
  const lock = useYearLock();
  const [searchParams] = useSearchParams();

  const [tick, setTick] = useState(0);
  const departments = DEPARTMENTS;
  const [filters, setFilters] = useState({
    status: ENCASHMENT_STATUSES.includes(searchParams.get("status")) ? searchParams.get("status") : "",
    payout_month: "",
    department_id: "",
  });
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  // page — back to 1 when the financial year changes
  const [pageState, setPageState] = useState({ version: fy.version, page: 1 });
  const page = pageState.version === fy.version ? pageState.page : 1;
  const setPage = (p) => setPageState({ version: fy.version, page: p });

  const [raiseOpen, setRaiseOpen] = useState(false);
  const [action, setAction] = useState(null); // { row, kind: APPROVE | REJECT }
  const [comment, setComment] = useState("");
  const [commentError, setCommentError] = useState("");
  const [acting, setActing] = useState(false);
  const [cancelRow, setCancelRow] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  // Filters + paging on the static list (counts ignore the status filter).
  const found = tick >= 0
    ? listEncashments({
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.payout_month ? { payout_month: filters.payout_month } : {}),
      ...(filters.department_id ? { department_id: filters.department_id } : {}),
      ...(search ? { search } : {}),
      ...(fy.selected ? { fy: fy.selected } : {}),
    })
    : { rows: [], counts: {} };
  const pg = paginate(found.rows, page, PAGE_SIZE);
  const loading = false;
  const rows = pg.rows;
  const meta = { total: pg.total, total_pages: pg.totalPages, counts: found.counts };
  const load = () => setTick((n) => n + 1);

  const setFilter = (key, value) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };
  const clearFilters = () => {
    setFilters({ status: "", payout_month: "", department_id: "" });
    setSearchInput("");
    setSearch("");
    setPage(1);
  };

  const openAction = (row, kind) => {
    setComment("");
    setCommentError("");
    setAction({ row, kind });
  };
  const submitAction = async () => {
    if (!action) return;
    const text = comment.trim();
    if (action.kind === "REJECT" && !text) {
      setCommentError(t("encashment.admin.reasonRequired"));
      return;
    }
    if (text.length > COMMENT_MAX) {
      setCommentError(t("encashment.admin.reasonMax"));
      return;
    }
    setActing(true);
    try {
      actOnEncashment(action.row.id, action.kind, text);
      toast.success(action.kind === "APPROVE" ? t("encashment.toast.approved") : t("encashment.toast.rejected"), {
        toastId: `encash-${action.row.id}`,
      });
      setAction(null);
      load();
    } finally {
      setActing(false);
    }
  };

  const confirmCancel = async () => {
    if (!cancelRow) return;
    setCancelling(true);
    try {
      cancelEncashment(cancelRow.id);
      toast.success(t("encashment.toast.cancelled"));
      setCancelRow(null);
      load();
    } finally {
      setCancelling(false);
    }
  };

  const statusOptions = [
    { value: "", label: t("encashment.admin.allStatuses") },
    ...ENCASHMENT_STATUSES.map((s) => ({ value: s, label: t(`encashment.status.${s}`) })),
  ];
  const deptOptions = [
    { value: "", label: t("encashment.admin.allDepartments") },
    ...departments.map((d) => ({ value: String(d.id), label: d.name || d.department_name || "—" })),
  ];
  const canCancel = (r) => !lock.locked && (r.status === "PENDING" || r.status === "APPROVED");

  const actions = (r) => (
    <div className="flex items-center gap-1.5 flex-wrap">
      {r.approval?.can_approve && r.status === "PENDING" && (
        <button
          type="button"
          onClick={() => openAction(r, "APPROVE")}
          disabled={lock.locked}
          title={lock.title}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-green-700 bg-green-50 border border-green-200 hover:bg-green-100 disabled:opacity-50 transition-colors"
        >
          <MdCheck className="text-sm" /> {t("encashment.admin.approve")}
        </button>
      )}
      {r.approval?.can_reject && r.status === "PENDING" && (
        <button
          type="button"
          onClick={() => openAction(r, "REJECT")}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors"
        >
          <MdClose className="text-sm" /> {t("encashment.admin.reject")}
        </button>
      )}
      {canCancel(r) && (
        <button
          type="button"
          onClick={() => setCancelRow(r)}
          title={r.status === "APPROVED" ? t("encashment.admin.cancelApprovedHint") : undefined}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <MdOutlineCancel className="text-sm" /> {t("encashment.admin.cancel")}
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <MdOutlinePayments className="text-cyan-600" />
            {t("encashment.admin.title")}
          </h1>
          <p className="text-gray-400 mt-1 text-sm">{t("encashment.admin.subtitle")}</p>
        </div>
        {!lock.locked && (
          <button
            type="button"
            onClick={() => setRaiseOpen(true)}
            className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm transition-colors self-start"
          >
            <MdAddCircleOutline className="text-lg" /> {t("encashment.admin.raise")}
          </button>
        )}
      </div>

      {/* Status counts */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {ENCASHMENT_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter("status", filters.status === s ? "" : s)}
            className={`text-start bg-white border rounded-xl px-4 py-3 transition-colors ${
              filters.status === s ? "border-cyan-400 ring-2 ring-cyan-100" : "border-gray-200 hover:bg-gray-50"
            }`}
          >
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{t(`encashment.status.${s}`)}</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">
              <Ltr>{meta.counts?.[s] ?? 0}</Ltr>
            </p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl px-4 py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div className="lg:col-span-2">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">{t("encashment.admin.search")}</label>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSearch(searchInput.trim());
                setPage(1);
              }}
              className="relative"
            >
              <MdSearch className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onBlur={() => {
                  if (searchInput.trim() !== search) {
                    setSearch(searchInput.trim());
                    setPage(1);
                  }
                }}
                placeholder={t("encashment.admin.searchPlaceholder")}
                className="w-full border border-gray-200 rounded-lg ps-9 pe-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </form>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">{t("encashment.admin.status")}</label>
            <CustomDropdown value={filters.status} onChange={(e) => setFilter("status", e.target.value)} options={statusOptions} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">{t("encashment.admin.department")}</label>
            <CustomDropdown
              value={filters.department_id}
              onChange={(e) => setFilter("department_id", e.target.value)}
              options={deptOptions}
              isSearchable
            />
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1 min-w-0">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">{t("encashment.admin.payoutMonth")}</label>
              <CustomMonthPicker value={filters.payout_month} onChange={(v) => setFilter("payout_month", v)} containerClassName="w-full" className="w-full" />
            </div>
            <button
              type="button"
              onClick={clearFilters}
              title={t("encashment.admin.clear")}
              aria-label={t("encashment.admin.clear")}
              className="h-[42px] px-3 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
            >
              <MdOutlineClear className="text-lg" />
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {[
                  t("encashment.table.employee"),
                  t("encashment.table.leaveType"),
                  t("encashment.table.days"),
                  t("encashment.table.payoutMonth"),
                  t("encashment.table.amount"),
                  t("encashment.table.status"),
                  t("encashment.table.level"),
                  t("encashment.table.action"),
                ].map((h) => (
                  <th key={h} className="text-start px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <TableLoader colSpan={8} />
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-sm text-gray-400">
                    {t("encashment.admin.empty")}
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors align-top">
                    <td className="px-4 py-3.5">
                      <p className="text-sm font-bold text-gray-900">{r.employee?.full_name || "—"}</p>
                      <p className="text-xs text-gray-400">
                        <Ltr>{r.employee?.country_emp_id || r.code}</Ltr>
                        {r.employee?.department?.name ? ` · ${r.employee.department.name}` : ""}
                      </p>
                      {r.raised_on_behalf && (
                        <span className="inline-block mt-1 text-[10px] font-semibold text-indigo-600 bg-indigo-50 rounded px-1.5 py-0.5">
                          {t("encashment.admin.onBehalfBadge")}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-700">
                      {r.leave_type?.name || "—"}
                      {r.reason && <p className="text-xs text-gray-400 mt-0.5 max-w-[220px] truncate" title={r.reason}>{r.reason}</p>}
                      {r.reject_reason && <p className="text-xs text-red-500 mt-0.5">{r.reject_reason}</p>}
                    </td>
                    <td className="px-4 py-3.5 text-sm font-bold text-gray-900">
                      <Ltr>{r.days}</Ltr>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-700">
                      <EncashMonth value={r.payout_month} />
                    </td>
                    <td className="px-4 py-3.5 text-sm font-semibold text-gray-900">
                      <EncashAmount value={r.amount} currency={r.currency} />
                      <p className="text-[11px] text-gray-400 font-normal">
                        <Ltr>{fmtDate(r.created_at)}</Ltr>
                      </p>
                    </td>
                    <td className="px-4 py-3.5">
                      <EncashStatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3.5">
                      {r.approval ? <LevelProgress levels={r.approval.levels_summary} currentLevel={r.approval.current_level} /> : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3.5">{actions(r)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile */}
        <div className="md:hidden divide-y divide-gray-100">
          {loading ? (
            <Loader />
          ) : rows.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">{t("encashment.admin.empty")}</div>
          ) : (
            rows.map((r) => (
              <div key={r.id} className="px-4 py-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-gray-900">{r.employee?.full_name || "—"}</p>
                    <p className="text-xs text-gray-500">{r.leave_type?.name || "—"}</p>
                  </div>
                  <EncashStatusBadge status={r.status} />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                  <span>
                    {t("encashment.table.days")}: <strong className="text-gray-800"><Ltr>{r.days}</Ltr></strong>
                  </span>
                  <span>
                    {t("encashment.table.payoutMonth")}: <strong className="text-gray-800"><EncashMonth value={r.payout_month} /></strong>
                  </span>
                  <span>
                    {t("encashment.table.amount")}: <strong className="text-gray-800"><EncashAmount value={r.amount} currency={r.currency} /></strong>
                  </span>
                </div>
                {actions(r)}
              </div>
            ))
          )}
        </div>

        <Pagination
          page={page}
          totalPages={meta.total_pages}
          total={meta.total}
          limit={PAGE_SIZE}
          onPage={setPage}
          label={t("encashment.my.label")}
          activeClass="bg-cyan-600 text-white"
        />
      </div>

      <RequestEncashmentModal
        open={raiseOpen}
        mode="ADMIN"
        onClose={() => setRaiseOpen(false)}
        onDone={() => {
          setRaiseOpen(false);
          load();
        }}
      />

      {/* Approve / reject */}
      {action && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4" onClick={() => !acting && setAction(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <p className="text-base font-bold text-gray-900">
                {action.kind === "APPROVE" ? t("encashment.admin.approveTitle") : t("encashment.admin.rejectTitle")}
              </p>
              <button type="button" onClick={() => !acting && setAction(null)} className="text-gray-400 hover:text-gray-600">
                <MdClose className="text-xl" />
              </button>
            </div>
            <div className="px-5 py-5 space-y-3">
              <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm">
                <p className="font-semibold text-gray-900">{action.row.employee?.full_name}</p>
                <p className="text-gray-600">
                  {t("encashment.admin.summary", {
                    type: action.row.leave_type?.name || "—",
                    days: action.row.days,
                  })}{" "}
                  · <EncashMonth value={action.row.payout_month} /> · <EncashAmount value={action.row.amount} currency={action.row.currency} />
                </p>
              </div>
              {action.kind === "APPROVE" && <p className="text-xs text-gray-500">{t("encashment.admin.approveNote")}</p>}
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                {action.kind === "REJECT" ? t("encashment.admin.reasonLabel") : t("encashment.admin.commentLabel")}
              </label>
              <textarea
                value={comment}
                rows={3}
                onChange={(e) => {
                  setComment(e.target.value);
                  if (commentError) setCommentError("");
                }}
                className={`w-full border rounded-lg px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                  commentError ? "border-red-400 bg-red-50" : "border-gray-200"
                }`}
              />
              <FieldError message={commentError} />
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setAction(null)}
                disabled={acting}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
              >
                {t("encashment.modal.cancel")}
              </button>
              <button
                type="button"
                onClick={submitAction}
                disabled={acting}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 ${
                  action.kind === "APPROVE" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {acting && <Spinner size="sm" className="border-white border-t-transparent" />}
                {action.kind === "APPROVE" ? t("encashment.admin.approve") : t("encashment.admin.reject")}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={!!cancelRow}
        onClose={() => !cancelling && setCancelRow(null)}
        onConfirm={confirmCancel}
        title={t("encashment.admin.cancelTitle")}
        message={
          cancelRow?.status === "APPROVED"
            ? t("encashment.admin.cancelApprovedMessage", { name: cancelRow?.employee?.full_name || "", days: cancelRow?.days ?? "" })
            : t("encashment.admin.cancelPendingMessage", { name: cancelRow?.employee?.full_name || "" })
        }
        type="warning"
        confirmText={t("encashment.admin.cancelConfirm")}
        cancelText={t("encashment.my.keep")}
        isLoading={cancelling}
      />
    </div>
  );
}
