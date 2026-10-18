import { useMemo, useState } from "react";
import { useTranslation, Trans } from "react-i18next";
import {
  MdArrowBack,
  MdOutlineBusiness,
  MdOutlineFolderOpen,
  MdOutlineSearch,
  MdChevronRight,
} from "react-icons/md";
import CustomDropdown from "../../components/CustomDropdown";
import Pagination from "../../components/Pagination";
import { TableLoader } from "../../components/Loader";
import PartnerEmployeeDetail from "./PartnerEmployeeDetail";
import { roleOf, initials } from "./partnerMock";
import { sharedProjectsFor, deployedEmployees } from "../../data/groupB";
import { paginate, matches } from "../../data/common";

const LIMIT = 8;
const TYPE_STYLE = { FULL_TIME: "bg-cyan-50 text-cyan-700", CONTRACT: "bg-amber-50 text-amber-700" };

// Host-side drill-in when a company under me is selected: company card, a
// project card scoped to the projects I assigned this company, and the employees
// this company DEPLOYED to the selected project.
export default function PartnerCompanyView({ company, onBack }) {
  const { t } = useTranslation("collaboration");
  // shared projects (only the ones I assigned this company)
  const [sharedProjects] = useState(() => sharedProjectsFor(company.employer_id));
  const [proj, setProj] = useState(() => (sharedProjects.length ? String(sharedProjects[0].id) : ""));
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const loadingProjects = false;
  const loading = false;
  const [selectedEmp, setSelectedEmp] = useState(null);

  // Employees this company deployed to the selected project (client-side search + paging).
  const { rows, pageInfo } = useMemo(() => {
    if (!proj) return { rows: [], pageInfo: { total: 0, total_pages: 1 } };
    const list = deployedEmployees(company.employer_id, proj).filter((e) =>
      matches(e, query, ["full_name", "country_emp_id", "email"]),
    );
    const block = paginate(list, page, LIMIT);
    return { rows: block.rows, pageInfo: { total: block.total, total_pages: block.totalPages } };
  }, [company.employer_id, proj, page, query]);

  const r = roleOf(company.role);
  const projectName = (sharedProjects.find((p) => String(p.id) === String(proj)) || {}).project_name || "—";
  const projectOptions = sharedProjects.map((p) => ({ label: p.project_name, value: String(p.id) }));

  if (selectedEmp) {
    return (
      <PartnerEmployeeDetail
        employee={selectedEmp}
        company={company}
        projectId={proj}
        onBack={() => setSelectedEmp(null)}
      />
    );
  }

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900">
        <MdArrowBack /> {t("partner.backToHierarchy")}
      </button>

      {/* Two cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Company card */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <span className={`flex-shrink-0 w-12 h-12 rounded-full grid place-items-center text-base font-bold ${r.avatar}`}>{initials(company.name)}</span>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-gray-900 truncate">{company.name}</h3>
              <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${r.badge}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${r.dot}`} /> {company.role ? t(`role.${company.role}`, { defaultValue: r.label }) : r.label}
              </span>
            </div>
            <MdOutlineBusiness className="ms-auto text-2xl text-gray-200" />
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">{t("partner.sharedProjects")}</span>
            <span className="text-sm font-bold text-gray-800">{sharedProjects.length}</span>
          </div>
        </div>

        {/* Project card */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <MdOutlineFolderOpen className="text-xl text-cyan-600" />
              <h3 className="text-base font-bold text-gray-900">{t("partner.project")}</h3>
            </div>
            <div className="w-44">
              <CustomDropdown
                value={proj}
                onChange={(e) => { setProj(e.target.value); setPage(1); }}
                options={projectOptions}
                placeholder={loadingProjects ? t("partner.loading") : t("partner.selectProject")}
              />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-y-4 gap-x-4">
            <div><p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{t("partner.project")}</p><p className="text-sm text-gray-800 mt-0.5 font-semibold">{projectName}</p></div>
            <div><p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{t("partner.deployedHere")}</p><p className="text-sm text-gray-800 mt-0.5">{pageInfo.total}</p></div>
            <div className="col-span-2"><p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{t("partner.scope")}</p><p className="text-sm text-gray-600 mt-0.5">{t("partner.scopeText")}</p></div>
          </div>
        </div>
      </div>

      {/* Deployed employees */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-800">
            <Trans t={t} i18nKey="partner.employeesOnProject" values={{ name: company.name }} components={{ name: <span className="text-cyan-700" /> }} />
            <span className="ms-2 text-xs font-medium text-gray-400">· {projectName}</span>
          </h3>
          <div className="relative w-full sm:w-64">
            <MdOutlineSearch className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
            <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder={t("partner.searchEmployee")} className="w-full h-[40px] ps-10 pe-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-[#F8F9FE]">
                {["sno", "employee", "role", "type", "status", ""].map((h) => (
                  <th key={h} className="px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">{h ? t(`partner.table.${h}`) : ""}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <TableLoader colSpan={6} />
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-400">{t("partner.emptyEmployees")}</td></tr>
              ) : (
                rows.map((e, i) => (
                  <tr key={e.id} className="hover:bg-gray-50/60 cursor-pointer" onClick={() => setSelectedEmp(e)}>
                    <td className="px-5 py-3 text-gray-500 font-semibold">{(page - 1) * LIMIT + i + 1}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-full grid place-items-center text-xs font-bold bg-gray-100 text-gray-600">{initials(e.full_name)}</span>
                        <div className="min-w-0"><div className="font-semibold text-gray-800 truncate">{e.full_name}</div><div className="text-xs text-gray-400 truncate">{e.country_emp_id || `#${e.id}`}</div></div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-700">{e.roles?.[0]?.name || "—"}</td>
                    <td className="px-5 py-3"><span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${TYPE_STYLE[e.employment_type] || "bg-gray-100 text-gray-600"}`}>{e.employment_type ? t(`employmentType.${e.employment_type}`, { defaultValue: String(e.employment_type).replace("_", "-") }) : "—"}</span></td>
                    <td className="px-5 py-3"><span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${String(e.user_status).toUpperCase() === "ACTIVE" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>{e.user_status ? t(`userStatus.${String(e.user_status).toUpperCase()}`, { defaultValue: e.user_status }) : "—"}</span></td>
                    <td className="px-5 py-3 text-gray-300"><MdChevronRight className="text-lg" /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {pageInfo.total_pages > 1 && (
          <div className="px-5 py-4 border-t border-gray-100">
            <Pagination page={page} totalPages={pageInfo.total_pages} total={pageInfo.total} limit={LIMIT} onPage={setPage} label={t("partner.paginationLabel")} activeClass="bg-cyan-600 text-white" containerClass="flex items-center justify-between gap-3" />
          </div>
        )}
      </div>
    </div>
  );
}
