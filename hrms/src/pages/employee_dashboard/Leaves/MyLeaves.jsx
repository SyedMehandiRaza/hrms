import { useState } from "react";
import {
  MdChevronLeft,
  MdChevronRight,
  MdArrowUpward,
  MdArrowDownward,
  MdOutlineCalendarToday,
  MdAddCircleOutline,
  MdVisibility,
  MdOutlineClear,
  MdOutlineEventBusy,
} from "react-icons/md";
import { Link } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";
import LeaveDetailsModal from "../../../components/LeaveDetailsModal";
import Ltr from "../../../components/Ltr";
import { useFormat } from "../../../hooks/useFormat";
import Loader, { TableLoader } from "../../../components/Loader";
import { MY_LEAVES, MY_LEAVE_TYPES } from "../../../data/groupH";
import { paginate } from "../../../data/common";
import CustomDropdown from "../../../components/CustomDropdown";
import CancelApprovedLeaveModal from "../../../components/leave/CancelApprovedLeaveModal";
import useFiscalYear from "../../../hooks/useFiscalYear";
import { lockedYearOf } from "../../../hooks/useYearLock";
import MyEncashmentRequests from "../../../components/leave/encashment/MyEncashmentRequests";

// ── Data ──────────────────────────────────────────────────────────────────────
const STATUSES = ["All Statuses", "Approved", "Pending", "Rejected", "Cancelled"];
const PAGE_SIZE = 10;

