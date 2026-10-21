import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import * as XLSX from "xlsx";
import {
  MdOutlineDownload,
  MdOutlinePersonAdd,
  MdOutlinePeople,
  MdOutlineListAlt,
  MdOutlinePendingActions,
  MdOutlineCheckCircle,
  MdOutlineWarning,
  MdOutlineBarChart,
  MdOutlineBolt,
  MdOutlineReceiptLong,
  MdOutlineHistory,
  MdOutlineShield,
  MdOutlineRocketLaunch,
  MdOutlineNotificationsNone,
} from "react-icons/md";
import Ltr from "../../components/Ltr";
import { useFormat } from "../../hooks/useFormat";
import useFiscalYear from "../../hooks/useFiscalYear";
import { DASHBOARD } from "../../data/groupA";
import useApiQuery from "../../hooks/useApiQuery";
import { getInbox } from "../../api/approvals";
import { ScreenError } from "../../components/ScreenState";
import ApprovalDecisionModal from "../../components/ApprovalDecisionModal";

// Every widget keeps its own state shape ({ loading, denied, failed, ...data })
// so each block can render its own empty / no-access variant.
const ok = (data) => ({ loading: false, denied: false, failed: false, ...data });
const asArray = (v) => (Array.isArray(v) ? v : []);

// Documents expiring inside this window feed the compliance widget.
const EXPIRY_WINDOW_DAYS = 60;
const pct = (value, total) =>
  total > 0 ? Math.round((Number(value) / total) * 100) : 0;

const ACTION_PREVIEW = 4; // rows before "view all"

// Worst (most advanced) status across the month's runs drives the payroll card.
const RUN_RANK = {
  DRAFT: 1,
  PENDING_APPROVAL: 2,
  APPROVED: 3,
  PAID: 4,
  CREDITED: 5,
};

const STATUS_BADGE = {
  DRAFT: "badges.draft",
  PENDING_APPROVAL: "badges.pending",
  APPROVED: "badges.approved",
  PAID: "badges.processed",
  CREDITED: "badges.processed",
};

const AVATAR_COLORS = [
  "bg-cyan-500",
  "bg-blue-500",
  "bg-violet-500",
  "bg-rose-400",
];

const initialsOf = (name = "") =>
  String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "—";

const PROJECT_STATUS_STYLE = {
  ACTIVE: "text-green-600 bg-green-50 border-green-200",
  INACTIVE: "text-amber-600 bg-amber-50 border-amber-200",
  COMPLETED: "text-blue-600 bg-blue-50 border-blue-200",
};

// Compliance severity → how the row reads.
const BUCKET_STYLE = {
  EXPIRED: { color: "text-red-500", dot: "bg-red-500", key: "compliance.status.expired" },
  CRITICAL: { color: "text-red-500", dot: "bg-red-500", key: "compliance.status.critical" },
  WARNING: { color: "text-amber-500", dot: "bg-amber-400", key: "compliance.status.expiringSoon" },
};

// ── Donut Chart (SVG) ─────────────────────────────────────────────────────────
// Segments are drawn over the whole headcount, so employees with no employment
// type stay visible as the uncoloured remainder instead of being rounded away.
const DonutChart = ({ segments, total, totalStaffLabel, fmtNumber }) => {
  const r = 60;
  const circ = 2 * Math.PI * r;
  // Each arc carries its own start offset, accumulated without reassigning
  // anything during render.
  const drawn = segments
    .filter((s) => s.value > 0)
    .reduce((acc, s) => {
      const prev = acc[acc.length - 1];
      const share = total > 0 ? s.value / total : 0;
      return [...acc, { ...s, share, start: prev ? prev.start + prev.share : 0 }];
    }, []);
  return (
    <svg width="150" height="150" viewBox="0 0 150 150">
      <circle cx="75" cy="75" r={r} fill="none" stroke="#f1f5f9" strokeWidth="18" />
      {drawn.map((seg) => {
        const dash = seg.share * circ;
        const rot = seg.start * 360 - 90;
        return (
          <circle
            key={seg.label}
            cx="75"
            cy="75"
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth="18"
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeLinecap="butt"
            transform={`rotate(${rot} 75 75)`}
          />
        );
      })}
      <text x="75" y="70" textAnchor="middle" fontSize="20" fontWeight="bold" fill="#111827">
        {fmtNumber(total)}
      </text>
      <text x="75" y="88" textAnchor="middle" fontSize="10" fill="#9ca3af">
        {totalStaffLabel}
      </text>
    </svg>
  );
};

