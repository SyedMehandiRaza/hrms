import { useEffect, useMemo, useState } from "react";
import {
  MdOutlineSearch,
  MdOutlineDescription,
  MdOutlineVisibility,
  MdOutlineDraw,
  MdOutlineInbox,
  MdCheckCircle,
  MdOutlineClear,
} from "react-icons/md";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useNcMyContracts, ncStore } from "./newContractStore";
import { getStaticUser } from "../../data/session";
import { matches, paginate } from "../../data/common";
import { NC_STATUS_STYLES } from "./newContractData";
import ContractViewer from "./ContractViewer";
import Pagination from "../../components/Pagination";

// Known English title/subtitle defaults (passed from routes) → translation keys.
const TITLE_KEYS = { "My Contracts": "myContracts.title", Contracts: "myContracts.titleCompany" };
const SUBTITLE_KEYS = {
  "Contracts sent to you for review and signature.": "myContracts.subtitle",
  "Agreements sent to your company for review and signature.": "myContracts.subtitleCompany",
  "Contracts your employer has sent you to review and sign.": "myContracts.subtitleEmployee",
};

// Recipient-side inbox: shows ONLY the contracts sent to the logged-in
// recipient (employee / staffing company), scoped by the /contracts/mine API.
export default function MyContracts({
  title = "My Contracts",
  subtitle = "Contracts sent to you for review and signature.",
}) {
  const { t } = useTranslation("contractStudio");
  // the staffing-company portal has its own inbox; everyone else sees the employee one
  const items = useNcMyContracts(getStaticUser().role === "STAFFING_COMPANY" ? "staffing" : "employee");
  const loaded = true;
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [viewing, setViewing] = useState(null); // { contract, canSign }
  const [page, setPage] = useState(1);
  const limit = 10;

  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  // Email deep-link: open a specific contract when ?contract=<id> is present.
  useEffect(() => {
    const cid = searchParams.get("contract");
    if (!cid) return;
    const c = items.find((x) => String(x.id) === cid || String(x.serverId) === cid);
    if (c) {
      const done = ["Signed", "Submitted", "Completed", "Approved"].includes(c.status);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setViewing({ contract: c, canSign: !done });
    }
    searchParams.delete("contract");
    setSearchParams(searchParams, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // back to page 1 whenever the search changes
  const [pageKey, setPageKey] = useState(debouncedQuery);
  if (pageKey !== debouncedQuery) {
    setPageKey(debouncedQuery);
    setPage(1);
  }

  const { rows, total, totalPages } = useMemo(
    () => paginate(items.filter((c) => matches(c, debouncedQuery.trim(), ["name", "id", "module"])), page, limit),
    [items, debouncedQuery, page]
  );

  const openViewer = (c, canSign) => {
    if (!canSign) ncStore.markViewed(c.id); // opening marks it viewed
    setViewing({ contract: c, canSign });
  };

  return (
    <div className="space-y-6 pb-10">
      {/* header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">{TITLE_KEYS[title] ? t(TITLE_KEYS[title]) : title}</h1>
        <p className="text-gray-500 mt-1 text-sm">{SUBTITLE_KEYS[subtitle] ? t(SUBTITLE_KEYS[subtitle]) : subtitle}</p>
      </div>

      {/* search */}
      <div className="bg-white border border-gray-200 rounded-xl px-4 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="relative max-w-md flex-1">
            <MdOutlineSearch className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg pointer-events-none" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("myContracts.searchPlaceholder")}
              className="w-full ps-10 pe-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
            />
          </div>
          <div className="flex-shrink-0 w-full sm:w-auto h-[42px]">
            <button
              onClick={() => setQuery("")}
              className="w-full sm:w-auto flex justify-center items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-2 rounded-lg font-medium text-sm transition-colors h-[42px]"
            >
              <MdOutlineClear className="text-lg" />
              {t("actions.clearFilters")}
            </button>
          </div>
        </div>
      </div>

      {/* inbox */}
      {rows.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-14 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center mb-4">
            <MdOutlineInbox className="text-3xl text-gray-300" />
          </div>
          <h3 className="text-base font-bold text-gray-900 mb-1">{loaded ? t("myContracts.empty.title") : t("common.loading")}</h3>
          <p className="text-sm text-gray-500 max-w-sm">
            {t("myContracts.empty.description")}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100">
                  {["sno", "contract", "from", "sent", "fields", "status", "action"].map((h) => (
                    <th key={h} className="text-start px-5 py-3">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t(`table.${h}`)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((c, idx) => {
                  const st = NC_STATUS_STYLES[c.status] || NC_STATUS_STYLES.Draft;
                  const done = ["Signed", "Submitted", "Completed", "Approved"].includes(c.status);
                  return (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4 text-sm font-medium text-gray-500">
                        {(page - 1) * limit + idx + 1}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center">
                            <MdOutlineDescription className="text-base" />
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 text-sm">{c.name}</p>
                            <p className="text-[11px] text-gray-400">{t("common.idLabel", { id: c.id })}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-700">
                        <span className="text-[11px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                          {t(`modules.${c.module || "Company"}`, { defaultValue: c.module || "Company" })}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-700">{c.sentDate || "—"}</td>
                      <td className="px-5 py-4 text-sm text-gray-700">{c.fields ?? 0}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${st.chip}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                          {t(`status.${c.status}`, { defaultValue: c.status })}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {done ? (
                          <div className="flex items-center gap-3">
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                              <MdCheckCircle className="text-sm" /> {t("myContracts.submitted")}
                            </span>
                            <button
                              onClick={() => openViewer(c, false)}
                              className="flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-cyan-600 transition-colors"
                              title={t("myContracts.viewDocument")}
                            >
                              <MdOutlineVisibility className="text-base" /> {t("actions.view")}
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openViewer(c, false)}
                              className="flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-cyan-600 transition-colors"
                              title={t("actions.open")}
                            >
                              <MdOutlineVisibility className="text-base" /> {t("actions.open")}
                            </button>
                            <button
                              onClick={() => openViewer(c, true)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#20B2AA] hover:bg-[#1C9D96] rounded-lg transition-colors"
                            >
                              <MdOutlineDraw className="text-sm" /> {t("myContracts.reviewSign")}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-gray-100">
            {rows.map((c, index) => {
              const st = NC_STATUS_STYLES[c.status] || NC_STATUS_STYLES.Draft;
              const done = ["Signed", "Submitted", "Completed", "Approved"].includes(c.status);
              return (
                <div key={c.id} className="px-4 py-4 space-y-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="inline-flex items-center px-2 py-0.5 mt-1 rounded text-[10px] font-bold text-gray-700 bg-gray-100 border border-gray-200">
                        #{(page - 1) * limit + index + 1}
                      </span>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center">
                          <MdOutlineDescription className="text-base" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{c.name}</p>
                          <p className="text-[11px] text-gray-400">{t("common.idLabel", { id: c.id })}</p>
                        </div>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold flex-shrink-0 ${st.chip}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />{t(`status.${c.status}`, { defaultValue: c.status })}
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 pb-2">
                    <span>{t("table.from")} <strong className="text-gray-800">{t(`modules.${c.module || "Company"}`, { defaultValue: c.module || "Company" })}</strong></span>
                    <span>{t("table.sent")} <strong className="text-gray-800">{c.sentDate || "—"}</strong></span>
                    <span>{t("table.fields")} <strong className="text-gray-800">{c.fields ?? 0}</strong></span>
                  </div>

                  <div className="pt-2 border-t border-gray-100 flex justify-end">
                    {done ? (
                      <div className="flex items-center justify-between w-full">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                          <MdCheckCircle className="text-sm" /> {t("myContracts.submitted")}
                        </span>
                        <button
                          onClick={() => openViewer(c, false)}
                          className="flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-cyan-600 transition-colors bg-gray-100 px-3 py-1.5 rounded-lg"
                        >
                          <MdOutlineVisibility className="text-base" /> {t("actions.view")}
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 w-full justify-end">
                        <button
                          onClick={() => openViewer(c, false)}
                          className="flex-1 flex justify-center items-center gap-1 text-xs font-semibold text-gray-600 hover:text-cyan-600 transition-colors bg-gray-100 px-3 py-1.5 rounded-lg"
                        >
                          <MdOutlineVisibility className="text-base" /> {t("actions.open")}
                        </button>
                        <button
                          onClick={() => openViewer(c, true)}
                          className="flex-[2] flex justify-center items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#20B2AA] hover:bg-[#1C9D96] rounded-lg transition-colors"
                        >
                          <MdOutlineDraw className="text-sm" /> {t("myContracts.reviewSign")}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {total > 0 && (
            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              limit={limit}
              onPage={setPage}
              label={t("pagination.contracts")}
              activeClass="bg-cyan-600 text-white"
              containerClass="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-gray-100"
            />
          )}
        </div>
      )}

      {viewing && (
        <ContractViewer
          contract={viewing.contract}
          canSign={viewing.canSign}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}
