import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  MdOutlineDescription,
  MdOutlinePendingActions,
  MdOutlineVerified,
  MdOutlineInventory2,
  MdOutlineArrowOutward,
  MdOutlineNorthEast,
  MdAdd,
  MdOutlineSearch,
  MdOutlineCalendarMonth,
  MdOutlineFilterList,
  MdOutlineVisibility,
  MdOutlineDraw,
  MdOutlineMarkEmailRead,
  MdOutlineCancel,
  MdOutlineDoneAll,
  MdOutlineTrendingUp,
} from "react-icons/md";
import { NC_STATUS_STYLES, NC_STATUS_KEY } from "./newContractData";
import { contractStats, listContracts } from "../../api/contracts";
import useApiQuery from "../../hooks/useApiQuery";
import { useCan } from "../../hooks/usePermission";
import { useCurrentUser } from "../../hooks/useSession";
import { useFormat } from "../../hooks/useFormat";
import { MODULES } from "../../constants/permissions";
import { ScreenError, ScreenLoader } from "../../components/ScreenState";

const STAT_ICONS = {
  total: MdOutlineDescription,
  pending: MdOutlinePendingActions,
  signed: MdOutlineVerified,
  completed: MdOutlineInventory2,
};

const STAT_TINT = {
  cyan: "bg-cyan-50 text-cyan-600",
  amber: "bg-amber-50 text-amber-600",
  emerald: "bg-emerald-50 text-emerald-600",
  indigo: "bg-indigo-50 text-indigo-600",
};

const DELTA_TONE = {
  up: "text-emerald-600",
  good: "text-emerald-600",
  warn: "text-amber-600",
  muted: "text-gray-400",
};

const MINI_TONE = {
  muted: "text-gray-500",
  info: "text-sky-600",
  bad: "text-rose-600",
  warn: "text-amber-600",
};

// The feed: each recent non-draft contract's latest step (status → icon, tone, text, time).
const FEED = {
  SENT: { icon: "sent", tone: "cyan", at: "sent_at" },
  VIEWED: { icon: "viewed", tone: "sky", at: "viewed_at" },
  SUBMITTED: { icon: "signed", tone: "emerald", at: "submitted_at" },
  COMPLETED: { icon: "completed", tone: "emerald", at: "completed_at" },
  REJECTED: { icon: "rejected", tone: "rose", at: "updated_at" },
  EXPIRED: { icon: "rejected", tone: "rose", at: "expires_at" },
  REVOKED: { icon: "rejected", tone: "rose", at: "revoked_at" },
};
const FEED_STATUSES = Object.keys(FEED).join(",");

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

const ACT_ICON = {
  signed: MdOutlineDraw,
  viewed: MdOutlineMarkEmailRead,
  sent: MdOutlineArrowOutward,
  rejected: MdOutlineCancel,
};

const ACT_TONE = {
  emerald: "bg-emerald-50 text-emerald-600",
  sky: "bg-sky-50 text-sky-600",
  cyan: "bg-cyan-50 text-cyan-600",
  rose: "bg-rose-50 text-rose-600",
};

function StatCard({ stat }) {
  const { t } = useTranslation("contractStudio");
  const Icon = STAT_ICONS[stat.icon];
  return (
    <div className="group relative overflow-hidden bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-lg hover:shadow-gray-100 hover:-translate-y-0.5 transition-all duration-300">
      <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-gradient-to-br from-gray-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="flex items-start justify-between mb-5">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl ${STAT_TINT[stat.tint]}`}>
          <Icon />
        </div>
        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${DELTA_TONE[stat.deltaTone]}`}>
          {stat.deltaTone === "up" && <MdOutlineTrendingUp className="text-sm" />}
          {t(stat.deltaKey)}
        </span>
      </div>
      <p className="text-[11px] text-gray-400 font-bold tracking-wider uppercase mb-1">
        {t(stat.labelKey)}
      </p>
      <h3 className="text-3xl font-bold text-gray-900">{stat.value}</h3>
    </div>
  );
}

