import { useEffect, useState } from "react";
import Pagination from "../../components/Pagination";
import {
  MdPeople,
  MdCheckCircle,
  MdWarningAmber,
  MdVisibility,
  MdEdit,
  MdOutlineBarChart,
  MdOutlineAdd,
  MdOutlineClear
} from "react-icons/md";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { STAFFING_PROJECTS, STAFFING_PROJECT_DASHBOARD } from "../../data/groupH";
import { matches, paginate } from "../../data/common";
import Ltr from "../../components/Ltr";
import Can from "../../components/Can";
import EditProjectModal from "../../components/EditProjectModal";
import CustomDropdown from "../../components/CustomDropdown";
import { MODULES, ACTIONS } from "../../constants/permissions";
import AttendanceTodayCard from "../../components/AttendanceTodayCard";

const STATUS_MAP = {
  ACTIVE: {
    labelKey: "status.active",
    cls: "bg-green-50 text-green-700 border border-green-200",
  },
  COMPLETED: {
    labelKey: "status.completed",
    cls: "bg-blue-50 text-blue-700 border border-blue-200",
  },
  INACTIVE: {
    labelKey: "status.onHold",
    cls: "bg-amber-50 text-amber-700 border border-amber-200",
  },
};

const projectInitial = (name) => (name ? name.charAt(0).toUpperCase() : "P");

// ── Stat Card Component ──
const StatCard = ({ stat }) => {
  const Icon = stat.icon;
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 md:p-6 transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
            {stat.label}
          </p>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900">
            {stat.value}
          </p>
          {stat.badge && (
            <p className={`text-xs sm:text-sm font-semibold mt-1 ${stat.badgeColor}`}>
              {stat.badge}
            </p>
          )}
        </div>
        <div
          className={`${stat.iconBg} w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center flex-shrink-0`}
        >
          <Icon className={`${stat.iconColor} text-lg sm:text-xl`} />
        </div>
      </div>
    </div>
  );
};

// ── Donut Chart (SVG) — full-time vs contract ──
const DonutChart = ({ fullTime = 0, contract = 0, totalLabel = "0", totalStaffLabel = "TOTAL STAFF" }) => {
  const denom = fullTime + contract;
  const ftPct = denom > 0 ? Math.round((fullTime / denom) * 100) : 0;
  const ctPct = denom > 0 ? 100 - ftPct : 0;
  const segments = [
    { pct: ftPct, color: "#06b6d4" },
    { pct: ctPct, color: "#818cf8" },
  ];
  const r = 60;
  const circ = 2 * Math.PI * r;
  let cum = 0;
  return (
    <svg width="150" height="150" viewBox="0 0 150 150">
      {segments.map((seg, i) => {
        const dash = (seg.pct / 100) * circ;
        const gap = circ - dash;
        const rot = (cum / 100) * 360 - 90;
        cum += seg.pct;
        return (
          <circle
            key={i}
            cx="75"
            cy="75"
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth="18"
            strokeDasharray={`${dash} ${gap}`}
            strokeLinecap="butt"
            transform={`rotate(${rot} 75 75)`}
          />
        );
      })}
      <text
        x="75"
        y="70"
        textAnchor="middle"
        fontSize="20"
        fontWeight="bold"
        fill="#111827"
      >
        {totalLabel}
      </text>
      <text x="75" y="88" textAnchor="middle" fontSize="10" fill="#9ca3af">
        {totalStaffLabel}
      </text>
    </svg>
  );
};

