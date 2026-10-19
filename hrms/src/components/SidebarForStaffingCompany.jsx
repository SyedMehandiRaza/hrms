import { useEffect, useState } from "react";
import {
  Link,
  useLocation,
} from "react-router-dom";
import {
  MdOutlineDashboard,
  MdOutlinePeople,
  MdOutlineAttachMoney,
  MdOutlineDescription,
  MdOutlineFolder,
  MdOutlineMenu,
  MdOutlineClose,
  MdKeyboardArrowDown,
  MdKeyboardArrowUp,
} from "react-icons/md";
import { useTranslation } from "react-i18next";
import { useCurrentUser } from "../hooks/useSession";
import { capitalizeFirstLetter } from "../utils/assets";

const SidebarForStaffingCompany = () => {
  const [isOpen, setIsOpen] = useState(true);
  const [openMenus, setOpenMenus] = useState({});
  const location = useLocation();
  const user = useCurrentUser();
  const { t } = useTranslation("nav");

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
      path: "/staffing-company/dashboard",
    },
    {
      id: 2,
      label: "menu.employees",
      icon: MdOutlinePeople,
      path: "/staffing-company/employees",
    },
    {
      id: 3,
      label: "menu.projects",
      icon: MdOutlineFolder,
      path: "/staffing-company/projects",
    },
    {
      id: 4,
      label: "menu.billing",
      icon: MdOutlineAttachMoney,
      path: "/staffing-company/billing",
    },
    {
      id: 5,
      label: "menu.contracts",
      icon: MdOutlineDescription,
      path: "/staffing-company/contracts",
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
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };


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
            {t("staffingConsole")}
          </p>
        </div>

        {/* Menu Items — scrollable */}
        <nav className="flex-1 overflow-auto custom-scrollbar">
          {menuItems.map((item) => {
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
              </Link>
            );
          })}
        </nav>

        {/* Footer — User Profile */}
        <div className="p-3 sm:p-4 border-t border-gray-100">
          <Link
            to="/staffing-company/profile"
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

export default SidebarForStaffingCompany;
