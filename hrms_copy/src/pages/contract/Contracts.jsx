import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  MdAdd,
  MdOutlineInsertDriveFile,
  MdHourglassEmpty,
  MdCheckCircleOutline,
  MdHighlightOff,
  MdOutlineSearch,
  MdOutlineVisibility,
  MdOutlineEditCalendar,
  MdOutlineClear,
  MdOutlineInbox,
} from "react-icons/md";

import CustomDropdown from "../../components/CustomDropdown";
import Pagination from "../../components/Pagination";
import { TableLoader } from "../../components/Loader";
import Ltr from "../../components/Ltr";
import useFiscalYear from "../../hooks/useFiscalYear";
import useFyResetState from "../../hooks/useFyResetState";
import { useFormat } from "../../hooks/useFormat";
import { LEGACY_CONTRACTS, legacyStatsOf } from "../../data/groupF";
import { matches, paginate } from "../../data/common";
import { ContractStatusBadge, ExpiredBadge } from "./ContractStatusBadge";
import { CONTRACT_STATUSES, TERM_LOCKED_STATUSES } from "./contractHelpers";
import ContractTermModal from "./ContractTermModal";

const LIMIT = 10;
const COLORS = [
  "bg-cyan-50 text-cyan-600",
  "bg-indigo-50 text-indigo-600",
  "bg-amber-50 text-amber-600",
  "bg-rose-50 text-rose-600",
  "bg-emerald-50 text-emerald-600",
];
const initialsOf = (name = "") =>
  String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "?";


