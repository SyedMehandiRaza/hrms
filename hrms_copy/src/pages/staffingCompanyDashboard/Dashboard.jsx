import { useState } from "react";
import { useTranslation } from "react-i18next";
import { STAFFING_DASHBOARD } from "../../data/groupH";
import {
  MdOutlinePeople,
  MdOutlineListAlt,
  MdOutlinePendingActions,
  MdOutlineCheckCircle,
  MdOutlineBarChart,
  MdOutlineBolt,
  MdOutlineReceiptLong,
  MdOutlineHistory,
  MdOutlineShield,
  MdPersonOutline,
  MdOutlineMonetizationOn,
  MdOutlineDescription,
  MdOutlineRocketLaunch,
} from "react-icons/md";
import Ltr from "../../components/Ltr";

// ── Data ──────────────────────────────────────────────────────────────────────
const buildActionItems = (t) => [
  {
    id: 1,
    avatar:
      "https://ui-avatars.com/api/?name=John+Doe&background=374151&color=fff&size=40",
    name: t("actionCenter.names.johnDoe"),
    action: t("actionCenter.requested"),
    bold: t("actionCenter.items.annualLeave"),
    sub: t("actionCenter.items.annualLeaveSub"),
    leftBtn: t("actionCenter.actions.reject"),
    rightBtn: t("actionCenter.actions.approve"),
  },
  {
    id: 2,
    avatar:
      "https://ui-avatars.com/api/?name=Jane+Smith&background=be185d&color=fff&size=40",
    name: t("actionCenter.names.janeSmith"),
    action: t("actionCenter.requested"),
    bold: t("actionCenter.items.overtime"),
    sub: t("actionCenter.items.overtimeSub"),
    leftBtn: t("actionCenter.actions.reject"),
    rightBtn: t("actionCenter.actions.approve"),
  },
  {
    id: 3,
    isOrg: true,
    name: t("actionCenter.names.globalTech"),
    action: "",
    bold: t("actionCenter.items.contractRenewal"),
    sub: t("actionCenter.items.contractRenewalSub"),
    leftBtn: t("actionCenter.actions.review"),
    rightBtn: t("actionCenter.actions.approve"),
  },
];

const buildCompliance = (t) => [
  {
    name: t("compliance.names.ahmedAli"),
    docType: t("compliance.docTypes.iqama"),
    expiry: "20 Oct 2023",
    status: t("compliance.status.expiringSoon"),
    statusColor: "text-amber-500",
    dot: "bg-amber-400",
    action: t("compliance.actions.notify"),
  },
  {
    name: t("compliance.names.sarahChen"),
    docType: t("compliance.docTypes.passport"),
    expiry: "15 Sep 2023",
    status: t("compliance.status.expired"),
    statusColor: "text-red-500",
    dot: "bg-red-500",
    action: t("compliance.actions.renew"),
  },
  {
    name: t("compliance.names.michaelRoss"),
    docType: t("compliance.docTypes.healthCard"),
    expiry: "12 Nov 2023",
    status: t("compliance.status.expiringSoon"),
    statusColor: "text-amber-500",
    dot: "bg-amber-400",
    action: t("compliance.actions.notify"),
  },
  {
    name: t("compliance.names.michaelRoss"),
    docType: t("compliance.docTypes.healthCard"),
    expiry: "12 Nov 2023",
    status: t("compliance.status.expiringSoon"),
    statusColor: "text-amber-500",
    dot: "bg-amber-400",
    action: t("compliance.actions.notify"),
  },
  {
    name: t("compliance.names.michaelRoss"),
    docType: t("compliance.docTypes.healthCard"),
    expiry: "12 Nov 2023",
    status: t("compliance.status.expiringSoon"),
    statusColor: "text-amber-500",
    dot: "bg-amber-400",
    action: t("compliance.actions.notify"),
  },
];

