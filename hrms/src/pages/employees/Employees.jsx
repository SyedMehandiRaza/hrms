import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  MdOutlineAdd,
  MdOutlineSearch,
  MdOutlineClear
} from "react-icons/md";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { TableLoader } from "../../components/Loader";
import Can from "../../components/Can";
import Ltr from "../../components/Ltr";
import { MODULES, ACTIONS } from "../../constants/permissions";
import CustomDropdown from "../../components/CustomDropdown";
import { useCan } from "../../hooks/usePermission";
import EmployeeDrafts from "./EmployeeDrafts";
import Pagination from "../../components/Pagination";
import { EmploymentStatusBadge } from "../../components/exits/ExitBadges";
import { ScreenError } from "../../components/ScreenState";
import useApiQuery from "../../hooks/useApiQuery";
import { bulkEmployeeStatus, listEmployeeDrafts, listEmployees, listRoles } from "../../api/employees";
import { listProjects } from "../../api/projects";
import { toastApiError } from "../../utils/apiError";

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

// API employee (GET /employees) → row shape the existing UI already knows how to render.
const decorate = (apiEmp, idx) => ({
  raw: apiEmp,
  id: apiEmp.id,
  empCode: apiEmp.employee_code,
  // The ID number (Iqama / national ID / passport, D45).
  iqamaNumber: apiEmp.country_emp_id || "—",
  name: apiEmp.name || "—",
  email: apiEmp.email || "—",
  avatar: null,
  initials: getInitials(apiEmp.name),
  color: AVATAR_COLORS[idx % AVATAR_COLORS.length],
  role: apiEmp.role?.name || "—",
  type: apiEmp.employment_type === "CONTRACT" ? "CONTRACT" : "FULL-TIME",
  project: apiEmp.main_project?.name || "NA",
  staffing: apiEmp.staffing_company?.name || "NA",
  employmentStatus: apiEmp.employment_status || "ACTIVE",
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
  const { t: tExits } = useTranslation("exits");
  const navigate = useNavigate();
  const { data: projectData } = useApiQuery(() => listProjects({ limit: 100 }).catch(() => null), []);
  const projects = projectData?.items || [];

  // Filters (values map directly to the backend query params).
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [projectId, setProjectId] = useState(""); // project_id
  const [type, setType] = useState(""); // employment_type
  const [roleId, setRoleId] = useState(""); // role_id
  const [status, setStatus] = useState(""); // ACTIVE | IN_NOTICE | EXITED
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState(""); // "" | full_name | employment_type
  const [sortOrder, setSortOrder] = useState("asc"); // asc | desc

  const { data: roleData } = useApiQuery(() => listRoles().catch(() => null), []);
  const roles = roleData || [];

  // Employees | Drafts tabs (?tab=drafts). Drafts belong to the Add Employee
  // flow, so only users who can create employees see them.
  const can = useCan();
  const canCreate = can(MODULES.EMPLOYEE, ACTIONS.CREATE);
  const canUpdate = can(MODULES.EMPLOYEE, ACTIONS.UPDATE);
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = canCreate && searchParams.get("tab") === "drafts" ? "drafts" : "employees";
  const setTab = (next) =>
    setSearchParams(next === "drafts" ? { tab: "drafts" } : {}, { replace: true });
  const drafts = useApiQuery(() => (canCreate ? listEmployeeDrafts({ limit: 1 }).catch(() => null) : Promise.resolve(null)), [canCreate]);
  const draftCount = drafts.data?.total ?? 0;
  const onDraftCountChange = drafts.reload;

  // Debounce the search box; reset to page 1 when the term settles.
  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(id);
  }, [searchInput]);

  // Filters and paging by the server (by Employee ID); the column sort orders the page.
  const { data, loading, error, reload } = useApiQuery(
    () => listEmployees({ page, limit: LIMIT, search: debouncedSearch, status, employmentType: type, projectId, roleId }),
    [page, debouncedSearch, status, type, projectId, roleId],
  );
  const list = useMemo(() => {
    const items = data?.items || [];
    if (!sortBy) return items;
    const key = sortBy === "full_name" ? "name" : sortBy;
    const dir = sortOrder === "asc" ? 1 : -1;
    return [...items].sort((a, b) => String(a[key] || "").localeCompare(String(b[key] || "")) * dir);
  }, [data, sortBy, sortOrder]);
  const pagination = { total: data?.total ?? 0, total_pages: Math.max(1, Math.ceil((data?.total ?? 0) / LIMIT)) };

  // Bulk activate / deactivate (D56): all or nothing; an exited employee fails the batch.
  const [selected, setSelected] = useState([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const pageIds = list.map((e) => e.id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));
  const toggleOne = (id) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleAll = () =>
    setSelected((prev) => (allOnPage ? prev.filter((id) => !pageIds.includes(id)) : [...new Set([...prev, ...pageIds])]));
  const runBulk = async (nextStatus) => {
    if (!selected.length) return;
    setBulkBusy(true);
    try {
      await bulkEmployeeStatus(selected, nextStatus);
      toast.success(nextStatus === "ACTIVE" ? t("list.bulkActivated") : t("list.bulkDeactivated"));
      setSelected([]);
      reload();
    } catch (err) {
      // e.g. 409 EMPLOYEE_EXITED "This employee has exited. Use Rehire." — nobody changed.
      toastApiError(err);
    }
    setBulkBusy(false);
  };

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

  const total = pagination?.total ?? rows.length;
  const totalPages = Math.max(1, pagination?.total_pages ?? 1);


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

      {/* ── Tabs ── */}
      {canCreate && (
        <div className="flex items-center gap-1 border-b border-gray-200">
          {[
            { key: "employees", label: t("drafts.tabs.employees") },
            { key: "drafts", label: t("drafts.tabs.drafts"), count: draftCount },
          ].map((tb) => (
            <button
              key={tb.key}
              type="button"
              onClick={() => setTab(tb.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${tab === tb.key
                ? "border-cyan-600 text-cyan-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
            >
              {tb.label}
              {tb.count > 0 && (
                <span className="min-w-5 h-5 px-1.5 inline-flex items-center justify-center rounded-full text-[11px] font-bold bg-amber-100 text-amber-700">
                  {tb.count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {tab === "drafts" ? (
        <EmployeeDrafts onCountChange={onDraftCountChange} />
      ) : (
      <>
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
                  ...projects.map((p) => ({ label: p.name, value: p.id }))
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
                  ...["ACTIVE", "IN_NOTICE", "EXITED"].map((v) => ({ label: tExits(`employmentStatus.${v}`), value: v })),
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
        {canUpdate && selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-100 bg-cyan-50/40">
            <span className="text-sm font-semibold text-gray-700">{t("list.bulkActions")}</span>
            <span className="text-xs text-gray-500"><Ltr>{selected.length}</Ltr></span>
            <button
              type="button"
              onClick={() => runBulk("ACTIVE")}
              disabled={bulkBusy}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-green-700 bg-green-50 border border-green-200 hover:bg-green-100 disabled:opacity-50"
            >
              {t("list.activate")}
            </button>
            <button
              type="button"
              onClick={() => runBulk("SUSPENDED")}
              disabled={bulkBusy}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 disabled:opacity-50"
            >
              {t("list.deactivate")}
            </button>
          </div>
        )}
        {/* Responsive Table */}
        <div className="w-full overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {canUpdate && (
                  <th className="px-4 py-3 w-10">
                    <input type="checkbox" checked={allOnPage} onChange={toggleAll} className="w-4 h-4 accent-cyan-600 cursor-pointer" aria-label={t("list.bulkActions")} />
                  </th>
                )}
                {[
                  { labelKey: "list.table.sn" },
                  { labelKey: "list.table.employeeId" },
                  { labelKey: "list.table.iqamaNumber" },
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
              {loading ? (
                <TableLoader colSpan={canUpdate ? 9 : 8} label={t("list.loading")} />
              ) : error ? (
                <tr>
                  <td colSpan={canUpdate ? 9 : 8} className="px-4 py-6">
                    <ScreenError error={error} onRetry={reload} />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={canUpdate ? 9 : 8}
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
                    {canUpdate && (
                      <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.includes(emp.id)}
                          onChange={() => toggleOne(emp.id)}
                          className="w-4 h-4 accent-cyan-600 cursor-pointer"
                          aria-label={emp.name}
                        />
                      </td>
                    )}
                    <td className="px-4 py-4 text-sm text-gray-500 whitespace-nowrap">
                      {(page - 1) * LIMIT + index + 1}
                    </td>

                    <td className="px-4 py-4 text-sm text-gray-500 font-mono whitespace-nowrap">
                      <Ltr>{emp.empCode}</Ltr>
                    </td>

                    <td className="px-4 py-4 text-sm text-gray-500 font-mono whitespace-nowrap">
                      <Ltr>{emp.iqamaNumber}</Ltr>
                    </td>

                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <Avatar emp={emp} />

                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-gray-900">
                              {emp?.name
                                ? emp.name.length > 20
                                  ? `${emp.name.substring(0, 20)}...`
                                  : emp.name
                                : "—"}
                            </p>
                            <EmploymentStatusBadge status={emp.employmentStatus} />
                          </div>

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
          limit={LIMIT}
          total={total}
          totalPages={totalPages}
          onPage={setPage}
        />
      </div>
      </>
      )}
    </div>
  );
}

export default Employees;
