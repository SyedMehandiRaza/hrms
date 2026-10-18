import { useState } from "react";
import Pagination from "../../components/Pagination";
import { useNavigate } from "react-router-dom";
import { MdAdd, MdOutlineWorkOff, MdOutlineCalendarToday, MdOutlineRemoveRedEye, MdOutlineDelete, MdOutlineClear, MdOutlineEventBusy } from "react-icons/md";
import { TableLoader } from "../../components/Loader";
import CustomDropdown from "../../components/CustomDropdown";
import ConfirmationModal from "../../components/ConfirmationModal";
import ViewLeaveRequestModal from "../../components/ViewLeaveRequestModal";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import CancelApprovedLeaveModal from "../../components/leave/CancelApprovedLeaveModal";
import MyEncashmentRequests from "../../components/leave/encashment/MyEncashmentRequests";
import useFiscalYear from "../../hooks/useFiscalYear";
import { lockedYearOf } from "../../hooks/useYearLock";
import { getStaticUser } from "../../data/session";
import { paginate } from "../../data/common";
import { LR_REQUESTS, LR_MY_EMPLOYEE_ID, LR_remove, LR_sortNewest } from "../../data/groupD";

// The signed-in employee's own requests (static samples).
const myRequests = () => {
  const myId = getStaticUser().employee_id || LR_MY_EMPLOYEE_ID;
  return LR_sortNewest(LR_REQUESTS).filter((r) => r.employee_id === myId);
};

const STATUS_STYLE = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  Pending: "bg-amber-100 text-amber-700",
  Approved: "bg-green-100 text-green-700",
  Rejected: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-500",
};

const fmtDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const TABLE_HEADER_KEYS = [
  "myRequests.table.sno",
  "myRequests.table.leaveType",
  "myRequests.table.dates",
  "myRequests.table.reason",
  "myRequests.table.status",
  "myRequests.table.levelApproved",
  "myRequests.table.actions",
];