function StatCard({ title, value, icon, iconColor, iconBg }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl mb-4 ${iconBg} ${iconColor}`}>{icon}</div>
      <p className="text-[11px] text-gray-400 font-bold tracking-wider uppercase mb-1">{title}</p>
      <h3 className="text-3xl font-bold text-gray-900">{value ?? "—"}</h3>
    </div>
  );
}

function Contracts() {
  const { t } = useTranslation("contracts");
  const navigate = useNavigate();
  const { fmtDate } = useFormat();
  // "Expired" compares with today in company time.
  const fy = useFiscalYear();

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useFyResetState(1, fy.version); // page 1 on a year change

  // all contracts (static); term edits are applied locally
  const [all, setAll] = useState(() => [...LEGACY_CONTRACTS]);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(id);
  }, [search]);

  const stats = useMemo(() => legacyStatsOf(all), [all]);
  const loading = false;
  const { rows, meta } = useMemo(() => {
    const list = all.filter(
      (c) =>
        (!status || c.status === status) &&
        (matches(c, debounced, ["name", "reference_no"]) ||
          (c.recipients || []).some((r) => matches(r, debounced, ["recipient_name", "recipient_email"]))),
    );
    const p = paginate(list, page, LIMIT);
    return { rows: p.rows, meta: { total: p.total, totalPages: p.totalPages } };
  }, [all, status, debounced, page]);

  const statusOptions = useMemo(
    () => [
      { label: t("list.allStatuses"), value: "" },
      ...CONTRACT_STATUSES.map((s) => ({ label: t(`status.${s}`, { defaultValue: s }), value: s })),
    ],
    [t],
  );

  const hasFilters = !!(search || status);
  const clearFilters = () => {
    setSearch("");
    setDebounced("");
    setStatus("");
    setPage(1);
  };

  const recipientOf = (c) => {
    const list = c.recipients || [];
    if (!list.length) return "—";
    const first = list[0].recipient_name || list[0].recipient_email || "—";
    return list.length > 1 ? `${first} +${list.length - 1}` : first;
  };
  const dateOrDash = (v) => (v ? fmtDate(v) : "—");

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">{t("list.title")}</h1>
          <p className="text-gray-500 mt-1 text-sm">{t("list.subtitle")}</p>
        </div>
        <button
          onClick={() => navigate("/admin/contracts/create")}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#20B2AA] hover:bg-[#1C9D96] rounded-lg transition-colors self-start sm:self-auto"
        >
          <MdAdd className="text-lg" />
          {t("list.createContract")}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title={t("list.stats.totalContracts")} value={stats?.total} icon={<MdOutlineInsertDriveFile />} iconColor="text-cyan-500" iconBg="bg-cyan-50" />
        <StatCard
          title={t("list.stats.pendingApproval")}
          value={stats ? (stats.pending || 0) + (stats.submitted || 0) : undefined}
          icon={<MdHourglassEmpty />}
          iconColor="text-amber-500"
          iconBg="bg-amber-50"
        />
        <StatCard
          title={t("list.stats.activeContracts")}
          value={stats ? (stats.approved || 0) + (stats.completed || 0) : undefined}
          icon={<MdCheckCircleOutline />}
          iconColor="text-green-500"
          iconBg="bg-green-50"
        />
        <StatCard
          title={t("list.stats.expiredRejected")}
          value={stats ? (stats.expired || 0) + (stats.rejected || 0) : undefined}
          icon={<MdHighlightOff />}
          iconColor="text-rose-500"
          iconBg="bg-rose-50"
        />
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl px-4 py-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <MdOutlineSearch className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg pointer-events-none" />
            <input
              type="text"
              value={search}
              maxLength={150}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("list.searchPlaceholder")}
              className="w-full ps-10 pe-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition h-[42px]"
            />
          </div>
          <div className="w-full sm:w-52">
            <CustomDropdown
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              options={statusOptions}
            />
          </div>
          <button
            type="button"
            onClick={clearFilters}
            disabled={!hasFilters}
            className="w-full sm:w-auto flex justify-center items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-2 rounded-lg font-medium text-sm transition-colors h-[42px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <MdOutlineClear className="text-lg" />
            {t("list.clearFilters")}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-start border-collapse min-w-[1000px]">
            <thead>
              <tr className="border-b border-gray-100">
                {["sno", "contractName", "employeeName", "startDate", "endDate", "renewalDue", "status", "lastUpdated"].map((k) => (
                  <th key={k} className="px-5 py-4 text-start text-[11px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    {t(`list.table.${k}`)}
                  </th>
                ))}
                <th className="px-5 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-center">{t("list.table.action")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <TableLoader colSpan={9} label={t("list.loading")} />
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-14">
                    <div className="flex flex-col items-center text-center">
                      <MdOutlineInbox className="text-3xl text-gray-300 mb-2" />
                      <p className="text-sm text-gray-500">{hasFilters ? t("list.emptyFiltered") : t("list.empty")}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((c, index) => {
                  const termLocked = TERM_LOCKED_STATUSES.includes(c.status);
                  return (
                    <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-4 text-sm font-medium text-gray-600">
                        <Ltr>{String((page - 1) * LIMIT + index + 1).padStart(2, "0")}</Ltr>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${COLORS[c.id % COLORS.length]}`}>
                            {initialsOf(c.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 text-sm truncate max-w-[220px]">{c.name}</p>
                            {c.reference_no && (
                              <p className="text-xs text-gray-400">
                                <Ltr>{c.reference_no}</Ltr>
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-600 whitespace-nowrap">{recipientOf(c)}</td>
                      <td className="px-5 py-4 text-sm text-gray-600 whitespace-nowrap">{dateOrDash(c.start_date)}</td>
                      <td className="px-5 py-4 text-sm text-gray-600 whitespace-nowrap">{dateOrDash(c.end_date)}</td>
                      <td className="px-5 py-4 text-sm text-gray-600 whitespace-nowrap">{dateOrDash(c.renewal_due)}</td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <ContractStatusBadge status={c.status} />
                          <ExpiredBadge contract={c} today={fy.today} />
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-400 whitespace-nowrap">{dateOrDash(c.updated_at || c.created_at)}</td>
                      <td className="px-5 py-4">
                        <div className="flex justify-center gap-3 text-gray-400">
                          <button
                            type="button"
                            onClick={() => navigate(`/admin/contracts/${c.id}`)}
                            className="hover:text-cyan-600 transition-colors"
                            title={t("list.view")}
                            aria-label={t("list.view")}
                          >
                            <MdOutlineVisibility className="text-lg" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditing(c)}
                            disabled={termLocked}
                            className="hover:text-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            title={termLocked ? t("term.lockedHint") : t("term.editDates")}
                            aria-label={t("term.editDates")}
                          >
                            <MdOutlineEditCalendar className="text-lg" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <Pagination page={page} totalPages={meta.totalPages || 0} total={meta.total || 0} limit={LIMIT} onPage={setPage} label={t("list.paginationLabel")} />
      </div>

      {editing && (
        <ContractTermModal contract={editing} onClose={() => setEditing(null)} onSaved={(saved) => saved && setAll((list) => list.map((x) => (x.id === saved.id ? saved : x)))} />
      )}
    </div>
  );
}

export default Contracts;