// ── Main Component ──
export default function Projects() {
  const navigate = useNavigate();
  const { t } = useTranslation("projects");
  const dashboard = STAFFING_PROJECT_DASHBOARD;
  const loading = false;

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [editProject, setEditProject] = useState(null);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset page on search change
    }, 500);
    return () => clearTimeout(handler);
  }, [search]);

  // Client-side search / status filter / paging over the static projects.
  const projectsPaged = paginate(
    STAFFING_PROJECTS.filter(
      (p) =>
        matches(p, debouncedSearch, ["project_name", "project_code", "project_location"]) &&
        (statusFilter === "ALL" || p.status === statusFilter),
    ),
    page,
    limit,
  );
  const paginatedList = projectsPaged.rows;
  const pagination = { total: projectsPaged.total, total_pages: projectsPaged.totalPages };

  const handleClearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setStatusFilter("ALL");
    setPage(1);
  };

  const stats = [
    {
      id: 1,
      label: t("stats.totalProject"),
      value: dashboard?.total_projects ?? "—",
      icon: MdPeople,
      iconBg: "bg-cyan-50",
      iconColor: "text-cyan-600",
    },
    {
      id: 2,
      label: t("stats.activeProjects"),
      value: dashboard?.active_projects ?? "—",
      badge: t("status.active"),
      badgeColor: "text-blue-600",
      icon: MdCheckCircle,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-600",
    },
    {
      id: 3,
      label: t("stats.completeProject"),
      value: dashboard?.completed_projects ?? "—",
      icon: MdWarningAmber,
      iconBg: "bg-orange-50",
      iconColor: "text-orange-600",
    },
    {
      id: 4,
      label: t("stats.totalEmployees"),
      value: dashboard?.total_employees ?? "—",
      icon: MdPeople,
      iconBg: "bg-green-50",
      iconColor: "text-green-600",
    },
  ];


  const ft = dashboard?.distribution?.full_time ?? 0;
  const ct = dashboard?.distribution?.contract ?? 0;
  const denom = ft + ct;
  const ftPct = denom > 0 ? Math.round((ft / denom) * 100) : 0;
  const ctPct = denom > 0 ? 100 - ftPct : 0;

  const renderStatus = (status) => {
    const mapped = STATUS_MAP[status];
    const label = mapped ? t(mapped.labelKey) : status || "—";
    const cls = mapped
      ? mapped.cls
      : "bg-gray-50 text-gray-600 border border-gray-200";
    return (
      <span
        className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${cls}`}
      >
        {label}
      </span>
    );
  };

  return (
    <>
      <div className="space-y-6 sm:space-y-8">
        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
              {t("dashboard.title")}
            </h1>
            <p className="text-gray-500 mt-1 text-sm">
              {t("dashboard.subtitle")}
            </p>
          </div>

          <Can module={MODULES.PROJECT} action={ACTIONS.CREATE}>
            <Link
              to="/admin/projects/create-project"
              className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm transition-colors flex-shrink-0 self-start"
            >
              <MdOutlineAdd className="text-lg" />
              {t("buttons.addProject")}
            </Link>
          </Can>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 md:gap-6">
          {stats.map((stat) => (
            <StatCard key={stat.id} stat={stat} />
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Employee Distribution */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <MdOutlineBarChart className="text-cyan-500 text-xl" />
              <h3 className="text-sm font-bold text-gray-900">
                {t("distribution.title")}
              </h3>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <DonutChart
                fullTime={ft}
                contract={ct}
                totalLabel={String(dashboard?.total_employees ?? 0)}
                totalStaffLabel={t("distribution.totalStaff")}
              />
              <div className="flex-1 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-cyan-500 flex-shrink-0" />
                    <span className="text-sm text-gray-700">{t("distribution.fullTime")}</span>
                  </div>
                  <span className="text-sm font-bold text-gray-900">
                    {ftPct}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-indigo-400 flex-shrink-0" />
                    <span className="text-sm text-gray-700">{t("distribution.contract")}</span>
                  </div>
                  <span className="text-sm font-bold text-gray-900">
                    {ctPct}%
                  </span>
                </div>
                <p className="text-xs text-gray-400 pt-2 border-t border-gray-50">
                  {t("distribution.summary", { fullTime: ft, contract: ct })}
                </p>
              </div>
            </div>
          </div>

          {/* Today's attendance (live: /dashboard attendance_today) */}
          <AttendanceTodayCard data={dashboard?.attendance_today} />
        </div>

        {/* Assigned Projects Table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-100 gap-4">
            <h2 className="text-base sm:text-lg font-bold text-gray-900">
              {t("staffingProjects.assignedProjects")}
            </h2>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("staffingProjects.searchPlaceholder")}
                className="w-full sm:w-48 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all"
              />

              <div className="w-32">
                <CustomDropdown
                  options={[
                    { value: "ALL", label: t("staffingProjects.filters.allStatus") },
                    { value: "ACTIVE", label: t("staffingProjects.filters.active") },
                    { value: "COMPLETED", label: t("staffingProjects.filters.completed") },
                    { value: "INACTIVE", label: t("staffingProjects.filters.inactive") },
                  ]}
                  value={statusFilter}
                  onChange={(val) => {
                    const actualVal = typeof val === 'object' && val.target ? val.target.value : val;
                    setStatusFilter(actualVal);
                    setPage(1);
                  }}
                  placeholder={t("staffingProjects.filters.status")}
                />
              </div>

              <div className="flex-shrink-0 flex items-end">
                <button
                  onClick={handleClearFilters}
                  className="w-full sm:w-auto flex justify-center items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-2 rounded-lg font-medium text-sm transition-colors h-[42px]"
                >
                  <MdOutlineClear className="text-lg" />
                  {t("staffingProjects.filters.clearFilters")}
                </button>
              </div>
            </div>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {[
                    { key: "projectName", label: t("table.projectName") },
                    { key: "location", label: t("table.location") },
                    { key: "totalEmployees", label: t("table.totalEmployees") },
                    { key: "contractEmployees", label: t("table.contractEmployees") },
                    { key: "status", label: t("table.status") },
                    { key: "actions", label: t("table.actions") },
                  ].map((header) => (
                    <th
                      key={header.key}
                      className="px-6 py-3 text-start text-[10px] font-bold text-gray-400 uppercase tracking-wider"
                    >
                      {header.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-400">
                      {t("staffingProjects.loading")}
                    </td>
                  </tr>
                ) : paginatedList?.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-400">
                      {t("staffingProjects.empty")}
                    </td>
                  </tr>
                ) : (
                  paginatedList?.map((project) => (
                    <tr
                      key={project.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {project.photo_url ? (
                            <img src={project.photo_url} alt={project.project_name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                          ) : (
                            <div className="bg-cyan-50 text-cyan-700 w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold">
                              {projectInitial(project.project_name)}
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              {project.project_name}
                            </p>
                            <p className="text-xs text-gray-400">
                              {t("table.idPrefix")}{" "}
                              <Ltr>{project.project_code || project.id}</Ltr>
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          📍 {project.project_location || "—"}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-gray-900">
                          {t("table.members", { count: project.employee_count ?? 0 })}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-700">
                          {t("table.contractors", { count: project.contract_count ?? 0 })}
                        </p>
                      </td>
                      <td className="px-6 py-4">{renderStatus(project.status)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              navigate(String(project.id));
                            }}
                            title={t("tooltips.viewProject")}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <MdVisibility className="text-lg" />
                          </button>
                          <Can module={MODULES.PROJECT} action={ACTIONS.UPDATE}>
                            <button
                              onClick={() => setEditProject(project)}
                              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                              <MdEdit className="text-lg" />
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
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                {t("staffingProjects.loading")}
              </div>
            ) : paginatedList?.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                {t("staffingProjects.empty")}
              </div>
            ) : (
              paginatedList?.map((project) => (
                <div key={project.id} className="p-4 space-y-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {project.photo_url ? (
                        <img src={project.photo_url} alt={project.project_name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="bg-cyan-50 text-cyan-700 w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold">
                          {projectInitial(project.project_name)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {project.project_name}
                        </p>
                        <p className="text-xs text-gray-400">
                          <Ltr>{project.project_code || project.id}</Ltr>
                        </p>
                      </div>
                    </div>
                    {renderStatus(project.status)}
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
                    <div>
                      <p className="text-gray-400 font-medium mb-1">{t("card.location")}</p>
                      <p className="text-gray-700">
                        📍 {project.project_location || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 font-medium mb-1">{t("card.employees")}</p>
                      <p className="text-gray-900 font-semibold">
                        {t("table.members", { count: project.employee_count ?? 0 })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-500">
                      {t("table.contractors", { count: project.contract_count ?? 0 })}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          navigate(String(project.id));
                        }}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <MdVisibility className="text-base" />
                      </button>
                      <Can module={MODULES.PROJECT} action={ACTIONS.UPDATE}>
                        <button
                          onClick={() => setEditProject(project)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <MdEdit className="text-base" />
                        </button>
                      </Can>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination Footer */}
          {pagination && (
            <Pagination
              page={page}
              totalPages={Math.max(1, pagination.total_pages || 1)}
              total={pagination.total || 0}
              limit={limit}
              onPage={setPage}
              label={t("staffingProjects.paginationLabel")}
              activeClass="bg-cyan-600 text-white"
              containerClass="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-gray-100 bg-white"
            />
          )}
        </div>
      </div>

      {editProject && (
        <EditProjectModal
          project={editProject}
          onClose={() => setEditProject(null)}
        />
      )}
    </>
  );
}