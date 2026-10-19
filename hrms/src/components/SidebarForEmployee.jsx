// SidebarForEmployee.jsx

import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  MdOutlineDashboard,
  MdOutlineWorkOff,
  MdOutlineMenu,
  MdOutlineClose,
  MdOutlineCalendarMonth,
  MdOutlineCalendarViewDay,
  MdOutlineApproval,
  MdOutlinePayments,
  MdOutlineFactCheck,
  MdOutlineDescription,
  MdOutlineFlightTakeoff,
  MdKeyboardArrowDown,
  MdKeyboardArrowUp,
} from "react-icons/md";
import { useTranslation } from "react-i18next";
import { capitalizeFirstLetter } from "../utils/assets";
import { useCurrentUser } from "../hooks/useSession";

const SidebarForEmployee = () => {
  const [isOpen, setIsOpen] = useState(true);
  const [openMenus, setOpenMenus] = useState({ "approvals-group": true });
  const location = useLocation();
  const user = useCurrentUser();

  const toggleMenu = (id) =>
    setOpenMenus((prev) => ({ ...prev, [id]: !prev[id] }));
  const { t } = useTranslation("nav");

  // Close sidebar by default on mobile/tablet
  useEffect(() => {
    if (window.innerWidth < 1024) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsOpen(false);
    }
  }, []);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsOpen(true);
      } else {
        setIsOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Auto close on route change for mobile
  useEffect(() => {
    if (window.innerWidth < 1024) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsOpen(false);
    }
  }, [location.pathname]);

  const menuItems = [
    { id: 1, label: "menu.dashboard", icon: MdOutlineDashboard, path: "/employee/dashboard" },
    { id: 2, label: "menu.myLeave", icon: MdOutlineWorkOff, path: "/employee/my-leaves" },
    {
      id: "approvals-group",
      label: "menu.approvals",
      icon: MdOutlineApproval,
      children: [
        { id: 31, label: "menu.myApprovals", icon: MdOutlineApproval, path: "/employee/approvals" },
        { id: 32, label: "menu.salaryApprovals", icon: MdOutlineFactCheck, path: "/employee/salary-approvals" },
        { id: 33, label: "menu.visaApprovals", icon: MdOutlineFlightTakeoff, path: "/employee/visa-approvals" },
      ],
    },
    { id: 8, label: "menu.myContracts", icon: MdOutlineDescription, path: "/employee/my-contracts" },
    { id: 9, label: "menu.myLoans", icon: MdOutlinePayments, path: "/employee/loans" },
    { id: 6, label: "menu.myPayslips", icon: MdOutlinePayments, path: "/employee/my-payslips" },
    { id: 10, label: "menu.myVisa", icon: MdOutlineFlightTakeoff, path: "/employee/my-visa" },
    { id: 4, label: "menu.calendar", icon: MdOutlineCalendarMonth, path: "/employee/calendar" },
    { id: 5, label: "menu.holidayList", icon: MdOutlineCalendarViewDay, path: "/employee/holiday-list" },
  ];

  const isActive = (path) => location.pathname.startsWith(path);

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-3 start-3 z-[60] p-2 bg-white border border-gray-200 rounded-lg shadow-sm"
        aria-label={isOpen ? "Close menu" : "Open menu"}
      >
        {isOpen ? (
          <MdOutlineClose className="text-xl text-gray-600" />
        ) : (
          <MdOutlineMenu className="text-xl text-gray-600" />
        )}
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="lg:hidden fixed inset-0 bg-black/40 z-30 backdrop-blur-sm"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static top-0 start-0 h-screen
          w-56 sm:w-60 lg:w-64
          bg-white border-e border-gray-200
          flex flex-col
          transform-gpu transition-transform duration-300 ease-in-out
          z-40
          ${isOpen ? "translate-x-0" : "-translate-x-full rtl:translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-5 sm:py-6 border-gray-100">
          <h1 className="text-base sm:text-lg font-bold text-cyan-600">
            {t("employeePanel")}
          </h1>

          <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">
            {t("employeeConsole")}
          </p>
        </div>

        {/* Menu */}
        <nav className="flex-1 overflow-auto custom-scrollbar">
          {menuItems.map((item) => {
            const Icon = item.icon;

            // Collapsible group (e.g. Approvals).
            if (item.children) {
              const menuOpen = openMenus[item.id];
              const anyChildActive = item.children.some((c) => isActive(c.path));
              return (
                <div key={item.id} className="flex flex-col">
                  <button
                    onClick={() => toggleMenu(item.id)}
                    className={`flex items-center justify-between w-full px-4 sm:px-6 py-2.5 sm:py-3 transition-colors ${
                      anyChildActive ? "text-cyan-600" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="text-lg sm:text-xl flex-shrink-0" />
                      <span className="text-sm font-medium truncate">{t(item.label)}</span>
                    </div>
                    {menuOpen ? (
                      <MdKeyboardArrowUp className="text-lg flex-shrink-0" />
                    ) : (
                      <MdKeyboardArrowDown className="text-lg flex-shrink-0" />
                    )}
                  </button>
                  <div className={`flex flex-col overflow-hidden transition-all duration-300 ${menuOpen ? "max-h-96" : "max-h-0"}`}>
                    {item.children.map((child) => {
                      const ChildIcon = child.icon;
                      const active = isActive(child.path);
                      return (
                        <Link
                          key={child.id}
                          to={child.path}
                          className={`flex items-center gap-3 pl-10 sm:pl-12 pr-4 sm:pr-6 py-2.5 transition-colors relative ${
                            active ? "text-cyan-600 bg-[#f4faff]" : "text-gray-500 hover:text-gray-900"
                          }`}
                        >
                          {active && <div className="absolute end-0 top-0 bottom-0 w-1 bg-cyan-600 rounded-s" />}
                          <ChildIcon className="text-lg flex-shrink-0" />
                          <span className="text-sm font-medium truncate">{t(child.label)}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            }

            const active = isActive(item.path);
            return (
              <Link
                key={item.id}
                to={item.path}
                className={`
                  flex items-center gap-3
                  px-4 sm:px-6 py-2.5 sm:py-3
                  transition-colors relative group
                  ${active
                    ? "text-cyan-600 bg-cyan-50"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }
                `}
              >
                {/* Active Indicator */}
                {active && (
                  <div className="absolute end-0 top-0 bottom-0 w-1 bg-cyan-600 rounded-s" />
                )}

                <Icon className="text-lg sm:text-xl flex-shrink-0" />

                <span className="text-sm font-medium truncate">
                  {t(item.label)}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <Link
          to="/employee/profile"
          className="p-3 sm:p-4 border-t border-gray-100 cursor-pointer"
        >
          <div className="flex items-center gap-3 px-2 py-2 bg-gray-50 rounded-lg">
            <img
              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || "Employee")}&background=22d3ee&color=fff&size=40`}
              alt="Employee Avatar"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex-shrink-0"
            />

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">
                {user?.name ?? "User"}
              </p>

              <p className="text-xs text-gray-500">
                {" "}
                {capitalizeFirstLetter(user?.role?.name || user?.role || "")}
              </p>
            </div>
          </div>
        </Link>
      </aside>
    </>
  );
};

export default SidebarForEmployee;
