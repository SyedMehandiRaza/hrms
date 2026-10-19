import { useEffect, useState } from "react";
import {
  MdOutlineCalendarToday,
  MdAddCircleOutline,
  MdOutlineListAlt,
  MdOutlinePendingActions,
  MdOutlineCheckCircle,
  MdOutlineDoNotDisturb,
  MdOutlineMoreVert,
  MdOutlineTrendingUp,
  MdOutlineAccessTime,
  MdInfoOutline,
  MdVisibility,
  MdSearch,
  MdOutlineClear,
} from "react-icons/md";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import Pagination from "../../components/Pagination";
import ConfirmationModal from "../../components/ConfirmationModal";
import Ltr from "../../components/Ltr";
import LevelProgress from "../../components/LevelProgress";
import { useFormat } from "../../hooks/useFormat";
import useFiscalYear from "../../hooks/useFiscalYear";
import useYearLock from "../../hooks/useYearLock";
import { matches, paginate } from "../../data/common";
import {
  LR_REQUESTS,
  LR_applyAction,
  LR_save,
  LR_sortNewest,
  LR_summaryOf,
} from "../../data/groupD";

// Leave-request status → badge styling for the recent-requests list.
const REQ_STATUS_COLORS = {
  PENDING: "bg-orange-50 border-orange-200 text-orange-600",
  APPROVED: "bg-green-50 border-green-200 text-green-600",
  REJECTED: "bg-red-50 border-red-200 text-red-600",
};

const AVATAR_COLORS = [
  "bg-slate-600",
  "bg-rose-500",
  "bg-amber-600",
  "bg-cyan-600",
  "bg-violet-600",
  "bg-emerald-600",
];

const initials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "?";

const getStatCards = (t, s) => [
  {
    tag: t("dashboard.stats.thisMonth"),
    tagColor: "text-gray-400",
    icon: MdOutlineListAlt,
    iconBg: "bg-cyan-50",
    iconColor: "text-cyan-500",
    label: t("dashboard.stats.totalRequests"),
    value: s?.total_requests ?? "—",
    sub: (
      <span className="flex items-center gap-1 text-xs text-green-500 font-semibold">
        <MdOutlineTrendingUp />
        {t("dashboard.stats.fromLastMonth", { value: "8%" })}
      </span>
    ),
  },
  {
    tag: t("dashboard.stats.actionNeeded"),
    tagColor: "text-orange-500",
    icon: MdOutlinePendingActions,
    iconBg: "bg-orange-50",
    iconColor: "text-orange-500",
    label: t("dashboard.stats.pendingApprovals"),
    value: s?.pending ?? "—",
    sub: (
      <span className="flex items-center gap-1 text-xs text-orange-500">
        <MdOutlineAccessTime className="text-sm" />
        {t("dashboard.stats.avgResponse")} <strong>4.2h</strong>
      </span>
    ),
  },
  {
    tag: t("dashboard.stats.systemFinalized"),
    tagColor: "text-green-500",
    icon: MdOutlineCheckCircle,
    iconBg: "bg-green-50",
    iconColor: "text-green-500",
    label: t("dashboard.stats.approvedRequests"),
    value: s?.approved ?? "—",
    sub: (
      <span className="text-xs text-gray-400">
        {t("dashboard.stats.compliancePassed")}
      </span>
    ),
  },
  {
    tag: t("dashboard.stats.liveStatus"),
    tagColor: "text-purple-500",
    icon: MdOutlineDoNotDisturb,
    iconBg: "bg-purple-50",
    iconColor: "text-purple-500",
    label: t("dashboard.stats.todaysAbsence"),
    value: s?.on_leave_today ?? "—",
    sub: (
      <span className="flex items-center gap-1 text-xs text-purple-500">
        <MdInfoOutline className="text-sm" />
        {s?.on_leave_today === 1
          ? "1 Employee on leave"
          : `${s?.on_leave_today || 0} Employees on leave`}
      </span>
    ),
  },
];

