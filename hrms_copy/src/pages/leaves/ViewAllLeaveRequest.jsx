import { useState, useEffect } from "react";
import Pagination from "../../components/Pagination";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import {
  MdVisibility,
  MdClose,
  MdDone,
  MdArrowUpward,
  MdArrowDownward,
  MdSearch,
  MdOutlineClear,
  MdOutlineEventBusy,
} from "react-icons/md";
import ConfirmationModal from "../../components/ConfirmationModal";
import LevelProgress from "../../components/LevelProgress";
import { useFormat } from "../../hooks/useFormat";
import CustomDropdown from "../../components/CustomDropdown";
import Can from "../../components/Can";
import { MODULES, ACTIONS } from "../../constants/permissions";
import CancelApprovedLeaveModal from "../../components/leave/CancelApprovedLeaveModal";
import useFiscalYear from "../../hooks/useFiscalYear";
import { lockedYearOf } from "../../hooks/useYearLock";
import { LR_REQUESTS, LR_applyAction, LR_save, LR_sortNewest } from "../../data/groupD";
import { matches, paginate } from "../../data/common";

const STATUS_OPTIONS = ["All Statuses", "Pending", "Approved", "Rejected", "Cancelled"];
const PAGE_SIZE = 10;

const STATUS_COLORS = {
  Pending: "bg-orange-50 border-orange-200 text-orange-600",
  Approved: "bg-green-50 border-green-200 text-green-600",
  Rejected: "bg-red-50 border-red-200 text-red-600",
  Cancelled: "bg-gray-50 border-gray-200 text-gray-500",
};

// Avatar color palette — picked by row index for stable colors.
const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-red-500",
  "bg-yellow-500",
  "bg-indigo-500",
  "bg-pink-500",
  "bg-cyan-500",
  "bg-orange-500",
  "bg-teal-500",
];

// "John Doe" → "JD"
const initials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");

// API UPPERCASE status → Title case used by STATUS_COLORS / t() keys.
const toTitleStatus = (s = "") =>
  s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;



