import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  MdOutlineLocationOn,
  MdOutlineEdit,
  MdOutlineTrendingUp,
  MdMailOutline,
  MdOutlineSecurity,
  MdOutlineChevronRight,
  MdOutlineSearch,
  MdOutlineBusiness,
  MdOutlinePhone,
  MdOutlineGroups,
  MdOutlineClear,
} from "react-icons/md";
import Ltr from "../../components/Ltr";
import Can from "../../components/Can";
import { MODULES, ACTIONS } from "../../constants/permissions";
import Pagination from "../../components/Pagination";
import { TableLoader } from "../../components/Loader";
import CustomDropdown from "../../components/CustomDropdown";
import StaffingCompanyModal from "../../components/StaffingCompanyModal";
import { staffingCompanyById, staffingEmployeesFor, HRMS_PROJECTS } from "../../data/groupC";
import { matches, paginate } from "../../data/common";

const TYPE_STYLES = {
  "FULL-TIME": "text-cyan-700 bg-cyan-50 border-cyan-200",
  CONTRACT: "text-gray-600 bg-gray-100 border-gray-200",
};

const LIMIT = 10;

// Display-only translation keys for the decorated status/type values.
const EMP_STATUS_KEYS = {
  Active: "details.empStatus.active",
  Inactive: "details.empStatus.inactive",
  Unknown: "details.empStatus.unknown",
};
const EMP_TYPE_KEYS = {
  "FULL-TIME": "details.empType.fullTime",
  CONTRACT: "details.empType.contract",
};

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

const decorate = (apiEmp, idx) => {
  const currentStatus = apiEmp.status || apiEmp.user_status;

  return {
    raw: apiEmp,
    id: apiEmp.id,
    empCode: apiEmp.country_emp_id || `EMP-${apiEmp.id}`,
    name: apiEmp.full_name || "—",
    email: apiEmp.email || "—",
    avatar: apiEmp.profile_url || null,
    initials: getInitials(apiEmp.full_name),
    color: AVATAR_COLORS[idx % AVATAR_COLORS.length],
    role: apiEmp.role || apiEmp.roles?.[0]?.name || "—",
    type: apiEmp.employment_type === "CONTRACT" ? "CONTRACT" : "FULL-TIME",
    project: apiEmp.project || apiEmp.projects?.[0]?.project_name || "NA",
    staffing: apiEmp.staffing_company || apiEmp.staffingCompany?.name || "NA",
    status:
      currentStatus === "ACTIVE"
        ? "Active"
        : currentStatus === "INACTIVE"
          ? "Inactive"
          : currentStatus
            ? currentStatus.charAt(0).toUpperCase() +
              currentStatus.slice(1).toLowerCase()
            : "Unknown",
  };
};

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

function StatCard({ icon, title, value, badge, iconBg, iconColor }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex justify-between items-start mb-4">
        <div
          className={`w-9 h-9 rounded-lg ${iconBg} ${iconColor} flex items-center justify-center text-lg`}
        >
          {icon}
        </div>
        {badge && (
          <span className="text-xs bg-green-50 text-green-600 px-2.5 py-0.5 rounded-full font-medium inline-flex items-center justify-center">
            {badge}
          </span>
        )}
      </div>
      <p className="text-xs text-gray-400 font-semibold tracking-wider">
        {title}
      </p>
      <h3 className="text-3xl font-bold text-gray-900 mt-2">{value}</h3>
    </div>
  );
}

