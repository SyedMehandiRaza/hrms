import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import {
  MdAdd,
  MdOutlineSearch,
  MdOutlineClear,
  MdOutlineDescription,
  MdOutlineSend,
  MdOutlineVisibility,
  MdOutlineDelete,
  MdOutlineGridView,
  MdOutlineViewList,
  MdOutlinePeople,
} from "react-icons/md";
import CustomDropdown from "../../components/CustomDropdown";
import { NC_STATUS_STYLES, NC_STATUS_KEY, NC_AUDIENCE_ID } from "./newContractData";
import Pagination from "../../components/Pagination";
import ConfirmationModal from "../../components/ConfirmationModal";
import { ScreenError, ScreenLoader } from "../../components/ScreenState";
import { contractStats, deleteDraft, listContracts } from "../../api/contracts";
import useApiQuery from "../../hooks/useApiQuery";
import { useCan } from "../../hooks/usePermission";
import { useFormat } from "../../hooks/useFormat";
import { MODULES } from "../../constants/permissions";
import { toastApiError } from "../../utils/apiError";
import HrContractViewer from "./HrContractViewer";

const TABS = [
  { id: "all", labelKey: "contracts.tabs.all" },
  { id: "Draft", labelKey: "contracts.tabs.drafts" },
  { id: "Pending", labelKey: "contracts.tabs.pending" },
  { id: "Signed", labelKey: "contracts.tabs.signed" },
  { id: "Rejected", labelKey: "contracts.tabs.rejected" },
];

// tab → the API statuses it shows ("all" = no filter)
const TAB_STATUSES = {
  Draft: ["DRAFT"],
  Pending: ["SENT", "VIEWED"],
  Signed: ["SUBMITTED", "COMPLETED"],
  Rejected: ["REJECTED"],
};

const AVATAR_COLORS = ["bg-indigo-50 text-indigo-600", "bg-amber-50 text-amber-600", "bg-cyan-50 text-cyan-600", "bg-rose-50 text-rose-600", "bg-emerald-50 text-emerald-600"];
const initialsOf = (name = "") =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
const colorOf = (id = "") => AVATAR_COLORS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];