const getStatusColor = (status) => {
  switch (status?.toUpperCase()) {
    case "APPROVED":
      return "text-green-700 bg-green-50 border-green-200";
    case "PENDING":
      return "text-amber-700 bg-amber-50 border-amber-200";
    case "REJECTED":
      return "text-red-700 bg-red-50 border-red-200";
    case "CANCELLED":
      return "text-gray-500 bg-gray-100 border-gray-200";
    default:
      return "text-gray-700 bg-gray-50 border-gray-200";
  }
};

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Myleaves() {
  const { t } = useTranslation("leaves");
  const { t: tFy } = useTranslation("fiscalYear");
  const { fmtDate } = useFormat();
  const fy = useFiscalYear();
  // Read-only when the leave's own date is in a closed + locked year.
  const lockOf = (date) => {
    const closed = lockedYearOf(fy.years, date) || (fy.isLocked ? fy.year : null);
    return closed ? tFy("locked.tooltip", { label: closed.label || fy.label }) : null;
  };
  const [cancelRow, setCancelRow] = useState(null);
  const [myLeaves, setMyLeaves] = useState(MY_LEAVES);
  const statusLabel = (s) =>
    ({
      "All Statuses": t("myLeaves.statusOptions.all"),
      Approved: t("myLeaves.statusOptions.approved"),
      Pending: t("myLeaves.statusOptions.pending"),
      Rejected: t("myLeaves.statusOptions.rejected"),
      Cancelled: t("myLeaves.statusOptions.cancelled"),
    })[s] || s;
  const [leaveType, setLeaveType] = useState("All Types");
  const [status, setStatus] = useState("All Statuses");
  const [sortField, setSortField] = useState("id");
  const [sortDir, setSortDir] = useState("asc");
  // Page — back to 1 whenever the financial year changes.
  const [pageState, setPageState] = useState({ version: fy.version, page: 1 });
  const page = pageState.version === fy.version ? pageState.page : 1;
  const setPage = (p) =>
    setPageState((prev) => {
      const cur = prev.version === fy.version ? prev.page : 1;
      return { version: fy.version, page: typeof p === "function" ? p(cur) : p };
    });
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const loading = false;

  const openModal = (req) => {
    setSelectedRequest({
      type: req.leave_type,
      status: req.status,
      statusColor: getStatusColor(req.status),
      from: req.from_date,
      to: req.to_date,
      days: req.total_days,
      reason: req.reason,
    });
    setIsModalOpen(true);
  };

  const leaveTypesData = MY_LEAVE_TYPES;

  // Client-side status filter / sort / paging over the static list (the
  // selected FY's leaves only).
  const SORT_KEYS = { id: "id", type: "leave_type", from: "from_date", to: "to_date", days: "total_days", status: "status" };
  const sortKey = SORT_KEYS[sortField] || "id";
  const fyRows = myLeaves
    .filter(
      (req) =>
        (!fy.range || (req.from_date >= fy.range.from && req.from_date <= fy.range.to)) &&
        (status === "All Statuses" || req.status === status.toUpperCase()),
    )
    .sort((a, b) => {
      const x = a[sortKey];
      const y = b[sortKey];
      const cmp = x < y ? -1 : x > y ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  const { rows: pageRows, totalPages, total: totalCount } = paginate(fyRows, page, PAGE_SIZE);

  let paginated = pageRows;
  if (leaveType !== "All Types") {
    paginated = paginated.filter((req) => {
      const typeStr = typeof req.leave_type === "string" ? req.leave_type : req.leave_type?.leave_name;
      return typeStr === leaveType;
    });
  }

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  return (
    <>
      <div className="space-y-5">
        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
              {t("myLeaves.title")}
            </h1>
            <p className="text-gray-400 mt-1 text-sm">
              {t("myLeaves.subtitle")}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
            <Link
              to="/employee/calendar"
              className="flex items-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors"
            >
              <MdOutlineCalendarToday className="text-base" /> {t("common.viewCalendar")}
            </Link>
            {!fy.isLocked && (
              <Link
                to="/employee/my-leaves/apply-leave"
                className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm transition-colors"
              >
                <MdAddCircleOutline className="text-lg" /> {t("common.applyLeave")}
              </Link>
            )}
          </div>
        </div>

        {/* ── Filters Bar ── */}
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            {/* Leave Type */}
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                {t("myLeaves.filters.leaveType")}
              </label>
              <div className="relative">
                <CustomDropdown
                  value={leaveType}
                  onChange={(e) => {
                    setLeaveType(e.target.value);
                    setPage(1);
                  }}
                  options={[
                    { label: t("myLeaves.filters.allTypes"), value: "All Types" },
                    ...(leaveTypesData || []).map((type) => ({
                      label: type.leave_name,
                      value: type.leave_name
                    }))
                  ]}
                />
              </div>
            </div>

            {/* Status */}
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                {t("myLeaves.filters.status")}
              </label>
              <div className="relative">
                <CustomDropdown
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setPage(1);
                  }}
                  options={STATUSES.map((s) => ({ label: statusLabel(s), value: s }))}
                />
              </div>
            </div>

            {/* Clear Filters Button */}
            <div className="flex-shrink-0 w-full sm:w-auto h-[42px]">
              <button
                onClick={() => {
                  setLeaveType("All Types");
                  setStatus("All Statuses");
                  setPage(1);
                }}
                className="w-full sm:w-auto flex justify-center items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-2 rounded-lg font-medium text-sm transition-colors h-[42px]"
              >
                <MdOutlineClear className="text-lg" />
                {t("common.clearFilters", { defaultValue: "Clear Filters" })}
              </button>
            </div>
          </div>
        </div>

        {/* ── Leave Table ── */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-start px-5 py-3">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {t("myLeaves.table.sn")}
                    </span>
                  </th>
                  <th className="text-start px-5 py-3">
                    <button
                      onClick={() => toggleSort("type")}
                      className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 transition-colors"
                    >
                      {t("myLeaves.table.leaveType")}
                      {sortField === "type" &&
                        (sortDir === "asc" ? (
                          <MdArrowUpward className="text-sm" />
                        ) : (
                          <MdArrowDownward className="text-sm" />
                        ))}
                    </button>
                  </th>
                  <th className="text-start px-5 py-3">
                    <button
                      onClick={() => toggleSort("from")}
                      className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 transition-colors"
                    >
                      {t("myLeaves.table.from")}
                      {sortField === "from" &&
                        (sortDir === "asc" ? (
                          <MdArrowUpward className="text-sm" />
                        ) : (
                          <MdArrowDownward className="text-sm" />
                        ))}
                    </button>
                  </th>
                  <th className="text-start px-5 py-3">
                    <button
                      onClick={() => toggleSort("to")}
                      className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 transition-colors"
                    >
                      {t("myLeaves.table.to")}
                      {sortField === "to" &&
                        (sortDir === "asc" ? (
                          <MdArrowUpward className="text-sm" />
                        ) : (
                          <MdArrowDownward className="text-sm" />
                        ))}
                    </button>
                  </th>
                  <th className="text-start px-5 py-3">
                    <button
                      onClick={() => toggleSort("days")}
                      className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 transition-colors"
                    >
                      {t("myLeaves.table.days")}
                      {sortField === "days" &&
                        (sortDir === "asc" ? (
                          <MdArrowUpward className="text-sm" />
                        ) : (
                          <MdArrowDownward className="text-sm" />
                        ))}
                    </button>
                  </th>
                  <th className="text-start px-5 py-3">
                    <button
                      onClick={() => toggleSort("status")}
                      className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 transition-colors"
                    >
                      {t("myLeaves.table.status")}
                      {sortField === "status" &&
                        (sortDir === "asc" ? (
                          <MdArrowUpward className="text-sm" />
                        ) : (
                          <MdArrowDownward className="text-sm" />
                        ))}
                    </button>
                  </th>
                  <th className="text-center px-5 py-3">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {t("myLeaves.table.action")}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <TableLoader colSpan={7} />
                ) : paginated.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-12 text-center text-sm text-gray-400"
                    >
                      {t("myLeaves.noResults")}
                    </td>
                  </tr>
                ) : (
                  paginated.map((req, index) => (
                    <tr
                      key={req.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-5 py-4 text-sm text-gray-700">
                        <Ltr>{(page - 1) * PAGE_SIZE + index + 1}</Ltr>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200">
                          {req.leave_type || t("myLeaves.leaveFallback")}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-700">
                        <Ltr>{fmtDate(req.from_date)}</Ltr>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-700">
                        <Ltr>{fmtDate(req.to_date)}</Ltr>
                      </td>
                      <td className="px-5 py-4 text-sm font-bold text-gray-900">
                        <Ltr>{req.total_days}</Ltr>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold border ${getStatusColor(req.status)}`}
                        >
                          {req.status ? t(`status.${req.status.toLowerCase()}`) : req.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openModal(req)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 transition-colors"
                            title={t("myLeaves.viewDetails")}
                          >
                            <MdVisibility className="text-lg" />
                          </button>
                          {req.status === "APPROVED" && (
                            <button
                              onClick={() => setCancelRow(req)}
                              disabled={!!lockOf(req.from_date)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-400"
                              title={lockOf(req.from_date) || t("fy.cancelLeave.button")}
                            >
                              <MdOutlineEventBusy className="text-lg" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-gray-100">
            {loading ? (
              <Loader />
            ) : paginated.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">
                {t("myLeaves.noResults")}
              </div>
            ) : (
              paginated.map((req) => (
                <div key={req.id} className="px-4 py-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200">
                          {req.leave_type?.leave_name || t("myLeaves.leaveFallback")}
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusColor(req.status)}`}
                        >
                          {req.status ? t(`status.${req.status.toLowerCase()}`) : req.status}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-gray-900">
                        {t("myLeaves.mobile.days", { count: req.total_days })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openModal(req)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 transition-colors"
                        title={t("myLeaves.viewDetails")}
                      >
                        <MdVisibility className="text-lg" />
                      </button>
                      {req.status === "APPROVED" && (
                        <button
                          onClick={() => setCancelRow(req)}
                          disabled={!!lockOf(req.from_date)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          title={lockOf(req.from_date) || t("fy.cancelLeave.button")}
                        >
                          <MdOutlineEventBusy className="text-lg" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                    <span>
                      {t("myLeaves.mobile.from")}{" "}
                      <strong className="text-gray-800"><Ltr>{fmtDate(req.from_date)}</Ltr></strong>
                    </span>
                    <span>
                      {t("myLeaves.mobile.to")}{" "}
                      <strong className="text-gray-800"><Ltr>{fmtDate(req.to_date)}</Ltr></strong>
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-gray-100">
            <p className="text-sm text-gray-400 order-2 sm:order-1">
              <Trans
                i18nKey="myLeaves.showing"
                ns="leaves"
                values={{
                  from: totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1,
                  to: Math.min(page * PAGE_SIZE, totalCount),
                  total: totalCount,
                }}
                components={[
                  <span className="font-semibold text-gray-600" />,
                  <span className="font-semibold text-gray-600" />,
                ]}
              />
            </p>
            <div className="flex items-center gap-1 order-1 sm:order-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-8 h-8 flex items-center justify-center border border-gray-200 rounded-md text-gray-400 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <MdChevronLeft className="rtl:rotate-180" />
              </button>
              {Array.from(
                { length: Math.min(totalPages, 3) },
                (_, i) => i + 1,
              ).map((n) => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`w-8 h-8 flex items-center justify-center rounded-md text-sm font-medium transition-colors ${
                    page === n
                      ? "bg-cyan-600 text-white"
                      : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {n}
                </button>
              ))}
              {totalPages > 3 && (
                <span className="px-1 text-gray-400 text-sm">...</span>
              )}
              {totalPages > 3 && (
                <button
                  onClick={() => setPage(totalPages)}
                  className={`w-8 h-8 flex items-center justify-center rounded-md text-sm font-medium transition-colors ${
                    page === totalPages
                      ? "bg-cyan-600 text-white border-cyan-600"
                      : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {totalPages}
                </button>
              )}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || totalPages === 0}
                className="w-8 h-8 flex items-center justify-center border border-gray-200 rounded-md text-gray-400 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <MdChevronRight className="rtl:rotate-180" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Leave encashment requests ── */}
        <MyEncashmentRequests />
      </div>

      <CancelApprovedLeaveModal
        open={!!cancelRow}
        leave={cancelRow}
        scope="MY"
        onClose={() => setCancelRow(null)}
        onDone={() => {
          const id = cancelRow?.id;
          setMyLeaves((prev) =>
            prev.map((r) => (r.id === id ? { ...r, status: "CANCELLED" } : r)),
          );
          setCancelRow(null);
        }}
      />

      {isModalOpen && (
        <LeaveDetailsModal
          request={selectedRequest}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
}