export default function NewContractDashboard() {
  const { t } = useTranslation("contractStudio");
  const navigate = useNavigate();
  const { fmtDate } = useFormat();
  const user = useCurrentUser();
  const canCreate = useCan()(MODULES.CONTRACT, "create");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 400);
    return () => clearTimeout(timer);
  }, [query]);

  const statsQuery = useApiQuery(() => contractStats(), []);
  const recentQuery = useApiQuery(() => listContracts({ limit: 5, q: debouncedQuery }), [debouncedQuery]);
  const feedQuery = useApiQuery(() => listContracts({ limit: 5, status: FEED_STATUSES }), []);
  const recent = recentQuery.data?.items || [];

  const metrics = useMemo(() => {
    const by = statsQuery.data?.byStatus || {};
    return {
      total: statsQuery.data?.total || 0,
      pending: (by.SENT || 0) + (by.VIEWED || 0),
      signed: by.SUBMITTED || 0,
      completed: by.COMPLETED || 0,
      draft: by.DRAFT || 0,
      viewed: by.VIEWED || 0,
      rejected: by.REJECTED || 0,
      expired: by.EXPIRED || 0,
    };
  }, [statsQuery.data]);

  const activities = useMemo(
    () =>
      (feedQuery.data?.items || [])
        .map((c) => {
          const f = FEED[c.status];
          return {
            id: c.id,
            icon: f.icon,
            tone: f.tone,
            text: t(`dashboard.feed.${c.status}`, { name: c.name, recipient: c.recipient?.name || "—" }),
            at: c[f.at] || c.updated_at,
          };
        })
        .sort((a, b) => new Date(b.at) - new Date(a.at)),
    [feedQuery.data, t],
  );

  const statCards = [
    { key: "total", labelKey: "dashboard.stats.total", value: metrics.total, deltaKey: "dashboard.stats.allContracts", deltaTone: "muted", icon: "total", tint: "cyan" },
    { key: "pending", labelKey: "dashboard.stats.pending", value: metrics.pending, deltaKey: "dashboard.stats.needsAction", deltaTone: "warn", icon: "pending", tint: "amber" },
    { key: "signed", labelKey: "dashboard.stats.signed", value: metrics.signed, deltaKey: "dashboard.stats.submitted", deltaTone: "good", icon: "signed", tint: "emerald" },
    { key: "completed", labelKey: "dashboard.stats.completed", value: metrics.completed, deltaKey: "dashboard.stats.approvedClosed", deltaTone: "muted", icon: "completed", tint: "indigo" },
  ];
  const miniStats = [
    { labelKey: "dashboard.mini.drafts", value: metrics.draft, tone: "muted" },
    { labelKey: "dashboard.mini.viewed", value: metrics.viewed, tone: "info" },
    { labelKey: "dashboard.mini.rejected", value: metrics.rejected, tone: "bad" },
    { labelKey: "dashboard.mini.expired", value: metrics.expired, tone: "warn" },
  ];
  const feed = activities;

  const firstError = statsQuery.error || recentQuery.error || feedQuery.error;
  if (firstError && !(statsQuery.data && recentQuery.data && feedQuery.data)) {
    return (
      <ScreenError
        error={firstError}
        onRetry={() => {
          statsQuery.reload();
          recentQuery.reload();
          feedQuery.reload();
        }}
      />
    );
  }
  if (!statsQuery.data || !recentQuery.data || !feedQuery.data) return <ScreenLoader />;

  return (
    <div className="space-y-6 pb-10">
      {/* Greeting / hero */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2 py-0.5 rounded-md bg-cyan-50 text-cyan-700 text-[10px] font-bold uppercase tracking-wider">
              {t("dashboard.badge")}
            </span>
            <span className="text-[11px] text-gray-400">{t("dashboard.edition")}</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
            {t("dashboard.greeting", { name: user?.name || "" })}
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            {t("dashboard.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative hidden md:block">
            <MdOutlineSearch className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg pointer-events-none" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("dashboard.searchPlaceholder")}
              className="w-64 ps-10 pe-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
            />
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
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <StatCard key={s.key} stat={s} />
        ))}
      </div>

      {/* Mini stat strip */}
      <div className="bg-white border border-gray-200 rounded-2xl px-2 py-2">
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-100">
          {miniStats.map((m) => (
            <div key={m.labelKey} className="flex items-center justify-center gap-2 py-3">
              <span className={`text-lg font-bold ${MINI_TONE[m.tone]}`}>{m.value}</span>
              <span className="text-xs text-gray-500 font-medium">{t(m.labelKey)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main grid: recent contracts + activity */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent contracts */}
        <div className="xl:col-span-2 bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-bold text-gray-900">{t("dashboard.recentContracts")}</h2>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
                <MdOutlineCalendarMonth className="text-sm" /> {t("dashboard.dateRange")}
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
                <MdOutlineFilterList className="text-sm" /> {t("dashboard.filters")}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  {["sno", "document", "recipient", "module", "sentDate", "status", ""].map((h) => (
                    <th key={h} className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      {h ? t(`table.${h}`) : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recent.map((c, idx) => {
                  const statusKey = NC_STATUS_KEY[c.status];
                  const st = NC_STATUS_STYLES[statusKey] || NC_STATUS_STYLES.Draft;
                  return (
                    <tr
                      key={c.id}
                      onClick={() => navigate(`/admin/new-contracts?contract=${c.id}`)}
                      className="hover:bg-gray-50/70 transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-3.5 text-sm font-medium text-gray-500">
                        {idx + 1}
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
                          {c.contract_type?.name || "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-500">{c.sent_at ? fmtDate(c.sent_at) : "—"}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${st.chip}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                          {t(`status.${statusKey}`, { defaultValue: c.status })}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <MdOutlineVisibility className="text-lg text-gray-300 hover:text-cyan-600 transition-colors" />
                      </td>
                    </tr>
                  );
                })}
                {recent.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-400">
                      {debouncedQuery ? t("dashboard.noMatch", { query: debouncedQuery }) : t("dashboard.noContracts")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Activity feed */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-gray-900">{t("dashboard.recentActivity")}</h2>
            <MdOutlineNorthEast className="text-gray-300" />
          </div>

          <div className="relative flex-1">
            {feed.length > 0 && <span className="absolute left-[15px] top-2 bottom-6 w-px bg-gray-100" />}
            {feed.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400">{t("dashboard.noActivity")}</div>
            ) : (
              <ul className="space-y-1">
                {feed.map((a) => {
                  const Icon = ACT_ICON[a.icon] || MdOutlineDoneAll;
                  return (
                    <li key={a.id} className="relative flex gap-3 py-2.5">
                      <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-sm ${ACT_TONE[a.tone]}`}>
                        <Icon />
                      </div>
                      <div className="min-w-0 pt-0.5">
                        <p className="text-[13px] text-gray-700 leading-snug">{a.text}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{a.at ? fmtDate(a.at) : ""}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <button
            onClick={() => navigate("/admin/new-contracts")}
            className="mt-4 w-full text-center text-sm font-semibold text-cyan-600 hover:text-cyan-700 py-2 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {t("dashboard.viewAllActivity")}
          </button>
        </div>
      </div>
    </div>
  );
}