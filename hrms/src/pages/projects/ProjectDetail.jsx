import { useEffect, useState } from "react";
import {
  MdOutlineLocationOn,
  MdOutlineCalendarToday,
  MdOutlinePersonAdd,
  MdOutlineDeleteOutline,
  MdOutlineChevronLeft,
  MdOutlineChevronRight,
  MdEdit,
  MdOutlineClear,
} from "react-icons/md";
import CustomDropdown from "../../components/CustomDropdown";

import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { getProject, listProjectWorkforce, removeProjectEmployee, updateProject } from "../../api/projects";
import { assetUrl } from "../../api/client";
import AssignEmployeesModal from "../../components/AssignEmployeesModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import { TableLoader } from "../../components/Loader";
import { ScreenError } from "../../components/ScreenState";
import Ltr from "../../components/Ltr";
import { useFormat } from "../../hooks/useFormat";
import useApiQuery from "../../hooks/useApiQuery";
import Can from "../../components/Can";
import EditProjectModal from "../../components/EditProjectModal";
import OfflineAttendanceTile from "../../components/projects/OfflineAttendanceTile";
import { MODULES, ACTIONS } from "../../constants/permissions";
import { toastApiError } from "../../utils/apiError";
import { toProjectBody, toProjectFormValues } from "../../utils/projectRules";
import constructionImage from "../../assets/images/constructionimage.png";

const EMP_AVATAR_COLORS = [
  "bg-cyan-500",
  "bg-blue-500",
  "bg-violet-500",
  "bg-rose-400",
  "bg-amber-500",
  "bg-teal-500",
];

const empInitials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "?";

const typeLabel = (t) => (t === "CONTRACT" ? "CONTRACT" : "FULL-TIME");

// ── Data ──────────────────────────────────────────────────────────────────────

const TYPE_STYLES = {
  "FULL-TIME": "text-blue-600 bg-blue-50 border-blue-200",
  CONTRACT: "text-violet-600 bg-violet-50 border-violet-200",
};

const PAGE_SIZE = 4;

const apiStatusToDisplay = (s) => {
  if (s === "COMPLETED") return "Completed";
  if (s === "ON_HOLD") return "On Hold";
  if (s === "ACTIVE") return "Active";
  return "—";
};

const STATUS_LABEL_KEY = {
  Completed: "status.completed",
  "On Hold": "status.onHold",
  Active: "status.active",
};

const STATUS_PILL = {
  Active:
    "bg-green-50 border-green-200 text-green-700 [&_.dot]:bg-green-500",
  Completed: "bg-blue-50 border-blue-200 text-blue-700 [&_.dot]:bg-blue-500",
  "On Hold":
    "bg-amber-50 border-amber-200 text-amber-700 [&_.dot]:bg-amber-500",
  "—": "bg-gray-50 border-gray-200 text-gray-500 [&_.dot]:bg-gray-300",
};

// Workforce status = the member's employment status (D15): Active / In notice.
const EMP_STATUS_PILL = {
  ACTIVE: "bg-green-50 text-green-700 border-green-200",
  IN_NOTICE: "bg-amber-50 text-amber-700 border-amber-200",
};

