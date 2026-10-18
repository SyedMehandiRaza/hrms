import { useState } from "react";
import {
  MdPeople,
  MdCheckCircle,
  MdWarningAmber,
  MdVisibility,
  MdEdit,
  MdOutlineBarChart,
  MdOutlineAdd,
} from "react-icons/md";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { HRMS_PROJECTS, projectDashboard, projectRowFrom } from "../../data/groupC";
import Ltr from "../../components/Ltr";
import ProjectDetail from "./ProjectDetail";
import AssignedProjects from "./AssignedProjects";
import WorkforceCard from "./WorkforceCard";
import Can from "../../components/Can";
import EditProjectModal from "../../components/EditProjectModal";
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
  const { t } = useTranslation("projects");
  // Static build: projects live in local state; the selection is local too.
  const location = useLocation();
  const [list, setList] = useState(() => {
    const created = location.state?.createdProject;
    return created ? [projectRowFrom(created, HRMS_PROJECTS), ...HRMS_PROJECTS] : HRMS_PROJECTS;
  });
  const dashboard = projectDashboard(list);
  const [selectedProjectId, setSelectedProject] = useState("ALL");
  const selection = selectedProjectId || "ALL";

  const [editProject, setEditProject] = useState(null);
  const [tab, setTab] = useState("mine"); // "mine" = my own projects | "assigned" = projects assigned to me

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

  const latest = (list || []).slice(0, 3);
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

  if (selection !== "ALL") {
    return (
      <ProjectDetail
        projectId={selection}
        onBack={() => setSelectedProject("ALL")}
      />
    );
  }

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

          {/* Tabs: my own projects vs projects another company assigned to me */}
          <div className="flex gap-2 border-b border-gray-200">
            {[
              { key: "mine", label: t("tabs.mine") },
              { key: "assigned", label: t("tabs.assigned") },
            ].map((tb) => (
              <button
                key={tb.key}
                onClick={() => setTab(tb.key)}
                className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                  tab === tb.key
                    ? "border-cyan-600 text-cyan-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tb.label}
              </button>
            ))}
          </div>

          {tab === "assigned" ? (
            <AssignedProjects />
          ) : (
          <>
          <WorkforceCard />

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

          {/* Latest Project Detail Table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-100">
              <h2 className="text-base sm:text-lg font-bold text-gray-900">
                {t("latest.title")}
              </h2>
              {(list || []).length > 3 && (
                <Link
                  to="/admin/projects/all"
                  className="text-sm font-medium text-cyan-600 hover:text-cyan-700 transition-colors"
                >
                  {t("buttons.viewAll", "View All")}
                </Link>
              )}
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
                  {latest.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-12 text-center text-sm text-gray-400"
                      >
                        {t("latest.empty")}
                      </td>
                    </tr>
                  ) : (
                    latest.map((project) => (
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
                              onClick={() => setSelectedProject(String(project.id))}
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

            {/* Mobile/Tablet Cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {latest.length === 0 ? (
                <div className="px-4 py-12 text-center text-sm text-gray-400">
                  {t("latest.empty")}
                </div>
              ) : (
                latest.map((project) => (
                  <div key={project.id} className="p-4 sm:p-5 hover:bg-gray-50 transition-colors">
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
                          onClick={() => setSelectedProject(String(project.id))}
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
          </div>
          </>
          )}
        </div>

      {editProject && (
        <EditProjectModal
          project={editProject}
          onClose={() => setEditProject(null)}
          onSaved={(saved) => setList((prev) => prev.map((p) => (p.id === saved.id ? saved : p)))}
        />
      )}
    </>
  );
}