function StaffingCompanyDetails() {
  const { t } = useTranslation(["staffing", "employees"]);
  const { id } = useParams();
  const navigate = useNavigate();
  // Static build: the company + its employees come from the static data.
  const [company, setCompany] = useState(() => staffingCompanyById(id));
  const summary = company?.summary;
  const loadingCompany = false;
  const projects = HRMS_PROJECTS;
  const [modal, setModal] = useState(null); // { mode, company }

  // Filters
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [type, setType] = useState(""); // employment_type
  const [status, setStatus] = useState(""); // ACTIVE | INACTIVE
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("");
  const [sortOrder, setSortOrder] = useState("asc");

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Employees for this staffing company — filtered, sorted and paged client-side.
  const loadingEmployees = false;
  const allEmployees = useMemo(() => staffingEmployeesFor(company?.id), [company?.id]);
  const filteredEmployees = allEmployees
    .filter((e) => matches(e, debouncedSearch, ["full_name", "country_emp_id", "email"]))
    .filter((e) => !type || e.employment_type === type)
    .filter((e) => !status || e.status === status);
  if (sortBy) {
    filteredEmployees.sort((a, b) => {
      const cmp = String(a[sortBy] ?? "").localeCompare(String(b[sortBy] ?? ""));
      return sortOrder === "asc" ? cmp : -cmp;
    });
  }
  const pageData = paginate(filteredEmployees, page, LIMIT);
  const list = pageData.rows;
  const pagination = { total: pageData.total, total_pages: pageData.totalPages };

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
    setType("");
    setStatus("");
    setSortBy("");
    setSortOrder("asc");
    setPage(1);
  };

  const rows = useMemo(() => list.map((e, i) => decorate(e, i)), [list]);
  const total = pagination?.total ?? 0;
  const totalPages = Math.max(1, pagination?.total_pages ?? 1);

  const assignedProjects = useMemo(() => {
    if (!company?.project_ids || !projects.length) return [];
    return projects.filter((p) => company.project_ids.includes(p.id));
  }, [company?.project_ids, projects]);

  if (loadingCompany) {
    return (
      <div className="flex justify-center items-center h-64">
        <span className="text-gray-400">{t("details.loadingDetails")}</span>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex justify-center items-center h-64">
        <span className="text-red-400">{t("details.notFound")}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wider flex-wrap">
        <Link
          to="/admin/staffing-companies"
          className="hover:text-cyan-600 transition-colors"
        >
          {t("details.breadcrumbManagement", "STAFFING COMPANIES")}
        </Link>
        <MdOutlineChevronRight className="text-sm rtl:rotate-180" />
        <span className="text-cyan-600">
          <Ltr>{company.code}</Ltr>
        </span>
      </div>

      {/* HEADER AND ACTION BUTTON */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-extrabold text-slate-800">
            {company.name}
          </h1>
          <div
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 border ${
              company.status === "ACTIVE"
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-red-50 text-red-700 border-red-200"
            }`}
          >
            <div
              className={`w-1.5 h-1.5 rounded-full ${company.status === "ACTIVE" ? "bg-green-600" : "bg-red-600"}`}
            ></div>
            {company.status === "ACTIVE" ? t("details.companyStatus.active") : t("details.companyStatus.inactive")}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Can module={MODULES.STAFFING_COMPANY} action={ACTIONS.UPDATE}>
            <button
              onClick={() => setModal({ mode: "edit", company })}
              className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
            >
              <MdOutlineEdit className="text-lg" />
              <span>{t("details.editCompany", "Edit Company")}</span>
            </button>
          </Can>
        </div>
      </div>

      {/* DETAILS CARD (Matches Image) */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col lg:flex-row gap-6 lg:gap-8">
        {/* Left: Big gray placeholder with building icon */}
        <div className="w-full lg:w-[350px] xl:w-[400px] h-[250px] bg-gray-300 rounded-xl flex items-center justify-center shrink-0 overflow-hidden">
          {company.company_image ? (
            <img
              src={company.company_image}
              alt={company.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <MdOutlineBusiness className="text-gray-400 text-9xl" />
          )}
        </div>

        {/* Right: Info */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Contact Person Details */}
          <div className="mb-6 space-y-4">
            <div>
              <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                {t("details.contactPerson")}
              </h3>
              <p className="text-gray-600 text-[15px] font-medium">
                {company.contact_person_name || t("details.na")}
              </p>
            </div>

            {(company.contact_person_email || company.contact_person_phone) && (
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                {company.contact_person_email && (
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                      {t("details.contactEmail")}
                    </p>
                    <p className="text-sm text-gray-800 truncate">
                      <Ltr>{company.contact_person_email}</Ltr>
                    </p>
                  </div>
                )}
                {company.contact_person_phone && (
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                      {t("details.contactPhone")}
                    </p>
                    <p className="text-sm text-gray-800 truncate">
                      <Ltr>{company.contact_person_phone}</Ltr>
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Small info cards (gray bg) */}
          <div className="flex flex-col gap-4 mt-auto pt-6">
            {/* 2 columns */}
            <div className="flex flex-col xl:flex-row gap-4">
              <div className="flex-1 min-w-0 bg-gray-50 rounded-xl p-4 flex items-center gap-4">
                <MdMailOutline className="text-gray-400 text-2xl shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                    {t("details.emailLabel")}
                  </p>
                  <p className="font-semibold text-gray-900 text-sm truncate">
                    <Ltr>{company.email || t("details.na")}</Ltr>
                  </p>
                </div>
              </div>
              <div className="flex-1 min-w-0 bg-gray-50 rounded-xl p-4 flex items-center gap-4">
                <MdOutlinePhone className="text-gray-400 text-2xl shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                    {t("details.phoneLabel")}
                  </p>
                  <p className="font-semibold text-gray-900 text-sm truncate">
                    <Ltr>{company.phone || t("details.na")}</Ltr>
                  </p>
                </div>
              </div>
            </div>
            {/* 1 full width */}
            <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-4 min-w-0">
              <MdOutlineLocationOn className="text-gray-400 text-2xl shrink-0" />
              <div className="min-w-0 w-full">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  {t("details.locationLabel")}
                </p>
                <p className="font-semibold text-gray-900 text-sm break-words">
                  {[company.address, company.city].filter(Boolean).join(", ") ||
                    t("details.na")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ASSIGNED PROJECTS */}
      {assignedProjects.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
          <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-4">
            {t("details.assignedProjects", { n: assignedProjects.length })}
          </h3>
          <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto custom-scrollbar pr-2">
            {assignedProjects.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-lg text-[13px] font-semibold"
              >
                <Ltr>{p.project_name || p.name || t("details.unnamedProject")}</Ltr>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* STATS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6">
        <StatCard
          icon={<MdOutlineGroups />}
          title={t("details.stats.totalEmployees", "Total Employees")}
          value={summary?.total_employees ?? 0}
          badge={t("details.live")}
          iconBg="bg-blue-100"
          iconColor="text-blue-600"
        />
        <StatCard
          icon={<MdOutlineTrendingUp />}
          title={t("details.stats.activeEmployees", "Active Employees")}
          value={summary?.active_employees ?? 0}
          badge={t("details.live")}
          iconBg="bg-green-100"
          iconColor="text-green-600"
        />
        <StatCard
          icon={<MdOutlineSecurity />}
          title={t("details.stats.inactiveEmployees", "Inactive Employees")}
          value={summary?.inactive_employees ?? 0}
          badge={t("details.live")}
          iconBg="bg-red-100"
          iconColor="text-red-600"
        />
      </div>

      {/* EMPLOYEES TABLE SECTION */}
      <div className="mt-8">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-gray-900">
            {t("details.employeesList", "Staffing Company Employees")}
          </h2>
          <p className="text-sm text-gray-500">
            {t(
              "details.employeesListSub",
              "Manage employees assigned to this staffing company.",
            )}
          </p>
        </div>

        {/* Filters Bar */}
        <div className="bg-white border border-gray-200 rounded-t-xl px-4 py-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1 min-w-[120px]">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                {t("employees:list.filters.type", "Type")}
              </label>
              <CustomDropdown
                value={type}
                onChange={(e) => {
                  setType(e.target.value);
                  setPage(1);
                }}
                options={[
                  { label: t("details.filters.allTypes"), value: "" },
                  { label: t("details.filters.fullTime"), value: "FULL_TIME" },
                  { label: t("details.filters.contract"), value: "CONTRACT" },
                ]}
              />
            </div>
            <div className="flex flex-col gap-1 min-w-[120px]">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                {t("employees:list.filters.status", "Status")}
              </label>
              <CustomDropdown
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                options={[
                  { label: t("details.filters.allStatus"), value: "" },
                  { label: t("details.filters.active"), value: "ACTIVE" },
                  { label: t("details.filters.inactive"), value: "INACTIVE" },
                ]}
              />
            </div>
            <div className="flex-1 min-w-[180px] flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider opacity-0 select-none">
                {t("details.filters.search")}
              </label>
              <div className="relative">
                <MdOutlineSearch className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder={t(
                    "employees:list.filters.searchPlaceholder",
                    "Search by name or email...",
                  )}
                  className="w-full ps-9 pe-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition h-[42px]"
                />
              </div>
            </div>
            <div className="flex-shrink-0 flex items-end">
              <button
                onClick={handleClearFilters}
                className="w-full sm:w-auto flex justify-center items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-2 rounded-lg font-medium text-sm transition-colors h-[42px]"
              >
                <MdOutlineClear className="text-lg" />
                {t("details.filters.clearFilters")}
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border-x border-gray-200 overflow-hidden">
          <div className="w-full overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  {[
                    { labelKey: "details.empTable.sn" },
                    { labelKey: "details.empTable.employeeId" },
                    { labelKey: "details.empTable.name", sort: "full_name" },
                    { labelKey: "details.empTable.role" },
                    { labelKey: "details.empTable.type", sort: "employment_type" },
                    { labelKey: "details.empTable.project" },
                    { labelKey: "details.empTable.status" },
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
                {loadingEmployees && rows.length === 0 ? (
                  <TableLoader colSpan={7} label={t("details.loadingEmployees")} />
                ) : rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-14 text-center text-sm text-gray-400"
                    >
                      {t("details.noEmployees")}
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
                          {EMP_TYPE_KEYS[emp.type] ? t(EMP_TYPE_KEYS[emp.type]) : emp.type}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700 whitespace-nowrap">
                        {emp.project}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center whitespace-nowrap px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                            emp.status === "Active"
                              ? "text-green-700 bg-green-50 border-green-200"
                              : "text-red-700 bg-red-50 border-red-200"
                          }`}
                        >
                          {EMP_STATUS_KEYS[emp.status] ? t(EMP_STATUS_KEYS[emp.status]) : emp.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            limit={LIMIT}
            onPage={setPage}
            label={t("details.paginationLabel")}
            activeClass="bg-cyan-600 text-white"
            containerClass="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-4 border-t border-gray-200 bg-white"
          />
        </div>
      </div>

      {modal && (
        <StaffingCompanyModal
          mode={modal.mode}
          company={modal.company}
          onClose={() => {
            setModal(null);
          }}
          onSaved={(saved) => setCompany((c) => ({ ...c, ...saved }))}
        />
      )}
    </div>
  );
}

export default StaffingCompanyDetails;