// The admin project page (D13–D15): the project from GET /projects/:id, its workforce from
// GET /projects/:id/employees (paged on the server), assign and remove.
function ProjectDetail() {
  const { t } = useTranslation("projects");
  const { fmtDate } = useFormat();
  const { id } = useParams();

  const { data: current, loading: detailLoading, error: detailError, reload: reloadProject, setData: setCurrent } =
    useApiQuery(() => getProject(id), [id]);

  const [tab, setTab] = useState("ALL");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  const status = tab === "ALL" ? "" : tab;
  const {
    data: workforce,
    loading: empLoading,
    error: empError,
    reload: reloadEmployees,
  } = useApiQuery(
    () => listProjectWorkforce(id, { page, limit: PAGE_SIZE, search: debouncedSearch, status }),
    [id, page, debouncedSearch, status],
  );
  const employees = workforce?.items || [];
  const total = workforce?.total || 0;

  const [openAssign, setOpenAssign] = useState(false);
  const [editProject, setEditProject] = useState(null);
  const [employeeToRemove, setEmployeeToRemove] = useState(null);
  const [removing, setRemoving] = useState(false);

  // After an assign: the new members show in the table and the project's head count changes.
  const loadEmployees = () => {
    reloadEmployees();
    reloadProject();
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 500);
    return () => clearTimeout(handler);
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const paginated = employees;

  const handleClearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setTab("ALL");
    setPage(1);
  };

  // The offline switch saves the project as it is with only that flag changed.
  const saveOffline = (allowed) =>
    updateProject(id, {
      ...toProjectBody(toProjectFormValues(current), {
        officeId: current.office?.id,
        position: { lat: current.latitude, lng: current.longitude },
        address: current.location,
      }),
      allowOfflineAttendance: allowed,
    });

  const handleRemove = (emp) => {
    setEmployeeToRemove(emp);
  };

  const confirmRemove = async () => {
    if (!employeeToRemove || removing) return;
    setRemoving(true);
    try {
      await removeProjectEmployee(id, employeeToRemove.id);
      toast.success(t("detail.toast.employeeRemoved"));
      // The last row of a page went: step back a page.
      if (employees.length === 1 && page > 1) setPage(page - 1);
      else reloadEmployees();
      reloadProject();
    } catch (err) {
      toastApiError(err, t("detail.toast.removeFailed"));
    }
    setRemoving(false);
    setEmployeeToRemove(null);
  };

  if (detailError && !current) {
    return <ScreenError error={detailError} onRetry={reloadProject} />;
  }

  const displayStatus = apiStatusToDisplay(current?.status);
  const pillCls = STATUS_PILL[displayStatus] || STATUS_PILL["—"];
  const displayStatusLabel = STATUS_LABEL_KEY[displayStatus]
    ? t(STATUS_LABEL_KEY[displayStatus])
    : displayStatus;
  const typeDisplay = (type) =>
    type === "CONTRACT" ? t("type.contract") : t("type.fullTime");
  const empStatusLabel = (s) => (s ? t(`empStatus.${s}`, { defaultValue: s }) : t("detail.unknown"));

  return (
    <>
      <div className="space-y-6">
        {/* ── Breadcrumb & Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-sm flex-wrap mb-2">
              <Link
                to="/admin/projects"
                className="text-gray-400 hover:text-cyan-600 transition-colors"
              >
                {t("detail.breadcrumbProjects")}
              </Link>
              <MdOutlineChevronRight className="text-gray-300 rtl:rotate-180" />
              <span className="text-cyan-600 font-semibold">
                <Ltr>{current?.code || "—"}</Ltr>
              </span>
            </div>

            <div className="flex items-center gap-3">
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
                {detailLoading && !current
                  ? t("detail.loading")
                  : current?.name || "—"}
              </h1>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-semibold ${pillCls}`}
              >
                <span className="dot w-1.5 h-1.5 rounded-full" />
                {displayStatusLabel}
              </span>
            </div>
          </div>

          <Can module={MODULES.PROJECT} action={ACTIONS.UPDATE}>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setEditProject(current)}
                disabled={!current}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900 rounded-lg font-medium text-sm transition-colors flex-shrink-0"
              >
                <MdEdit className="text-lg" />
                {t("detail.editProject")}
              </button>
              <button
                onClick={() => setOpenAssign(true)}
                disabled={!current}
                className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm transition-colors flex-shrink-0 self-start"
              >
                <MdOutlinePersonAdd className="text-lg" />
                {t("buttons.assignEmployees")}
              </button>
            </div>
          </Can>
        </div>

        {/* ── Project Details Card ── */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 sm:p-6 flex flex-col lg:flex-row gap-6">
          {/* Image */}
          <div className="w-full lg:w-2/5 flex-shrink-0">
            <img
              src={current?.photo ? assetUrl(current.photo) : constructionImage}
              alt={t("detail.imageAlt")}
              className="w-full h-48 sm:h-64 object-cover rounded-xl bg-gray-100"
            />
          </div>

          {/* Info */}
          <div className="flex-1 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">{t("detail.description")}</h3>
              <p className="text-sm text-gray-500 leading-relaxed whitespace-pre-wrap">
                {current?.description || t("detail.noDescription")}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
              <div className="bg-gray-50 rounded-lg p-3 flex items-start gap-3">
                <MdOutlineCalendarToday className="text-gray-400 text-xl mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">{t("detail.targetCompletionLabel")}</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {current?.end_date ? fmtDate(current.end_date, { month: "short", year: "numeric" }) : t("detail.noEndDate")}
                  </p>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 flex items-start gap-3">
                <MdOutlineLocationOn className="text-gray-400 text-xl mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">{t("detail.radius")}</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {current?.radius ? <Ltr>{current.radius}m</Ltr> : "—"}
                  </p>
                </div>
              </div>
              {/* Offline (mobile) attendance for employees whose main project this is */}
              <OfflineAttendanceTile project={current} save={saveOffline} onSaved={(saved) => setCurrent(saved)} />
              <div className="bg-gray-50 rounded-lg p-3 flex items-start gap-3 sm:col-span-2">
                <MdOutlineLocationOn className="text-gray-400 text-xl mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">{t("card.location")}</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {current?.location || "—"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Assigned Workforce Table ── */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {/* Table Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-5 border-b border-gray-100">
            <div>
              <h3 className="text-base font-bold text-gray-900">
                {t("detail.assignedWorkforce")}
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                {t("detail.totalPersonnel", { count: current?.employee_count ?? total })}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto mt-3 sm:mt-0">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("detail.searchPlaceholder")}
                className="w-full sm:w-48 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"
              />

              <div className="w-full sm:w-32">
                <CustomDropdown
                  options={[
                    { value: "ALL", label: t("detail.allStatus") },
                    { value: "ACTIVE", label: t("empStatus.ACTIVE") },
                    { value: "IN_NOTICE", label: t("empStatus.IN_NOTICE") },
                  ]}
                  value={tab}
                  onChange={(val) => {
                    const actualVal = typeof val === 'object' && val.target ? val.target.value : val;
                    setTab(actualVal);
                    setPage(1);
                  }}
                  placeholder={t("detail.statusPlaceholder")}
                />
              </div>

              <button
                onClick={handleClearFilters}
                className="w-full sm:w-auto flex justify-center items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-2 rounded-lg font-medium text-sm transition-colors h-[42px]"
              >
                <MdOutlineClear className="text-lg" />
                {t("buttons.clearFilters")}
              </button>
            </div>
          </div>

          {/* Desktop Table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {[
                    { key: "sn", label: t("detailTable.sn") },
                    { key: "employeeName", label: t("detailTable.employeeName") },
                    { key: "role", label: t("detailTable.role") },
                    { key: "type", label: t("detailTable.type") },
                    { key: "staffingCompany", label: t("detailTable.staffingCompany") },
                    { key: "status", label: t("detailTable.status") },
                    { key: "action", label: t("detailTable.action") },
                  ].map((h) => (
                    <th
                      key={h.key}
                      className="text-start px-5 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider"
                    >
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {empLoading && employees.length === 0 ? (
                  <TableLoader colSpan={7} label={t("detail.loading")} />
                ) : empError ? (
                  <tr>
                    <td colSpan={7}>
                      <ScreenError error={empError} onRetry={reloadEmployees} />
                    </td>
                  </tr>
                ) : paginated.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-5 py-10 text-center text-sm text-gray-400"
                    >
                      {t("detail.emptyTable")}
                    </td>
                  </tr>
                ) : (
                  paginated.map((emp, idx) => {
                    const type = typeLabel(emp.employment_type);
                    return (
                      <tr
                        key={emp.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-5 py-4 text-sm text-gray-700">
                          {(page - 1) * PAGE_SIZE + idx + 1}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded ${EMP_AVATAR_COLORS[idx % EMP_AVATAR_COLORS.length]} text-white text-xs font-bold flex items-center justify-center flex-shrink-0`}
                            >
                              {empInitials(emp.name)}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-900">
                                {emp.name}
                              </p>
                              <p className="text-xs text-gray-400">
                                {emp.employee_code ? <Ltr>{emp.employee_code}</Ltr> : "—"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-700">
                          {emp.role || "—"}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${TYPE_STYLES[type]}`}
                          >
                            {typeDisplay(emp.employment_type)}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-600">
                          {emp.staffing_company || "—"}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${EMP_STATUS_PILL[emp.employment_status] || "bg-gray-50 text-gray-600 border-gray-200"}`}
                          >
                            {empStatusLabel(emp.employment_status)}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <Can module={MODULES.PROJECT} action={ACTIONS.UPDATE}>
                            <button
                              onClick={() => handleRemove(emp)}
                              title={t("tooltips.removeFromProject")}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                            >
                              <MdOutlineDeleteOutline className="text-lg" />
                            </button>
                          </Can>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden divide-y divide-gray-100">
            {empLoading && employees.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-gray-400">
                {t("detail.loadingEmployees")}
              </div>
            ) : empError ? (
              <ScreenError error={empError} onRetry={reloadEmployees} />
            ) : paginated.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-gray-400">
                {t("detail.emptyMobile")}
              </div>
            ) : (
              paginated.map((emp, idx) => {
                const type = typeLabel(emp.employment_type);
                return (
                  <div key={emp.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-full ${EMP_AVATAR_COLORS[idx % EMP_AVATAR_COLORS.length]} text-white text-xs font-bold flex items-center justify-center flex-shrink-0`}
                        >
                          {empInitials(emp.name)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {emp.name}
                          </p>
                          <p className="text-xs text-gray-400">
                            {emp.employee_code ? <Ltr>{emp.employee_code}</Ltr> : "—"}
                          </p>
                        </div>
                      </div>
                      <Can module={MODULES.PROJECT} action={ACTIONS.UPDATE}>
                        <button
                          onClick={() => handleRemove(emp)}
                          title={t("tooltips.removeFromProject")}
                          className="p-1 text-gray-400 hover:text-red-500"
                        >
                          <MdOutlineDeleteOutline className="text-lg" />
                        </button>
                      </Can>
                    </div>
                    <p className="text-sm text-gray-700">{emp.role || "—"}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${TYPE_STYLES[type]}`}
                      >
                        {typeDisplay(emp.employment_type)}
                      </span>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${EMP_STATUS_PILL[emp.employment_status] || "bg-gray-50 text-gray-600 border-gray-200"}`}
                      >
                        {empStatusLabel(emp.employment_status)}
                      </span>
                      <span className="text-xs text-gray-500">
                        {emp.staffing_company || "—"}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-gray-100">
            <p className="text-sm text-gray-500 font-medium order-2 sm:order-1">
              {t("detail.showing", { from: total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1, to: Math.min(page * PAGE_SIZE, total), total })}
            </p>
            <div className="flex items-center gap-1 order-1 sm:order-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-8 h-8 flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <MdOutlineChevronLeft className="rtl:rotate-180" />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`w-8 h-8 flex items-center justify-center rounded-md text-xs font-bold transition-colors ${page === n
                    ? "bg-cyan-600 text-white"
                    : "text-gray-600 hover:bg-gray-50"
                    }`}
                >
                  {n}
                </button>
              ))}

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="w-8 h-8 flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <MdOutlineChevronRight className="rtl:rotate-180" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {openAssign && (
        <AssignEmployeesModal
          projectId={id}
          onClose={() => setOpenAssign(false)}
          onAssigned={loadEmployees}
        />
      )}

      {editProject && (
        <EditProjectModal
          project={editProject}
          onClose={() => {
            setEditProject(null);
          }}
          onSaved={(saved) => setCurrent(saved)}
        />
      )}

      {/* ── Confirmation Modal ── */}
      <ConfirmationModal
        isOpen={!!employeeToRemove}
        onClose={() => setEmployeeToRemove(null)}
        onConfirm={confirmRemove}
        title={t("detail.removeTitle")}
        message={t("detail.removeMessage", { name: employeeToRemove?.name })}
        type="delete"
        confirmText={t("buttons.remove")}
      />
    </>
  );
}

export default ProjectDetail;