function LeaveManagement() {
  const { t } = useTranslation("leaves");
  const { fmtDate } = useFormat();
  const navigate = useNavigate();
  const fy = useFiscalYear();
  const lock = useYearLock();

  // Static sample requests; the summary and lists are derived from them.
  const [allRows, setAllRows] = useState(() => LR_sortNewest(LR_REQUESTS));
  const fyRows = allRows.filter((r) => fy.inFy(r.from_date));
  const summary = LR_summaryOf(fyRows, fy.today);
  const STAT_CARDS = getStatCards(t, summary);

  const recentLoading = false;

  const onLeaveTodayLoading = false;
  const [onLeaveTodayPage, setOnLeaveTodayPage] = useState(1);
  const [onLeaveTodaySearch, setOnLeaveTodaySearch] = useState("");
  const [onLeaveTodayAppliedSearch, setOnLeaveTodayAppliedSearch] = useState("");

  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState(null);
  // approve | reject — the dashboard no longer opens this modal itself.
  const [actionType] = useState("");
  const [statusType] = useState("");

  // Recent leave requests across the company (not just my approvals) so the
  // dashboard surfaces requests without having to open "View All".
  const decorateRecent = (req, i) => ({
    id: req.id,
    name: req.employee_name || "—",
    role: req.leave_type || "",
    type: req.leave_type || "—",
    dates: `${fmtDate(req.from_date)} – ${fmtDate(req.to_date)}`,
    days: `${req.total_days} ${t("dashboard.daysLabel", "Days")}`,
    status: (req.status || "PENDING").toUpperCase(),
    avatar: initials(req.employee_name),
    profile_url: req.profile_url,
    color: AVATAR_COLORS[i % AVATAR_COLORS.length],
    levelsSummary: req.levels_summary || [],
    currentLevel: req.current_level,
  });

  const recent = fyRows.slice(0, 5).map(decorateRecent);

  // "today" in the company timezone, whatever year the switcher shows
  const onLeaveTodayPaged = paginate(
    allRows.filter(
      (r) =>
        r.status === "APPROVED" &&
        r.from_date <= fy.today &&
        r.to_date >= fy.today &&
        matches(r, onLeaveTodayAppliedSearch, ["employee_name", "leave_type", "country_emp_id"]),
    ),
    onLeaveTodayPage,
    5,
  );
  const onLeaveToday = onLeaveTodayPaged.rows.map(decorateRecent);
  const onLeaveTodayTotal = onLeaveTodayPaged.total;
  const onLeaveTodayTotalPages = onLeaveTodayPaged.totalPages;

  useEffect(() => {
    const handler = setTimeout(() => {
      if (onLeaveTodaySearch !== onLeaveTodayAppliedSearch) {
        setOnLeaveTodayPage(1);
        setOnLeaveTodayAppliedSearch(onLeaveTodaySearch);
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [onLeaveTodaySearch, onLeaveTodayAppliedSearch]);

  const handleConfirm = () => {
    if (!selectedLeave) return;
    const raw = allRows.find(
      (r) => r.approval_request_id === selectedLeave.id || r.id === selectedLeave.leaveRequestId,
    );
    if (raw) LR_save(LR_applyAction(raw, actionType === "approve" ? "APPROVE" : "REJECT"));
    setAllRows(LR_sortNewest(LR_REQUESTS));
    toast.success(
      actionType === "approve"
        ? t("dashboard.confirm.approvedToast", "Leave approved")
        : t("dashboard.confirm.rejectedToast", "Leave rejected"),
    );
    setShowConfirm(false);
    setSelectedLeave(null);
  };


  const upcoming = (summary.upcoming || []).map((u, i) => {
    return {
      id: i,
      name: u.employee_name || "—",
      type: u.leave_type || "—",
      dates: `${fmtDate(u.from_date)} – ${fmtDate(u.to_date)}`,
      days: `${u.total_days} ${t("dashboard.daysLabel", "Days")}`,
      status: (u.status || "APPROVED").toUpperCase(),
      avatar: initials(u.employee_name),
      profile_url: u.profile_url,
      color: AVATAR_COLORS[i % AVATAR_COLORS.length],
    };
  });

  return (
    <>
      <div className="space-y-6">
        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
              {t("dashboard.title")}
            </h1>
            <p className="text-gray-400 mt-1 text-sm">
              {t("dashboard.subtitle")}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
            <Link
              to="/admin/leave-management/leave-calender"
              className="flex items-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors"
            >
              <MdOutlineCalendarToday className="text-base" /> {t("common.viewCalendar")}
            </Link>
            {!lock.locked && (
              <Link
                to="/admin/leave-management/apply-leave"
                className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm transition-colors"
              >
                <MdAddCircleOutline className="text-lg" /> {t("common.applyLeave")}
              </Link>
            )}
          </div>
        </div>

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {STAT_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className="bg-white border border-gray-200 rounded-xl p-5"
              >
                <div className="flex items-start justify-between mb-3">
                  <div
                    className={`w-10 h-10 ${card.iconBg} rounded-lg flex items-center justify-center`}
                  >
                    <Icon className={`${card.iconColor} text-xl`} />
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider ${card.tagColor}`}
                  >
                    {card.tag}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mb-1">{card.label}</p>
                <p className="text-3xl font-bold text-gray-900 mb-2">
                  {card.value}
                </p>
                {card.sub}
              </div>
            );
          })}
        </div>

        {/* ── Recent Leave Requests (all requests, not only my approvals) ── */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="text-base font-bold text-gray-900">
              {t("dashboard.recentRequests", { defaultValue: "Recent Leave Requests" })}
            </h3>
            <button
              onClick={() =>
                navigate("/admin/leave-management/view-all-requests")
              }
              className="cursor-pointer text-sm font-semibold text-cyan-600 hover:text-cyan-700 transition-colors"
            >
              {t("common.viewAll")}
            </button>
          </div>

          {/* Desktop Table Header */}
          <div className="hidden md:grid grid-cols-[0.5fr_2fr_1.3fr_1.5fr_1.2fr_1fr_auto] gap-4 px-5 py-3 border-b border-gray-50">
            {[
              t("dashboard.table.sn"),
              t("dashboard.table.employee"),
              t("dashboard.table.type"),
              t("dashboard.table.dates"),
              t("viewAll.table.level", { defaultValue: "Level" }),
              t("dashboard.table.status"),
              t("dashboard.table.reviewAction"),
            ].map((h, i) => (
              <p
                key={`${h}-${i}`}
                className="text-[10px] font-bold text-gray-400 uppercase tracking-wider"
              >
                {h}
              </p>
            ))}
          </div>

          <div className="divide-y divide-gray-50">
            {recentLoading && recent.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">
                {t("dashboard.loading", "Loading...")}
              </div>
            ) : recent.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">
                {t("dashboard.noRecentRequests", {
                  defaultValue: "No leave requests yet.",
                })}
              </div>
            ) : (
              recent.map((row, index) => (
                <div key={row.id} className="px-5 py-4 hover:bg-gray-100">
                  {/* Desktop Row */}
                  <div className="hidden md:grid grid-cols-[0.5fr_2fr_1.3fr_1.5fr_1.2fr_1fr_auto] gap-4 items-center">
                    <p className="text-sm font-semibold text-gray-600">
                      {index + 1}
                    </p>
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded ${row.color} text-white text-xs font-bold flex items-center justify-center flex-shrink-0 overflow-hidden`}
                      >
                        {row.profile_url ? (
                          <img src={row.profile_url} alt={row.name} className="w-full h-full object-cover" />
                        ) : (
                          row.avatar
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {row.name}
                        </p>
                        <p className="text-xs text-gray-400">{row.role}</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700">{row.type}</p>
                    <div>
                      <p className="text-sm text-gray-700">
                        <Ltr>{row.dates}</Ltr>
                      </p>
                      <p className="text-xs text-gray-400">{row.days}</p>
                    </div>
                    <LevelProgress
                      levels={row.levelsSummary}
                      currentLevel={row.currentLevel}
                    />
                    <span
                      className={`inline-flex items-center w-fit px-2.5 py-1 rounded-md border text-[11px] font-bold uppercase tracking-wide ${
                        REQ_STATUS_COLORS[row.status] ||
                        "bg-gray-50 border-gray-200 text-gray-500"
                      }`}
                    >
                      {t(`status.${row.status.toLowerCase()}`)}
                    </span>
                    <button
                      onClick={() =>
                        navigate(
                          `/admin/leave-management/review-leave-request?id=${row.id}`,
                        )
                      }
                      className="w-8 h-8 flex items-center cursor-pointer justify-center text-gray-300 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors"
                    >
                      <MdVisibility className="text-xl" />
                    </button>
                  </div>

                  {/* Mobile Card */}
                  <div className="md:hidden space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-full ${row.color} text-white text-xs font-bold flex items-center justify-center flex-shrink-0 overflow-hidden`}
                        >
                          {row.profile_url ? (
                            <img src={row.profile_url} alt={row.name} className="w-full h-full object-cover" />
                          ) : (
                            row.avatar
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {row.name}
                          </p>
                          <p className="text-xs text-gray-400">{row.role}</p>
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase flex-shrink-0 ${
                          REQ_STATUS_COLORS[row.status] ||
                          "bg-gray-50 border-gray-200 text-gray-500"
                        }`}
                      >
                        {t(`status.${row.status.toLowerCase()}`)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                      <span>
                        <strong className="text-gray-700">{row.type}</strong>
                      </span>
                      <span>
                        <Ltr>{row.dates}</Ltr> • {row.days}
                      </span>
                    </div>
                    <LevelProgress
                      levels={row.levelsSummary}
                      currentLevel={row.currentLevel}
                    />
                    <button
                      onClick={() =>
                        navigate(
                          `/admin/leave-management/review-leave-request?id=${row.id}`,
                        )
                      }
                      className="flex items-center gap-1.5 w-full px-3 py-1.5 border border-gray-200 text-gray-600 hover:border-cyan-300 hover:text-cyan-600 rounded-lg text-xs font-medium transition-colors"
                    >
                      <MdVisibility className="text-base" /> {t("dashboard.actions.view")}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Bottom row: 2 Cards ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start mt-4">
          {/* Upcoming Leaves */}
          <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col h-full">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <h3 className="text-base font-bold text-gray-900">
                {t("dashboard.upcomingLeaves")}
              </h3>
              <button className="p-1 text-gray-400 hover:text-gray-700 rounded-md transition-colors">
                <MdOutlineMoreVert />
              </button>
            </div>

            {/* Desktop Table Header */}
            <div className="hidden md:grid grid-cols-[2fr_1.5fr_1.5fr_1fr] gap-4 px-5 py-3 border-b border-gray-50 flex-shrink-0">
              {[
                t("dashboard.table.employee"),
                t("dashboard.table.type"),
                t("dashboard.table.dates"),
                t("dashboard.table.status"),
              ].map((h, idx) => (
                <p
                  key={idx}
                  className="text-[10px] font-bold text-gray-400 uppercase tracking-wider"
                >
                  {h}
                </p>
              ))}
            </div>

            <div className="divide-y divide-gray-50 flex-1 overflow-y-auto max-h-[300px]">
              {upcoming.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-400">
                  {t("dashboard.noUpcoming", "No upcoming leaves.")}
                </div>
              ) : (
                upcoming.map((row) => (
                  <div key={row.id} className="px-5 py-4 hover:bg-gray-100">
                    {/* Desktop Row */}
                    <div className="hidden md:grid grid-cols-[2fr_1.5fr_1.5fr_1fr] gap-4 items-center">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded ${row.color} text-white text-xs font-bold flex items-center justify-center flex-shrink-0 overflow-hidden`}
                        >
                          {row.profile_url ? (
                            <img src={row.profile_url} alt={row.name} className="w-full h-full object-cover" />
                          ) : (
                            row.avatar
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {row.name}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-700">{row.type}</p>
                      <div>
                        <p className="text-sm text-gray-700">
                          <Ltr>{row.dates}</Ltr>
                        </p>
                        <p className="text-xs text-gray-400">{row.days}</p>
                      </div>
                      <span
                        className={`inline-flex items-center w-fit px-2.5 py-1 rounded-md border text-[11px] font-bold uppercase tracking-wide ${
                          REQ_STATUS_COLORS[row.status] ||
                          "bg-green-50 border-green-200 text-green-600"
                        }`}
                      >
                        {t(`status.${row.status.toLowerCase()}`)}
                      </span>
                    </div>

                    {/* Mobile Card */}
                    <div className="md:hidden space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-full ${row.color} text-white text-xs font-bold flex items-center justify-center flex-shrink-0`}
                          >
                            {row.avatar}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              {row.name}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase flex-shrink-0 ${
                            REQ_STATUS_COLORS[row.status] ||
                            "bg-green-50 border-green-200 text-green-600"
                          }`}
                        >
                          {t(`status.${row.status.toLowerCase()}`)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span>
                          <strong className="text-gray-700">{row.type}</strong>
                        </span>
                        <span>
                          <Ltr>{row.dates}</Ltr> • {row.days}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Leave Policy Review */}
          <div className="bg-cyan-600 rounded-xl p-6 flex flex-col justify-between relative overflow-hidden">
            {/* Decorative background icon */}
            <div className="absolute bottom-0 end-4 opacity-10 text-[140px] leading-none select-none pointer-events-none">
              ✦
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-3">
                {t("dashboard.policyReview.title")}
              </h3>
              <p className="text-cyan-100 text-sm leading-relaxed mb-6">
                {t("dashboard.policyReview.body")}
              </p>
            </div>
            <Link
              to="/admin/leave-management/leave-policy"
              className="border border-white text-white hover:bg-white hover:text-cyan-600 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors w-fit z-10"
            >
              {t("dashboard.policyReview.cta")}
            </Link>
          </div>
        </div>


        {/* ── On Leave Today ── */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 border-b border-gray-100 gap-4">
            <h3 className="text-base font-bold text-gray-900 whitespace-nowrap">
              {t("dashboard.onLeaveToday", { defaultValue: "On Leave Today" })}
            </h3>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-[250px]">
                <MdSearch className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg pointer-events-none" />
                <input
                  type="text"
                  placeholder={t("common.search", { defaultValue: "Search employee..." })}
                  className="w-full ps-10 pe-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
                  value={onLeaveTodaySearch}
                  onChange={(e) => setOnLeaveTodaySearch(e.target.value)}
                />
              </div>
              <button 
                onClick={() => {
                  setOnLeaveTodaySearch("");
                  setOnLeaveTodayAppliedSearch("");
                  setOnLeaveTodayPage(1);
                }}
                className="flex justify-center items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors whitespace-nowrap"
              >
                <MdOutlineClear className="text-base" />
                {t("common.clear", { defaultValue: "Clear Filter" })}
              </button>
            </div>
          </div>
          
          <div className="hidden md:grid grid-cols-[0.5fr_2fr_1.3fr_1.5fr_1.2fr_1fr_auto] gap-4 px-5 py-3 border-b border-gray-50">
            {[
              t("dashboard.table.sn", { defaultValue: "S/N" }),
              t("dashboard.table.employee", { defaultValue: "Employee" }),
              t("dashboard.table.type", { defaultValue: "Leave Type" }),
              t("dashboard.table.dates", { defaultValue: "Dates" }),
              t("viewAll.table.level", { defaultValue: "Level" }),
              t("dashboard.table.status", { defaultValue: "Status" }),
              t("dashboard.table.reviewAction", { defaultValue: "Action" }),
            ].map((h, i) => (
              <p
                key={`onleave-${h}-${i}`}
                className="text-[10px] font-bold text-gray-400 uppercase tracking-wider"
              >
                {h}
              </p>
            ))}
          </div>

          <div className="divide-y divide-gray-50">
            {onLeaveTodayLoading && onLeaveToday.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">
                {t("dashboard.loading", "Loading...")}
              </div>
            ) : onLeaveToday.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">
                {t("dashboard.noOnLeaveToday", { defaultValue: "No employees on leave today." })}
              </div>
            ) : (
              onLeaveToday.map((row, index) => (
                <div key={`onleave-${row.id}`} className="px-5 py-4 hover:bg-gray-100">
                  <div className="hidden md:grid grid-cols-[0.5fr_2fr_1.3fr_1.5fr_1.2fr_1fr_auto] gap-4 items-center">
                    <p className="text-sm font-semibold text-gray-600">
                      {(onLeaveTodayPage - 1) * 5 + index + 1}
                    </p>
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded ${row.color} text-white text-xs font-bold flex items-center justify-center flex-shrink-0 overflow-hidden`}>
                        {row.profile_url ? (
                          <img src={row.profile_url} alt={row.name} className="w-full h-full object-cover" />
                        ) : (
                          row.avatar
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{row.name}</p>
                        <p className="text-xs text-gray-400">{row.role}</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700">{row.type}</p>
                    <div>
                      <p className="text-sm text-gray-700"><Ltr>{row.dates}</Ltr></p>
                      <p className="text-xs text-gray-400">{row.days}</p>
                    </div>
                    <LevelProgress levels={row.levelsSummary} currentLevel={row.currentLevel} />
                    <span className={`inline-flex items-center w-fit px-2.5 py-1 rounded-md border text-[11px] font-bold uppercase tracking-wide ${REQ_STATUS_COLORS[row.status] || "bg-gray-50 border-gray-200 text-gray-500"}`}>
                      {t(`status.${row.status.toLowerCase()}`)}
                    </span>
                    <button onClick={() => navigate(`/admin/leave-management/review-leave-request?id=${row.id}`)} className="w-8 h-8 flex items-center cursor-pointer justify-center text-gray-300 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors">
                      <MdVisibility className="text-xl" />
                    </button>
                  </div>
                  <div className="md:hidden space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full ${row.color} text-white text-xs font-bold flex items-center justify-center flex-shrink-0 overflow-hidden`}>
                          {row.profile_url ? <img src={row.profile_url} alt={row.name} className="w-full h-full object-cover" /> : row.avatar}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{row.name}</p>
                          <p className="text-xs text-gray-400">{row.role}</p>
                        </div>
                      </div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase flex-shrink-0 ${REQ_STATUS_COLORS[row.status] || "bg-gray-50 border-gray-200 text-gray-500"}`}>
                        {t(`status.${row.status.toLowerCase()}`)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <div><p className="text-[10px] font-bold text-gray-400 uppercase">{t("dashboard.table.type", { defaultValue: "Type" })}</p><p className="text-xs font-semibold text-gray-700">{row.type}</p></div>
                      <div><p className="text-[10px] font-bold text-gray-400 uppercase">{t("dashboard.table.dates", { defaultValue: "Dates" })}</p><p className="text-xs font-semibold text-gray-700"><Ltr>{row.dates}</Ltr></p></div>
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
                      <LevelProgress levels={row.levelsSummary} currentLevel={row.currentLevel} />
                      <button onClick={() => navigate(`/admin/leave-management/review-leave-request?id=${row.id}`)} className="text-sm font-medium text-cyan-600 hover:text-cyan-700">{t("dashboard.table.reviewAction", { defaultValue: "Review" })}</button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          
          <Pagination
            page={onLeaveTodayPage}
            totalPages={onLeaveTodayTotalPages}
            total={onLeaveTodayTotal}
            limit={5}
            onPage={setOnLeaveTodayPage}
            label={t("dashboard.employees", { defaultValue: "employees" })}
            activeClass="bg-cyan-600 text-white"
            containerClass="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-gray-100 bg-gray-50/50 mt-auto"
          />
        </div>

      </div>

      <ConfirmationModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleConfirm}
        type={statusType}
        title={
          actionType === "approve"
            ? t("dashboard.confirm.approveTitle")
            : t("dashboard.confirm.rejectTitle")
        }
        message={
          actionType === "approve"
            ? t("dashboard.confirm.approveMessage", { name: selectedLeave?.name })
            : t("dashboard.confirm.rejectMessage", { name: selectedLeave?.name })
        }
        confirmText={
          actionType === "approve"
            ? t("dashboard.confirm.approve")
            : t("dashboard.confirm.reject")
        }
      />
    </>
  );
}

export default LeaveManagement;
