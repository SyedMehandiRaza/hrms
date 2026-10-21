import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

import RolesPermissions from "../../components/RolesPermission";
import { MdOutlineShield } from "react-icons/md";
import BillingSubscriptions from "../../components/BillingSubscription";
import NotificationSettings from "../../components/NotificationSettings";
import CompanyProfile from "../../components/CompanyProfile";
import UserManagement from "../../components/UserManagement";
import SecuritySsO from "../../components/SecuritySso";
import ExitSettingsTab from "../../components/exits/ExitSettingsTab";
import { MODULES } from "../../constants/permissions";
import FinancialYearTab from "./FinancialYearTab";
import { useCan } from "../../hooks/usePermission";

// ── Constants ─────────────────────────────────────────────────────────────────
const TABS = [
  { id: "Company Profile", labelKey: "tabs.companyProfile" },
  { id: "User Management", labelKey: "tabs.userManagement" },
  { id: "Roles & Permissions", labelKey: "tabs.rolesPermissions" },
  { id: "Billing & Subscriptions", labelKey: "tabs.billingSubscriptions" },
  { id: "Security & SSO", labelKey: "tabs.securitySso" },
  { id: "Notification", labelKey: "tabs.notification" },
];
// Shown only to users who may manage exits; its label lives in the exits namespace.
const EXIT_TAB = { id: "Exit Settings", labelKey: "exits:settings.tabLabel" };
// Shown to the owner or a role with financial_year read.
const FY_TAB = { id: "Financial Year", labelKey: "tabs.financialYear" };

// ── Placeholder Tab ───────────────────────────────────────────────────────────
function PlaceholderTab({ name }) {
  const { t } = useTranslation("settings");
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
      <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center">
        <MdOutlineShield className="text-gray-300 text-3xl" />
      </div>
      <p className="text-base font-bold text-gray-700">{name}</p>
      <p className="text-sm text-gray-400">{t("placeholder.comingSoon")}</p>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Settings() {
  const { t } = useTranslation("settings");
  const location = useLocation();
  // other pages may open a tab directly: navigate("/admin/settings", { state: { tab } })
  const [activeTab, setActiveTab] = useState(location.state?.tab || "Company Profile");
  const can = useCan();
  // Exit settings: exit:read sees the tab, exit:update saves it (D62).
  const canManageExits = can(MODULES.EXIT, "read");
  const canSeeFy = can("financial_year", "read");
  const tabs = [...TABS, ...(canManageExits ? [EXIT_TAB] : []), ...(canSeeFy ? [FY_TAB] : [])];

  const renderTab = () => {
    if (activeTab === "Company Profile") return <CompanyProfile />;
    if (activeTab === "User Management") return <UserManagement />;
    if (activeTab === "Roles & Permissions") return <RolesPermissions />;
    if (activeTab === "Billing & Subscriptions")
      return <BillingSubscriptions />;
    if (activeTab === "Security & SSO") return <SecuritySsO />;
    if (activeTab === "Notification") return <NotificationSettings />;
    if (activeTab === EXIT_TAB.id)
      return canManageExits ? <ExitSettingsTab /> : <CompanyProfile />;
    if (activeTab === FY_TAB.id)
      return canSeeFy ? <FinancialYearTab /> : <CompanyProfile />;
    return <PlaceholderTab name={activeTab} />;
  };

  return (

      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
            {t("page.title")}
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            {t("page.subtitle")}
          </p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex overflow-x-auto scrollbar-hide -mb-px gap-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors flex-shrink-0 ${
                  activeTab === tab.id
                    ? "border-cyan-600 text-cyan-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {t(tab.labelKey)}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div>{renderTab()}</div>

        {/* Footer */}
        <div className="pt-4 border-t border-gray-100 text-center">
          <p className="flex items-center justify-center gap-2 text-[10px] font-bold text-gray-300 uppercase tracking-widest">
            <MdOutlineShield className="text-sm" /> {t("page.footer")}
          </p>
        </div>
      </div>

  );
}
