import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  MdSearch,
  MdOutlineClear,
  MdOutlineInbox,
  MdOutlineLock,
  MdChevronRight,
} from "react-icons/md";

import { listExits } from "../../api/exits";
import useApiQuery from "../../hooks/useApiQuery";
import { useCan } from "../../hooks/usePermission";
import { MODULES } from "../../constants/permissions";
import { ScreenError } from "../../components/ScreenState";
import { useFormat } from "../../hooks/useFormat";
import { EXIT_TYPES, REASON_CATEGORIES, diffDays } from "../../utils/exitValidation";
import useFiscalYear from "../../hooks/useFiscalYear";
import CustomMonthPicker from "../../components/CustomMonthPicker";
import { ExitStatusBadge } from "../../components/exits/ExitBadges";
import CustomDropdown from "../../components/CustomDropdown";
import Pagination from "../../components/Pagination";
import Loader from "../../components/Loader";
import Ltr from "../../components/Ltr";

const LIMIT = 10;

// The tabs (D60): Pending approval is new; Cancelled also shows Rejected (labelled as such).
const TABS = ["PENDING_APPROVAL", "IN_NOTICE", "EXITED", "COMPLETED", "CANCELLED"];
const TAB_STATUSES = { CANCELLED: ["CANCELLED", "REJECTED"] };
const statusesOf = (tab) => TAB_STATUSES[tab] || [tab];

const TAB_LABEL = {
  PENDING_APPROVAL: "list.tabs.pendingApproval",
  IN_NOTICE: "list.tabs.inNotice",
  EXITED: "list.tabs.exited",
  COMPLETED: "list.tabs.completed",
  CANCELLED: "list.tabs.cancelled",
};
const EMPTY_LABEL = {
  PENDING_APPROVAL: "list.empty.pendingApproval",
  IN_NOTICE: "list.empty.inNotice",
  EXITED: "list.empty.exited",
  COMPLETED: "list.empty.completed",
  CANCELLED: "list.empty.cancelled",
};

// All reasons, de-duplicated (OTHER exists for both types).
const ALL_REASONS = [...new Set(EXIT_TYPES.flatMap((ty) => REASON_CATEGORIES[ty]))];

const initialsOf = (name = "") =>
  String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "?";

function NotAllowedState() {
  const { t } = useTranslation("exits");
  return (
    <div className="flex flex-col items-center justify-center text-center py-24 px-4">
      <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center mb-4">
        <MdOutlineLock className="text-2xl text-gray-400" />
      </div>
      <p className="text-sm text-gray-600 max-w-md">{t("common.notAllowed")}</p>
    </div>
  );
}

export default function ExitList() {
  const canManage = useCan()(MODULES.EXIT, "read");
  if (!canManage) return <NotAllowedState />;
  return <ExitListInner />;
}