const buildActivity = (t) => [
  {
    icon: MdPersonOutline,
    iconBg: "bg-cyan-50",
    iconColor: "text-cyan-500",
    title: t("activity.items.onboardedTitle"),
    desc: t("activity.items.onboardedDesc"),
    time: t("activity.time.twoHoursAgo"),
  },
  {
    icon: MdOutlineMonetizationOn,
    iconBg: "bg-green-50",
    iconColor: "text-green-500",
    title: t("activity.items.payrollTitle"),
    desc: t("activity.items.payrollDesc"),
    time: t("activity.time.fiveHoursAgo"),
  },
  {
    icon: MdOutlineDescription,
    iconBg: "bg-purple-50",
    iconColor: "text-purple-500",
    title: t("activity.items.contractTitle"),
    desc: t("activity.items.contractDesc"),
    time: t("activity.time.yesterday"),
  },
];

const AVATAR_COLORS = [
  "bg-cyan-500",
  "bg-blue-500",
  "bg-violet-500",
  "bg-rose-400",
];

const DonutChart = ({ totalStaffLabel, total, ftPct, ctPct }) => {
  const segments = [
    { pct: ftPct, color: "#06b6d4", offset: 0 },
    { pct: ctPct, color: "#818cf8", offset: ftPct },
  ];
  const r = 60,
    circ = 2 * Math.PI * r;
  let cum = 0;
  return (
    <svg width="150" height="150" viewBox="0 0 150 150">
      {segments.map((seg, i) => {
        if (seg.pct <= 0) return null;
        const dash = (seg.pct / 100) * circ;
        const gap = circ - dash;
        const rot = (cum / 100) * 360 - 90;
        cum += seg.pct;
        return (
          <circle
            key={i}
            cx="75"
            cy="75"
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth="18"
            strokeDasharray={`${dash} ${gap}`}
            strokeLinecap="butt"
            transform={`rotate(${rot} 75 75)`}
          />
        );
      })}
      <text
        x="75"
        y="70"
        textAnchor="middle"
        fontSize="20"
        fontWeight="bold"
        fill="#111827"
      >
        {total}
      </text>
      <text x="75" y="88" textAnchor="middle" fontSize="10" fill="#9ca3af">
        {totalStaffLabel}
      </text>
    </svg>
  );
};

