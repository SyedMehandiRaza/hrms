import { useState, useMemo } from "react";
import Pagination from "../../components/Pagination";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import { MdAdd, MdAccessTime, MdOutlineCalendarToday, MdEdit, MdDelete, MdOutlineClear } from "react-icons/md";
import { TableLoader } from "../../components/Loader";
import NewOvertimeRequestModal from "../../components/NewOvertimeRequestModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import CustomDropdown from "../../components/CustomDropdown";
import { OT_REQUESTS, OT_saveRequests } from "../../data/groupD";
import { getStaticUser } from "../../data/session";
import useFiscalYear from "../../hooks/useFiscalYear";
import useYearLock, { lockedYearOf } from "../../hooks/useYearLock";
import { clampDate } from "../../utils/fiscalYear";

const STATUS_STYLE = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  Pending: "bg-amber-100 text-amber-700",
  Approved: "bg-green-100 text-green-700",
  Rejected: "bg-red-100 text-red-700",
};

const fmtDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const truncateReason = (reason) => {
  if (!reason) return "—";
  return reason.length > 25 ? reason.substring(0, 25) + "..." : reason;
};

export default function MyOvertimeRequests() {
  const { t } = useTranslation("attendance");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ open: false, id: null });
  const isDeleting = false;
  const myEmployeeId = getStaticUser().employee_id;
  const [allRows, setAllRows] = useState(() => [...OT_REQUESTS]);

  const [page, setPage] = useState(1);
  const limit = 10;
  const [projectFilter, setProjectFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateRangeFilter, setDateRangeFilter] = useState({ start: "", end: "" });
  const fy = useFiscalYear();
  const lock = useYearLock();

  // A new financial year in the header → its list from page 1, old dates cleared.
  const [fyVersion, setFyVersion] = useState(fy.version);
  if (fyVersion !== fy.version) {
    setFyVersion(fy.version);
    setDateRangeFilter({ start: "", end: "" });
    setPage(1);
  }
  const pickDate = (key, value) => {
    setDateRangeFilter((prev) => ({ ...prev, [key]: value && fy.range ? clampDate(value, fy.range) : value }));
    setPage(1);
  };

  const loading = false;
  const fyFrom = fy.range?.from;
  const fyTo = fy.range?.to;
  // My requests in the selected year + filters, newest first (was server-side).
  const filtered = useMemo(
    () =>
      allRows
        .filter((r) => r.employee_id === myEmployeeId)
        .filter((r) => (!fyFrom || r.work_date >= fyFrom) && (!fyTo || r.work_date <= fyTo))
        .filter((r) => !projectFilter || String(r.project_id) === String(projectFilter))
        .filter((r) => !statusFilter || r.status === statusFilter)
        .filter((r) => !dateRangeFilter.start || r.work_date >= dateRangeFilter.start)
        .filter((r) => !dateRangeFilter.end || r.work_date <= dateRangeFilter.end)
        .sort((a, b) => b.work_date.localeCompare(a.work_date) || b.id - a.id),
    [allRows, myEmployeeId, fyFrom, fyTo, projectFilter, statusFilter, dateRangeFilter],
  );
  const mineData = filtered.slice((page - 1) * limit, page * limit);
  const total = filtered.length;
  const totalPages = Math.ceil(total / limit) || 1;

  const saveRows = (next) => {
    OT_saveRequests(next);
    setAllRows(next);
  };

  const handleSuccess = (row) => {
    toast.success(editData ? t("myOvertime.updated") : t("myOvertime.created"));
    if (row) {
      const exists = allRows.some((r) => r.id === row.id);
      saveRows(exists ? allRows.map((r) => (r.id === row.id ? row : r)) : [row, ...allRows]);
    }
    setIsModalOpen(false);
    setEditData(null);
  };

  const handleEdit = (row) => {
    setEditData(row);
    setIsModalOpen(true);
  };

  const handleDelete = () => {
    saveRows(allRows.filter((r) => r.id !== deleteModal.id));
    toast.success(t("myOvertime.deleted"));
    setDeleteModal({ open: false, id: null });
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MdAccessTime className="text-cyan-600" />
            {t("myOvertime.title")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t("myOvertime.subtitle")}
          </p>
        </div>
        {!lock.locked && (
        <button
          onClick={() => { setEditData(null); setIsModalOpen(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-cyan-600 text-white text-sm font-medium rounded-lg hover:bg-cyan-700 transition"
        >
          <MdAdd className="text-lg" />
          {t("myOvertime.apply")}
        </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 sm:p-5 border border-gray-200 rounded-xl">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-[11px] font-bold text-gray-500 tracking-wider uppercase mb-2">{t("myOvertime.status")}</label>
            <CustomDropdown
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              options={[
                { label: t("overtime.statusOptions.all"), value: "" },
                { label: t("overtime.statusOptions.pending"), value: "PENDING" },
                { label: t("overtime.statusOptions.approved"), value: "APPROVED" },
                { label: t("overtime.statusOptions.rejected"), value: "REJECTED" },
              ]}
            />
          </div>
          <div className="flex-1 min-w-[280px]">
            <label className="block text-[11px] font-bold text-gray-500 tracking-wider uppercase mb-2">{t("myOvertime.dateRange")}</label>
            <div className="flex items-center gap-2 h-[42px]">
              <div className="relative flex-1 h-full">
                <MdOutlineCalendarToday className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="date" 
                  value={dateRangeFilter.start}
                  min={fy.range?.from}
                  max={dateRangeFilter.end || fy.range?.to}
                  onChange={(e) => pickDate("start", e.target.value)}
                  className="w-full h-full border border-gray-200 text-gray-700 text-sm font-medium rounded-lg pl-9 pr-3 focus:outline-none focus:ring-1 focus:ring-[#17a2b8]" 
                />
              </div>
              <span className="text-gray-400 text-sm font-medium">{t("common.to")}</span>
              <div className="relative flex-1 h-full">
                <MdOutlineCalendarToday className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="date" 
                  value={dateRangeFilter.end}
                  min={dateRangeFilter.start || fy.range?.from}
                  max={fy.range?.to}
                  onChange={(e) => pickDate("end", e.target.value)}
                  className="w-full h-full border border-gray-200 text-gray-700 text-sm font-medium rounded-lg pl-9 pr-3 focus:outline-none focus:ring-1 focus:ring-[#17a2b8]" 
                />
              </div>
            </div>
          </div>
          <div className="flex-shrink-0 w-full sm:w-auto h-[42px]">
            <button 
              onClick={() => {
                setProjectFilter("");
                setStatusFilter("");
                setDateRangeFilter({ start: "", end: "" });
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

      {/* Table Section */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-sm text-gray-600 min-w-[800px]">
            <thead className="bg-gray-50/80 border-b border-gray-200 text-gray-500 uppercase tracking-wider text-[11px] font-semibold">
              <tr>
                {[t("myOvertime.columns.sno"), t("myOvertime.columns.date"), t("myOvertime.columns.hours"), t("myOvertime.columns.reason"), t("myOvertime.columns.levelApproved"), t("myOvertime.columns.status"), t("myOvertime.columns.action")].map((h) => (
                  <th key={h} className="px-6 py-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <TableLoader colSpan={9} label={t("myOvertime.loading")} />
              ) : mineData.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-6 py-12 text-center">
                    <MdAccessTime className="text-4xl text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">{t("myOvertime.empty")}</p>
                  </td>
                </tr>
              ) : (
                mineData.map((row, idx) => {
                  const hours = row.overtime_hours || "—";
                  
                  let approvedLevel = "—";
                  if (row.levels_summary && row.levels_summary.length > 0) {
                    const approvedCount = row.levels_summary.reduce((acc, curr) => acc + curr.approved, 0);
                    approvedLevel = t("common.levelOf", { current: approvedCount, total: row.levels_summary.length });
                  }

                  // Edit is read-only when the request's date is in a closed +
                  // locked year; withdrawing a PENDING one stays allowed.
                  const rowYear = lockedYearOf(fy.years, row.work_date);
                  const rowLocked = lock.locked || !!rowYear;
                  const rowLockTitle = rowLocked ? t("fiscalYear:locked.tooltip", { label: rowYear?.label || lock.label }) : undefined;

                  return (
                    <tr key={row.id} className="hover:bg-gray-50/50 transition">
                      <td className="px-6 py-4 whitespace-nowrap">{(page - 1) * limit + idx + 1}</td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        {fmtDate(row.work_date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">{hours}</td>
                      <td className="px-6 py-4">
                        <p className="max-w-xs" title={row.reason || ""}>{truncateReason(row.reason)}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                        {approvedLevel}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-3 py-1 text-xs font-semibold rounded-full ${STATUS_STYLE[row.status] || "bg-gray-100 text-gray-600"}`}
                        >
                          {row.status ? t(`requestStatus.${row.status}`, { defaultValue: row.status }) : t("requestStatus.Pending")}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {row.status === "PENDING" ? (
                          <div className="flex items-center gap-3">
                            <button onClick={() => handleEdit(row)} disabled={rowLocked} className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed" title={rowLockTitle || t("common.edit")}>
                              <MdEdit className="text-lg" />
                            </button>
                            <button onClick={() => setDeleteModal({ open: true, id: row.id })} className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed" title={t("common.delete")}>
                              <MdDelete className="text-lg" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs italic">—</span>
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
          label={t("common.requestsLabel")}
          activeClass="bg-cyan-600 text-white"
          containerClass="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-gray-100 bg-gray-50/50 mt-auto"
        />
      </div>

      <NewOvertimeRequestModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditData(null); }}
        onSuccess={handleSuccess}
        editData={editData}
      />

      <ConfirmationModal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, id: null })}
        onConfirm={handleDelete}
        loading={isDeleting}
        title={t("myOvertime.deleteTitle")}
        message={t("myOvertime.deleteMessage")}
        type="delete"
        confirmText={t("common.delete")}
      />
    </div>
  );
}