function ExitListInner() {
  const { t } = useTranslation("exits");
  const navigate = useNavigate();

  // ?status=EXITED (e.g. a year-end readiness "Fix" link) opens that tab.
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(() => {
    const s = String(searchParams.get("status") || "").toUpperCase();
    return TABS.includes(s) ? s : "PENDING_APPROVAL";
  });
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [exitType, setExitType] = useState("");
  const [reason, setReason] = useState("");
  const [month, setMonth] = useState("");
  const [page, setPage] = useState(1);

  // The header's financial year: the list (?fy, added by the api client) and
  // the LWD-month filter follow it. A new year clears the month filter.
  const fy = useFiscalYear();
  const [fyVersion, setFyVersion] = useState(fy.version);
  if (fyVersion !== fy.version) {
    setFyVersion(fy.version);
    setMonth("");
    setPage(1);
  }
  // Debounce the search box (400 ms) and go back to page 1.
  useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(id);
  }, [search]);

  // GET /exits: the tab's statuses, filters and page; `counts` (per status) give the tab numbers.
  const { data, loading: fetching, error, reload } = useApiQuery(
    () => listExits({ page, limit: LIMIT, search: debounced, status: statusesOf(tab).join(","), type: exitType, reason, lwdMonth: month }),
    [tab, page, debounced, exitType, reason, month],
  );
  const loading = fetching && !data;
  const rows = data?.items || [];
  const meta = { total: data?.total || 0, totalPages: Math.ceil((data?.total || 0) / LIMIT) };
  const counts = Object.fromEntries(
    TABS.map((s) => [s, data?.counts ? statusesOf(s).reduce((n, st) => n + (data.counts[st] || 0), 0) : null]),
  );

  const reasonOptions = useMemo(() => {
    const list = exitType ? REASON_CATEGORIES[exitType] || [] : ALL_REASONS;
    return [{ value: "", label: t("list.filters.allReasons") }, ...list.map((r) => ({ value: r, label: t(`reason.${r}`) }))];
  }, [exitType, t]);

  const typeOptions = useMemo(
    () => [{ value: "", label: t("list.filters.allTypes") }, ...EXIT_TYPES.map((ty) => ({ value: ty, label: t(`type.${ty}`) }))],
    [t],
  );

  const switchTab = (s) => {
    if (s === tab) return;
    setTab(s);
    setPage(1);
  };

  const onType = (v) => {
    setExitType(v);
    // Keep the reason only if it still belongs to the chosen type.
    if (v && reason && !(REASON_CATEGORIES[v] || []).includes(reason)) setReason("");
    setPage(1);
  };

  const hasFilters = !!(search || exitType || reason || month);
  const clearFilters = () => {
    setSearch("");
    setDebounced("");
    setExitType("");
    setReason("");
    setMonth("");
    setPage(1);
  };

  const open = (id) => navigate(`/admin/exits/${id}`);

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">{t("list.title")}</h1>
        <p className="text-gray-500 mt-1 text-sm">{t("list.subtitle")}</p>
      </div>

      {/* tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200 overflow-x-auto">
        {TABS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => switchTab(s)}
            className={`relative shrink-0 px-4 py-2.5 text-sm font-medium whitespace-nowrap ${
              tab === s ? "text-cyan-600" : "text-gray-500 hover:text-gray-800"
            }`}
          >
            {t(TAB_LABEL[s])}
            {counts[s] !== undefined && counts[s] !== null && (
              <span
                className={`ms-1.5 text-[11px] px-1.5 py-0.5 rounded-full font-bold ${
                  tab === s ? "bg-cyan-50 text-cyan-600" : "bg-gray-100 text-gray-500"
                }`}
              >
                {counts[s]}
              </span>
            )}
            {tab === s && <span className="absolute start-0 end-0 -bottom-px h-0.5 bg-cyan-600 rounded-full" />}
          </button>
        ))}
      </div>

      {/* filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("list.filters.search")}</label>
            <div className="relative">
              <MdSearch className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
              <input
                type="text"
                value={search}
                maxLength={100}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("list.filters.searchPlaceholder")}
                className="w-full ps-9 pe-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("list.filters.type")}</label>
            <CustomDropdown value={exitType} options={typeOptions} placeholder={t("list.filters.allTypes")} onChange={(e) => onType(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("list.filters.reason")}</label>
            <CustomDropdown
              value={reason}
              options={reasonOptions}
              placeholder={t("list.filters.allReasons")}
              onChange={(e) => {
                setReason(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("list.filters.lwdMonth")}</label>
            <CustomMonthPicker
              value={month}
              onChange={(v) => {
                setMonth(v);
                setPage(1);
              }}
              min={fy.range?.from?.slice(0, 7)}
              max={fy.range?.to?.slice(0, 7)}
              containerClassName="w-full"
              className="w-full h-[42px] min-w-0"
            />
          </div>
          <button
            type="button"
            onClick={clearFilters}
            disabled={!hasFilters}
            className="flex justify-center items-center gap-2 border border-gray-200 text-gray-600 hover:bg-gray-50 px-4 rounded-lg font-medium text-sm transition-colors h-[42px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <MdOutlineClear className="text-lg" />
            {t("list.filters.clear")}
          </button>
        </div>
      </div>

      {/* results */}
      {loading ? (
        <div className="bg-white border border-gray-200 rounded-xl">
          <Loader label={t("common.loading")} />
        </div>
      ) : error ? (
        <div className="bg-white border border-gray-200 rounded-xl">
          <ScreenError error={error} onRetry={reload} />
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center mb-3">
            <MdOutlineInbox className="text-2xl text-gray-300" />
          </div>
          <p className="text-sm text-gray-500">{hasFilters ? t("list.empty.filtered") : t(EMPTY_LABEL[tab])}</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {/* desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-start min-w-[860px]">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  {["employee", "type", "reason", "lwd", "status"].map((h) => (
                    <th key={h} className="px-5 py-3 text-start text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      {t(`list.columns.${h}`)}
                    </th>
                  ))}
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((x) => (
                  <tr
                    key={x.id}
                    onClick={() => open(x.id)}
                    className="hover:bg-gray-50/70 transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3.5">
                      <EmployeeCell employee={x.employee} />
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-700">{t(`type.${x.exit_type}`)}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{t(`reason.${x.reason_category}`)}</td>
                    <td className="px-5 py-3.5">
                      <LwdCell exit={x} today={fy.today} />
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <ExitStatusBadge status={x.status} />
                      </div>
                      <RejectReason exit={x} />
                    </td>
                    <td className="px-3 py-3.5 text-gray-300">
                      <MdChevronRight className="text-xl rtl:rotate-180" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* mobile cards */}
          <div className="md:hidden divide-y divide-gray-100">
            {rows.map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => open(x.id)}
                className="w-full text-start p-4 hover:bg-gray-50/70 transition-colors space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <EmployeeCell employee={x.employee} />
                  <div className="flex flex-wrap justify-end items-center gap-1.5">
                    <ExitStatusBadge status={x.status} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-xs font-medium">{t(`type.${x.exit_type}`)}</span>
                  <span className="px-2 py-0.5 rounded-md bg-gray-50 border border-gray-200 text-gray-600 text-xs">{t(`reason.${x.reason_category}`)}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{t("list.columns.lwd")}</p>
                    <LwdCell exit={x} today={fy.today} />
                  </div>
                </div>
                <RejectReason exit={x} />
              </button>
            ))}
          </div>

          <Pagination
            page={page}
            totalPages={meta.totalPages || 0}
            total={meta.total || 0}
            limit={LIMIT}
            onPage={setPage}
            label={t("list.paginationLabel")}
          />
        </div>
      )}
    </div>
  );
}

