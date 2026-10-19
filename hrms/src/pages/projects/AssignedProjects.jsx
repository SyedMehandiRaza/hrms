import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MdOutlineFolderShared, MdOutlineBusiness, MdChevronRight, MdOutlineSearch } from "react-icons/md";
import SharedProjectWorkspace from "./SharedProjectWorkspace";
import { ROLE_LABEL, ROLE_BADGE } from "./assignedMock";
import { ASSIGNED_TO_ME_PROJECTS } from "../../data/groupC";
import { matches, paginate } from "../../data/common";
import Pagination from "../../components/Pagination";
import { TableLoader } from "../../components/Loader";

const LIMIT = 10;

// "Assigned to me" tab: host projects another company invited me onto. Opening
// one lets me deploy my own employees to it.
export default function AssignedProjects() {
  const { t } = useTranslation("collaboration");
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const loading = false;

  // Client-side search + paging over the static rows.
  const pageData = paginate(
    ASSIGNED_TO_ME_PROJECTS.filter((p) => matches(p, search, ["project_name", "owner", "location"])),
    page,
    LIMIT,
  );
  const rows = pageData.rows;
  const pageInfo = { total: pageData.total, total_pages: pageData.totalPages };


  if (selected) {
    return <SharedProjectWorkspace project={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
        <div>
          <h3 className="text-sm font-bold text-gray-800">{t("assigned.title")}</h3>
          <p className="text-xs text-gray-400 mt-0.5">{t("assigned.subtitle")}</p>
        </div>
        <div className="relative w-full sm:w-64">
          <MdOutlineSearch className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t("assigned.searchPlaceholder")}
            className="w-full h-[40px] ps-10 pe-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-[#F8F9FE]">
              {["sno", "project", "ownerCompany", "myRole", "status", ""].map((h) => (
                <th key={h} className="px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">{h ? t(`assigned.table.${h}`) : ""}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <TableLoader colSpan={6} />
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-16 text-center">
                <MdOutlineFolderShared className="mx-auto text-4xl text-gray-300" />
                <p className="mt-3 text-sm font-semibold text-gray-600">{t("assigned.empty.title")}</p>
                <p className="text-xs text-gray-400 mt-1">{t("assigned.empty.subtitle")}</p>
              </td></tr>
            ) : (
              rows.map((p, i) => (
                <tr key={p.id} className="hover:bg-gray-50/60 cursor-pointer" onClick={() => setSelected(p)}>
                  <td className="px-5 py-3 text-gray-500 font-semibold">{(page - 1) * LIMIT + i + 1}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="w-8 h-8 rounded-lg grid place-items-center bg-cyan-50 text-cyan-600"><MdOutlineFolderShared className="text-lg" /></span>
                      <span className="font-semibold text-gray-800">{p.project_name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-600"><span className="inline-flex items-center gap-1.5"><MdOutlineBusiness className="text-gray-400" /> {p.owner || "—"}</span></td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold border ${ROLE_BADGE[p.my_role] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
                      {p.my_role ? t(`role.${p.my_role}`, { defaultValue: ROLE_LABEL[p.my_role] || p.my_role }) : p.my_role}
                    </span>
                  </td>
                  <td className="px-5 py-3"><span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-green-50 text-green-700">{p.status ? t(`projectStatus.${p.status}`, { defaultValue: p.status }) : "—"}</span></td>
                  <td className="px-5 py-3 text-gray-300"><MdChevronRight className="text-lg" /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {pageInfo.total_pages > 1 && (
        <div className="px-5 py-4 border-t border-gray-100">
          <Pagination page={page} totalPages={pageInfo.total_pages} total={pageInfo.total} limit={LIMIT} onPage={setPage} label={t("assigned.paginationLabel")} activeClass="bg-cyan-600 text-white" containerClass="flex items-center justify-between gap-3" />
        </div>
      )}
    </div>
  );
}
