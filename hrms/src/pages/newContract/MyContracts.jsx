import { useEffect, useState } from "react";
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
import { NC_STATUS_STYLES, NC_STATUS_KEY } from "./newContractData";
import ContractViewer from "./ContractViewer";
import Pagination from "../../components/Pagination";
import { ScreenError, ScreenLoader } from "../../components/ScreenState";
import { listMyContracts } from "../../api/contracts";
import useApiQuery from "../../hooks/useApiQuery";
import { useFormat } from "../../hooks/useFormat";

// Known English title/subtitle defaults (passed from routes) → translation keys.
const TITLE_KEYS = { "My Contracts": "myContracts.title", Contracts: "myContracts.titleCompany" };
const SUBTITLE_KEYS = {
  "Contracts sent to you for review and signature.": "myContracts.subtitle",
  "Agreements sent to your company for review and signature.": "myContracts.subtitleCompany",
  "Contracts your employer has sent you to review and sign.": "myContracts.subtitleEmployee",
};

// Signer inbox (plan decisions 26–27): only the caller's own contracts (GET /my/contracts),
// pending first. The open contract lives in the URL (?contract=<id>, also the emails' link).
const SIGNABLE = ["SENT", "VIEWED"];
const DONE = ["SUBMITTED", "COMPLETED"];
export default function MyContracts({
  title = "My Contracts",
  subtitle = "Contracts sent to you for review and signature.",
}) {
  const { t } = useTranslation("contractStudio");
  const { fmtDate } = useFormat();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1);
  const limit = 10;

  const [searchParams, setSearchParams] = useSearchParams();
  const viewing = searchParams.get("contract");
  const setViewing = (id) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set("contract", id);
        else next.delete("contract");
        return next;
      },
      { replace: true },
    );
  const closeViewer = () => setViewing(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  // back to page 1 whenever the search changes
  const [pageKey, setPageKey] = useState(debouncedQuery);
  if (pageKey !== debouncedQuery) {
    setPageKey(debouncedQuery);
    setPage(1);
  }

  const listQuery = useApiQuery(() => listMyContracts({ page, limit, q: debouncedQuery }), [page, debouncedQuery]);
  const rows = listQuery.data?.items || [];
  const total = listQuery.data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const openViewer = (c) => setViewing(c.id);

  if (listQuery.error && !listQuery.data) return <ScreenError error={listQuery.error} onRetry={listQuery.reload} />;
  if (!listQuery.data) return <ScreenLoader />;

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
          <h3 className="text-base font-bold text-gray-900 mb-1">{t("myContracts.empty.title")}</h3>
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
                  const statusKey = NC_STATUS_KEY[c.status];
                  const st = NC_STATUS_STYLES[statusKey] || NC_STATUS_STYLES.Draft;
                  const done = DONE.includes(c.status);
                  const signable = SIGNABLE.includes(c.status);
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
                            <p className="text-[11px] text-gray-400">{t("common.idLabel", { id: c.number || "—" })}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-700">
                        <span className="text-[11px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                          {t(`modules.${c.module || "Company"}`, { defaultValue: c.module || "Company" })}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-700">{c.sent_at ? fmtDate(c.sent_at) : "—"}</td>
                      <td className="px-5 py-4 text-sm text-gray-700">{c.field_count ?? 0}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${st.chip}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                          {t(`status.${statusKey}`, { defaultValue: c.status })}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {done ? (
                          <div className="flex items-center gap-3">
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                              <MdCheckCircle className="text-sm" /> {t("myContracts.submitted")}
                            </span>
                            <button
                              onClick={() => openViewer(c)}
                              className="flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-cyan-600 transition-colors"
                              title={t("myContracts.viewDocument")}
                            >
                              <MdOutlineVisibility className="text-base" /> {t("actions.view")}
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openViewer(c)}
                              className="flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-cyan-600 transition-colors"
                              title={t("actions.open")}
                            >
                              <MdOutlineVisibility className="text-base" /> {t("actions.open")}
                            </button>
                            {signable && (
                              <button
                                onClick={() => openViewer(c)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#20B2AA] hover:bg-[#1C9D96] rounded-lg transition-colors"
                              >
                                <MdOutlineDraw className="text-sm" /> {t("myContracts.reviewSign")}
                              </button>
                            )}
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
              const statusKey = NC_STATUS_KEY[c.status];
              const st = NC_STATUS_STYLES[statusKey] || NC_STATUS_STYLES.Draft;
              const done = DONE.includes(c.status);
              const signable = SIGNABLE.includes(c.status);
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
                          <p className="text-[11px] text-gray-400">{t("common.idLabel", { id: c.number || "—" })}</p>
                        </div>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold flex-shrink-0 ${st.chip}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />{t(`status.${statusKey}`, { defaultValue: c.status })}
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 pb-2">
                    <span>{t("table.from")} <strong className="text-gray-800">{t(`modules.${c.module || "Company"}`, { defaultValue: c.module || "Company" })}</strong></span>
                    <span>{t("table.sent")} <strong className="text-gray-800">{c.sent_at ? fmtDate(c.sent_at) : "—"}</strong></span>
                    <span>{t("table.fields")} <strong className="text-gray-800">{c.field_count ?? 0}</strong></span>
                  </div>

                  <div className="pt-2 border-t border-gray-100 flex justify-end">
                    {done ? (
                      <div className="flex items-center justify-between w-full">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                          <MdCheckCircle className="text-sm" /> {t("myContracts.submitted")}
                        </span>
                        <button
                          onClick={() => openViewer(c)}
                          className="flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-cyan-600 transition-colors bg-gray-100 px-3 py-1.5 rounded-lg"
                        >
                          <MdOutlineVisibility className="text-base" /> {t("actions.view")}
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 w-full justify-end">
                        <button
                          onClick={() => openViewer(c)}
                          className="flex-1 flex justify-center items-center gap-1 text-xs font-semibold text-gray-600 hover:text-cyan-600 transition-colors bg-gray-100 px-3 py-1.5 rounded-lg"
                        >
                          <MdOutlineVisibility className="text-base" /> {t("actions.open")}
                        </button>
                        {signable && (
                          <button
                            onClick={() => openViewer(c)}
                            className="flex-[2] flex justify-center items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#20B2AA] hover:bg-[#1C9D96] rounded-lg transition-colors"
                          >
                            <MdOutlineDraw className="text-sm" /> {t("myContracts.reviewSign")}
                          </button>
                        )}
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

      {viewing && <ContractViewer key={viewing} contractId={viewing} onClose={closeViewer} onChanged={listQuery.reload} />}
    </div>
  );
}