// onRetry: a failed API-backed widget shows the server's message with a Retry button.
const WidgetState = ({ state, t, children, className = "", onRetry }) => {
  if (state.loading) {
    return (
      <p className={`py-10 text-center text-sm text-gray-400 ${className}`}>
        {t("loading")}
      </p>
    );
  }
  if (state.denied) {
    return (
      <p className={`py-10 text-center text-sm text-gray-400 ${className}`}>
        {t("errors.noAccess")}
      </p>
    );
  }
  if (state.failed && onRetry) {
    return (
      <div className={className}>
        <ScreenError error={state.error} onRetry={onRetry} />
      </div>
    );
  }
  if (state.failed) {
    return (
      <p className={`py-10 text-center text-sm text-gray-400 ${className}`}>
        {t("errors.loadFailed")}
      </p>
    );
  }
  return children;
};

function Dashboard() {
  const { t } = useTranslation("dashboard");
  const { fmtDate, fmtNumber } = useFormat();
  const navigate = useNavigate();

  const loading = false;
  const [org] = useState(() => ok(DASHBOARD.org));
  const [attendance] = useState(() => ok(DASHBOARD.attendance));
  const [docs] = useState(() =>
    ok({ rows: DASHBOARD.docs.expiringDocuments, summary: DASHBOARD.docs.summary }),
  );
  // Requests waiting for the signed-in approver (the owner also sees owner-only and blocked ones).
  const inbox = useApiQuery(() => getInbox(), []);
  const approvals = inbox.error
    ? { failed: true, error: inbox.error, rows: [] }
    : ok({ rows: (inbox.data?.items || []).map((r) => ({ ...r, approval_request_id: r.id, employee_name: r.employee?.name, can_act: true })) });
  const [decision, setDecision] = useState(null); // { request, action }
  const [payroll] = useState(() => ok({ runs: DASHBOARD.payrollRuns }));
  const [projects] = useState(() => ok({ rows: DASHBOARD.projects }));
  const [activity] = useState(() => ok({ rows: DASHBOARD.activity }));
  const [showAllActions, setShowAllActions] = useState(false);

  // The day the dashboard reports on: today (company time) when the header's
  // financial year is the current one, else that year's nearest day (its last
  // day for a past year). Attendance + the payroll card use it; FY-aware lists
  // follow the header's year (?fy). Everything reloads on a year change.
  const fy = useFiscalYear();
  const todayStr = fy.defaultDate;
  const today = useMemo(() => {
    const [y, m, d] = todayStr.split("-").map(Number);
    return new Date(y, m - 1, d);
  }, [todayStr]);

  // ── derived ────────────────────────────────────────────────────────────────
  const totalEmployees = Number(org.total_employees || 0);
  const fullTime = Number(org.distribution?.full_time || 0);
  const contract = Number(org.distribution?.contract || 0);
  const unspecified = Math.max(0, totalEmployees - fullTime - contract);
  const newHires = Number(org.new_hires_this_month || 0);

  const attTotal = Number(attendance.total_employees || 0);

  // Only pending items this user can still act on belong in the Action Center.
  const actionable = useMemo(
    () => asArray(approvals.rows).filter((r) => r.can_act),
    [approvals.rows],
  );
  const visibleActions = showAllActions
    ? actionable
    : actionable.slice(0, ACTION_PREVIEW);

  const payrollMonth = useMemo(() => {
    const runs = asArray(payroll.runs);
    const netTotal = runs.reduce((s, r) => s + Number(r.total_net || 0), 0);
    const deductions = runs.reduce((s, r) => s + Number(r.deductions_total || 0), 0);
    const processed = runs.reduce((s, r) => s + Number(r.employee_count || 0), 0);
    const leadStatus = runs.reduce(
      (best, r) => ((RUN_RANK[r.status] || 0) > (RUN_RANK[best] || 0) ? r.status : best),
      null,
    );
    return { runs, netTotal, deductions, processed, leadStatus };
  }, [payroll.runs]);

  const expiringTotal = Number(docs.summary?.totalExpiring || 0);
  const criticalTotal =
    Number(docs.summary?.expired || 0) + Number(docs.summary?.critical || 0);

  const statCards = [
    {
      icon: MdOutlinePeople,
      iconBg: "bg-cyan-50",
      iconColor: "text-cyan-500",
      tag: t("statCards.totalEmployees"),
      value: org.denied || org.failed ? "—" : fmtNumber(totalEmployees),
      badge: newHires > 0 ? t("badges.newThisMonth", { count: newHires }) : "",
      badgeColor: "text-green-500",
    },
    {
      icon: MdOutlineListAlt,
      iconBg: "bg-green-50",
      iconColor: "text-green-500",
      tag: t("statCards.activeProjects"),
      value: org.denied || org.failed ? "—" : fmtNumber(Number(org.active_projects || 0)),
      badge: t("badges.active"),
      badgeColor: "text-green-500",
    },
    {
      icon: MdOutlinePendingActions,
      iconBg: "bg-orange-50",
      iconColor: "text-orange-500",
      tag: t("statCards.pendingApprovals"),
      value:
        approvals.denied || approvals.failed ? "—" : fmtNumber(actionable.length),
      badge: actionable.length > 0 ? t("badges.actionRequired") : t("badges.allClear"),
      badgeColor: actionable.length > 0 ? "text-orange-500" : "text-green-500",
    },
    {
      icon: MdOutlineCheckCircle,
      iconBg: "bg-green-50",
      iconColor: "text-green-500",
      tag: t("statCards.payrollStatus"),
      value:
        payroll.denied || payroll.failed
          ? "—"
          : fmtDate(today, { month: "short", year: "numeric" }),
      valueStyle: "text-2xl font-bold text-gray-900",
      badge: payrollMonth.leadStatus
        ? t(STATUS_BADGE[payrollMonth.leadStatus] || "badges.pending")
        : t("badges.notStarted"),
      badgeColor: payrollMonth.leadStatus ? "text-green-500" : "text-gray-400",
    },
    {
      icon: MdOutlineWarning,
      iconBg: "bg-red-50",
      iconColor: "text-red-500",
      tag: t("statCards.expiringDocuments"),
      value: docs.denied || docs.failed ? "—" : fmtNumber(expiringTotal),
      badge: criticalTotal > 0 ? t("badges.critical") : t("badges.allClear"),
      badgeColor: criticalTotal > 0 ? "text-red-500" : "text-green-500",
    },
  ];

  // ── actions ────────────────────────────────────────────────────────────────
  // Approve / reject through the shared dialog (a reason when the owner decides on someone's behalf).
  const act = (item, action) => setDecision({ request: item, action });

  const exportReport = () => {
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        [t("header.title"), fmtDate(today)],
        [],
        [t("statCards.totalEmployees"), totalEmployees],
        [t("distribution.fullTime"), fullTime],
        [t("distribution.contract"), contract],
        [t("distribution.unspecified"), unspecified],
        [t("statCards.activeProjects"), Number(org.active_projects || 0)],
        [t("statCards.pendingApprovals"), actionable.length],
        [t("statCards.expiringDocuments"), expiringTotal],
        [],
        [t("attendance.title"), fmtDate(today)],
        [t("attendance.present"), Number(attendance.present || 0)],
        [t("attendance.absent"), Number(attendance.absent || 0)],
        [t("attendance.onLeave"), Number(attendance.on_leave || 0)],
        [],
        [t("payroll.title"), fmtDate(today, { month: "short", year: "numeric" })],
        [t("payroll.netTotal"), payrollMonth.netTotal],
        [t("payroll.totalDeductions"), payrollMonth.deductions],
        [t("payroll.employeesProcessed"), payrollMonth.processed],
      ]),
      t("export.sheets.summary"),
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        asArray(docs.rows).map((d) => ({
          [t("compliance.table.employee")]: d.employee?.name || "",
          [t("compliance.table.documentType")]: d.type?.label || d.type?.code || "",
          [t("compliance.table.expiryDate")]: d.expiry_date || "",
          [t("compliance.table.status")]: d.bucket || "",
          [t("compliance.daysRemaining")]: d.days_remaining,
        })),
      ),
      t("export.sheets.compliance"),
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        asArray(projects.rows).map((p) => ({
          [t("export.columns.project")]: p.project_name || "",
          [t("compliance.table.status")]: p.status || "",
          [t("projects.staffHeader")]: p.employee_count ?? 0,
        })),
      ),
      t("export.sheets.projects"),
    );

    XLSX.writeFile(wb, `hrms-dashboard-${todayStr}.xlsx`);
  };

  const actionSubtitle = (item) => {
    if (item.entity_type === "LEAVE_REQUEST") {
      return [item.from_date && fmtDate(item.from_date), item.to_date && fmtDate(item.to_date)]
        .filter(Boolean)
        .join(" – ");
    }
    if (item.entity_type === "OVERTIME_REQUEST") {
      return [item.work_date && fmtDate(item.work_date), item.overtime_hours && `${item.overtime_hours}h`]
        .filter(Boolean)
        .join(" · ");
    }
    if (item.entity_type === "ATTENDANCE_CORRECTION") {
      return [item.work_date && fmtDate(item.work_date), item.check_in_time && `${item.check_in_time} – ${item.check_out_time || "—"}`]
        .filter(Boolean)
        .join(" · ");
    }
    if (item.entity_type === "LEAVE_ENCASHMENT") {
      return [item.leave_type, item.total_days && `${item.total_days}d`, item.payout_month].filter(Boolean).join(" · ");
    }
    return item.request_code || "";
  };

  const actionLabel = (item) => {
    if (item.entity_type === "LEAVE_REQUEST")
      return item.leave_type || t("actionCenter.types.leave");
    if (item.entity_type === "OVERTIME_REQUEST") return t("actionCenter.types.overtime");
    if (["ATTENDANCE_CORRECTION", "CORRECTION_REQUEST"].includes(String(item.entity_type).toUpperCase()))
      return t("actionCenter.types.correction");
    if (String(item.entity_type).toUpperCase() === "LEAVE_REQUEST") return t("actionCenter.types.leave");
    if (String(item.entity_type).toUpperCase() === "OVERTIME_REQUEST") return t("actionCenter.types.overtime");
    if (item.entity_type === "LEAVE_ENCASHMENT") return t("actionCenter.types.leaveEncashment");
    return item.type || item.module_key || "";
  };

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
        <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
          <button
            onClick={exportReport}
            disabled={loading}
            className="flex items-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
          >
            <MdOutlineDownload className="text-base" /> {t("buttons.exportReport")}
          </button>
          <button
            onClick={() => navigate("/admin/employees/add-employee")}
            className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm transition-colors"
          >
            <MdOutlinePersonAdd className="text-lg" /> {t("buttons.newHire")}
          </button>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        {statCards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.tag} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div
                  className={`w-9 h-9 ${c.iconBg} rounded-lg flex items-center justify-center`}
                >
                  <Icon className={`${c.iconColor} text-lg`} />
                </div>
                {c.badge && (
                  <span className={`text-[10px] font-bold ${c.badgeColor}`}>{c.badge}</span>
                )}
              </div>
              <p className="text-[11px] text-gray-400 mb-1">{c.tag}</p>
              {loading ? (
                <div className="h-8 w-16 bg-gray-100 rounded animate-pulse" />
              ) : (
                <Ltr
                  as="p"
                  className={c.valueStyle || "text-3xl font-bold text-gray-900"}
                >
                  {c.value}
                </Ltr>
              )}
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
            <h3 className="text-sm font-bold text-gray-900">{t("distribution.title")}</h3>
          </div>
          <WidgetState state={{ ...org, loading }} t={t}>
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <DonutChart
                total={totalEmployees}
                fmtNumber={fmtNumber}
                totalStaffLabel={t("distribution.totalStaff")}
                segments={[
                  { label: "full", value: fullTime, color: "#06b6d4" },
                  { label: "contract", value: contract, color: "#818cf8" },
                ]}
              />
              <div className="flex-1 space-y-4 w-full">
                {[
                  { label: t("distribution.fullTime"), value: fullTime, dot: "bg-cyan-500" },
                  { label: t("distribution.contract"), value: contract, dot: "bg-indigo-400" },
                  ...(unspecified > 0
                    ? [
                        {
                          label: t("distribution.unspecified"),
                          value: unspecified,
                          dot: "bg-gray-200",
                        },
                      ]
                    : []),
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${row.dot} flex-shrink-0`} />
                      <span className="text-sm text-gray-700">{row.label}</span>
                    </div>
                    <span className="text-sm font-bold text-gray-900">
                      <Ltr>{`${fmtNumber(row.value)} (${pct(row.value, totalEmployees)}%)`}</Ltr>
                    </span>
                  </div>
                ))}
                <p className="text-xs text-gray-400 pt-2 border-t border-gray-50">
                  {t("distribution.note")}
                </p>
              </div>
            </div>
          </WidgetState>
        </div>

        {/* Attendance Overview */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between gap-2 mb-5">
            <div className="flex items-center gap-2">
              <MdOutlineBarChart className="text-cyan-500 text-xl" />
              <h3 className="text-sm font-bold text-gray-900">{t("attendance.title")}</h3>
            </div>
            <span className="text-[11px] text-gray-400">{fmtDate(today)}</span>
          </div>
          <WidgetState state={{ ...attendance, loading }} t={t}>
            <div className="space-y-5">
              {[
                {
                  label: t("attendance.present"),
                  count: Number(attendance.present || 0),
                  color: "bg-green-500",
                  dot: "bg-green-500",
                },
                {
                  label: t("attendance.absent"),
                  count: Number(attendance.absent || 0),
                  color: "bg-red-500",
                  dot: "bg-red-500",
                },
                {
                  label: t("attendance.onLeave"),
                  count: Number(attendance.on_leave || 0),
                  color: "bg-amber-400",
                  dot: "bg-amber-400",
                },
              ].map(({ label, count, color, dot }) => (
                <div key={label}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="text-gray-700">{label}</span>
                    <span className="font-bold text-gray-900">
                      <Ltr>{`${fmtNumber(count)} (${pct(count, attTotal)}%)`}</Ltr>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${dot} flex-shrink-0`} />
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${color} rounded-full`}
                        style={{ width: `${pct(count, attTotal)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </WidgetState>
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
            {actionable.length > ACTION_PREVIEW && (
              <button
                onClick={() => setShowAllActions((v) => !v)}
                className="text-sm font-semibold text-cyan-600 hover:text-cyan-700 transition-colors"
              >
                {showAllActions
                  ? t("buttons.showLess")
                  : t("buttons.viewAllTasks", { count: actionable.length })}
              </button>
            )}
          </div>
          <WidgetState
            state={{ ...approvals, loading }}
            t={t}
            onRetry={inbox.reload}
            className="bg-white border border-gray-200 rounded-xl"
          >
            <div className="space-y-3">
              {visibleActions.map((item) => {
                const busy = false;
                return (
                  <div
                    key={item.approval_request_id}
                    className="bg-white border border-gray-200 rounded-xl px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-4"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-full ${AVATAR_COLORS[String(item.approval_request_id).charCodeAt(0) % AVATAR_COLORS.length]} text-white text-xs font-bold flex items-center justify-center flex-shrink-0`}
                      >
                        {initialsOf(item.employee_name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-gray-800 truncate">
                          <strong>{item.employee_name || "—"}</strong>{" "}
                          {t("actionCenter.requested")} <strong>{actionLabel(item)}</strong>
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          <Ltr>{actionSubtitle(item)}</Ltr>
                          {item.total_levels > 1 && (
                            <span className="ms-2">
                              <Ltr>{`L${item.current_level}/${item.total_levels}`}</Ltr>
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-auto">
                      <button
                        onClick={() => act(item, "REJECT")}
                        disabled={busy}
                        className="px-4 py-1.5 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        {t("actionCenter.actions.reject")}
                      </button>
                      <button
                        onClick={() => act(item, "APPROVE")}
                        disabled={busy}
                        className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                      >
                        {t("actionCenter.actions.approve")}
                      </button>
                    </div>
                  </div>
                );
              })}
              {actionable.length === 0 && (
                <div className="bg-white border border-gray-200 rounded-xl px-5 py-10 text-center text-sm text-gray-400">
                  {t("actionCenter.emptyState")}
                </div>
              )}
            </div>
          </WidgetState>
        </div>

        {/* Payroll Snapshot */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <MdOutlineReceiptLong className="text-cyan-500 text-xl" />
            <h3 className="text-base font-bold text-gray-900">{t("payroll.title")}</h3>
          </div>
          <div className="bg-cyan-600 rounded-xl p-5 text-white flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-200 mb-2">
              {t("payroll.cycle")} · {fmtDate(today, { month: "short", year: "numeric" })}
            </p>
            {loading ? (
              <div className="h-10 w-40 bg-cyan-500/60 rounded animate-pulse mb-4" />
            ) : payroll.denied || payroll.failed ? (
              <p className="text-sm text-cyan-100 mb-4">
                {payroll.denied ? t("errors.noAccess") : t("errors.loadFailed")}
              </p>
            ) : (
              <>
                <Ltr as="p" className="text-4xl font-bold mb-4">
                  {fmtNumber(payrollMonth.netTotal, { maximumFractionDigits: 0 })}
                </Ltr>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-cyan-100">{t("payroll.employeesProcessed")}</span>
                      <Ltr className="font-bold text-white">
                        {`${fmtNumber(payrollMonth.processed)} / ${fmtNumber(totalEmployees)}`}
                      </Ltr>
                    </div>
                    <div className="h-1.5 bg-cyan-500 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white rounded-full"
                        style={{ width: `${pct(payrollMonth.processed, totalEmployees)}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex justify-between text-sm pt-1 border-t border-cyan-500">
                    <span className="text-cyan-100">{t("payroll.totalDeductions")}</span>
                    <Ltr className="font-bold text-white">
                      {fmtNumber(payrollMonth.deductions, { maximumFractionDigits: 0 })}
                    </Ltr>
                  </div>
                  {payrollMonth.runs.length === 0 && (
                    <p className="text-xs text-cyan-100 pt-1">{t("payroll.noRun")}</p>
                  )}
                </div>
              </>
            )}
            <button
              onClick={() => navigate("/admin/payroll-overview/run-payroll")}
              className="w-full mt-4 bg-white text-cyan-600 hover:bg-cyan-50 font-bold py-2.5 rounded-lg text-sm transition-colors"
            >
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
              <h3 className="text-base font-bold text-gray-900">{t("compliance.title")}</h3>
            </div>
            {criticalTotal > 0 && (
              <span className="text-xs font-bold text-red-500 bg-red-50 border border-red-100 px-2.5 py-1 rounded-full">
                {t("compliance.criticalCount", { count: criticalTotal })}
              </span>
            )}
          </div>

          <WidgetState state={{ ...docs, loading }} t={t}>
            {asArray(docs.rows).length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-400">
                {t("compliance.empty", { days: EXPIRY_WINDOW_DAYS })}
              </p>
            ) : (
              <>
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
                      {asArray(docs.rows).slice(0, 5).map((row) => {
                        const style = BUCKET_STYLE[row.bucket] || BUCKET_STYLE.WARNING;
                        return (
                          <tr key={row.document_id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-5 py-3.5 text-sm font-semibold text-gray-900">
                              {row.employee?.name || "—"}
                            </td>
                            <td className="px-5 py-3.5 text-sm text-gray-600">
                              {row.type?.label || row.type?.code || "—"}
                            </td>
                            <td className="px-5 py-3.5 text-sm text-gray-600">
                              <Ltr>{row.expiry_date ? fmtDate(row.expiry_date) : "—"}</Ltr>
                            </td>
                            <td className="px-5 py-3.5">
                              <span
                                className={`flex items-center gap-1.5 text-sm font-semibold ${style.color}`}
                              >
                                <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                                {t(style.key)}
                              </span>
                            </td>
                            <td className="px-5 py-3.5">
                              <button
                                onClick={() =>
                                  row.employee?.id && navigate(`/admin/employees/${row.employee.id}`)
                                }
                                className="text-sm font-bold text-cyan-600 hover:text-cyan-700 transition-colors"
                              >
                                {t("compliance.actions.view")}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="sm:hidden divide-y divide-gray-50">
                  {asArray(docs.rows).slice(0, 5).map((row) => {
                    const style = BUCKET_STYLE[row.bucket] || BUCKET_STYLE.WARNING;
                    return (
                      <div key={row.document_id} className="px-4 py-3.5 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-gray-900">
                            {row.employee?.name || "—"}
                          </p>
                          <button
                            onClick={() =>
                              row.employee?.id && navigate(`/admin/employees/${row.employee.id}`)
                            }
                            className="text-sm font-bold text-cyan-600"
                          >
                            {t("compliance.actions.view")}
                          </button>
                        </div>
                        <p className="text-xs text-gray-500">
                          {row.type?.label || row.type?.code || "—"} •{" "}
                          {t("compliance.expiresLabel")}{" "}
                          <Ltr>{row.expiry_date ? fmtDate(row.expiry_date) : "—"}</Ltr>
                        </p>
                        <span
                          className={`flex items-center gap-1 text-xs font-semibold ${style.color}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                          {t(style.key)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </WidgetState>
        </div>

        {/* Recent Activity */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
            <MdOutlineHistory className="text-cyan-500 text-xl" />
            <h3 className="text-base font-bold text-gray-900">{t("activity.title")}</h3>
          </div>
          <WidgetState state={{ ...activity, loading }} t={t}>
            {asArray(activity.rows).length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-400">{t("activity.empty")}</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {asArray(activity.rows).map((item) => (
                  <div key={item.id} className="flex items-start gap-3 px-5 py-4">
                    <div className="w-8 h-8 bg-cyan-50 rounded-full flex items-center justify-center flex-shrink-0">
                      <MdOutlineNotificationsNone className="text-cyan-500 text-base" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 leading-snug">
                        {item.title}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{item.message}</p>
                      <p className="text-[10px] text-gray-300 mt-1">
                        <Ltr>
                          {item.created_at
                            ? fmtDate(item.created_at, {
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : ""}
                        </Ltr>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </WidgetState>
        </div>
      </div>

      {/* ── Active Project Overview ── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <MdOutlineRocketLaunch className="text-cyan-500 text-xl" />
          <h3 className="text-base font-bold text-gray-900">{t("projects.title")}</h3>
        </div>
        <WidgetState state={{ ...projects, loading }} t={t}>
          {asArray(projects.rows).length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl px-5 py-10 text-center text-sm text-gray-400">
              {t("projects.empty")}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {asArray(projects.rows).slice(0, 4).map((proj, idx) => (
                <button
                  key={proj.id}
                  onClick={() => navigate("/admin/projects")}
                  className="text-start bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3 gap-2">
                    <h4 className="text-sm font-bold text-gray-900 truncate">
                      {proj.project_name || `#${proj.id}`}
                    </h4>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${
                        PROJECT_STATUS_STYLE[proj.status] ||
                        "text-gray-600 bg-gray-50 border-gray-200"
                      }`}
                    >
                      {t(`projects.statusLabels.${proj.status}`, proj.status)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    {Number(proj.employee_count || 0) > 0 ? (
                      <div
                        className={`w-7 h-7 rounded-full ${AVATAR_COLORS[idx % AVATAR_COLORS.length]} text-white text-[10px] font-bold flex items-center justify-center`}
                      >
                        {initialsOf(proj.project_name)}
                      </div>
                    ) : (
                      <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                        {t("projects.tbd")}
                      </span>
                    )}
                    <span className="text-xs text-gray-500 font-medium">
                      {t("projects.staff", { count: Number(proj.employee_count || 0) })}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </WidgetState>
      </div>

      {decision && (
        <ApprovalDecisionModal
          request={decision.request}
          action={decision.action}
          onClose={() => setDecision(null)}
          onDone={() => {
            setDecision(null);
            inbox.reload();
          }}
        />
      )}
    </div>
  );
}

export default Dashboard;