// A rejected exit shows why (D59).
function RejectReason({ exit }) {
  const { t } = useTranslation("exits");
  if (exit.status !== "REJECTED" || !exit.reject_reason) return null;
  return <p className="text-xs text-gray-500 mt-1 max-w-xs line-clamp-2">{t("list.rejectReason", { reason: exit.reject_reason })}</p>;
}

function EmployeeCell({ employee }) {
  const { t } = useTranslation("exits");
  const name = employee?.name || t("list.unknownEmployee");
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-9 h-9 rounded-full bg-cyan-100 text-cyan-700 text-xs font-bold flex items-center justify-center shrink-0">
        {initialsOf(employee?.name)}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
        {employee?.employee_code && (
          <p className="text-xs text-gray-400 truncate">
            <Ltr>{employee.employee_code}</Ltr>
          </p>
        )}
      </div>
    </div>
  );
}

// LWD, with the days left while in notice (company today → LWD).
function LwdCell({ exit, today }) {
  const { t } = useTranslation("exits");
  const { fmtDate } = useFormat();
  const left = diffDays(exit.last_working_day, today);
  return (
    <div className="space-y-1">
      <p className="text-sm text-gray-800 font-medium">{fmtDate(exit.last_working_day)}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {exit.status === "IN_NOTICE" && left !== null && (
          <span className={`text-xs ${left <= 7 ? "text-amber-600 font-semibold" : "text-gray-500"}`}>
            {left > 0
              ? t("list.daysLeft", { days: t("common.days", { count: left }) })
              : t("list.lastDayReached")}
          </span>
        )}
      </div>
    </div>
  );
}


