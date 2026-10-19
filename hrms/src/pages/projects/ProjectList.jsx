import { useEffect, useState } from "react";
import useFiscalYear from "../../hooks/useFiscalYear";
import useFyResetState from "../../hooks/useFyResetState";
import Pagination from "../../components/Pagination";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  MdOutlineAdd,
  MdVisibility,
  MdEdit,
  MdSearch,
  MdChevronRight as BreadcrumbArrow,
  MdOutlineClear,
} from "react-icons/md";

import { HRMS_PROJECTS } from "../../data/groupC";
import { matches, paginate } from "../../data/common";
import Ltr from "../../components/Ltr";
import Can from "../../components/Can";
import EditProjectModal from "../../components/EditProjectModal";
import CustomDropdown from "../../components/CustomDropdown";
import ProjectDetail from "./ProjectDetail";
import { MODULES, ACTIONS } from "../../constants/permissions";

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

export default function ProjectList() {
  const { t } = useTranslation("projects");
  // Static build: projects + the open-project selection live in local state.
  const [projects, setProjects] = useState(HRMS_PROJECTS);
  const [selectedProjectId, setSelectedProject] = useState("ALL");
  const selection = selectedProjectId || "ALL";

  const [editProject, setEditProject] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Projects");

  // Pagination (back to page 1 when the header year changes)
  const fyVersion = useFiscalYear().version;
  const [currentPage, setCurrentPage] = useFyResetState(1, fyVersion);
  const itemsPerPage = 10;

  // Values stay English (they drive STATUS_TO_ENUM); only the labels translate.
  const statusOptions = ["All Projects", "Active", "Completed", "On Hold"];
  const STATUS_OPTION_LABEL_KEY = {
    "All Projects": "list.allProjects",
    Active: "status.active",
    Completed: "status.completed",
    "On Hold": "status.onHold",
  };
  const STATUS_TO_ENUM = {
    Active: "ACTIVE",
    Completed: "COMPLETED",
    "On Hold": "INACTIVE",
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setCurrentPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Client-side pagination + filters over the static rows.
  const pageData = paginate(
    projects
      .filter((p) => matches(p, debouncedSearch, ["project_name", "project_code", "project_location"]))
      .filter((p) => statusFilter === "All Projects" || p.status === STATUS_TO_ENUM[statusFilter]),
    currentPage,
    itemsPerPage,
  );
  const currentItems = pageData.rows;
  const totalPages = pageData.totalPages;
  const totalItems = pageData.total;

  const handleClearFilters = () => {
    setSearchQuery("");
    setStatusFilter("All Projects");
    setCurrentPage(1);
  };

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
        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-xs font-semibold text-gray-400 tracking-wider">
          <Link
            to="/admin/projects"
            className="hover:text-gray-600 transition-colors uppercase"
          >
            {t("detail.breadcrumbProjects")}
          </Link>
          <BreadcrumbArrow className="text-sm rtl:rotate-180" />
          <span className="text-gray-600 uppercase">{t("list.breadcrumbAll")}</span>
        </div>

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
              {t("list.title")}
            </h1>
            <p className="text-gray-500 mt-1 text-sm">
              {t("list.subtitle")}
            </p>
          </div>

          <Can module={MODULES.PROJECT} action={ACTIONS.CREATE}>
            <Link
              to="/admin/projects/create-project"
              className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm transition-colors flex-shrink-0 self-start shadow-sm"
            >
              <MdOutlineAdd className="text-lg" />
              {t("breadcrumb.createProject")}
            </Link>
          </Can>
        </div>

        {/* Filters Row */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1.5">
                {t("list.searchLabel")}
              </label>
              <div className="relative">
                <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xl" />
                <input
                  type="text"
                  placeholder={t("list.searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition h-[42px]"
                />
              </div>
            </div>
            <div className="w-full sm:w-48">
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1.5">
                {t("table.status")}
              </label>
              <div className="relative">
                <CustomDropdown
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  options={statusOptions.map((opt) => ({
                    label: t(STATUS_OPTION_LABEL_KEY[opt]),
                    value: opt,
                  }))}
                />
              </div>
            </div>
            {/* Clear Filters */}
            <div className="flex-shrink-0 w-full sm:w-auto">
              <button
                onClick={handleClearFilters}
                className="w-full sm:w-auto flex justify-center items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-2 rounded-lg font-medium text-sm transition-colors h-[42px]"
              >
                <MdOutlineClear className="text-lg" />
                {t("buttons.clearFilters")}
              </button>
            </div>
          </div>
        </div>

        {/* Table Area */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-6 py-4 text-start text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    {t("table.projectName")}
                  </th>
                  <th className="px-6 py-4 text-start text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    {t("table.location")}
                  </th>
                  <th className="px-6 py-4 text-start text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    {t("table.totalEmployees")}
                  </th>
                  <th className="px-6 py-4 text-start text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    {t("table.contractEmployees")}
                  </th>
                  <th className="px-6 py-4 text-start text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    {t("table.status")}
                  </th>
                  <th className="px-6 py-4 text-start text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    {t("table.actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {currentItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-sm text-gray-400"
                    >
                      {t("list.empty")}
                    </td>
                  </tr>
                ) : (
                  currentItems.map((project) => (
                    <tr
                      key={project.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {project.photo_url ? (
                            <img
                              src={project.photo_url}
                              alt={t("detail.imageAlt")}
                              className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="bg-cyan-50 text-cyan-700 w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold">
                              {projectInitial(project.project_name)}
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              {project.project_name}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {t("table.idPrefix")}{" "}
                              <Ltr>{project.project_code || project.id}</Ltr>
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <span className="text-gray-400">📍</span>{" "}
                          {project.project_location || "—"}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {/* Real members: up to 3 of the people assigned
                              (photo, else initials), then the total. */}
                          {(project.members_preview || []).length > 0 && (
                            <div className="flex -space-x-2">
                              {project.members_preview.map((m) =>
                                m.profile_url ? (
                                  <img
                                    key={m.id}
                                    src={m.profile_url}
                                    alt={m.full_name}
                                    title={m.full_name}
                                    className="w-6 h-6 rounded-full object-cover border-2 border-white"
                                  />
                                ) : (
                                  <div
                                    key={m.id}
                                    title={m.full_name}
                                    className="w-6 h-6 rounded-full bg-cyan-600 text-white text-[9px] font-bold flex items-center justify-center border-2 border-white"
                                  >
                                    {String(m.full_name || "?")
                                      .trim()
                                      .split(/\s+/)
                                      .slice(0, 2)
                                      .map((w) => w[0]?.toUpperCase())
                                      .join("")}
                                  </div>
                                ),
                              )}
                            </div>
                          )}
                          <p className="text-sm font-medium text-gray-900">
                            {t("table.members", { count: project.employee_count ?? 0 })}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-700">
                          {t("table.contractors", { count: project.contract_count ?? 0 })}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        {renderStatus(project.status)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              setSelectedProject(String(project.id))
                            }
                            className="p-2 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors"
                          >
                            <MdVisibility className="text-lg" />
                          </button>
                          <Can module={MODULES.PROJECT} action={ACTIONS.UPDATE}>
                            <button
                              onClick={() => setEditProject(project)}
                              className="p-2 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors"
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
            {currentItems.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-gray-400">
                {t("list.empty")}
              </div>
            ) : (
              currentItems.map((project) => (
                <div
                  key={project.id}
                  className="p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {project.photo_url ? (
                        <img
                          src={project.photo_url}
                          alt={t("detail.imageAlt")}
                          className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                        />
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
                      <p className="text-gray-400 font-medium mb-1">{t("table.location")}</p>
                      <p className="text-gray-700">
                        📍 {project.project_location || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 font-medium mb-1">
                        {t("list.employeesLabel")}
                      </p>
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
                        onClick={() =>
                          setSelectedProject(String(project.id))
                        }
                        className="p-1.5 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors"
                      >
                        <MdVisibility className="text-base" />
                      </button>
                      <Can module={MODULES.PROJECT} action={ACTIONS.UPDATE}>
                        <button
                          onClick={() => setEditProject(project)}
                          className="p-1.5 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors"
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
          <Pagination
            page={currentPage}
            totalPages={totalPages}
            total={totalItems}
            limit={itemsPerPage}
            onPage={setCurrentPage}
            label={t("list.paginationLabel")}
            activeClass="bg-cyan-50 text-cyan-600 border border-cyan-100"
            containerClass="border-t border-gray-100 px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white"
          />
        </div>
      </div>

      {editProject && (
        <EditProjectModal
          project={editProject}
          onClose={() => setEditProject(null)}
          onSaved={(saved) => setProjects((prev) => prev.map((p) => (p.id === saved.id ? saved : p)))}
        />
      )}
    </>
  );
}
