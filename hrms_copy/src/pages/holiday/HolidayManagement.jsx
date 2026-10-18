import { useEffect, useState } from "react";
import Pagination from "../../components/Pagination";
import {
  MdSearch,
  MdOutlineCalendarToday,
  MdAddCircleOutline,
  MdEdit,
  MdDelete,
  MdOutlineClear,
  MdOutlineContentCopy,
} from "react-icons/md";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import CreateHolidayModal from "../../components/CreateHolidayModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import { HOLIDAYS } from "../../data/groupC";
import { matches, nextId, paginate } from "../../data/common";
import Loader, { TableLoader } from "../../components/Loader";
import { useFormat } from "../../hooks/useFormat";
import Ltr from "../../components/Ltr";
import Can from "../../components/Can";
import { MODULES, ACTIONS } from "../../constants/permissions";
import CustomDropdown from "../../components/CustomDropdown";
import HolidayCopyModal from "../../components/fiscalYear/HolidayCopyModal";
import useFiscalYear from "../../hooks/useFiscalYear";
import useYearLock, { lockedYearOf } from "../../hooks/useYearLock";

const PAGE_SIZE = 10;

// Backend holiday_type enum + display label keys
const HOLIDAY_TYPES = [
  { value: "PUBLIC", labelKey: "types.public" },
  { value: "FESTIVAL", labelKey: "types.festival" },
  { value: "NATIONAL", labelKey: "types.national" },
  { value: "COMPANY", labelKey: "types.company" },
  { value: "OPTIONAL", labelKey: "types.optional" },
  { value: "WEEKLY_OFF", labelKey: "types.weeklyOff" },
];

