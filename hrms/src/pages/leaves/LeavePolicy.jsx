import { useState } from "react";
import Pagination from "../../components/Pagination";
import {
  MdOutlineAdd,
  MdOutlineListAlt,
  MdOutlineBeachAccess,
  MdOutlineLocalHospital,
  MdOutlineAutoAwesome,
  MdOutlineEdit,
  MdOutlineDelete,
  MdOutlineCheckCircle,
  MdOutlineCancel,
  MdOutlineChevronRight,
  MdOutlineCalendarMonth,
} from "react-icons/md";

import { Link, useNavigate } from "react-router-dom";
import useFiscalYear from "../../hooks/useFiscalYear";
import { useTranslation } from "react-i18next";
import Ltr from "../../components/Ltr";
import CreateLeaveTypeModal from "../../components/CreateLeaveTypeModal";
import ConfirmationModal from "../../components/ConfirmationModal";

import { toast } from "react-toastify";
import Can from "../../components/Can";
import { MODULES, ACTIONS } from "../../constants/permissions";
import CustomDropdown from "../../components/CustomDropdown";
import { LS_CALENDAR_LEAVES, LS_HOLIDAYS } from "../../data/groupD";
import { TableLoader } from "../../components/Loader";
import { ScreenError } from "../../components/ScreenState";
import useApiQuery from "../../hooks/useApiQuery";
import { listLeaveTypes, removeLeaveType } from "../../api/leaveTypes";
import { toastApiError } from "../../utils/apiError";
const TypeBadge = ({ type }) => {
  const { t } = useTranslation("leaves");
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${
        type === "PAID"
          ? "text-green-700 bg-green-50 border-green-200"
          : "text-gray-600 bg-gray-100 border-gray-200"
      }`}
    >
      {type === "PAID" ? t("common.paid") : t("common.unpaid")}
    </span>
  );
};

const StatusBadge = ({ status }) => {
  const { t } = useTranslation("leaves");
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${
        status === "ACTIVE"
          ? "text-green-700 bg-green-50 border-green-200"
          : "text-gray-600 bg-gray-100 border-gray-200"
      }`}
    >
      {status === "ACTIVE" ? t("status.active") : t("status.inactive")}
    </span>
  );
};

const BoolIcon = ({ value }) =>
  value ? (
    <MdOutlineCheckCircle className="text-green-500 text-xl mx-auto" />
  ) : (
    <MdOutlineCancel className="text-gray-300 text-xl mx-auto" />
  );

