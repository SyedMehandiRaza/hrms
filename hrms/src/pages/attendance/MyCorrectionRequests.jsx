import { useMemo, useState } from "react";
import Pagination from "../../components/Pagination";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import { MdAdd, MdOutlineDescription, MdOutlineCalendarToday, MdVisibility, MdEdit, MdDelete, MdOutlineClear } from "react-icons/md";
import { TableLoader } from "../../components/Loader";
import CorrectionRequestModal from "../../components/CorrectionRequestModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import CustomDropdown from "../../components/CustomDropdown";
import { ATT_CORRECTIONS } from "../../data/groupD";
import { paginate } from "../../data/common";
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

const fmtTime = (d) => {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleTimeString([], { timeZone: "UTC", hour: "2-digit", minute: "2-digit" });
};

const truncateReason = (reason) => {
  if (!reason) return "—";
  return reason.length > 25 ? reason.substring(0, 25) + "..." : reason;
};

export default function MyCorrectionRequests() {
  const { t } = useTranslation("attendance");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [viewData, setViewData] = useState(null);
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [rows, setRows] = useState(ATT_CORRECTIONS);
  const [page, setPage] = useState(1);
  const limit = 10;
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
  // Status / date-range filters + paging, client-side on the static list.
  const list = useMemo(() => {
    const filtered = rows
      .filter((r) => !statusFilter || r.status === statusFilter)
      .filter((r) => !dateRangeFilter.start || r.work_date >= dateRangeFilter.start)
      .filter((r) => !dateRangeFilter.end || r.work_date <= dateRangeFilter.end)
      .sort((a, b) => (a.work_date < b.work_date ? 1 : -1));
    return paginate(filtered, page, limit);
  }, [rows, statusFilter, dateRangeFilter, page, limit]);
  const mineData = list.rows;
  const total = list.total;
  const totalPages = list.totalPages;

  const handleSuccess = (saved) => {
    if (saved) {
      setRows((prev) =>
        prev.some((r) => r.id === saved.id)
          ? prev.map((r) => (r.id === saved.id ? saved : r))
          : [saved, ...prev],
      );
    }
    setIsModalOpen(false);
    setEditData(null);
    setViewData(null);
  };

  const handleEditClick = (row) => {
    setEditData(row);
    setViewData(null);
    setIsModalOpen(true);
  };

  const handleViewClick = (row) => {
    setViewData(row);
    setEditData(null);
    setIsModalOpen(true);
  };

  const openNewModal = () => {
    setEditData(null);
    setViewData(null);
    setIsModalOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    setRows((prev) => prev.filter((r) => r.id !== itemToDelete.id));
    toast.success(t("myCorrection.deleted"));
    setIsDeleteModalOpen(false);
    setItemToDelete(null);
    setIsDeleting(false);
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MdOutlineDescription className="text-cyan-600" />
            {t("myCorrection.title")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t("myCorrection.subtitle")}
          </p>
        </div>
        {!lock.locked && (
        <button
          onClick={openNewModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-cyan-600 text-white text-sm font-medium rounded-lg hover:bg-cyan-700 transition"
        >
          <MdAdd className="text-lg" />
          {t("myCorrection.apply")}
        </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 sm:p-5 border border-gray-200 rounded-xl">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-[11px] font-bold text-gray-500 tracking-wider uppercase mb-2">{t("myCorrection.status")}</label>
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
            <label className="block text-[11px] font-bold text-gray-500 tracking-wider uppercase mb-2">{t("myCorrection.dateRange")}</label>
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
                {[t("myCorrection.columns.sno"), t("myCorrection.columns.date"), t("myCorrection.columns.requestedTime"), t("myCorrection.columns.reason"), t("myCorrection.columns.levelApproved"), t("myCorrection.columns.status"), t("myCorrection.columns.action")].map((h) => (
                  <th key={h} className="px-6 py-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <TableLoader colSpan={6} label={t("myCorrection.loading")} />
              ) : mineData.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center">
                    <MdOutlineDescription className="text-4xl text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">{t("myCorrection.empty")}</p>
                  </td>
                </tr>
              ) : (
                mineData.map((row, index) => {
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
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600 font-medium">
                      {(page - 1) * limit + index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {fmtDate(row.work_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {fmtTime(row.requested_check_in)} - {fmtTime(row.requested_check_out)}
                    </td>
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
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleViewClick(row)}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                          title={t("myCorrection.viewDetails")}
                        >
                          <MdVisibility className="text-lg" />
                        </button>
                        {row.status === "PENDING" && (
                          <>
                            <button
                              onClick={() => handleEditClick(row)}
                              disabled={rowLocked}
                              className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              title={rowLockTitle || t("myCorrection.editRequest")}
                            >
                              <MdEdit className="text-lg" />
                            </button>
                            <button
                              onClick={() => {
                                setItemToDelete(row);
                                setIsDeleteModalOpen(true);
                              }}
                              className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              title={t("myCorrection.deleteRequest")}
                            >
                              <MdDelete className="text-lg" />
                            </button>
                          </>
                        )}
                      </div>
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

      <CorrectionRequestModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleSuccess}
        editData={editData}
        viewData={viewData}
      />

      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setItemToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
        loading={isDeleting}
        title={t("myCorrection.deleteTitle")}
        message={t("myCorrection.deleteMessage", { date: itemToDelete ? fmtDate(itemToDelete.work_date) : "" })}
        type="delete"
        confirmText={t("common.delete")}
      />
    </div>
  );
}
