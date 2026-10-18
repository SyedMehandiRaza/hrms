import { useEffect, useMemo, useState } from "react";
import Pagination from "../../components/Pagination";
import {
  MdOutlineAdd,
  MdOutlineSearch,
  MdOutlineClear
} from "react-icons/md";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { TableLoader } from "../../components/Loader";
import Can from "../../components/Can";
import Ltr from "../../components/Ltr";
import { MODULES, ACTIONS } from "../../constants/permissions";
import { STAFFING_WORKERS, STAFFING_PROJECTS, STAFFING_ROLES } from "../../data/groupH";
import { matches, paginate } from "../../data/common";
import CustomDropdown from "../../components/CustomDropdown";

const TYPE_STYLES = {
  "FULL-TIME": "text-cyan-700 bg-cyan-50 border-cyan-200",
  CONTRACT: "text-gray-600 bg-gray-100 border-gray-200",
};

const LIMIT = 10;

const AVATAR_COLORS = [
  "bg-cyan-500",
  "bg-blue-500",
  "bg-violet-500",
  "bg-rose-400",
  "bg-amber-500",
  "bg-teal-500",
];

const getInitials = (name) => {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// API employee → row shape the existing UI already knows how to render.
const decorate = (apiEmp, idx) => ({
  raw: apiEmp,
  id: apiEmp.id,
  empCode: apiEmp.country_emp_id || `EMP-${apiEmp.id}`,
  name: apiEmp.full_name || "—",
  email: apiEmp.email || "—",
  avatar: apiEmp.profile_url || null,
  initials: getInitials(apiEmp.full_name),
  color: AVATAR_COLORS[idx % AVATAR_COLORS.length],
  role: apiEmp.roles?.[0]?.name || "—",
  type: apiEmp.employment_type === "CONTRACT" ? "CONTRACT" : "FULL-TIME",
  project: apiEmp.projects?.[0]?.project_name || "NA",
  staffing: apiEmp.staffingCompany?.name || "NA",
  status: apiEmp.user_status === "ACTIVE" ? "Active" : "Inactive",
});

// ── Avatar Cell ───────────────────────────────────────────────────────────────

const Avatar = ({ emp }) =>
  emp.avatar ? (
    <img
      src={emp.avatar}
      alt={emp.name}
      className="w-9 h-9 rounded object-cover flex-shrink-0"
    />
  ) : (
    <div
      className={`w-9 h-9 rounded ${emp.color} text-white text-xs font-bold flex items-center justify-center flex-shrink-0`}
    >
      {emp.initials}
    </div>
  );

function Employees() {
  const { t } = useTranslation("employees");
  const navigate = useNavigate();
  const loading = false;
  const projects = STAFFING_PROJECTS;

  // Filters (values map directly to the backend query params).
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [projectId, setProjectId] = useState(""); // project_id
  const [type, setType] = useState(""); // employment_type
  const [roleId, setRoleId] = useState(""); // role_id
  const [status, setStatus] = useState(""); // ACTIVE | INACTIVE
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState(""); // "" | full_name | employment_type
  const [sortOrder, setSortOrder] = useState("asc"); // asc | desc

  const roles = STAFFING_ROLES;

  // Debounce the search box; reset to page 1 when the term settles.
  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(id);
  }, [searchInput]);

  // Filter / sort / page the static roster client-side.
  const filtered = useMemo(() => {
    const out = STAFFING_WORKERS.filter(
      (e) =>
        matches(e, debouncedSearch, ["full_name", "email", "country_emp_id"]) &&
        (!projectId || e.projects?.some((p) => String(p.id) === String(projectId))) &&
        (!type || e.employment_type === type) &&
        (!roleId || e.roles?.some((r) => String(r.id) === String(roleId))) &&
        (!status || e.user_status === status),
    );
    if (!sortBy) return out;
    return [...out].sort((a, b) => {
      const cmp = String(a[sortBy] ?? "").localeCompare(String(b[sortBy] ?? ""));
      return sortOrder === "asc" ? cmp : -cmp;
    });
  }, [debouncedSearch, projectId, type, roleId, status, sortBy, sortOrder]);
  const { rows: list, total, totalPages } = paginate(filtered, page, LIMIT);

  // Toggle server-side sort on a column (asc → desc → asc); resets to page 1.
  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
    setPage(1);
  };

  const handleClearFilters = () => {
    setSearchInput("");
    setDebouncedSearch("");
    setProjectId("");
    setType("");
    setRoleId("");
    setStatus("");
    setSortBy("");
    setSortOrder("asc");
    setPage(1);
  };

  const rows = useMemo(() => list.map((e, i) => decorate(e, i)), [list]);


  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
            {t("list.title")}
          </h1>

          <p className="text-gray-500 mt-1 text-sm">{t("list.subtitle")}</p>
        </div>

        <Can module={MODULES.EMPLOYEE} action={ACTIONS.CREATE}>
          <Link
            to="/admin/employees/add-employee"
            className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm transition-colors flex-shrink-0 self-start"
          >
            <MdOutlineAdd className="text-lg" />
            {t("buttons.addEmployee")}
          </Link>
        </Can>
      </div>

      {/* ── Filters Bar ── */}
      <div className="bg-white border border-gray-200 rounded-xl px-4 py-4">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Project (dynamic) */}
          <div className="flex flex-col gap-1 min-w-[150px]">
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              {t("list.filters.project")}
            </label>

            <div className="relative">
              <CustomDropdown
                value={projectId}
                onChange={(e) => { setProjectId(e.target.value); setPage(1); }}
                options={[
                  { label: t("list.filters.allProjects"), value: "" },
                  ...projects.map((p) => ({ label: p.project_name, value: p.id }))
                ]}
              />
            </div>
          </div>

          {/* Type */}
          <div className="flex flex-col gap-1 min-w-[120px]">
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              {t("list.filters.type")}
            </label>

            <div className="relative">
              <CustomDropdown
                value={type}
                onChange={(e) => { setType(e.target.value); setPage(1); }}
                options={[
                  { label: t("list.filters.allTypes"), value: "" },
                  { label: t("type.fullTime"), value: "FULL_TIME" },
                  { label: t("type.contract"), value: "CONTRACT" }
                ]}
              />
            </div>
          </div>

          {/* Role (dynamic) */}
          <div className="flex flex-col gap-1 min-w-[140px]">
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              {t("list.filters.role")}
            </label>

            <div className="relative">
              <CustomDropdown
                value={roleId}
                onChange={(e) => { setRoleId(e.target.value); setPage(1); }}
                options={[
                  { label: t("list.filters.allRoles"), value: "" },
                  ...roles.map((r) => ({ label: r.name, value: r.id }))
                ]}
              />
            </div>
          </div>

          {/* Status */}
          <div className="flex flex-col gap-1 min-w-[120px]">
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              {t("list.filters.status")}
            </label>

            <div className="relative">
              <CustomDropdown
                value={status}
                onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                options={[
                  { label: t("list.filters.allStatus"), value: "" },
                  { label: t("status.active"), value: "ACTIVE" },
                  { label: t("status.inactive"), value: "INACTIVE" }
                ]}
              />
            </div>
          </div>

          {/* Search */}
          <div className="flex-1 min-w-[180px] flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider opacity-0 select-none">
              {t("list.filters.search")}
            </label>

            <div className="relative">
              <MdOutlineSearch className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />

              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t("list.filters.searchPlaceholder")}
                className="w-full ps-9 pe-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition h-[42px]"
              />
            </div>
          </div>

          {/* Clear Filters */}
          <div className="flex-shrink-0 flex items-end">
            <button
              onClick={handleClearFilters}
              className="w-full sm:w-auto flex justify-center items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-2 rounded-lg font-medium text-sm transition-colors h-[42px]"
            >
              <MdOutlineClear className="text-lg" />
              {t("list.filters.clearFilters")}
            </button>
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* Responsive Table */}
        <div className="w-full overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {[
                  { labelKey: "list.table.sn" },
                  { labelKey: "list.table.employeeId" },
                  { labelKey: "list.table.name", sort: "full_name" },
                  { labelKey: "list.table.role" },
                  { labelKey: "list.table.type", sort: "employment_type" },
                  { labelKey: "list.table.project" },
                  { labelKey: "list.table.staffingCompany" },
                ].map((c) => (
                  <th
                    key={c.labelKey}
                    className="text-start px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap"
                  >
                    {c.sort ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(c.sort)}
                        className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-gray-600 transition-colors"
                      >
                        {t(c.labelKey)}
                        <span className="text-[10px] leading-none">
                          {sortBy === c.sort
                            ? sortOrder === "asc"
                              ? "▲"
                              : "▼"
                            : "↕"}
                        </span>
                      </button>
                    ) : (
                      t(c.labelKey)
                    )}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-50">
              {loading && rows.length === 0 ? (
                <TableLoader colSpan={7} label={t("list.loading")} />
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-14 text-center text-sm text-gray-400"
                  >
                    {t("list.empty")}
                  </td>
                </tr>
              ) : (
                rows.map((emp, index) => (
                  <tr
                    key={emp.id}
                    onClick={() => navigate(`/admin/employees/${emp.id}`)}
                    className="cursor-pointer transition-colors hover:bg-gray-50"
                  >
                    <td className="px-4 py-4 text-sm text-gray-500 whitespace-nowrap">
                      {(page - 1) * LIMIT + index + 1}
                    </td>

                    <td className="px-4 py-4 text-sm text-gray-500 font-mono whitespace-nowrap">
                      <Ltr>{emp.empCode}</Ltr>
                    </td>

                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <Avatar emp={emp} />

                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {emp?.name
                              ? emp.name.length > 20
                                ? `${emp.name.substring(0, 20)}...`
                                : emp.name
                              : "—"}
                          </p>

                          <p className="text-xs text-gray-400">
                            <Ltr>{emp.email}</Ltr>
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4 text-sm text-gray-700 whitespace-nowrap">
                      {emp.role}
                    </td>

                    <td className="px-4 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center whitespace-nowrap px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${TYPE_STYLES[emp.type] || TYPE_STYLES["FULL-TIME"]}`}
                      >
                        {emp.type === "CONTRACT" ? t("list.typeBadge.contract") : emp.type === "FULL-TIME" ? t("list.typeBadge.fullTime") : emp.type}
                      </span>
                    </td>

                    <td className="px-4 py-4 text-sm text-gray-700 whitespace-nowrap">
                      {emp.project}
                    </td>

                    <td className="px-4 py-4 text-sm text-gray-500 whitespace-nowrap">
                      {emp.staffing}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>



        {/* Footer Pagination */}
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          limit={LIMIT}
          onPage={setPage}
          label={t("list.entries")}
          activeClass="bg-cyan-600 text-white"
          containerClass="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-4 border-t border-gray-100"
        />
      </div>
    </div>
  );
}

export default Employees;
