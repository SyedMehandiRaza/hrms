import { useEffect, useState } from "react";
import {
  Link,
  useLocation,
} from "react-router-dom";
import {
  MdOutlineDashboard,
  MdOutlinePeople,
  MdOutlineEventNote,
  MdOutlineDescription,
  MdOutlineCheckCircle,
  MdOutlineWorkOff,
  MdOutlineFolder,
  MdOutlineBusiness,
  MdOutlineReceiptLong,
  MdOutlineSettings,
  MdOutlineMenu,
  MdOutlineClose,
  MdOutlineHomeWork,
  MdOutlineApproval,
  MdOutlineHolidayVillage,
  MdAccessTime,
  MdOutlineAccountTree,
  MdOutlinePayments,
  MdOutlineWidgets,
  MdKeyboardArrowDown,
  MdKeyboardArrowUp,
  MdOutlineNoteAdd,
  MdOutlineFlightTakeoff,
  MdOutlineGroupAdd,
  MdOutlinePersonRemove,
} from "react-icons/md";
import { useTranslation } from "react-i18next";
import { STATIC_PERMISSION } from "../data/session";
import { useCurrentUser } from "../hooks/useSession";
import { INVITATION_COUNTS } from "../data/groupA";
import { capitalizeFirstLetter } from "../utils/assets";
import { useCan } from "../hooks/usePermission";
import { canManageExits } from "../hooks/useCanManageExits";
import { MODULES } from "../constants/permissions";

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(true);
  const [openMenus, setOpenMenus] = useState({});
  const location = useLocation();
  const user = useCurrentUser();
  const { t } = useTranslation("nav");
  const can = useCan();
  const approvalModules = STATIC_PERMISSION.approvalModules || [];
  const permission = STATIC_PERMISSION;
  const showExits = canManageExits(permission);
  const inviteCounts = INVITATION_COUNTS;
  const inviteBadge =
    (inviteCounts.received || 0) + (inviteCounts.approvals || 0);

  const toggleMenu = (id) => {
    setOpenMenus((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // On mount: close sidebar on mobile/tablet by default
  useEffect(() => {
    if (window.innerWidth < 1024) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsOpen(false);
    }
  }, []);

  // Re-open on resize to desktop
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

  // Auto-close on route change for mobile/tablet
  useEffect(() => {
    if (window.innerWidth < 1024) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsOpen(false);
    }
  }, [location.pathname]);

  const menuItems = [
    {
      id: 1,
      label: "menu.dashboard",
      icon: MdOutlineDashboard,
      path: "/admin/dashboard",
    },
    {
      id: 2,
      label: "menu.employees",
      icon: MdOutlinePeople,
      path: "/admin/employees",
    },
    {
      id: "exits",
      label: "menu.exits",
      icon: MdOutlinePersonRemove,
      path: "/admin/exits",
      // owner or LEAVE approval-group member — the backend gate's rule
      visible: showExits,
    },
    {
      id: 21,
      label: "menu.departments",
      icon: MdOutlinePeople,
      path: "/admin/departments",
      module: MODULES.DEPARTMENT,
    },
    {
      id: 22,
      label: "menu.invitations",
      icon: MdOutlineGroupAdd,
      path: "/admin/invitations",
    },

    {
      id: 3,
      label: "menu.attendanceManagement",
      icon: MdOutlineEventNote,
      children: [
        {
          id: 31,
          label: "menu.attendance",
          icon: MdOutlineEventNote,
          path: "/admin/attendance",
        },
        {
          id: 32,
          label: "menu.overtimeRequest",
          icon: MdAccessTime,
          path: "/admin/attendance/request",
        },
        {
          id: 33,
          label: "menu.correctionRequest",
          icon: MdOutlineDescription,
          path: "/admin/attendance/correction-requests",
        },
        {
          id: 34,
          label: "menu.reports",
          icon: MdOutlineEventNote,
          path: "/admin/attendance/reports",
        },
      ],
    },
    {
      id: 4,
      label: "menu.payrollManagement",
      icon: MdOutlineAccountTree,
      children: [
        {
          id: 41,
          label: "menu.payroll",
          icon: MdOutlinePayments,
          path: "/admin/payroll-overview",
        },
        {
          id: 42,
          label: "menu.salaryComponent",
          icon: MdOutlineWidgets,
          path: "/admin/salary-component",
        },
        {
          id: 44,
          label: "menu.salaryReport",
          icon: MdOutlinePayments,
          path: "/admin/salary-report",
        },
        {
          id: 43,
          label: "menu.approvals",
          icon: MdOutlineApproval,
          path: "/admin/payroll-approvals",
        },
        {
          id: 45,
          label: "menu.transaction",
          icon: MdOutlinePayments,
          path: "/admin/payroll-transactions",
        },
        {
          id: 46,
          label: "menu.staffingBilling",
          icon: MdOutlineReceiptLong,
          path: "/admin/staffing-billing",
        },
        {
          id: 47,
          label: "menu.loanApprovals",
          icon: MdOutlineApproval,
          path: "/admin/loan-approvals",
        },
        {
          id: 50,
          label: "menu.leaveEncashments",
          icon: MdOutlinePayments,
          path: "/admin/leave-encashments",
        },
        {
          id: 48,
          label: "menu.salaryIncrements",
          icon: MdOutlinePayments,
          path: "/admin/salary-increments",
        },
        {
          id: 49,
          label: "menu.annualReports",
          icon: MdOutlineReceiptLong,
          path: "/admin/annual-reports",
        },
      ],
    },
    {
      id: 5,
      label: "menu.documentsManagement",
      icon: MdOutlineDescription,
      children: [
        {
          id: 51,
          label: "menu.documents",
          icon: MdOutlineDescription,
          path: "/admin/documents",
        },
        {
          id: 52,
          label: "menu.documentType",
          icon: MdOutlineNoteAdd,
          path: "/admin/document-type",
        },
      ],
    },
    {
      id: 6,
      label: "menu.contractManagement",
      icon: MdOutlineCheckCircle,
      children: [
        {
          id: 61,
          label: "menu.contracts",
          icon: MdOutlineCheckCircle,
          path: "/admin/contracts",
        },
        {
          id: 62,
          label: "menu.contractType",
          icon: MdOutlineNoteAdd,
          path: "/admin/contract-types",
        },
      ],
    },
    {
      id: "contract-studio",
      label: "menu.contractStudio",
      icon: MdOutlineNoteAdd,
      module: MODULES.CONTRACT,
      children: [
        {
          id: "cs-dashboard",
          label: "menu.dashboard",
          icon: MdOutlineDashboard,
          path: "/admin/new-contracts/dashboard",
        },
        {
          id: "cs-documents",
          label: "menu.documents",
          icon: MdOutlineDescription,
          path: "/admin/new-contracts/documents",
        },
        {
          id: "cs-templates",
          label: "menu.templates",
          icon: MdOutlineNoteAdd,
          path: "/admin/new-contracts/templates",
        },
        {
          id: "cs-create",
          label: "menu.sendContract",
          icon: MdOutlineNoteAdd,
          path: "/admin/new-contracts/create",
          module: MODULES.CONTRACT,
          action: "create",
        },
        {
          id: "cs-contracts",
          label: "menu.contracts",
          icon: MdOutlineCheckCircle,
          path: "/admin/new-contracts",
        },
      ],
    },
    {
      id: 7,
      label: "menu.holidayManagement",
      icon: MdOutlineHolidayVillage,
      path: "/admin/holiday-management",
    },
    {
      id: 8,
      label: "menu.leaveManagement",
      icon: MdOutlineWorkOff,
      path: "/admin/leave-management",
    },
    {
      id: "my-requests",
      label: "menu.myRequest",
      icon: MdOutlineEventNote,
      children: [
        {
          id: "my-req-dashboard",
          label: "menu.dashboard",
          icon: MdOutlineDashboard,
          path: "/admin/my-requests/dashboard",
        },
        {
          id: "my-req-overtime",
          label: "menu.overtime",
          icon: MdAccessTime,
          path: "/admin/my-requests/overtime",
        },
        {
          id: "my-req-correction",
          label: "menu.correction",
          icon: MdOutlineDescription,
          path: "/admin/my-requests/correction",
        },
        {
          id: "my-req-leave",
          label: "menu.leave",
          icon: MdOutlineWorkOff,
          path: "/admin/my-requests/leave",
        },
        {
          id: "my-req-documents",
          label: "menu.documents",
          icon: MdOutlineDescription,
          path: "/admin/my-requests/documents",
        },
        {
          id: "my-req-contracts",
          label: "menu.myContracts",
          icon: MdOutlineCheckCircle,
          path: "/admin/my-requests/contracts",
        },
        {
          id: "my-req-loans",
          label: "menu.myLoans",
          icon: MdOutlinePayments,
          path: "/admin/my-requests/loans",
        },
        {
          id: "my-req-visa",
          label: "menu.myVisa",
          icon: MdOutlineFlightTakeoff,
          path: "/admin/my-requests/visa",
        },
      ],
    },
    {
      id: 9,
      label: "menu.shiftManagement",
      icon: MdAccessTime,
      path: "/admin/shift-management",
      module: MODULES.SHIFT,
    },
    {
      id: 10,
      label: "menu.projects",
      icon: MdOutlineFolder,
      path: "/admin/projects",
    },
    {
      id: 11,
      label: "menu.headOffices",
      icon: MdOutlineHomeWork,
      path: "/admin/head-offices",
    },
    {
      id: 12,
      label: "menu.staffingCompanies",
      icon: MdOutlineBusiness,
      path: "/admin/staffing-companies",
    },
    {
      id: 13,
      label: "menu.invoices",
      icon: MdOutlineReceiptLong,
      path: "/admin/invoices",
    },
    {
      id: 14,
      label: "menu.approvals",
      icon: MdOutlineApproval,
      path: "/admin/approvals",
    },
    {
      id: 16,
      label: "menu.visaManagement",
      icon: MdOutlineFlightTakeoff,
      path: "/admin/visa-management",
    },
    {
      id: 15,
      label: "menu.settings",
      icon: MdOutlineSettings,
      path: "/admin/settings",
    },
  ];

  const isActive = (path) => {
    if (path === "/admin/attendance") {
      return location.pathname === "/admin/attendance";
    }
    if (path === "/admin/attendance/request") {
      return location.pathname === "/admin/attendance/request";
    }
    if (path === "/admin/attendance/correction-requests") {
      return location.pathname === "/admin/attendance/correction-requests";
    }
    if (path === "/admin/documents") {
      return location.pathname === "/admin/documents" || location.pathname.startsWith("/admin/documents/add-new-document");
    }
    if (path === "/admin/contracts") {
      return location.pathname === "/admin/contracts" || location.pathname.startsWith("/admin/contracts/add");
    }
    // "Contracts to Send" — exact match so Documents/Templates/Create don't also light up
    if (path === "/admin/new-contracts") {
      return location.pathname === "/admin/new-contracts";
    }
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };


  // ── Payroll Management visibility (gated per child) ──
  // - Payroll / Salary Component / Salary Report / Transaction → payroll:READ
  //   (company owner = super passes).
  // - Approvals + Loan Approvals → payroll:READ OR active PAYROLL approver
  //   (loans reuse the payroll approval group, so an approver handles both).
  // - Staffing Billing → any staffing_company permission (its own RBAC module).
  // The whole group is hidden when none of its children qualify.
  const canFullPayroll = can("payroll", "read");
  const isPayrollApprover = approvalModules.includes("PAYROLL");
  const canStaffingBilling = ["read", "create", "update", "delete"].some((a) =>
    can("staffing_company", a),
  );
  const PAYROLL_GROUP_ID = 4;

  const payrollChildVisible = (path) => {
    if (path === "/admin/payroll-approvals" || path === "/admin/loan-approvals") {
      return canFullPayroll || isPayrollApprover;
    }
    if (path === "/admin/staffing-billing") return canStaffingBilling;
    // Leave encashment: owner / LEAVE approval-group member / leave:update (the backend gate)
    if (path === "/admin/leave-encashments") return showExits || can("leave", "update");
    // Annual reports belong to the financial year (owner / financial_year:read)
    if (path === "/admin/annual-reports") return can("financial_year", "read");
    // Payroll, Salary Component, Salary Report, Transaction
    return canFullPayroll;
  };

  // Attendance Management: attendance:READ sees every sub-tab. An OVERTIME /
  // CORRECTION approval-group member (even without attendance:READ) sees only
  // their own request tab(s). With none of these, the whole group is hidden.
  const attendanceRead = can("attendance", "read");
  const isOvertimeApprover = approvalModules.includes("OVERTIME");
  const isCorrectionApprover = approvalModules.includes("CORRECTION");
  const ATTENDANCE_GROUP_ID = 3;

  const attendanceChildVisible = (path) => {
    if (path === "/admin/attendance/request") {
      return attendanceRead || isOvertimeApprover;
    }
    if (path === "/admin/attendance/correction-requests") {
      return attendanceRead || isCorrectionApprover;
    }
    // Attendance, Reports, and any other attendance sub-tab
    return attendanceRead;
  };

  // A nav node with a `module` field is hidden unless the user has its `action` (default read).
  const moduleVisible = (node) => !node.module || can(node.module, node.action || "read");

  const visibleMenuItems = menuItems
    .map((item) => {
      if (item.id === PAYROLL_GROUP_ID) {
        return {
          ...item,
          children: item.children.filter((c) => payrollChildVisible(c.path)),
        };
      }
      if (item.id === ATTENDANCE_GROUP_ID) {
        return {
          ...item,
          children: item.children.filter((c) => attendanceChildVisible(c.path)),
        };
      }
      // Other groups: drop children the user can't read (by their `module`).
      if (item.children) {
        return { ...item, children: item.children.filter(moduleVisible) };
      }
      return item;
    })
    .filter((item) => item.visible !== false) // items with their own visibility rule
    .filter(moduleVisible) // top-level items gated by their own `module`
    // "My Request" is self-service — only for admins who are also employees.
    // The company owner has no employee record, so there is nothing of theirs.
    .filter((item) => item.id !== "my-requests" || !!user?.employeeId)
    .filter((item) => !item.children || item.children.length > 0);

  return (
    <>
      {/* Mobile / Tablet Toggle Button — sits in header area */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-3 start-3 z-[60] p-2 bg-white border border-gray-200 rounded-lg shadow-sm"
        aria-label={isOpen ? t("closeMenu") : t("openMenu")}
      >
        {isOpen ? (
          <MdOutlineClose className="text-xl text-gray-600" />
        ) : (
          <MdOutlineMenu className="text-xl text-gray-600" />
        )}
      </button>

      {/* Overlay — mobile/tablet only */}
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
            {t("enterpriseHrms")}
          </h1>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">
            {t("adminConsole")}
          </p>
        </div>

        {/* Menu Items — scrollable */}
        <nav className="flex-1 overflow-auto custom-scrollbar">
          {visibleMenuItems.map((item) => {
            const Icon = item.icon;

            if (item.children) {
              const isMenuOpen = openMenus[item.id];
              const anyChildActive = item.children.some((child) => isActive(child.path));

              return (
                <div key={item.id} className="flex flex-col">
                  <button
                    onClick={() => toggleMenu(item.id)}
                    className={`
                      flex items-center justify-between
                      px-4 sm:px-6 py-2.5 sm:py-3
                      transition-colors relative group w-full
                      ${anyChildActive
                        ? "text-cyan-600 hover:bg-gray-50"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }
                    `}
                  >

                    <div className="flex items-center gap-3">
                      <Icon className="text-lg sm:text-xl flex-shrink-0" />
                      <span className="text-sm font-medium truncate">
                        {t(item.label)}
                      </span>
                    </div>
                    {isMenuOpen ? (
                      <MdKeyboardArrowUp className="text-lg flex-shrink-0" />
                    ) : (
                      <MdKeyboardArrowDown className="text-lg flex-shrink-0" />
                    )}
                  </button>

                  {/* Dropdown Children */}
                  <div
                    className={`
                      flex flex-col overflow-hidden transition-all duration-300 ease-in-out relative
                      ${isMenuOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"}
                    `}
                  >
                    {/* Vertical line from parent icon */}
                    <div className="absolute left-[1.35rem] sm:left-[1.85rem] top-0 bottom-6 w-px bg-gray-300 z-0" />

                    {item.children.map((child) => {
                      const ChildIcon = child.icon;
                      const active = isActive(child.path);

                      return (
                        <div key={child.id} className="relative">
                          {/* Horizontal connecting line visual */}
                          <div className="absolute left-[1.35rem] sm:left-[1.85rem] top-1/2 w-[1.15rem] sm:w-[1.65rem] h-[1.5px] bg-gray-400 z-0" />

                          <Link
                            to={child.path}
                            className={`
                              flex items-center gap-3
                              pl-3 sm:pl-4 pr-4 sm:pr-6 py-2.5 sm:py-3
                              transition-colors relative group
                              ml-[2.5rem] sm:ml-[3.5rem]
                              rounded-l-2xl
                              ${active
                                ? "text-cyan-600 bg-[#f4faff]"
                                : "text-gray-500 hover:text-gray-900"
                              }
                            `}
                          >
                            <ChildIcon className={`text-lg sm:text-xl flex-shrink-0 relative z-10 ${active ? 'text-cyan-600' : 'text-slate-600'}`} />
                            <span className="text-sm font-medium truncate relative z-10">
                              {t(child.label)}
                            </span>

                            {/* Active Indicator on the right edge */}
                            {active && (
                              <div className="absolute end-0 top-0 bottom-0 w-1 bg-cyan-600 rounded-s" />
                            )}
                          </Link>
                        </div>
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
                {item.path === "/admin/invitations" && inviteBadge > 0 && (
                  <span className="ms-auto inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                    {inviteBadge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer — User Profile */}
        <div className="p-3 sm:p-4 border-t border-gray-100">
          <Link
            to="/admin/profile"
            className="flex items-center gap-3 px-2 py-2 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
          >
            <img
              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || "NA")}&background=22d3ee&color=fff&size=40`}
              alt={t("userAvatarAlt")}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">
                {user?.name}
              </p>
              <p className="text-xs text-gray-500">
                {capitalizeFirstLetter(user?.role?.name || user?.role || "")}
              </p>
            </div>
          </Link>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