export default function HolidayManagement() {
  const { t } = useTranslation("holidays");
  const { fmtDate } = useFormat();
  // The list shows the selected financial year's holidays (static build: the
  // year filter below switches a local year instead of the app-wide one).
  const fyBase = useFiscalYear();
  const [yearKey, setYearKey] = useState(fyBase.selected);
  const selectedYear = fyBase.years.find((y) => y.year_key === yearKey);
  const fy = { ...fyBase, selected: yearKey, label: selectedYear?.label || fyBase.label };
  const selectFiscalYear = (key) => {
    setYearKey(key);
    setPage(1);
  };
  const lock = useYearLock();
  const nextYear = fy.selected ? fy.years.find((y) => y.year_key === fy.selected + 1) || null : null;
  const [copyOpen, setCopyOpen] = useState(false);
  const { t: tFy } = useTranslation("fiscalYear");
  const lockTitle = (d) => tFy("locked.tooltip", { label: lockedYearOf(fy.years, d)?.label || fy.label });

  const typeLabel = (value) => {
    const found = HOLIDAY_TYPES.find((x) => x.value === value);
    return found ? t(found.labelKey) : value || "—";
  };

  const formatDate = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return fmtDate(iso, { month: "short", day: "2-digit", year: "numeric" });
  };

  const weekdayOf = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return fmtDate(iso, { weekday: "long" });
  };

  const [allHolidays, setAllHolidays] = useState(HOLIDAYS);
  const loading = false;
  const [page, setPage] = useState(1);

  const [searchTerm, setSearchTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [filterType, setFilterType] = useState("All");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editHoliday, setEditHoliday] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [holidayToDelete, setHolidayToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Pagination helpers

  // Debounce the search box
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(searchTerm), 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset to page 1 when the query changes
  useEffect(() => {
    setPage(1);
  }, [debounced, filterType]);

  // Client-side search / type / year filter + paging over the static rows.
  const filteredHolidays = allHolidays
    .filter((h) => String(h.holiday_date).slice(0, 4) === String(yearKey))
    .filter((h) => filterType === "All" || h.holiday_type === filterType)
    .filter((h) => matches(h, debounced, ["holiday_name", "description"]))
    .sort((a, b) => String(a.holiday_date).localeCompare(String(b.holiday_date)));
  const { rows: holidays, total: count, totalPages } = paginate(filteredHolidays, page, PAGE_SIZE);

  // Merge a created/edited holiday into the local list.
  const load = (saved) => {
    if (!saved) return;
    setAllHolidays((prev) =>
      saved.id && prev.some((h) => h.id === saved.id)
        ? prev.map((h) => (h.id === saved.id ? { ...h, ...saved } : h))
        : [...prev, { ...saved, id: nextId(prev) }],
    );
  };

  const handleEditClick = (row) => {
    const h = row;
    setEditHoliday({
      id: h.id,
      holiday_name: h.holiday_name || "",
      holiday_date: h.holiday_date ? String(h.holiday_date).slice(0, 10) : "",
      holiday_type: h.holiday_type || "PUBLIC",
      description: h.description || "",
      is_global: h.is_global ?? true,
      is_optional: h.is_optional ?? false,
      is_half_day: h.is_half_day ?? false,
      from_time: h.from_time || "",
      to_time: h.to_time || "",
      is_active: h.is_active ?? true,
    });
    setIsModalOpen(true);
  };

  const handleDeleteClick = (row) => {
    setHolidayToDelete(row);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!holidayToDelete) return;
    setDeleting(true);
    setAllHolidays((prev) => prev.filter((h) => h.id !== holidayToDelete.id));
    toast.success(t("toast.deleted"));
    setShowDeleteConfirm(false);
    setHolidayToDelete(null);
    setDeleting(false);
  };

  return (
    <>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
              {t("title")}
            </h1>
            <p className="text-gray-400 mt-1 text-sm">
              {t("subtitle")}
              {fy.label && (
                <span className="ms-2 inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold text-cyan-700 bg-cyan-50 border border-cyan-100">
                  {fy.label}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
            <Link
              to="/admin/leave-management/leave-calender"
              className="flex items-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors"
            >
              <MdOutlineCalendarToday className="text-base" />{" "}
              {t("viewCalendar")}
            </Link>
            <Can module={MODULES.HOLIDAY} action={ACTIONS.CREATE}>
              <button
                type="button"
                onClick={() => setCopyOpen(true)}
                disabled={!nextYear || !!nextYear?.is_locked}
                title={
                  !nextYear
                    ? t("copy.noNextYear")
                    : nextYear.is_locked
                      ? t("copy.targetLocked", { label: nextYear.label })
                      : t("copy.buttonHint", { from: fy.label, to: nextYear.label })
                }
                className="flex items-center gap-2 border border-cyan-200 text-cyan-700 hover:bg-cyan-50 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <MdOutlineContentCopy className="text-base" /> {t("copy.button")}
              </button>
              {!lock.locked && (
                <button
                  onClick={() => {
                    setEditHoliday(null);
                    setIsModalOpen(true);
                  }}
                  className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm transition-colors"
                >
                  <MdAddCircleOutline className="text-lg" /> {t("createHoliday")}
                </button>
              )}
            </Can>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-1.5">
                {t("filters.searchLabel")}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none">
                  <MdSearch className="text-gray-400 text-lg" />
                </div>
                <input
                  type="text"
                  placeholder={t("filters.searchPlaceholder")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full appearance-none border border-gray-200 rounded-lg ps-10 px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 h-[42px]"
                />
              </div>
            </div>

            <div className="w-full sm:w-44">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-1.5">
                {t("filters.financialYear")}
              </label>
              <CustomDropdown
                value={fy.selected ? String(fy.selected) : ""}
                onChange={(e) => e.target.value && selectFiscalYear(Number(e.target.value))}
                options={fy.years.map((y) => ({ label: y.label, value: String(y.year_key) }))}
              />
            </div>

            <div className="w-full sm:w-48">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-1.5">
                {t("filters.filterByType")}
              </label>
              <div className="relative">
                <CustomDropdown
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  options={[
                    { label: t("filters.allTypes"), value: "All" },
                    ...HOLIDAY_TYPES.map((type) => ({
                      label: t(type.labelKey),
                      value: type.value
                    }))
                  ]}
                />
              </div>
            </div>

            {/* Clear Filters */}
            <div className="flex-shrink-0 w-full sm:w-auto">
              <button
                onClick={() => {
                  setSearchTerm("");
                  setFilterType("All");
                  setPage(1);
                }}
                className="w-full sm:w-auto flex justify-center items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-2 rounded-lg font-medium text-sm transition-colors h-[42px]"
              >
                <MdOutlineClear className="text-lg" />
                {t("filters.clearFilters")}
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
                    t("table.sn"),
                    t("table.holidayName"),
                    t("table.date"),
                    t("table.day"),
                    t("table.type"),
                    t("table.action"),
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-start px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <TableLoader colSpan={6} label={t("loading")} />
                ) : holidays.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-12 text-center text-sm text-gray-400"
                    >
                      {t("empty")}
                    </td>
                  </tr>
                ) : (
                  holidays.map((holiday, index) => (
                    <tr
                      key={holiday.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-5 py-4 text-sm text-gray-700">
                        {(page - 1) * PAGE_SIZE + index + 1}
                      </td>
                      <td className="px-5 py-4 font-bold text-gray-900 text-sm">
                        {holiday?.holiday_name
                          ? holiday.holiday_name.length > 20
                            ? `${holiday.holiday_name.substring(0, 20)}...`
                            : holiday.holiday_name
                          : "—"}
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-700">
                        <Ltr>{formatDate(holiday.holiday_date)}</Ltr>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-700">
                        {weekdayOf(holiday.holiday_date)}
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200">
                          {typeLabel(holiday.holiday_type)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <Can module={MODULES.HOLIDAY} action={ACTIONS.UPDATE}>
                            <button
                              onClick={() => handleEditClick(holiday)}
                              disabled={lock.isLockedDate(holiday.holiday_date)}
                              title={lock.isLockedDate(holiday.holiday_date) ? lockTitle(holiday.holiday_date) : t("edit")}
                              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-400"
                            >
                              <MdEdit className="text-lg" />
                            </button>
                          </Can>
                          <Can module={MODULES.HOLIDAY} action={ACTIONS.DELETE}>
                            <button
                              onClick={() => handleDeleteClick(holiday)}
                              disabled={lock.isLockedDate(holiday.holiday_date)}
                              title={lock.isLockedDate(holiday.holiday_date) ? lockTitle(holiday.holiday_date) : t("delete")}
                              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-400"
                            >
                              <MdDelete className="text-lg" />
                            </button>
                          </Can>
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
              <Loader label={t("loading")} />
            ) : holidays.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">
                {t("empty")}
              </div>
            ) : (
              holidays.map((holiday, index) => (
                <div key={holiday.id} className="px-4 py-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold text-gray-700 bg-gray-100 border border-gray-200">
                          #{(page - 1) * PAGE_SIZE + index + 1}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200">
                          {typeLabel(holiday.holiday_type)}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-gray-900">
                        {holiday.holiday_name}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                    <span>
                      {t("card.dateLabel")}{" "}
                      <strong className="text-gray-800">
                        <Ltr>{formatDate(holiday.holiday_date)}</Ltr>
                      </strong>
                    </span>
                    <span>
                      {t("card.dayLabel")}{" "}
                      <strong className="text-gray-800">
                        {weekdayOf(holiday.holiday_date)}
                      </strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-50">
                    <Can module={MODULES.HOLIDAY} action={ACTIONS.UPDATE}>
                      <button
                        onClick={() => handleEditClick(holiday)}
                        disabled={lock.isLockedDate(holiday.holiday_date)}
                        title={lock.isLockedDate(holiday.holiday_date) ? lockTitle(holiday.holiday_date) : undefined}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-gray-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <MdEdit className="text-base" /> {t("edit")}
                      </button>
                    </Can>
                    <Can module={MODULES.HOLIDAY} action={ACTIONS.DELETE}>
                      <button
                        onClick={() => handleDeleteClick(holiday)}
                        disabled={lock.isLockedDate(holiday.holiday_date)}
                        title={lock.isLockedDate(holiday.holiday_date) ? lockTitle(holiday.holiday_date) : undefined}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <MdDelete className="text-base" /> {t("delete")}
                      </button>
                    </Can>
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
            label={t("paginationLabel")}
            activeClass="bg-cyan-600 text-white"
            containerClass="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-4 border-t border-gray-100"
          />
        </div>
      </div>

      {isModalOpen && (
        <CreateHolidayModal
          mode={editHoliday ? "edit" : "create"}
          initialData={editHoliday}
          onClose={() => {
            setIsModalOpen(false);
            setEditHoliday(null);
          }}
          onSuccess={(saved) => {
            setIsModalOpen(false);
            setEditHoliday(null);
            load(saved);
          }}
        />
      )}

      <HolidayCopyModal
        open={copyOpen}
        fromFy={fy.selected}
        toFy={nextYear?.year_key}
        onClose={() => setCopyOpen(false)}
        onDone={() => {
          setCopyOpen(false);
          if (nextYear) selectFiscalYear(nextYear.year_key);
        }}
      />

      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setHolidayToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        isLoading={deleting}
        title={t("deleteConfirm.title")}
        message={t("deleteConfirm.message", {
          name: holidayToDelete?.holiday_name,
        })}
        type="delete"
        confirmText={t("deleteConfirm.confirm")}
      />
    </>
  );
}
