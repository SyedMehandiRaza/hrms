import { useState, useRef, useEffect, useSyncExternalStore } from "react";
import {
  MdOutlineSearch,
  MdOutlineNotifications,
  MdOutlineExpandMore,
} from "react-icons/md";

import SearchDropdown from "./SearchDropdown";
import YearSwitcher from "./YearSwitcher";

const getProjectInitials = (name) => {
  if (!name) return "AP";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "AP";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

import NotificationPanel from "./NotificationPanel";
import ProfileDropdown from "./ProfileDropdown";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { capitalizeFirstLetter } from "../utils/assets";
import { getStaticUser } from "../data/session";
import { HEADER_PROJECTS, notificationStore } from "../data/groupA";

// ── Header ────────────────────────────────────────────────────────────────────
const Header = () => {
  const user = getStaticUser();
  const projects = HEADER_PROJECTS;
  const loadingProjects = false;
  const [selectedProjectId, setSelectedProject] = useState("ALL");
  const { t, i18n } = useTranslation("nav");
  const navigate = useNavigate();
  const location = useLocation();

  const isArabic = i18n.language === "ar";
  const toggleLanguage = () => i18n.changeLanguage(isArabic ? "en" : "ar");

  const showProjectPicker =
    location.pathname === "/admin/projects" ||
    location.pathname.startsWith("/admin/projects/");

  const [searchQuery, setSearchQuery] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // Project picker
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");

  const selectedProject =
    selectedProjectId && selectedProjectId !== "ALL"
      ? projects.find((p) => String(p.id) === String(selectedProjectId)) || null
      : null;

  const panelRefDesktop = useRef(null);
  const panelRefMobile = useRef(null);
  const bellRef = useRef(null);
  const profileRef = useRef(null);
  const profileButtonRef = useRef(null);
  const searchRef = useRef(null);
  const searchDropdownRef = useRef(null);
  const projectMenuRef = useRef(null);
  const projectButtonRef = useRef(null);

  // Unread badge — from the static notification store.
  const { unreadCount } = useSyncExternalStore(
    notificationStore.subscribe,
    notificationStore.get,
  );

  const filteredProjects = projects.filter((p) =>
    [p.project_name, p.project_code]
      .filter(Boolean)
      .some((value) =>
        value.toLowerCase().includes(projectSearch.toLowerCase()),
      ),
  );

  const handleSelectAllProjects = () => {
    setSelectedProject("ALL");
    setShowProjectMenu(false);
    navigate("/admin/projects");
  };

  const handleSelectProject = (p) => {
    setSelectedProject(String(p.id));
    setShowProjectMenu(false);
    navigate("/admin/projects");
  };

  const displayLabel =
    selectedProject?.project_name || t("header.allProjects");
  const displayInitials = selectedProject
    ? getProjectInitials(selectedProject.project_name)
    : "AP";

  // Close panels on outside click
  useEffect(() => {
    const handler = (e) => {
      // notifications panel close
      const isOutsideDesktopPanel = !panelRefDesktop.current || !panelRefDesktop.current.contains(e.target);
      const isOutsideMobilePanel = !panelRefMobile.current || !panelRefMobile.current.contains(e.target);
      if (
        isOutsideDesktopPanel &&
        isOutsideMobilePanel &&
        bellRef.current &&
        !bellRef.current.contains(e.target)
      ) {
        setShowNotifications(false);
      }

      // profile
      if (
        profileRef.current &&
        !profileRef.current.contains(e.target) &&
        profileButtonRef.current &&
        !profileButtonRef.current.contains(e.target)
      ) {
        setShowProfileMenu(false);
      }

      // search dropdown close
      if (
        searchDropdownRef.current &&
        !searchDropdownRef.current.contains(e.target) &&
        searchRef.current &&
        !searchRef.current.contains(e.target)
      ) {
        setShowSearchDropdown(false);
      }

      // project picker close
      if (
        projectMenuRef.current &&
        !projectMenuRef.current.contains(e.target) &&
        projectButtonRef.current &&
        !projectButtonRef.current.contains(e.target)
      ) {
        setShowProjectMenu(false);
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSearchSubmit = () => {
    if (!searchQuery.trim()) return;
    setShowSearchDropdown(false);
    setShowMobileSearch(false);
    navigate(
      `/admin/dashboard/search-results?q=${encodeURIComponent(searchQuery)}`,
    );
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
        {/* Main Header */}
        <div className="flex items-center justify-between px-3 sm:px-4 md:px-6 lg:px-8 py-2.5 sm:py-3 md:py-4 gap-2 sm:gap-3 md:gap-4 lg:gap-6">
          {showProjectPicker && (
            <div className="relative flex-shrink-0 ms-15 lg:ms-0  ">
              <button
                ref={projectButtonRef}
                type="button"
                onClick={() => setShowProjectMenu((v) => !v)}
                className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-gray-50 transition-colors"
              >
                <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center text-white font-bold text-xs sm:text-sm">
                  {displayInitials}
                </div>
                <div className="items-center gap-1 hidden lg:flex min-w-0">
                  <span className="font-semibold text-gray-900 text-sm truncate max-w-[150px]">
                    {displayLabel}
                  </span>
                  <MdOutlineExpandMore
                    className={`text-gray-500 text-lg flex-shrink-0 transition-transform ${showProjectMenu ? "rotate-180" : ""
                      }`}
                  />
                </div>
              </button>

              {showProjectMenu && (
                <div
                  ref={projectMenuRef}
                  className="absolute top-full lg:mt-4 start-0 mt-2 w-72 max-h-96 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-xl z-50 custom-scrollbar"
                >
                  <div className="sticky top-0 bg-white p-3 border-b border-gray-100 z-10">
                    <div className="relative">
                      <MdOutlineSearch className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={projectSearch}
                        onChange={(e) => setProjectSearch(e.target.value)}
                        placeholder={t("header.searchProjects")}
                        className="w-full ps-9 pe-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleSelectAllProjects}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-start transition-colors ${!selectedProject ? "bg-cyan-50" : "hover:bg-gray-50"
                      }`}
                  >
                    <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500 font-bold text-xs flex-shrink-0">
                      AP
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-semibold ${!selectedProject ? "text-cyan-600" : "text-gray-900"
                          }`}
                      >
                        {t("header.allProjects")}
                      </p>
                      <p className="text-xs text-gray-400">
                        {t("header.viewEntirePortfolio")}
                      </p>
                    </div>
                  </button>

                  <div className="border-t border-gray-100" />

                  {loadingProjects ? (
                    <div className="px-4 py-6 text-center text-xs text-gray-400">
                      {t("header.loadingProjects")}
                    </div>
                  ) : filteredProjects.length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs text-gray-400">
                      {t("header.noMatchingProjects")}
                    </div>
                  ) : (
                    filteredProjects.map((p) => {
                      const isActive = selectedProject?.id === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleSelectProject(p)}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-start transition-colors ${isActive ? "bg-cyan-50" : "hover:bg-gray-50"
                            }`}
                        >
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                            {getProjectInitials(p.project_name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-sm font-semibold truncate ${isActive ? "text-cyan-600" : "text-gray-900"
                                }`}
                            >
                              {p.project_name}
                            </p>
                            {p.project_code && (
                              <p className="text-xs text-gray-400 truncate">
                                {p.project_code}
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}

          {/* Financial year switcher (admin + employee; not the staffing portal) */}
          {user?.layoutRole !== "STAFFING_COMPANY" && (
            <div className={showProjectPicker ? "" : "ms-15 lg:ms-0"}>
              <YearSwitcher />
            </div>
          )}

          {/* Center — Search (Desktop / Tablet) */}
          <div
            ref={searchRef}
            className="flex-1 max-w-xs sm:max-w-sm md:max-w-lg hidden md:flex relative"
          >
            <div className="relative w-full">
              <MdOutlineSearch className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg sm:text-xl" />
              <input
                type="text"
                value={searchQuery}
                onFocus={() => setShowSearchDropdown(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearchDropdown(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearchSubmit();
                }}
                placeholder={t("header.searchPlaceholder")}
                className="w-full ps-10 pe-4 py-2 sm:py-2.5 bg-gray-100 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm"
              />
            </div>

            {showSearchDropdown && (
              <div
                ref={searchDropdownRef}
                className="absolute top-12 sm:top-14 start-0 w-full z-50"
              >
                <SearchDropdown
                  query={searchQuery}
                  onClose={() => setShowSearchDropdown(false)}
                  onSelectResult={() => {
                    setShowSearchDropdown(false);
                    window.location.href = "/search-results";
                  }}
                />
              </div>
            )}
          </div>

          {/* Right — Icons */}
          <div className="flex items-center gap-1 sm:gap-2 md:gap-3 lg:gap-4 flex-shrink-0 ms-auto">
            {/* Mobile Search toggle */}
            <button
              onClick={() => setShowMobileSearch((v) => !v)}
              className="md:hidden p-2 sm:p-2.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors touch-target"
              aria-label={t("header.toggleSearch")}
            >
              <MdOutlineSearch className="text-xl sm:text-2xl" />
            </button>

            {/* Language toggle EN / AR */}
            <button
              onClick={toggleLanguage}
              className="px-2.5 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors touch-target"
              aria-label={t("header.toggleLanguage")}
              title={isArabic ? "Switch to English" : "التبديل إلى العربية"}
            >
              {isArabic ? "EN" : "ع"}
            </button>

            {/* Bell - Notifications */}
            <div className="relative" ref={bellRef}>
              <button
                onClick={() => setShowNotifications((v) => !v)}
                className="relative p-2 sm:p-2.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors touch-target"
                aria-label={t("header.notifications")}
              >
                <MdOutlineNotifications className="text-xl sm:text-2xl" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 end-1 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>


            {/* Profile */}
            <div className="relative border-s border-gray-200 ps-1 sm:ps-2 md:ps-3 lg:ps-4">
              <div
                ref={profileButtonRef}
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-1.5 sm:gap-2 md:gap-3 cursor-pointer hover:opacity-75 transition-opacity touch-target p-1 -m-1"
              >
                {/* Name/role — Hidden on small screens */}
                <div className="text-end hidden lg:block">
                  <p className="text-xs sm:text-sm font-semibold text-gray-900 whitespace-nowrap">
                    {t("header.portalName")}
                  </p>
                  <p className="text-xs text-gray-500">
                    {capitalizeFirstLetter(user?.role?.name || user?.role || "")}
                  </p>
                </div>

                <img
                  src="https://ui-avatars.com/api/?name=User+Profile&background=0066cc&color=fff&size=40"
                  alt="User Profile"
                  className="w-7 h-7 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded border-2 border-blue-200 hover:border-blue-400 transition-colors flex-shrink-0"
                />
              </div>

              {/* Dropdown */}
              {showProfileMenu && (
                <div
                  ref={profileRef}
                  className="absolute end-0 top-12 sm:top-14 z-50 w-auto sm:min-w-[220px]"
                >
                  <ProfileDropdown onClose={() => setShowProfileMenu(false)} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Search Bar (Expanded) */}
        {showMobileSearch && (
          <div className="md:hidden px-3 sm:px-4 pb-3 bg-gray-50">
            <div className="relative w-full">
              <MdOutlineSearch className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearchSubmit();
                }}
                placeholder={t("header.searchPlaceholder")}
                autoFocus
                className="w-full ps-10 pe-4 py-2.5 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
              />
            </div>
          </div>
        )}
      </header>

      {/* ── Notification Panel ── */}

      {/* Desktop / Tablet Dropdown */}
      {showNotifications && (
        <div
          ref={panelRefDesktop}
          className="hidden sm:block fixed top-[calc(2.5rem+0.5rem)] sm:top-[calc(3rem+0.75rem)] md:top-[calc(4rem+1rem)] end-2 sm:end-4 md:end-6 lg:end-8 w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] md:w-[90vw] max-w-[420px] bg-white border border-gray-200 rounded-2xl shadow-2xl shadow-gray-200/60 z-50 overflow-hidden flex flex-col max-h-[min(600px,calc(100vh-6rem))]"
        >
          <NotificationPanel onClose={() => setShowNotifications(false)} />
        </div>
      )}

      {/* Mobile Full-width Bottom Sheet */}
      {showNotifications && (
        <div className="sm:hidden fixed inset-0 z-50 flex flex-col">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/20"
            onClick={() => setShowNotifications(false)}
          />
          {/* Panel slides up from bottom */}
          <div
            ref={panelRefMobile}
            className="relative mt-auto bg-white rounded-t-3xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            <NotificationPanel onClose={() => setShowNotifications(false)} />
          </div>
        </div>
      )}
    </>
  );
};

export default Header;