function Dashboard() {
  const { t } = useTranslation("dashboard");
  const [data] = useState(STAFFING_DASHBOARD);
  const loading = false;

  const STAT_CARDS = [
    {
      badge: t("badges.total"),
      badgeColor: "text-blue-500",
      icon: MdOutlinePeople,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-500",
      tag: t("staffingDashboard.stats.totalEmployees"),
      tagColor: "text-gray-400",
      value: data?.total_employees || 0,
      valueStyle: "text-3xl font-bold text-gray-900",
    },
    {
      badge: t("badges.active"),
      badgeColor: "text-green-500",
      icon: MdOutlineListAlt,
      iconBg: "bg-green-50",
      iconColor: "text-green-500",
      tag: t("staffingDashboard.stats.activeProjects"),
      tagColor: "text-gray-400",
      value: data?.active_projects || 0,
      valueStyle: "text-3xl font-bold text-gray-900",
    },
    {
      badge: t("badges.completed"),
      badgeColor: "text-cyan-500",
      icon: MdOutlineCheckCircle,
      iconBg: "bg-cyan-50",
      iconColor: "text-cyan-500",
      tag: t("staffingDashboard.stats.completedProjects"),
      tagColor: "text-gray-400",
      value: data?.completed_projects || 0,
      valueStyle: "text-3xl font-bold text-gray-900",
    },
    {
      badge: t("badges.pending"),
      badgeColor: "text-orange-500",
      icon: MdOutlinePendingActions,
      iconBg: "bg-orange-50",
      iconColor: "text-orange-500",
      tag: t("staffingDashboard.stats.actionRequired"),
      tagColor: "text-gray-400",
      value: data?.pending_actions?.length || 0,
      valueStyle: "text-3xl font-bold text-gray-900",
    }
  ];

  const COMPLIANCE = buildCompliance(t);
  const ACTIVITY = data?.recent_activity?.length ? data.recent_activity : buildActivity(t);
  
  // Live projects only — the made-up sample projects are no longer shown when
  // the company has none. Avatars arrive as { name, url }; the stack shows
  // initials plus a "+N" for the rest of the real headcount.
  const initialsOf = (name) =>
    String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("") || "?";
  const PROJECTS = (data?.top_projects || []).map((p) => {
    const avatars = (p.avatars || []).map((a) => (typeof a === "string" ? a : initialsOf(a?.name)));
    return {
      ...p,
      avatars,
      extra: Math.max(0, (p.staff || 0) - avatars.length),
      status: t(`projects.statusLabels.${p.status}`, p.status),
      statusColor: p.status === "ACTIVE"
        ? "text-green-600 bg-green-50 border-green-200"
        : p.status === "COMPLETED"
          ? "text-blue-600 bg-blue-50 border-blue-200"
          : "text-amber-600 bg-amber-50 border-amber-200",
    };
  });
  
  // Share of the people expected at work today (weekly offs and holidays
  // excluded); on leave is real now, not a placeholder 0.
  const attendancePct = (n) => {
    const expected = Number(data?.attendance_today?.expected) || 0;
    return expected > 0 ? Math.round(((Number(n) || 0) / expected) * 100) : 0;
  };

  const [actions, setActions] = useState(() => buildActionItems(t));
  const dismiss = (id) => setActions((a) => a.filter((x) => x.id !== id));
  
  if (loading) {
    return <div className="p-8 text-center text-gray-500">{t("loading", "Loading dashboard...")}</div>;
  }
  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
            {t("header.title")}
          </h1>
          <p className="text-gray-400 mt-1 text-sm">{t("header.subtitle")}</p>
        </div>
        {/* <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
          <button className="flex items-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors">
            <MdOutlineDownload className="text-base" /> {t("buttons.exportReport")}
          </button>
          <button className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm transition-colors">
            <MdOutlinePersonAdd className="text-lg" /> {t("buttons.newHire")}
          </button>
        </div> */}
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-4 gap-3">
        {STAT_CARDS.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.tag}
              className="bg-white border border-gray-200 rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div
                  className={`w-9 h-9 ${c.iconBg} rounded-lg flex items-center justify-center`}
                >
                  <Icon className={`${c.iconColor} text-lg`} />
                </div>
                <span className={`text-[10px] font-bold ${c.badgeColor}`}>
                  {c.badge}
                </span>
              </div>
              <p
                className={`text-[10px] font-bold uppercase tracking-wider ${c.tagColor} mb-1`}
              >
                {c.tag}
              </p>
              <Ltr as="p" className={c.valueStyle}>
                {c.value}
              </Ltr>
            </div>
          );
        })}
      </div>

      {/* ── Employee Distribution + Attendance Overview ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Employee Distribution */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <MdOutlineBarChart className="text-cyan-500 text-xl" />
            <h3 className="text-sm font-bold text-gray-900">
              {t("distribution.title")}
            </h3>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <DonutChart 
              totalStaffLabel={t("distribution.totalStaff")} 
              total={data?.total_employees || 0}
              ftPct={data?.total_employees ? Math.round((data.distribution.full_time / data.total_employees) * 100) : 0}
              ctPct={data?.total_employees ? Math.round((data.distribution.contract / data.total_employees) * 100) : 0}
            />
            <div className="flex-1 space-y-4 w-full">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-cyan-500 flex-shrink-0" />
                  <span className="text-sm text-gray-700">
                    {t("distribution.fullTime")}
                  </span>
                </div>
                <span className="text-sm font-bold text-gray-900">
                  {data?.total_employees ? Math.round((data.distribution.full_time / data.total_employees) * 100) : 0}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-indigo-400 flex-shrink-0" />
                  <span className="text-sm text-gray-700">
                    {t("distribution.contract")}
                  </span>
                </div>
                <span className="text-sm font-bold text-gray-900">
                  {data?.total_employees ? Math.round((data.distribution.contract / data.total_employees) * 100) : 0}%
                </span>
              </div>
              <p className="text-xs text-gray-400 pt-2 border-t border-gray-50">
                {t("distribution.note")}
              </p>
            </div>
          </div>
        </div>

        {/* Attendance Overview */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-5">
            <MdOutlineBarChart className="text-cyan-500 text-xl" />
            <h3 className="text-sm font-bold text-gray-900">
              {t("attendance.title")}
            </h3>
          </div>
          <div className="space-y-5">
            {[
              {
                label: t("attendance.present"),
                pct: attendancePct(data?.attendance_today?.present),
                color: "bg-green-500",
                dot: "bg-green-500",
              },
              {
                label: t("attendance.absent"),
                pct: attendancePct(data?.attendance_today?.absent),
                color: "bg-red-500",
                dot: "bg-red-500",
              },
              {
                label: t("attendance.onLeave"),
                pct: attendancePct(data?.attendance_today?.on_leave),
                color: "bg-amber-400",
                dot: "bg-amber-400",
              },
            ].map(({ label, pct, color, dot }) => (
              <div key={label}>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="text-gray-700">{label}</span>
                  <span className="font-bold text-gray-900">{pct}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${dot} flex-shrink-0`}
                  />
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${color} rounded-full`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Action Center + Payroll Snapshot ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Action Center */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MdOutlineBolt className="text-cyan-500 text-xl" />
              <h3 className="text-base font-bold text-gray-900">
                {t("actionCenter.title")}
              </h3>
            </div>
            <button className="text-sm font-semibold text-cyan-600 hover:text-cyan-700 transition-colors">
              {t("buttons.viewAllTasks")}
            </button>
          </div>
          <div className="space-y-3">
            {actions.map((item) => (
              <div
                key={item.id}
                className="bg-white border border-gray-200 rounded-xl px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-4"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {item.isOrg ? (
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                      <MdOutlineListAlt className="text-indigo-500 text-xl" />
                    </div>
                  ) : (
                    <img
                      src={item.avatar}
                      alt={item.name}
                      className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800 truncate">
                      <strong>{item.name}</strong>
                      {item.action ? ` ${item.action} ` : " "}
                      <strong>{item.bold}</strong>
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{item.sub}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-auto">
                  <button
                    onClick={() => dismiss(item.id)}
                    className="px-4 py-1.5 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors"
                  >
                    {item.leftBtn}
                  </button>
                  <button className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-semibold transition-colors">
                    {item.rightBtn}
                  </button>
                </div>
              </div>
            ))}
            {actions.length === 0 && (
              <div className="bg-white border border-gray-200 rounded-xl px-5 py-10 text-center text-sm text-gray-400">
                {t("actionCenter.emptyState")}
              </div>
            )}
          </div>
        </div>

        {/* Payroll Snapshot */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <MdOutlineReceiptLong className="text-cyan-500 text-xl" />
            <h3 className="text-base font-bold text-gray-900">
              {t("payroll.title")}
            </h3>
          </div>
          <div className="bg-cyan-600 rounded-xl p-5 text-white flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-200 mb-2">
              {t("payroll.cycle")}
            </p>
            <Ltr as="p" className="text-4xl font-bold mb-4">
              $450,000
            </Ltr>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-cyan-100">
                    {t("payroll.employeesProcessed")}
                  </span>
                  <Ltr className="font-bold text-white">1,284 / 1,284</Ltr>
                </div>
                <div className="h-1.5 bg-cyan-500 rounded-full overflow-hidden">
                  <div className="h-full w-full bg-white rounded-full" />
                </div>
              </div>
              <div className="flex justify-between text-sm pt-1 border-t border-cyan-500">
                <span className="text-cyan-100">
                  {t("payroll.taxLiabilities")}
                </span>
                <Ltr className="font-bold text-white">$84,200</Ltr>
              </div>
            </div>
            <button className="w-full mt-4 bg-white text-cyan-600 hover:bg-cyan-50 font-bold py-2.5 rounded-lg text-sm transition-colors">
              {t("buttons.runPayroll")}
            </button>
          </div>
        </div>
      </div>

      {/* ── Compliance Alerts + Recent Activity ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Compliance Alerts */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <MdOutlineShield className="text-cyan-500 text-xl" />
              <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                {t("staffingDashboard.title")}
              </h1>
            </div>
            <span className="text-xs font-bold text-red-500 bg-red-50 border border-red-100 px-2.5 py-1 rounded-full">
              {t("compliance.criticalCount")}
            </span>
          </div>

          {/* Desktop Table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-50">
                  {[
                    t("compliance.table.employee"),
                    t("compliance.table.documentType"),
                    t("compliance.table.expiryDate"),
                    t("compliance.table.status"),
                    t("compliance.table.action"),
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-start px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {COMPLIANCE.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5 text-sm font-semibold text-gray-900">
                      {row.name}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">
                      {row.docType}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">
                      <Ltr>{row.expiry}</Ltr>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`flex items-center gap-1.5 text-sm font-semibold ${row.statusColor}`}
                      >
                        <span className={`w-2 h-2 rounded-full ${row.dot}`} />
                        {row.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <button className="text-sm font-bold text-cyan-600 hover:text-cyan-700 transition-colors">
                        {row.action}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="sm:hidden divide-y divide-gray-50">
            {COMPLIANCE.map((row, i) => (
              <div key={i} className="px-4 py-3.5 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900">
                    {row.name}
                  </p>
                  <button className="text-sm font-bold text-cyan-600">
                    {row.action}
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  {row.docType} • {t("compliance.expiresLabel")}{" "}
                  <Ltr>{row.expiry}</Ltr>
                </p>
                <span
                  className={`flex items-center gap-1 text-xs font-semibold ${row.statusColor}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${row.dot}`} />
                  {row.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
            <MdOutlineHistory className="text-cyan-500 text-xl" />
            <h3 className="text-base font-bold text-gray-900">
              {t("activity.title")}
            </h3>
          </div>
          <div className="divide-y divide-gray-50">
            {ACTIVITY.map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} className="flex items-start gap-3 px-5 py-4">
                  <div
                    className={`w-8 h-8 ${item.iconBg} rounded-full flex items-center justify-center flex-shrink-0`}
                  >
                    <Icon className={`${item.iconColor} text-base`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 leading-snug">
                      {item.title}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
                    <p className="text-[10px] text-gray-300 mt-1">
                      {item.time}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="px-5 py-4 border-t border-gray-50">
            <button className="text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors">
              {t("buttons.viewSystemLogs")}
            </button>
          </div>
        </div>
      </div>

      {/* ── Active Project Overview ── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <MdOutlineRocketLaunch className="text-cyan-500 text-xl" />
          <h3 className="text-base font-bold text-gray-900">
            {t("projects.title")}
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {PROJECTS.length === 0 && (
            <p className="col-span-full text-sm text-gray-400 py-6 text-center">
              {t("projects.empty")}
            </p>
          )}
          {PROJECTS.map((proj) => (
            <div
              key={proj.name}
              className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <h4 className="text-sm font-bold text-gray-900">{proj.name}</h4>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${proj.statusColor}`}
                >
                  {proj.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                {/* Avatar stack */}
                <div className="flex items-center gap-2">
                  {proj.tbd ? (
                    <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                      {t("projects.tbd")}
                    </span>
                  ) : (
                    <div className="flex -space-x-2">
                      {proj.avatars.map((a, i) => (
                        <div
                          key={i}
                          className={`w-7 h-7 rounded-full ${AVATAR_COLORS[i % AVATAR_COLORS.length]} text-white text-[10px] font-bold flex items-center justify-center border-2 border-white`}
                        >
                          {a}
                        </div>
                      ))}
                      {proj.extra > 0 && (
                        <div className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold flex items-center justify-center border-2 border-white">
                          +{proj.extra}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <span className="text-xs text-gray-500 font-medium">
                  {t("projects.staff", { count: proj.staff })}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
