import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getStaticUser } from "../../../data/session";
import {
  MY_LEAVE_BALANCES,
  EMPLOYEE_DASHBOARD_STATS,
  EMPLOYEE_RECENT_REQUESTS,
  nextHolidayFrom,
} from "../../../data/groupH";
import {
  MdOutlineAccessTime,
  MdOutlineEventAvailable,
  MdOutlineWorkOff,
  MdOutlineTrendingUp,
  MdAddCircleOutline,
  MdOutlineDescription,
  MdOutlineFactCheck,
  MdOutlineNotificationsActive,
  MdHolidayVillage,
  MdOutlineFilePresent,
} from "react-icons/md";
import { capitalizeFirstLetter } from "../../../utils/assets";
import LeaveBalanceModal from "../../../components/LeaveBalanceModal";
import NoticeBanner from "../../../components/exits/NoticeBanner";
import CarriedLeaveNote from "../../../components/leave/CarriedLeaveNote";
import MyAnnualStatementsCard from "../../../components/fiscalYear/MyAnnualStatementsCard";
import useFiscalYear from "../../../hooks/useFiscalYear";
import { useFormat } from "../../../hooks/useFormat";

const buildEmployeeStatCards = (t, dashboardStats, myLeavesBalances, loading, setIsLeaveModalOpen, monthLabel) => {
  return [
    {
      id: "attendance",
      tag: t("employeeDashboard.cards.attendance", "Attendance"),
      icon: MdOutlineEventAvailable,
      color: "blue",
      value: dashboardStats.loading ? "..." : `${dashboardStats.daysPresent}/${dashboardStats.workingDays}`,
      sub: (
        <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
          <MdOutlineTrendingUp /> {t("employeeDashboard.cards.onTrack", "On Track")}
        </span>
      ),
      label: t("employeeDashboard.cards.daysPresent", "Days Present"),
    },
    {
      id: "leaves",
      tag: t("employeeDashboard.cards.leaves", "Leaves"),
      icon: MdOutlineWorkOff,
      color: "orange",
      value: loading ? "..." : (myLeavesBalances?.data?.total_available_balance || "0"),
      sub: (
        <span className="text-xs text-orange-600">
           {t("employeeDashboard.cards.availableBalance", "Available Balance")}
        </span>
      ),
      label: t("employeeDashboard.cards.availableLeaves", "Available Leaves"),
      onClick: () => setIsLeaveModalOpen(true)
    },
    {
      id: "overtime",
      tag: t("employeeDashboard.cards.overtime", "Overtime"),
      icon: MdOutlineAccessTime,
      color: "purple",
      value: dashboardStats.loading ? "..." : t("employeeDashboard.cards.hoursValue", { hours: dashboardStats.overtimeHours }),
      sub: <span className="text-xs text-purple-500">{monthLabel || t("employeeDashboard.cards.thisMonth", "This Month")}</span>,
      label: t("employeeDashboard.cards.overtimeHours", "Overtime Hours"),
    },
    {
      id: "holidays",
      tag: t("employeeDashboard.cards.holidays", "Holidays"),
      icon: MdHolidayVillage,
      color: "emerald",
      value: dashboardStats.loading ? "..." : (dashboardStats.nextHoliday ? new Date(dashboardStats.nextHoliday.holiday_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : t("employeeDashboard.cards.noHoliday")),
      sub: <span className="text-xs text-gray-400">{dashboardStats.nextHoliday ? dashboardStats.nextHoliday.holiday_name : t("employeeDashboard.cards.noUpcomingHolidays")}</span>,
      label: t("employeeDashboard.cards.nextHoliday", "Next Holiday"),
    },
  ];
};

function EmployeeDashboard() {
  const { t } = useTranslation(["dashboard", "nav"]);
  const sessionUser = getStaticUser();
  const user = { ...sessionUser, role: { name: sessionUser.role } };
  const myLeavesBalances = MY_LEAVE_BALANCES;
  const loading = false;
  const { fmtDate } = useFormat();

  // The header's financial year: the month cards cover today's month in the
  // current year, else that year's nearest month; balances are that year's.
  const fy = useFiscalYear();
  const statsMonth = fy.defaultMonth;
  const isCurrentMonth = statsMonth === fy.today.slice(0, 7);
  const monthLabel = isCurrentMonth
    ? ""
    : fmtDate(new Date(Number(statsMonth.slice(0, 4)), Number(statsMonth.slice(5, 7)) - 1, 1), { month: "long", year: "numeric" });
  const balanceRows = myLeavesBalances?.data?.leave_balances || [];
  
  const role = user?.role?.name?.toLowerCase();
  const isEmployee = role === "employee";
  const applyLeavePath = isEmployee ? "/employee/my-leaves/apply-leave" : "/admin/my-requests/leave/apply-leave";
  const overtimePath = isEmployee ? "/employee/overtime" : "/admin/my-requests/overtime";
  const correctionPath = isEmployee ? "/employee/correction" : "/admin/my-requests/correction";
  const documentsPath = isEmployee ? "/employee/documents" : "/admin/my-requests/documents";

  const [currentTime, setCurrentTime] = useState(new Date());
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [dashboardStats] = useState(() => ({
    ...EMPLOYEE_DASHBOARD_STATS,
    nextHoliday: nextHolidayFrom(fy.today),
  }));

  const [recentRequests] = useState(EMPLOYEE_RECENT_REQUESTS);
  const recentLoading = false;

  const STAT_CARDS = buildEmployeeStatCards(t, dashboardStats, myLeavesBalances, loading, setIsLeaveModalOpen, monthLabel);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const formattedDate = currentTime.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-6">
      <NoticeBanner />

      {/* ── Page Header / Profile Snapshot ── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-2xl p-6 sm:p-8 shadow-sm text-white">
        <div className="flex items-center gap-5">
          <img
            src={`https://ui-avatars.com/api/?name=${user?.name || "Employee"}&background=ffffff&color=0891b2&size=80`}
            alt={t("employeeDashboard.avatarAlt")}
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-white/20 shadow-sm flex-shrink-0"
          />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              {t("employeeDashboard.welcome", { name: user?.name || t("employeeDashboard.employeeFallback") })}
            </h1>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-1 text-cyan-100 text-sm">
              <span className="font-medium">
                {user?.role?.name
                  ? t(`employeeDashboard.roles.${user.role.name.toLowerCase()}`, { defaultValue: capitalizeFirstLetter(user.role.name) })
                  : t("employeeDashboard.employeeFallback")}
              </span>
              <span className="hidden sm:inline">•</span>
              <span>{formattedDate}</span>
            </div>
          </div>
        </div>
        <div className="hidden lg:flex items-center gap-3">
           {/* Primary action or clock-in could go here */}
           <div className="bg-white/20 px-4 py-2 rounded-lg backdrop-blur-sm">
             <div className="text-xs text-cyan-100 font-medium uppercase tracking-wider mb-1">{t("employeeDashboard.currentTime")}</div>
             <div className="text-xl font-bold font-mono">
               {currentTime.toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit' })}
             </div>
           </div>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {STAT_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              onClick={card.onClick}
              className={`bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow duration-300 ${card.onClick ? "cursor-pointer hover:border-orange-200" : ""}`}
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

      {/* ── Main Content Area ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Recent Requests (Takes up 2 cols on lg) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-4">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <MdOutlineFactCheck className="text-cyan-600" />
                {t("employeeDashboard.recentRequests", "Recent Requests")}
              </h2>
            </div>
            
            <div className="overflow-x-auto overflow-y-auto max-h-[280px]">
              <table className="w-full text-sm text-left text-gray-500">
                <thead className="text-xs text-gray-400 uppercase bg-gray-50 rounded-lg sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th scope="col" className="px-4 py-3 rounded-tl-lg bg-gray-50">{t("employeeDashboard.table.sNo")}</th>
                    <th scope="col" className="px-4 py-3 bg-gray-50">{t("employeeDashboard.table.type")}</th>
                    <th scope="col" className="px-4 py-3 bg-gray-50">{t("employeeDashboard.table.date")}</th>
                    <th scope="col" className="px-4 py-3 bg-gray-50">{t("employeeDashboard.table.status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLoading ? (
                    <tr>
                      <td colSpan="4" className="px-4 py-6 text-center text-gray-500">
                        {t("employeeDashboard.table.loading")}
                      </td>
                    </tr>
                  ) : recentRequests.length > 0 ? (
                    recentRequests.map((req, index) => (
                      <tr key={req.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3 text-gray-700">{index + 1}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{req.type || t(req.typeKey)}</td>
                        <td className="px-4 py-3">{req.isOvertime ? t("employeeDashboard.dateWithHours", { date: req.dateStr, hours: req.hours }) : req.dateStr}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                            req.status === 'APPROVED' ? 'bg-green-100 text-green-700 border-green-200' :
                            req.status === 'REJECTED' ? 'bg-red-100 text-red-700 border-red-200' :
                            'bg-orange-100 text-orange-700 border-orange-200'
                          }`}>
                            {req.status ? t(`employeeDashboard.status.${req.status}`, { defaultValue: capitalizeFirstLetter(req.status) }) : ""}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="px-4 py-6 text-center text-gray-500">
                        {t("employeeDashboard.table.empty")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Leave balances of the selected year (+ days carried from the last one) */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3 mb-4 border-b border-gray-100 pb-4">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <MdOutlineWorkOff className="text-orange-500" />
                {t("employeeDashboard.leaveBalances.title")}
              </h2>
              {fy.label && <span className="text-xs font-semibold text-gray-500">{fy.label}</span>}
            </div>
            {loading ? (
              <p className="py-6 text-center text-sm text-gray-500">{t("employeeDashboard.table.loading")}</p>
            ) : balanceRows.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-500">{t("employeeDashboard.leaveBalances.empty")}</p>
            ) : (
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {balanceRows.map((row) => (
                  <li key={row.balance_id || row.id || row.name} className="rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-gray-800 min-w-0 truncate">{row.name}</p>
                      {/* no balance row → 0, never the policy's yearly quota */}
                      <p className="text-lg font-bold text-cyan-700 shrink-0">{Number(row.balance ?? 0)}</p>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {t("employeeDashboard.leaveBalances.usedOf", { used: Number(row.used ?? 0), allocated: Number(row.allocated ?? 0) })}
                    </p>
                    <CarriedLeaveNote balance={row} className="mt-1.5" />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Right Column: Quick Actions & Notifications (Takes up 1 col on lg) */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Quick Actions */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100">
              {t("employeeDashboard.quickActions", "Quick Actions")}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <Link 
                to={applyLeavePath}
                className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-xl hover:bg-cyan-50 border border-transparent hover:border-cyan-100 transition-all duration-200 group text-center"
              >
                <MdAddCircleOutline className="text-2xl text-cyan-600 mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium text-gray-700 group-hover:text-cyan-700">{t("employeeDashboard.actions.applyLeave")}</span>
              </Link>
              <Link 
                to={overtimePath}
                className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-xl hover:bg-cyan-50 border border-transparent hover:border-cyan-100 transition-all duration-200 group text-center"
              >
                <MdOutlineAccessTime className="text-2xl text-cyan-600 mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium text-gray-700 group-hover:text-cyan-700">{t("employeeDashboard.actions.overtime")}</span>
              </Link>
              <Link 
                to={correctionPath}
                className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-xl hover:bg-cyan-50 border border-transparent hover:border-cyan-100 transition-all duration-200 group text-center"
              >
                <MdOutlineDescription className="text-2xl text-cyan-600 mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium text-gray-700 group-hover:text-cyan-700">{t("employeeDashboard.actions.correction")}</span>
              </Link>
              <Link 
                to={documentsPath}
                className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-xl hover:bg-cyan-50 border border-transparent hover:border-cyan-100 transition-all duration-200 group text-center"
              >
                <MdOutlineFilePresent className="text-2xl text-cyan-600 mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium text-gray-700 group-hover:text-cyan-700">{t("employeeDashboard.actions.documents")}</span>
              </Link>
            </div>
          </div>

          <MyAnnualStatementsCard />

          {/* Announcements / Notifications */}
          <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 rounded-2xl p-5 sm:p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <MdOutlineNotificationsActive className="text-6xl text-indigo-600" />
            </div>
            <h2 className="text-lg font-bold text-indigo-900 mb-2 relative z-10 flex items-center gap-2">
              <MdOutlineNotificationsActive />
              {t("employeeDashboard.announcements", "Announcements")}
            </h2>
            <div className="relative z-10 space-y-3 mt-4">
              <div className="bg-white/60 backdrop-blur-sm p-3 rounded-xl border border-indigo-50/50">
                <h3 className="text-sm font-bold text-indigo-900">{t("employeeDashboard.announcementItems.townhallTitle")}</h3>
                <p className="text-xs text-indigo-700 mt-1">{t("employeeDashboard.announcementItems.townhallDesc")}</p>
              </div>
              <div className="bg-white/60 backdrop-blur-sm p-3 rounded-xl border border-indigo-50/50">
                <h3 className="text-sm font-bold text-indigo-900">{t("employeeDashboard.announcementItems.leavePolicyTitle")}</h3>
                <p className="text-xs text-indigo-700 mt-1">{t("employeeDashboard.announcementItems.leavePolicyDesc")}</p>
              </div>
            </div>
          </div>

        </div>
      </div>
      
      {/* ── Leave Balance Modal ── */}
      <LeaveBalanceModal 
        isOpen={isLeaveModalOpen} 
        onClose={() => setIsLeaveModalOpen(false)} 
        loading={loading} 
        myLeavesBalances={myLeavesBalances} 
        applyLeavePath={applyLeavePath} 
      />

    </div>
  );
}

export default EmployeeDashboard;
