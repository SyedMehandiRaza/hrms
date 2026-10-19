import { MdOutlineManageAccounts, MdLogout } from "react-icons/md";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import { capitalizeFirstLetter } from "../utils/assets";
import { useState } from "react";
import { endSession, useCurrentUser } from "../hooks/useSession";

/**
 * ProfileDropdown - Responsive profile menu for all devices
 *
 * Features:
 * - Responsive design for mobile, tablet, desktop
 * - Touch-friendly button sizes on mobile
 * - Proper spacing and padding for all screen sizes
 * - Smooth animations
 * - Accessible with keyboard navigation
 */
const ProfileDropdown = ({ onClose }) => {
  const navigate = useNavigate();
  const { t } = useTranslation("shared");
  const user = useCurrentUser();

  const getProfileUrl = () => {
    switch (user?.layoutRole) {
      case "STAFFING_COMPANY":
        return "/staffing-company/profile";
      case "EMPLOYEE":
        return "/employee/profile";
      default:
        return "/admin/profile";
    }
  };

  const profileUrl = getProfileUrl();

  // Header logout in every panel (ticket 23): POST /auth/logout, then the
  // local session is cleared even if that call failed. `replace` keeps the
  // dashboard out of the Back history; ProtectedRoute bounces any older panel
  // entry to /login because the session is now anonymous.
  const [loggingOut, setLoggingOut] = useState(false);
  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    onClose?.();
    await endSession();
    toast.success(t("toast.loggedOut"));
    navigate("/login", { replace: true });
  };

  const handleNavigate = (path) => {
    navigate(path);
    onClose?.();
  };

  return (
    <div className="w-full sm:min-w-[200px] max-w-[320px] sm:max-w-[280px] bg-white rounded-2xl shadow-xl mt-1 border border-gray-100 overflow-hidden">
      {/* User Info Section - Mobile Only */}
      <div className="sm:hidden px-4 py-4 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-3">
          <img
            src="https://ui-avatars.com/api/?name=User+Profile&background=0066cc&color=fff&size=40"
            alt={t("userProfileAlt")}
            className="w-10 h-10 rounded-lg border-2 border-blue-200"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {t("profile.portal")}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {capitalizeFirstLetter(user?.role?.name || user?.role || "")}
            </p>
          </div>
        </div>
      </div>

      {/* Profile Link */}
      <Link
        to={profileUrl}
        onClick={() => handleNavigate(profileUrl)}
        className="w-full px-4 sm:px-5 py-3 sm:py-3.5 flex items-center gap-3 text-start hover:bg-gray-50 active:bg-gray-50 transition-colors touch-target"
      >
        <MdOutlineManageAccounts className="text-xl sm:text-2xl text-gray-600 flex-shrink-0" />
        <span className="text-sm sm:text-base font-medium text-gray-800 truncate">
          {t("profile.myProfile")}
        </span>
      </Link>

      {/* Divider */}
      <div className="mx-3 sm:mx-4 border-t border-gray-100" />

      {/* Logout Button */}
      <button
        onClick={handleLogout}
        disabled={loggingOut}
        className="w-full px-4 sm:px-5 py-3 sm:py-3.5 flex items-center gap-3 text-start hover:bg-red-50 active:bg-red-50 transition-colors touch-target"
      >
        <MdLogout className="text-xl sm:text-2xl text-red-600 flex-shrink-0" />
        <span className="text-sm sm:text-base font-medium text-red-600 truncate">
          {t("profile.logout")}
        </span>
      </button>

      {/* Version Info - Hidden on very small screens */}
      <div className="hidden xs:block px-4 sm:px-5 py-2 sm:py-2.5 border-t border-gray-100 bg-gray-50">
        <p className="text-xs text-gray-400 text-center">
          {t("profile.version")}
        </p>
      </div>
    </div>
  );
};

export default ProfileDropdown;