export default function MyLeaveRequests() {
  const { t } = useTranslation("leaves");
  const navigate = useNavigate();

  const { t: tFy } = useTranslation("fiscalYear");
  const fy = useFiscalYear();
  // Read-only when the leave's own date is in a closed + locked year.
  const lockOf = (date) => {
    const closed = lockedYearOf(fy.years, date) || (fy.isLocked ? fy.year : null);
    return closed ? tFy("locked.tooltip", { label: closed.label || fy.label }) : null;
  };
  const [cancelRow, setCancelRow] = useState(null);

  // Page + date range belong to the selected financial year: both reset when
  // the year switcher changes (derived from fy.version, no effect).
  const [pageState, setPageState] = useState({ version: fy.version, page: 1 });
  const page = pageState.version === fy.version ? pageState.page : 1;
  const setPage = (p) => setPageState({ version: fy.version, page: p });
  const [limit] = useState(10);
  const [statusFilter, setStatusFilter] = useState("");
  const [rangeState, setRangeState] = useState({ version: fy.version, start: "", end: "" });
  const dateRangeFilter =
    rangeState.version === fy.version ? { start: rangeState.start, end: rangeState.end } : { start: "", end: "" };
  const setDateRangeFilter = (r) => setRangeState({ version: fy.version, start: r.start, end: r.end });
  const [viewModal, setViewModal] = useState({ open: false, data: null });
  const [deleteModal, setDeleteModal] = useState({ open: false, id: null });
  const isDeleting = false;
  const loading = false;
  const [allMine, setAllMine] = useState(myRequests);

  // Client-side filters: status + an explicit date range (overlap), otherwise
  // the whole selected financial year.
  const filtered = allMine.filter((r) => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (dateRangeFilter.start || dateRangeFilter.end) {
      const from = dateRangeFilter.start || fy.range?.from || "0000-01-01";
      const to = dateRangeFilter.end || fy.range?.to || "9999-12-31";
      return r.to_date >= from && r.from_date <= to;
    }
    return fy.inFy(r.from_date);
  });
  const paged = paginate(filtered, page, limit);
  const mineData = paged.rows;
  const total = paged.total;
  const totalPages = paged.totalPages;

  const handleDelete = () => {
    if (!deleteModal.id) return;
    LR_remove(deleteModal.id);
    toast.success(t("myRequests.deleteSuccess"));
    setDeleteModal({ open: false, id: null });
    setAllMine(myRequests());
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MdOutlineWorkOff className="text-cyan-600" />
            {t("myRequests.title")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t("myRequests.subtitle")}
          </p>
        </div>
        {!fy.isLocked && (
        <button
          onClick={() => navigate("/admin/my-requests/leave/apply-leave")}
          className="flex items-center gap-2 px-4 py-2.5 bg-cyan-600 text-white text-sm font-medium rounded-lg hover:bg-cyan-700 transition"
        >
          <MdAdd className="text-lg" />
          {t("common.applyLeave")}
        </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 sm:p-5 border border-gray-200 rounded-xl">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-[11px] font-bold text-gray-500 tracking-wider uppercase mb-2">{t("myLeaves.filters.status")}</label>
            <CustomDropdown
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              options={[
                { label: t("myLeaves.statusOptions.all"), value: "" },
                { label: t("myLeaves.statusOptions.pending"), value: "PENDING" },
                { label: t("myLeaves.statusOptions.approved"), value: "APPROVED" },
                { label: t("myLeaves.statusOptions.rejected"), value: "REJECTED" },
              ]}
            />
          </div>
          <div className="flex-1 min-w-[280px]">
            <label className="block text-[11px] font-bold text-gray-500 tracking-wider uppercase mb-2">{t("myRequests.dateRange")}</label>
            <div className="flex items-center gap-2 h-[42px]">
              <div className="relative flex-1 h-full">
                <MdOutlineCalendarToday className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="date"
                  min={fy.range?.from}
                  max={dateRangeFilter.end || fy.range?.to}
                  value={dateRangeFilter.start}
                  onChange={(e) => { setDateRangeFilter({ ...dateRangeFilter, start: e.target.value }); setPage(1); }}
                  className="w-full h-full border border-gray-200 text-gray-700 text-sm font-medium rounded-lg pl-9 pr-3 focus:outline-none focus:ring-1 focus:ring-[#17a2b8]"
                />
              </div>
              <span className="text-gray-400 text-sm font-medium">{t("myRequests.to")}</span>
              <div className="relative flex-1 h-full">
                <MdOutlineCalendarToday className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="date"
                  min={dateRangeFilter.start || fy.range?.from}
                  max={fy.range?.to}
                  value={dateRangeFilter.end}
                  onChange={(e) => { setDateRangeFilter({ ...dateRangeFilter, end: e.target.value }); setPage(1); }}
                  className="w-full h-full border border-gray-200 text-gray-700 text-sm font-medium rounded-lg pl-9 pr-3 focus:outline-none focus:ring-1 focus:ring-[#17a2b8]"
                />
              </div>
            </div>
          </div>
          <div className="flex-shrink-0 w-full sm:w-auto h-[42px]">
            <button
              onClick={() => {
                setStatusFilter("");
                setDateRangeFilter({ start: "", end: "" });
                setPage(1);
              }}
              className="w-full sm:w-auto flex justify-center items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-2 rounded-lg font-medium text-sm transition-colors h-[42px]"
            >
              <MdOutlineClear className="text-lg" />
              {t("myRequests.clearFilters")}
            </button>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-sm text-gray-600 min-w-[800px]">
            <thead className="bg-gray-50/80 border-b border-gray-200 text-gray-500 uppercase tracking-wider text-[11px] font-semibold">
              <tr>
                {TABLE_HEADER_KEYS.map((h) => (
                  <th key={h} className="px-6 py-4">{t(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <TableLoader colSpan={7} label={t("myRequests.loadingRequests")} />
              ) : mineData.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center">
                    <MdOutlineWorkOff className="text-4xl text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">{t("myRequests.noResults")}</p>
                  </td>
                </tr>
              ) : (
                mineData.map((row, idx) => {
                  let approvedLevel = row.approval_level || "—";
                  if (row.levels_summary && row.levels_summary.length > 0) {
                    const approvedCount = row.levels_summary.reduce((acc, curr) => acc + curr.approved, 0);
                    approvedLevel = t("myRequests.levelOf", { approved: approvedCount, total: row.levels_summary.length });
                  }
                  return (
                    <tr key={row.id} className="hover:bg-gray-50/50 transition">
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600 font-medium">
                        {(page - 1) * limit + idx + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-3 py-1 text-xs font-medium rounded-md bg-blue-50 text-blue-700 border border-blue-100">
                          {row.leave_type?.name || row.LeaveType?.name || row.leave_type || "—"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <span className="text-gray-700">{fmtDate(row.start_date || row.from_date)} - {fmtDate(row.end_date || row.to_date)}</span>
                          <span className="text-xs font-medium text-gray-500 bg-gray-100 rounded px-2 py-0.5 w-max">
                            {t("myRequests.dayCount", { days: row.total_days || row.leave_days || 0 })}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                        <span title={row.reason}>
                          {row.reason?.length > 25 ? `${row.reason.substring(0, 25)}...` : row.reason || "—"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-3 py-1 text-xs font-semibold rounded-full ${STATUS_STYLE[row.status] || "bg-gray-100 text-gray-600"}`}
                        >
                          {row.status ? t(`statusCode.${row.status}`, { defaultValue: row.status }) : t("status.pending")}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">{approvedLevel}</td>
                      <td className="px-6 py-4 whitespace-nowrap flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setViewModal({ open: true, data: row })}
                          className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                          title={t("myRequests.view")}
                        >
                          <MdOutlineRemoveRedEye className="text-lg" />
                        </button>
                        {row.status === "APPROVED" && (
                          <button
                            type="button"
                            onClick={() => setCancelRow(row)}
                            disabled={!!lockOf(row.from_date || row.start_date)}
                            className="text-gray-400 hover:text-red-600 transition-colors p-1 disabled:opacity-40 disabled:cursor-not-allowed"
                            title={lockOf(row.from_date || row.start_date) || t("fy.cancelLeave.button")}
                          >
                            <MdOutlineEventBusy className="text-lg" />
                          </button>
                        )}
                        {row.status === "PENDING" && (
                          <button
                            type="button"
                            onClick={() => setDeleteModal({ open: true, id: row.id })}
                            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                            title={t("myRequests.delete")}
                          >
                            <MdOutlineDelete className="text-lg" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          page={page}
          limit={limit}
          total={total}
          totalPages={totalPages}
          onPage={setPage}
          label={t("myRequests.paginationLabel")}
          activeClass="bg-cyan-600 text-white"
          containerClass="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-gray-100 bg-gray-50/50 mt-auto"
        />
      </div>

      {/* Leave encashment requests */}
      <MyEncashmentRequests />

      <ConfirmationModal
        isOpen={deleteModal.open}
        title={t("myRequests.confirm.title")}
        message={t("myRequests.confirm.message")}
        onConfirm={handleDelete}
        onClose={() => setDeleteModal({ open: false, id: null })}
        isLoading={isDeleting}
      />

      <CancelApprovedLeaveModal
        open={!!cancelRow}
        leave={cancelRow ? { ...cancelRow, from_date: cancelRow.from_date || cancelRow.start_date, to_date: cancelRow.to_date || cancelRow.end_date } : null}
        scope="MY"
        onClose={() => setCancelRow(null)}
        onDone={() => {
          setCancelRow(null);
          setAllMine(myRequests());
        }}
      />

      {viewModal.open && (
        <ViewLeaveRequestModal
          data={viewModal.data}
          onClose={() => setViewModal({ open: false, data: null })}
        />
      )}
    </div>
  );
}