// ── Main ──────────────────────────────────────────────────────────────────────
export default function LeavePolicy() {
  const { t, i18n } = useTranslation("leaves");
  const sortLabel = (opt) =>
    ({
      All: t("policy.sortOptions.all"),
      Active: t("policy.sortOptions.active"),
      InActive: t("policy.sortOptions.inactive"),
    })[opt] || opt;
  const navigate = useNavigate();
  const fy = useFiscalYear();
  // Leave types aren't year-scoped — a locked header year doesn't make them
  // read-only (policy versions gate on the FY chosen in the modal).
  // Year-end review: the year being closed (CLOSING), else the current year.
  const closeYearKey =
    fy.years.find((y) => y.status === "CLOSING")?.year_key ?? fy.current?.year_key ?? fy.selected;
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("All");
  const [deleting, setDeleting] = useState(false);

  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("create"); // "create" or "edit"
  const [selectedLeaveType, setSelectedLeaveType] = useState(null); // For edit mode

  // Status filter + paging (10 per page) by the server, by name.
  const status = sort === "Active" ? "ACTIVE" : sort === "InActive" ? "INACTIVE" : "";
  const { data, loading, error, reload } = useApiQuery(() => listLeaveTypes({ page, limit: 10, status }), [page, status]);
  const sorted = data?.items || [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 10));

  const openDeleteModal = (id) => {
    setSelectedLeave(id);
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      await removeLeaveType(selectedLeave);
      toast.success(t("policy.deleteSuccess"));
      setPage(1);
      reload();
    } catch (err) {
      // 409 LEAVE_TYPE_IN_USE: "This leave type is assigned to employees and can't be deleted."
      toastApiError(err);
    }
    setDeleting(false);
    setShowConfirm(false);
  };

  const handleCreateClick = () => {
    setModalMode("create");
    setSelectedLeaveType(null);
    setShowModal(true);
  };


  const handleEditClick = (leaveTypeRow) => {
    setModalMode("edit");
    setSelectedLeaveType(leaveTypeRow);
    setShowModal(true);
  };

  // The modal saved a leave type: show the list again from the server.
  const handleModalSuccess = () => reload();

  const today = fy.today;

  // Leave summary "upcoming" = approved leaves that haven't ended yet.
  const onLeaveTodayData = LS_CALENDAR_LEAVES.filter((leave) => leave.status === "APPROVED").filter(
    (leave) => leave.from_date <= today && leave.to_date >= today
  ).map((leave, i) => ({
    id: i,
    initials: leave.employee_name ? leave.employee_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'N/A',
    color: "bg-cyan-500", 
    name: leave.employee_name || t("policy.unknownEmployee"),
    profile_url: leave.profile_url,
    type: leave.leave_type || t("policy.leaveFallback"),
    return: new Date(leave.to_date) > new Date(today) ? t("policy.returningLater") : t("policy.backTomorrow")
  }));

  const allHolidays = LS_HOLIDAYS;
  const upcomingHolidaysData = allHolidays.filter(
    (h) => h.holiday_date >= today
  ).slice(0, 5).map((h) => {
    const d = new Date(h.holiday_date);
    return {
      id: h.id,
      month: d.toLocaleString(i18n.language?.startsWith('ar') ? 'ar' : 'en-US', { month: 'short' }).toUpperCase(),
      day: String(d.getDate()).padStart(2, '0'),
      name: h.holiday_name,
      note: h.holiday_type
        ? t(`policy.holidayTypes.${h.holiday_type}`, { defaultValue: h.holiday_type })
        : t("policy.publicHolidayFallback")
    };
  });


  return (
    <>
      <div className="space-y-6">
        {/* ── Breadcrumb ── */}
        <div className="flex items-center gap-1.5 text-sm flex-wrap">
          <Link
            to="/admin/leave-management"
            className="text-gray-400 hover:text-cyan-600 transition-colors"
          >
            {t("common.leaveManagement")}
          </Link>
          <MdOutlineChevronRight className="text-gray-300 rtl:rotate-180" />
          <span className="text-cyan-600 font-semibold">{t("policy.breadcrumb")}</span>
        </div>

        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
              {t("policy.title")}
            </h1>
            <p className="text-gray-400 mt-1 text-sm">
              {t("policy.subtitle")}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
            <Can module={MODULES.LEAVE_TYPE} action={ACTIONS.CREATE}>
              <button
                onClick={handleCreateClick}
                className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm transition-colors"
              >
                <MdOutlineAdd className="text-base" /> {t("policy.createLeaveType")}
              </button>
            </Can>
          </div>
        </div>

        {/* ── Top Policy Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Annual Leave */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 bg-cyan-50 rounded-xl flex items-center justify-center">
                <MdOutlineBeachAccess className="text-cyan-500 text-xl" />
              </div>
              <span className="text-[11px] font-bold text-green-600 uppercase tracking-wide">
                {t("policy.activePolicy")}
              </span>
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">
              {t("policy.cards.annualLeave")}
            </h3>
            <p className="text-xs text-gray-400 leading-relaxed mb-4">
              {t("policy.cards.annualLeaveDesc")}
            </p>
            <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-4">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  {t("policy.cards.utilization")}
                </p>
                <p className="text-xl font-bold text-gray-900">68%</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  {t("policy.cards.pending")}
                </p>
                <p className="text-xl font-bold text-gray-900">12 {t("common.req")}</p>
              </div>
            </div>
          </div>

          {/* Sick Leave */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
                <MdOutlineLocalHospital className="text-orange-500 text-xl" />
              </div>
              <span className="text-[11px] font-bold text-green-600 uppercase tracking-wide">
                {t("policy.activePolicy")}
              </span>
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">
              {t("policy.cards.sickLeave")}
            </h3>
            <p className="text-xs text-gray-400 leading-relaxed mb-4">
              {t("policy.cards.sickLeaveDesc")}
            </p>
            <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-4">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  {t("policy.cards.avgUsage")}
                </p>
                <p className="text-xl font-bold text-gray-900">
                  4.2
                  <span className="text-sm font-normal text-gray-400">{t("policy.cards.perYear")}</span>
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  {t("policy.cards.current")}
                </p>
                <p className="text-xl font-bold text-red-500">3 {t("policy.cards.active")}</p>
              </div>
            </div>
          </div>

          {/* Special Policies */}
          <div className="bg-gray-900 rounded-xl p-5 relative overflow-hidden sm:col-span-2 lg:col-span-1">
            <div className="absolute bottom-2 end-3 text-[80px] opacity-10 select-none pointer-events-none">
              ✦
            </div>
            <div className="w-10 h-10 bg-gray-700 rounded-xl flex items-center justify-center mb-3">
              <MdOutlineAutoAwesome className="text-cyan-400 text-xl" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">
              {t("policy.cards.specialPolicies")}
            </h3>
            <p className="text-xs text-gray-400 leading-relaxed mb-5">
              {t("policy.cards.specialPoliciesDesc")}
            </p>
            <button className="w-full border border-gray-600 text-gray-300 hover:bg-gray-700 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors">
              {t("policy.cards.manageSpecialties")}
            </button>
          </div>
        </div>

        {/* ──Leave Types Table ── */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <MdOutlineListAlt className="text-cyan-500 text-xl" />
              <h3 className="text-base font-bold text-gray-900">{t("policy.leaveTypes")}</h3>
            </div>
            {/* Sort Dropdown & Clear Filter */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">{t("policy.statusLabel")}</label>
                <div className="w-40">
                  <CustomDropdown
                    value={sort}
                    onChange={(e) => {
                      setSort(e.target.value);
                      setPage(1);
                    }}
                    options={[
                      { label: sortLabel("All"), value: "All" },
                      { label: sortLabel("Active"), value: "Active" },
                      { label: sortLabel("InActive"), value: "InActive" },
                    ]}
                  />
                </div>
              </div>
              
              <button
                onClick={() => {
                  setSort("All");
                  setPage(1);
                }}
                className="w-full sm:w-auto flex justify-center items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-2 rounded-lg font-medium text-sm transition-colors h-[42px]"
              >
                {t("policy.clearFilter")}</button>
            </div>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {[
                    { key: "policy.table.sn" },
                    { key: "policy.table.leaveName" },
                    { key: "policy.table.type" },
                    { key: "policy.table.totalDays" },
                    { key: "policy.table.carryForward" },
                    { key: "policy.table.encashment" },
                    { key: "policy.table.status" },
                    { key: "policy.table.actions", isActions: true },
                  ].map(({ key, isActions }) => (
                    <th
                      key={key}
                      className={`px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider ${isActions ? "text-end" : "text-start"}`}
                    >
                      {t(key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <TableLoader colSpan={8} />
                ) : error ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-6">
                      <ScreenError error={error} onRetry={reload} />
                    </td>
                  </tr>
                ) : sorted.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-sm text-gray-400">
                      {t("policy.empty")}
                    </td>
                  </tr>
                ) : (
                  sorted.map((row, index) => {
                  return (
                    <tr
                      key={row.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-5 py-4 text-sm text-gray-700">
                        {(page - 1) * 10 + index + 1}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {/* <div
                            className={`w-8 h-8 ${row.iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}
                          >
                            <Icon className={`${row.iconColor} text-base`} />
                          </div> */}
                          <span className="text-sm font-semibold text-gray-900">
                            {row?.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <TypeBadge type={row?.is_paid ? "PAID" : "UNPAID"} />
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-700">
                        <Ltr>{Number(row?.yearly_quota)}</Ltr>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <BoolIcon value={row?.allow_carry_forward} />
                      </td>
                      <td className="px-5 py-4 text-center">
                        <BoolIcon value={row?.allow_encashment} />
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge
                          status={row.is_active ? "ACTIVE" : "INACTIVE"}
                        />
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Can module={MODULES.LEAVE_TYPE} action={ACTIONS.UPDATE}>
                            <button
                              onClick={() => handleEditClick(row)} // row is the leave type object
                              className="p-1.5 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <MdOutlineEdit className="text-lg" />
                            </button>
                          </Can>
                          <Can module={MODULES.LEAVE_TYPE} action={ACTIONS.DELETE}>
                            <button
                              onClick={() => openDeleteModal(row.id)}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <MdOutlineDelete className="text-lg" />
                            </button>
                          </Can>
                        </div>
                      </td>
                    </tr>
                  );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-gray-100">
            {loading ? (
              <div className="px-4 py-12 text-center text-sm text-gray-400">{t("common:ui.loading")}</div>
            ) : error ? (
              <div className="p-4">
                <ScreenError error={error} onRetry={reload} />
              </div>
            ) : sorted.map((row) => {
              return (
                <div key={row.id} className="px-4 py-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-sm font-bold text-gray-900">
                          {row.name}
                        </p>
                        <TypeBadge type={row?.is_paid ? "PAID" : "UNPAID"} />
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Can module={MODULES.LEAVE_TYPE} action={ACTIONS.UPDATE}>
                        <button
                          onClick={() => handleEditClick(row)}
                          className="p-1.5 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <MdOutlineEdit className="text-base" />
                        </button>
                      </Can>
                      <Can module={MODULES.LEAVE_TYPE} action={ACTIONS.DELETE}>
                        <button
                          onClick={() => openDeleteModal(row.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <MdOutlineDelete className="text-base" />
                        </button>
                      </Can>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-gray-500">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">
                        {t("policy.mobile.days")}
                      </p>
                      <p className="font-semibold text-gray-800">
                        <Ltr>{row?.yearly_quota != null ? Number(row.yearly_quota) : "-"}</Ltr>
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">
                        {t("policy.mobile.carryFwd")}
                      </p>
                      <BoolIcon value={row?.allow_carry_forward} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">
                        {t("policy.mobile.encash")}
                      </p>
                      <BoolIcon value={row?.allow_encashment} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            limit={10}
            onPage={setPage}
            label={t("policy.paginationLabel")}
            activeClass="bg-cyan-600 text-white"
            containerClass="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-gray-100"
          />
        </div>

        {/* ── Bottom: Carry-over Review + On Leave Today + Public Holidays ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Yearly Carry-over Review */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl flex flex-col items-center justify-center p-8 text-center gap-4">
            <div className="w-16 h-16 bg-white border border-gray-200 rounded-2xl flex items-center justify-center shadow-sm">
              <MdOutlineCalendarMonth className="text-cyan-500 text-3xl" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 mb-2">
                {t("policy.carryOver.title")}
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed max-w-xs">
                {t("policy.carryOver.body")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => closeYearKey && navigate(`/admin/fiscal-years/${closeYearKey}/close`)}
              disabled={!closeYearKey}
              className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t("policy.carryOver.cta")}
            </button>
          </div>

          {/* Right column: On Leave Today + Upcoming Holidays */}
          <div className="space-y-4">
            {/* On Leave Today */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  {t("policy.onLeaveToday")}
                </p>
              </div>
              <div className="divide-y divide-gray-50">
                {onLeaveTodayData.length > 0 ? (
                  onLeaveTodayData.map((person) => (
                    <div
                      key={person.id}
                      className="flex items-center justify-between px-5 py-3.5"
                    >
                      <div className="flex items-center gap-3">
                        {person.profile_url ? (
                          <img
                            src={person.profile_url}
                            alt={person.name}
                            className="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-gray-100"
                          />
                        ) : (
                          <div
                            className={`w-9 h-9 rounded-full ${person.color} text-white text-sm font-bold flex items-center justify-center flex-shrink-0`}
                          >
                            {person.initials}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {person.name}
                          </p>
                          <p className="text-xs text-gray-400">({person.type})</p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-gray-500">
                        {person.return}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="px-5 py-4 text-sm text-gray-500 text-center">{t("policy.noOneOnLeave")}</div>
                )}
              </div>
            </div>

            {/* Upcoming Public Holidays */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  {t("policy.upcomingHolidays")}
                </p>
              </div>
              <div className="divide-y divide-gray-50">
                {upcomingHolidaysData.length > 0 ? (
                  upcomingHolidaysData.map((h) => (
                    <div
                      key={h.id}
                      className="flex items-center gap-4 px-5 py-4"
                    >
                      <div className="text-center w-10 flex-shrink-0">
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                          {h.month}
                        </p>
                        <p className="text-xl font-bold text-gray-900 leading-tight">
                          {h.day}
                        </p>
                      </div>
                      <div className="w-px h-8 bg-cyan-500 flex-shrink-0 rounded-full" />
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {h.name}
                        </p>
                        <p className="text-xs text-gray-400">{h.note}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-5 py-4 text-sm text-gray-500 text-center">{t("policy.noUpcomingHolidays")}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      {showModal && (
        <CreateLeaveTypeModal
          mode={modalMode}
          initialData={selectedLeaveType}
          onSuccess={handleModalSuccess}
          onClose={() => {
            setShowModal(false);
            setSelectedLeaveType(null);
            setModalMode("create");
          }}
        />
      )}

      <ConfirmationModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleConfirm}
        type="warning"
        title={t("policy.confirm.title")}
        message={t("policy.confirm.message")}
        confirmText={t("policy.confirm.confirmText")}
        isLoading={deleting}
      />
    </>
  );
}