// ── Main Component ──────────────────────────────────────────────────────────
export default function ViewAllLeaveRequest() {
  const { t } = useTranslation("leaves");
  const statusLabel = (s) =>
    ({
      "All Statuses": t("viewAll.statusOptions.all"),
      Pending: t("viewAll.statusOptions.pending"),
      Approved: t("viewAll.statusOptions.approved"),
      Rejected: t("viewAll.statusOptions.rejected"),
      Cancelled: t("viewAll.statusOptions.cancelled"),
    })[s] || s;
  const navigate = useNavigate();
  const { fmtDate } = useFormat();
  const { t: tFy } = useTranslation("fiscalYear");
  const fy = useFiscalYear();
  // A leave in a closed + locked year is read-only (approve / reject / cancel).
  const lockOf = (date) => {
    const closed = lockedYearOf(fy.years, date) || (fy.isLocked ? fy.year : null);
    return closed ? tFy("locked.tooltip", { label: closed.label || fy.label }) : null;
  };
  const [cancelRow, setCancelRow] = useState(null);
  const [search, setSearch] = useState("");
  // ?status=PENDING (e.g. a year-end readiness "Fix" link) preselects the filter.
  const [searchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState(() => {
    const s = toTitleStatus(searchParams.get("status") || "");
    return STATUS_OPTIONS.includes(s) ? s : "All Statuses";
  });
  const [sortField, setSortField] = useState("id");
  const [sortDir, setSortDir] = useState("asc");
  // Page — back to 1 whenever the financial year changes.
  const [pageState, setPageState] = useState({ version: fy.version, page: 1 });
  const page = pageState.version === fy.version ? pageState.page : 1;
  const setPage = (p) => setPageState({ version: fy.version, page: p });

  // Static sample data (filtered / paged client-side below).
  const [allRows, setAllRows] = useState(() => LR_sortNewest(LR_REQUESTS));
  const listLoading = false;

  // Debounced search term mapped to the API param.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedSearch(search);
      setPageState((prev) => ({ ...prev, page: 1 }));
    }, 400);
    return () => clearTimeout(id);
  }, [search]);

  // Decorate an API row into the shape the JSX expects.
  const decorate = (req, index) => ({
    id: req.id,
    approval_request_id: req.approval_request_id,
    name: req.employee_name,
    role: req.leave_type,
    avatar: initials(req.employee_name),
    profile_url: req.profile_url,
    color: AVATAR_COLORS[index % AVATAR_COLORS.length],
    type: req.leave_type,
    dates: `${fmtDate(req.from_date)} - ${fmtDate(req.to_date)}`,
    days: `${req.total_days} Days`,
    status: toTitleStatus(req.status),
    rawStatus: req.status,
    from_date: req.from_date,
    to_date: req.to_date,
    total_days: req.total_days,
    employee_name: req.employee_name,
    leave_type: req.leave_type,
    lockTitle: lockOf(req.from_date),
    // Level-wise approval metadata (from the backend). Never actionable inside
    // a closed year.
    canAct: !!req.can_act && !lockOf(req.from_date),
    // Reject stays possible in a closed year (it writes nothing into it).
    canReject: !!req.can_act,
    isApprover: !!req.is_approver,
    currentLevel: req.current_level,
    myLevel: req.my_level,
    finalStatus: req.final_status,
    levelsSummary: req.levels_summary || [],
  });

  // A request can be acted on only while its approval flow is open.
  const isActionable = (row) =>
    ["PENDING", "IN_PROGRESS"].includes((row.finalStatus || "").toUpperCase());

  // Tooltip explaining why the approve/reject buttons are disabled for a row.
  const waitTooltip = (row) =>
    row.lockTitle
      ? row.lockTitle
      : row.isApprover
      ? t("viewAll.actions.waitingForLevel", { level: row.currentLevel })
      : t("viewAll.actions.notApprover");


  const filtered = allRows.filter(
    (r) =>
      fy.inFy(r.from_date) &&
      (statusFilter === "All Statuses" || r.status === statusFilter.toUpperCase()) &&
      matches(r, debouncedSearch, ["employee_name", "leave_type", "request_code", "country_emp_id"]),
  );
  const paged = paginate(filtered, page, PAGE_SIZE);
  const rows = paged.rows.map(decorate);
  const total = paged.total;
  const totalPages = paged.totalPages;
  const refresh = () => setAllRows(LR_sortNewest(LR_REQUESTS));

  // Confirmation modals
  const [approveConfirm, setApproveConfirm] = useState({
    isOpen: false,
    data: null,
  });
  const [rejectConfirm, setRejectConfirm] = useState({
    isOpen: false,
    data: null,
  });
  const isLoading = false;

  // Open modals
  const openApproveModal = (row) => {
    setApproveConfirm({ isOpen: true, data: row });
  };

  const openRejectModal = (row) => {
    setRejectConfirm({ isOpen: true, data: row });
  };

  // Handle approve/reject
  const act = (id, action) => {
    const raw = allRows.find((r) => r.id === id);
    if (raw) LR_save(LR_applyAction(raw, action));
    refresh();
  };

  const handleApprove = () => {
    act(approveConfirm.data.id, "APPROVE");
    toast.success(t("toast.requestApproved"));
    setApproveConfirm({ isOpen: false, data: null });
  };

  const handleReject = () => {
    act(rejectConfirm.data.id, "REJECT");
    toast.success(t("toast.requestRejected"));
    setRejectConfirm({ isOpen: false, data: null });
  };

  // Client-side paginated rows.
  const paginated = rows;

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  return (
    <div className="space-y-5">
      {/* ── Page Header ── */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
          {t("viewAll.title")}
        </h1>
        <p className="text-gray-400 mt-1 text-sm">
          {t("viewAll.subtitle")}
        </p>
      </div>

      {/* ── Search & Filter Bar ── */}
      <div className="bg-white border border-gray-200 rounded-xl px-4 py-4">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          {/* Search */}
          <div className="flex-1 relative">
            <MdSearch className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={t("viewAll.searchPlaceholder")}
              className="w-full ps-10 pe-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
            />
          </div>

          {/* Status Filter */}
          <div className="w-full sm:w-48">
            <div className="relative">
              <CustomDropdown
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                options={STATUS_OPTIONS.map((s) => ({
                  label: statusLabel(s),
                  value: s
                }))}
              />
            </div>
          </div>
          
          {/* Clear Filters */}
          <div className="w-full sm:w-auto">
            <button
              onClick={() => {
                setSearch("");
                setStatusFilter("All Statuses");
                setPage(1);
              }}
              className="w-full sm:w-auto flex justify-center items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-2 rounded-lg font-medium text-sm transition-colors h-[42px]"
            >
              <MdOutlineClear className="text-lg" />
              {t("common.clearFilters")}
            </button>
          </div>
        </div>
      </div>

      {/* ── Leave Requests Table ── */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* Desktop Table */}
        <div className="hidden md:block">
          {/* Header */}
          <div className="grid grid-cols-[2fr_1.3fr_1.4fr_1fr_1fr_120px] gap-4 px-5 py-3 border-b border-gray-100 bg-gray-50">
            {[
              { labelKey: "viewAll.table.employee", field: "name" },
              { labelKey: "viewAll.table.type", field: "type" },
              { labelKey: "viewAll.table.dates", field: "dates" },
              { labelKey: "viewAll.table.status", field: "status" },
              { labelKey: "viewAll.table.level", field: null, fallback: "Level" },
              { labelKey: "viewAll.table.actions", field: null },
            ].map(({ labelKey, field, fallback }) => (
              <button
                key={labelKey}
                onClick={() => field && toggleSort(field)}
                className={`flex items-center gap-1.5 text-xs font-semibold ${field ? "text-gray-700 hover:text-gray-900 cursor-pointer" : "text-gray-500"} uppercase tracking-wider transition-colors`}
              >
                {t(labelKey, fallback ? { defaultValue: fallback } : undefined)}
                {field &&
                  sortField === field &&
                  (sortDir === "asc" ? (
                    <MdArrowUpward className="text-sm" />
                  ) : (
                    <MdArrowDownward className="text-sm" />
                  ))}
              </button>
            ))}
          </div>

          {/* Rows */}
          <div className="divide-y divide-gray-50">
            {listLoading ? (
              <div className="py-12 text-center text-sm text-gray-400">
                {t("common.loading")}
              </div>
            ) : paginated.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">
                {t("viewAll.noResults")}
              </div>
            ) : (
              paginated.map((row) => (
                <div
                  key={row.id}
                  className="grid grid-cols-[2fr_1.3fr_1.4fr_1fr_1fr_120px] gap-4 px-5 py-4 hover:bg-gray-50 transition-colors items-center"
                >
                  {/* Employee */}
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded ${row.color} text-white text-xs font-bold flex items-center justify-center flex-shrink-0 overflow-hidden`}
                    >
                      {row.profile_url ? (
                        <img src={row.profile_url} alt={row.name} className="w-full h-full object-cover" />
                      ) : (
                        row.avatar
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {row.name}
                      </p>
                      <p className="text-xs text-gray-400">{row.role}</p>
                    </div>
                  </div>

                  {/* Type */}
                  <p className="text-sm text-gray-700">{row.type}</p>

                  {/* Dates */}
                  <div>
                    <p className="text-sm text-gray-700">{row.dates}</p>
                    <p className="text-xs text-gray-400">{row.days}</p>
                  </div>

                  {/* Status */}
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-md border text-[11px] font-bold uppercase tracking-wide w-fit ${STATUS_COLORS[row.status]}`}
                  >
                    {t(`status.${row.status.toLowerCase()}`)}
                  </span>

                  {/* Level progress — which level is approving */}
                  <LevelProgress
                    levels={row.levelsSummary}
                    currentLevel={row.currentLevel}
                  />

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        navigate(
                          `/admin/leave-management/review-leave-request?id=${row.id}`,
                        )
                      }
                      className="w-8 h-8 flex cursor-pointer items-center justify-center text-gray-300 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors"
                      title={t("viewAll.actions.view")}
                    >
                      <MdVisibility className="text-xl" />
                    </button>
                    {row.rawStatus === "APPROVED" && (
                      <Can module={MODULES.LEAVE} action={ACTIONS.UPDATE}>
                        <button
                          onClick={() => setCancelRow(row)}
                          disabled={!!row.lockTitle}
                          className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors text-gray-300 hover:text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-gray-200 disabled:hover:bg-transparent"
                          title={row.lockTitle || t("fy.cancelLeave.button")}
                        >
                          <MdOutlineEventBusy className="text-xl" />
                        </button>
                      </Can>
                    )}
                    {isActionable(row) && (
                      <>
                        <button
                          onClick={() => row.canReject && openRejectModal(row)}
                          disabled={!row.canReject}
                          className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                            row.canReject
                              ? "cursor-pointer text-gray-300 hover:text-red-500 hover:bg-red-50"
                              : "cursor-not-allowed text-gray-200"
                          }`}
                          title={
                            row.canReject
                              ? t("viewAll.actions.reject")
                              : waitTooltip(row)
                          }
                        >
                          <MdClose className="text-xl" />
                        </button>
                        <button
                          onClick={() => row.canAct && openApproveModal(row)}
                          disabled={!row.canAct}
                          className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                            row.canAct
                              ? "cursor-pointer text-gray-300 hover:text-green-500 hover:bg-green-50"
                              : "cursor-not-allowed text-gray-200"
                          }`}
                          title={
                            row.canAct
                              ? t("viewAll.actions.approve")
                              : waitTooltip(row)
                          }
                        >
                          <MdDone className="text-xl" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden divide-y divide-gray-100">
          {listLoading ? (
            <div className="py-12 text-center text-sm text-gray-400">
              {t("common.loading")}
            </div>
          ) : paginated.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              {t("viewAll.noResults")}
            </div>
          ) : (
            paginated.map((row) => (
              <div key={row.id} className="px-4 py-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full ${row.color} text-white text-xs font-bold flex items-center justify-center flex-shrink-0 overflow-hidden`}
                    >
                      {row.profile_url ? (
                        <img src={row.profile_url} alt={row.name} className="w-full h-full object-cover" />
                      ) : (
                        row.avatar
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {row.name}
                      </p>
                      <p className="text-xs text-gray-400">{row.role}</p>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase flex-shrink-0 ${STATUS_COLORS[row.status]}`}
                  >
                    {t(`status.${row.status.toLowerCase()}`)}
                  </span>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                  <span>
                    <strong className="text-gray-700">{row.type}</strong>
                  </span>
                  <span>{row.dates}</span>
                  <span>{row.days}</span>
                </div>

                <LevelProgress
                  levels={row.levelsSummary}
                  currentLevel={row.currentLevel}
                />

                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      navigate(
                        `/admin/leave-management/review-leave-request?id=${row.id}`,
                      )
                    }
                    className="flex items-center gap-1.5 flex-1 px-3 py-1.5 border border-gray-200 text-gray-600 hover:border-cyan-300 hover:text-cyan-600 rounded-lg text-xs font-medium transition-colors"
                  >
                    <MdVisibility className="text-base" /> {t("viewAll.actions.view")}
                  </button>
                  {row.rawStatus === "APPROVED" && (
                    <Can module={MODULES.LEAVE} action={ACTIONS.UPDATE}>
                      <button
                        onClick={() => setCancelRow(row)}
                        disabled={!!row.lockTitle}
                        title={row.lockTitle || undefined}
                        className="flex items-center gap-1.5 flex-1 px-3 py-1.5 border border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-600 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <MdOutlineEventBusy className="text-base" /> {t("fy.cancelLeave.button")}
                      </button>
                    </Can>
                  )}
                  {isActionable(row) && (
                    <>
                      <button
                        onClick={() => row.canReject && openRejectModal(row)}
                        disabled={!row.canReject}
                        className={`flex items-center gap-1.5 flex-1 px-3 py-1.5 border rounded-lg text-xs font-medium transition-colors ${
                          row.canReject
                            ? "border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-600"
                            : "border-gray-100 text-gray-300 cursor-not-allowed"
                        }`}
                      >
                        <MdClose className="text-base" /> {t("viewAll.actions.reject")}
                      </button>
                      <button
                        onClick={() => row.canAct && openApproveModal(row)}
                        disabled={!row.canAct}
                        className={`flex items-center gap-1.5 flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          row.canAct
                            ? "bg-cyan-600 hover:bg-cyan-700 text-white"
                            : "bg-gray-100 text-gray-300 cursor-not-allowed"
                        }`}
                      >
                        <MdDone className="text-base" /> {t("viewAll.actions.approve")}
                      </button>
                    </>
                  )}
                </div>
                {isActionable(row) && !row.canAct && (
                  <p className="text-[11px] text-amber-600">{waitTooltip(row)}</p>
                )}
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          limit={PAGE_SIZE}
          onPage={setPage}
          label={t("viewAll.paginationLabel")}
          activeClass="bg-cyan-600 text-white"
          containerClass="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-gray-100"
        />
      </div>

      <CancelApprovedLeaveModal
        open={!!cancelRow}
        leave={cancelRow}
        scope="ADMIN"
        onClose={() => setCancelRow(null)}
        onDone={() => {
          setCancelRow(null);
          refresh();
        }}
      />

      {/* ── Confirmation Modals ── */}
      <ConfirmationModal
        isOpen={approveConfirm.isOpen}
        onClose={() => setApproveConfirm({ isOpen: false, data: null })}
        onConfirm={handleApprove}
        isLoading={isLoading}
        type="success"
        title={t("viewAll.confirm.approveTitle")}
        message={t("viewAll.confirm.approveMessage", {
          type: approveConfirm.data?.type,
          name: approveConfirm.data?.name,
        })}
        confirmText={t("viewAll.confirm.approve")}
        cancelText={t("viewAll.confirm.cancel")}
      />

      <ConfirmationModal
        isOpen={rejectConfirm.isOpen}
        onClose={() => setRejectConfirm({ isOpen: false, data: null })}
        onConfirm={handleReject}
        isLoading={isLoading}
        type="delete"
        title={t("viewAll.confirm.rejectTitle")}
        message={t("viewAll.confirm.rejectMessage", {
          type: rejectConfirm.data?.type,
          name: rejectConfirm.data?.name,
        })}
        confirmText={t("viewAll.confirm.reject")}
        cancelText={t("viewAll.confirm.cancel")}
      />
    </div>
  );
}
