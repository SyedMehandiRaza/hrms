import { useState } from "react";
import Pagination from "../../components/Pagination";
import {
  MdSearch,
  MdAddCircleOutline,
  MdEdit,
  MdOutlineClear,
  MdOutlineContentCopy,
} from "react-icons/md";
import { MdDelete } from "react-icons/md";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import ConfirmationModal from "../../components/ConfirmationModal";
import Loader, { TableLoader } from "../../components/Loader";
import { ScreenError } from "../../components/ScreenState";
import { useCan } from "../../hooks/usePermission";
import { MODULES, ACTIONS } from "../../constants/permissions";
import useApiQuery from "../../hooks/useApiQuery";
import { listShifts, listWeekOffYears, removeShift } from "../../api/shifts";
import { toastApiError } from "../../utils/apiError";
import WeekOffCopyModal from "../../components/fiscalYear/WeekOffCopyModal";

const PAGE_SIZE = 10;

export default function ShiftManagement() {
  const { t } = useTranslation("settings");
  const navigate = useNavigate();
  const can = useCan();
  const canCreateShift = can(MODULES.SHIFT, ACTIONS.CREATE);
  const canUpdateShift = can(MODULES.SHIFT, ACTIONS.UPDATE);
  const canDeleteShift = can(MODULES.SHIFT, ACTIONS.DELETE);
  // Shifts aren't year-scoped: the backend refuses only off-dates / back-dated timings that
  // fall in a closed period (shown under their inputs on the form).
  const [copyOpen, setCopyOpen] = useState(false);
  // "Copy week-offs to next year" targets the company's year right after today's (D39), when it
  // exists and isn't closed.
  const { data: yearData } = useApiQuery(() => listWeekOffYears(), []);
  const years = yearData?.years || [];
  const currentIdx = years.findIndex((y) => y.id === yearData?.current_id);
  const nextYear = currentIdx >= 0 ? years[currentIdx + 1] || null : null;
  const canCopyWeekOffs = canUpdateShift && !!nextYear && !nextYear.year_locked;
  const [searchTerm, setSearchTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [shiftToDelete, setShiftToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);


  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(searchTerm);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Search (by name) and paging are done by the server.
  const { data, loading: isLoading, error, reload: load } = useApiQuery(
    () => listShifts({ page, limit: PAGE_SIZE, search: debounced.trim() }),
    [page, debounced],
  );
  const shifts = data?.items || [];
  const count = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const handleEditClick = (shift) => {
    navigate(`/admin/shift-management/edit/${shift.id}`);
  };

  const handleAddClick = () => {
    navigate("/admin/shift-management/add-shift");
  };

  const handleDeleteClick = (shift) => {
    setShiftToDelete(shift);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!shiftToDelete) return;

    const idToDelete = shiftToDelete.id || shiftToDelete._id;
    if (!idToDelete) {
      toast.error(t("shift.list.invalidShift"));
      return;
    }

    setDeleting(true);
    try {
      await removeShift(idToDelete);
      toast.success(t("shift.list.deleted"));
      load();
    } catch (err) {
      // 409 SHIFT_IN_USE: "This shift is assigned to employees and can't be deleted."
      toastApiError(err, t("shift.list.deleteFailed"));
    }
    setShowDeleteConfirm(false);
    setShiftToDelete(null);
    setDeleting(false);
  };

  return (
    <>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
              {t("shift.list.title")}
            </h1>
            <p className="text-gray-400 mt-1 text-sm">
              {t("shift.list.subtitle")}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
            {canCopyWeekOffs && (
              <button
                onClick={() => setCopyOpen(true)}
                title={t("shift.weekOffCopy.buttonHint", { label: nextYear.label })}
                className="flex items-center gap-2 border border-cyan-600 text-cyan-700 hover:bg-cyan-50 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors"
              >
                <MdOutlineContentCopy className="text-lg" /> {t("shift.weekOffCopy.button")}
              </button>
            )}
            <button
              onClick={handleAddClick}
              disabled={!canCreateShift}
              title={canCreateShift ? "" : t("shift.list.noCreatePermission")}
              className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-cyan-600"
            >
              <MdAddCircleOutline className="text-lg" /> {t("shift.list.addShift")}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-4">
          <div className="flex flex-col sm:flex-row items-end gap-4">
            <div className="flex-1 w-full sm:max-w-md">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                {t("shift.list.searchLabel")}
              </label>
              <div className="relative h-[42px]">
                <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none">
                  <MdSearch className="text-gray-400 text-lg" />
                </div>
                <input
                  type="text"
                  placeholder={t("shift.list.searchPlaceholder")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-full appearance-none border border-gray-200 rounded-lg ps-10 px-3 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>
            
            <button
                onClick={() => {
                  setSearchTerm("");
                  setPage(1);
                }}
                className="w-full sm:w-auto flex justify-center items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-2 rounded-lg font-medium text-sm transition-colors h-[42px]"
              >
                <MdOutlineClear className="text-lg" />
                {t("shift.list.clearFilters")}
              </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {[t("shift.list.headers.sn"), t("shift.list.headers.name"), t("shift.list.headers.startTime"), t("shift.list.headers.endTime"), t("shift.list.headers.action")].map(
                    (h) => (
                      <th
                        key={h}
                        className="text-start px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {isLoading ? (
                  <TableLoader colSpan={5} label={t("shift.list.loading")} />
                ) : error ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-6">
                      <ScreenError error={error} onRetry={load} />
                    </td>
                  </tr>
                ) : shifts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-12 text-center text-sm text-gray-400"
                    >
                      {t("shift.list.empty")}
                    </td>
                  </tr>
                ) : (
                  shifts.map((shift, index) => (
                    <tr
                      key={shift.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-5 py-4 text-sm text-gray-700">
                        {(page - 1) * PAGE_SIZE + index + 1}
                      </td>
                      <td className="px-5 py-4 font-bold text-gray-900 text-sm">
                        {shift.name}
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-700">
                        {shift.start_time}
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-700">
                        {shift.end_time}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditClick(shift)}
                            disabled={!canUpdateShift}
                            title={canUpdateShift ? t("shift.list.edit") : t("shift.list.noEditPermission")}
                            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-gray-400 disabled:hover:bg-transparent"
                          >
                            <MdEdit className="text-lg" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(shift)}
                            disabled={!canDeleteShift}
                            title={canDeleteShift ? t("shift.list.delete") : t("shift.list.noDeletePermission")}
                            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-gray-400 disabled:hover:bg-transparent"
                          >
                            <MdDelete className="text-lg" />
                          </button>
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
            {isLoading ? (
              <Loader label={t("shift.list.loading")} />
            ) : error ? (
              <div className="p-4">
                <ScreenError error={error} onRetry={load} />
              </div>
            ) : shifts.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">
                {t("shift.list.empty")}
              </div>
            ) : (
              shifts.map((shift, index) => (
                <div key={shift.id} className="px-4 py-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold text-gray-700 bg-gray-100 border border-gray-200">
                          #{(page - 1) * PAGE_SIZE + index + 1}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-gray-900">
                        {shift.name}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                    <span>
                      {t("shift.list.startTime")}{" "}
                      <strong className="text-gray-800">
                        {shift.start_time}
                      </strong>
                    </span>
                    <span>
                      {t("shift.list.endTime")}{" "}
                      <strong className="text-gray-800">
                        {shift.end_time}
                      </strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-50">
                    <button
                      onClick={() => handleEditClick(shift)}
                      disabled={!canUpdateShift}
                      title={canUpdateShift ? t("shift.list.edit") : t("shift.list.noEditPermission")}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-gray-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <MdEdit className="text-base" /> {t("shift.list.edit")}
                    </button>
                    <button
                      onClick={() => handleDeleteClick(shift)}
                      disabled={!canDeleteShift}
                      title={canDeleteShift ? t("shift.list.delete") : t("shift.list.noDeletePermission")}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <MdDelete className="text-base" /> {t("shift.list.delete")}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          <Pagination
            page={page}
            totalPages={totalPages}
            total={count}
            limit={PAGE_SIZE}
            onPage={setPage}
            label={t("shift.list.paginationLabel")}
            activeClass="bg-cyan-600 text-white"
            containerClass="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-4 border-t border-gray-100"
          />
        </div>
      </div>

      <WeekOffCopyModal
        open={copyOpen}
        onClose={() => setCopyOpen(false)}
        toFy={nextYear?.id}
        onDone={() => {
          setCopyOpen(false);
          load();
        }}
      />

      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setShiftToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        loading={deleting}
        title={t("shift.list.deleteTitle")}
        message={t("shift.list.deleteMessage", { name: shiftToDelete?.name })}
        type="delete"
        confirmText={t("shift.list.delete")}
      />
    </>
  );
}