export default function NewContracts() {
  const { t } = useTranslation("contractStudio");
  const navigate = useNavigate();
  const { fmtDate } = useFormat();
  const can = useCan();
  const canCreate = can(MODULES.CONTRACT, "create");
  const canDelete = can(MODULES.CONTRACT, "delete");

  // the open contract lives in the URL (?contract=<id>, also the emails' link)
  const [params, setParams] = useSearchParams();
  const viewing = params.get("contract");
  const setViewing = (id) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set("contract", id);
        else next.delete("contract");
        return next;
      },
      { replace: true },
    );

  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [audience, setAudience] = useState("");
  const [view, setView] = useState("list");
  const [deleting, setDeleting] = useState(null); // the draft whose delete is being confirmed
  const [deleteBusy, setDeleteBusy] = useState(false);
  const inFlight = useRef(false);

  const [page, setPage] = useState(1);
  const limit = 10;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  // back to page 1 whenever the filters change
  const filterKey = `${debouncedQuery}|${audience}|${tab}`;
  const [pageKey, setPageKey] = useState(filterKey);
  if (pageKey !== filterKey) {
    setPageKey(filterKey);
    setPage(1);
  }

  const status = (TAB_STATUSES[tab] || []).join(",");
  const listQuery = useApiQuery(() => listContracts({ page, limit, q: debouncedQuery, status, audience }), [page, debouncedQuery, status, audience]);
  const statsQuery = useApiQuery(() => contractStats(), []);
  const reload = () => {
    listQuery.reload();
    statsQuery.reload();
  };

  const filtered = listQuery.data?.items || [];
  const total = listQuery.data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const counts = useMemo(() => {
    const s = statsQuery.data;
    if (!s) return {};
    const sum = (list) => list.reduce((n, k) => n + (s.byStatus[k] || 0), 0);
    return {
      all: s.total || 0,
      Draft: sum(TAB_STATUSES.Draft),
      Pending: sum(TAB_STATUSES.Pending),
      Signed: sum(TAB_STATUSES.Signed),
      Rejected: sum(TAB_STATUSES.Rejected),
    };
  }, [statsQuery.data]);

  const confirmDelete = async () => {
    if (!deleting || inFlight.current) return;
    inFlight.current = true;
    setDeleteBusy(true);
    try {
      await deleteDraft(deleting.id);
      toast.success(t("viewer.toast.draftDeleted"));
    } catch (err) {
      toastApiError(err);
    } finally {
      inFlight.current = false;
      setDeleteBusy(false);
      setDeleting(null);
      reload();
    }
  };

  const closeViewer = () => setViewing(null);

  if (listQuery.error && !listQuery.data) return <ScreenError error={listQuery.error} onRetry={listQuery.reload} />;
  if (!listQuery.data) return <ScreenLoader />;

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">{t("contracts.title")}</h1>
          <p className="text-gray-500 mt-1 text-sm">
            {t("contracts.subtitle")}
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => navigate("/admin/new-contracts/create")}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-[#20B2AA] to-cyan-500 hover:from-[#1C9D96] hover:to-cyan-600 rounded-lg shadow-sm shadow-cyan-200 transition-all"
          >
            <MdAdd className="text-lg" />
            {t("actions.sendContract")}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200 overflow-x-auto">
        {TABS.map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={`relative px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${tab === tb.id ? "text-cyan-600" : "text-gray-500 hover:text-gray-800"
              }`}
          >
            {t(tb.labelKey)}
            <span className={`ml-1.5 text-[11px] px-1.5 py-0.5 rounded-full ${tab === tb.id ? "bg-cyan-50 text-cyan-600" : "bg-gray-100 text-gray-400"}`}>
              {counts[tb.id] ?? 0}
            </span>
            {tab === tb.id && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-cyan-600 rounded-full" />}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <MdOutlineSearch className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("contracts.searchPlaceholder")}
            className="w-full ps-10 pe-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
          />
        </div>
        <div className="w-full sm:w-52">
          <CustomDropdown
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            options={[
              { label: t("audiences.all"), value: "" },
              ...Object.entries(NC_AUDIENCE_ID).map(([api, id]) => ({ label: t(`audiences.${id}`), value: api })),
            ]}
          />
        </div>
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
          <button
            onClick={() => setView("list")}
            className={`w-9 h-9 flex items-center justify-center rounded-md transition-colors ${view === "list" ? "bg-cyan-50 text-cyan-600" : "text-gray-400 hover:text-gray-600"}`}
          >
            <MdOutlineViewList className="text-lg" />
          </button>
          <button
            onClick={() => setView("grid")}
            className={`w-9 h-9 flex items-center justify-center rounded-md transition-colors ${view === "grid" ? "bg-cyan-50 text-cyan-600" : "text-gray-400 hover:text-gray-600"}`}
          >
            <MdOutlineGridView className="text-lg" />
          </button>
        </div>
        <div className="flex-shrink-0 w-full sm:w-auto h-[42px]">
          <button
            onClick={() => {
              setQuery("");
              setAudience("");
              setTab("all");
            }}
            className="w-full sm:w-auto flex justify-center items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-2 rounded-lg font-medium text-sm transition-colors h-[42px]"
          >
            <MdOutlineClear className="text-lg" /> {t("actions.clearFilters")}
          </button>
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-14 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center mb-4">
            <MdOutlineDescription className="text-3xl text-gray-300" />
          </div>
          <h3 className="text-base font-bold text-gray-900 mb-1">{t("contracts.empty.title")}</h3>
          <p className="text-sm text-gray-500 max-w-sm mb-5">
            {t("contracts.empty.description")}
          </p>
          {canCreate && (
            <button
              onClick={() => navigate("/admin/new-contracts/create")}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#20B2AA] hover:bg-[#1C9D96] rounded-lg transition-colors"
            >
              <MdAdd className="text-lg" /> {t("actions.sendContract")}
            </button>
          )}
        </div>
      ) : view === "grid" ? (
        // GRID VIEW
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((c) => {
              const statusKey = NC_STATUS_KEY[c.status];
              const st = NC_STATUS_STYLES[statusKey] || NC_STATUS_STYLES.Draft;
              return (
                <div
                  key={c.id}
                  className="group bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-lg hover:shadow-gray-100 hover:-translate-y-0.5 transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold ${colorOf(c.id)}`}>
                      {initialsOf(c.recipient?.name || c.name)}
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${st.chip}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                      {t(`status.${statusKey}`, { defaultValue: c.status })}
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm mb-0.5 truncate">{c.name}</h3>
                  <p className="text-[11px] text-gray-400 mb-4">{t("common.idLabel", { id: c.number || "—" })}</p>
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                    <span className="inline-flex items-center gap-1"><MdOutlinePeople className="text-sm" /> {c.recipient?.name || "—"}</span>
                    <span>{t("common.fieldsCount", { count: c.field_count })}</span>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <span className="text-[11px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{c.contract_type?.name || "—"}</span>
                    <div className="flex items-center gap-2 text-gray-400">
                      <button onClick={() => setViewing(c.id)} title={t("actions.view")}>
                        <MdOutlineVisibility className="text-lg hover:text-cyan-600 cursor-pointer transition-colors" />
                      </button>
                      {c.status === "DRAFT" && canCreate && (
                        <button onClick={() => setViewing(c.id)} title={t("actions.send")}>
                          <MdOutlineSend className="text-lg hover:text-cyan-600 cursor-pointer transition-colors" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {total > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl">
              <Pagination
                page={page}
                totalPages={totalPages}
                total={total}
                limit={limit}
                onPage={setPage}
                label={t("pagination.contracts")}
                activeClass="bg-cyan-600 text-white"
                containerClass="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4"
              />
            </div>
          )}
        </div>
      ) : (
        // LIST VIEW
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[880px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  {["sno", "contract", "recipient", "audience", "sentDate", "fields", "status", "action"].map((h) => (
                    <th key={h} className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      {t(`table.${h}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((c, idx) => {
                  const statusKey = NC_STATUS_KEY[c.status];
              const st = NC_STATUS_STYLES[statusKey] || NC_STATUS_STYLES.Draft;
                  return (
                    <tr key={c.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="px-5 py-3.5 text-sm font-medium text-gray-500">
                        {(page - 1) * limit + idx + 1}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold ${colorOf(c.id)}`}>
                            {initialsOf(c.recipient?.name || c.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 text-sm truncate">{c.name}</p>
                            <p className="text-[11px] text-gray-400">{t("common.idLabel", { id: c.number || "—" })}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-600">{c.recipient?.name || "—"}</td>
                      <td className="px-5 py-3.5">
                        <span className="text-[11px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                          {t(`audiences.${NC_AUDIENCE_ID[c.audience_type]}`, { defaultValue: c.audience_type })}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-500">{c.sent_at ? fmtDate(c.sent_at) : "—"}</td>
                      <td className="px-5 py-3.5 text-sm text-gray-500">{c.field_count}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${st.chip}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                          {t(`status.${statusKey}`, { defaultValue: c.status })}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3 text-gray-400">
                          <button onClick={() => setViewing(c.id)} title={t("actions.view")} className="hover:text-cyan-600 transition-colors"><MdOutlineVisibility className="text-lg" /></button>
                          {c.status === "DRAFT" && canDelete && (
                            <button onClick={() => setDeleting(c)} title={t("actions.delete")} className="hover:text-rose-500 transition-colors"><MdOutlineDelete className="text-lg" /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {total > 0 && (
            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              limit={limit}
              onPage={setPage}
              label={t("pagination.contracts")}
              activeClass="bg-cyan-600 text-white"
              containerClass="flex items-center justify-between px-5 py-4 border-t border-gray-100"
            />
          )}
        </div>
      )}

      {viewing && <HrContractViewer key={viewing} contractId={viewing} onClose={closeViewer} onChanged={reload} />}
      <ConfirmationModal
        isOpen={!!deleting}
        type="delete"
        title={t("viewer.deleteTitle")}
        message={t("viewer.deleteMessage", { name: deleting?.name })}
        confirmText={t("actions.delete")}
        cancelText={t("actions.cancel")}
        isLoading={deleteBusy}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}