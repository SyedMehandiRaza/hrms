import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getStaticUser } from "../../data/session";
import { useSession } from "../../hooks/useSession";

import WorkInformation from "../../components/WorkInformation";
import PersonalInformation from "../../components/PersonalInformation";
import ActiveSessionsCard from "../../components/sessions/ActiveSessionsCard";

// ── Constants ─────────────────────────────────────────────────────────────────
const TABS = [
  { id: "Personal Information", labelKey: "tabs.personalInformation" },
  { id: "Work Information", labelKey: "tabs.workInformation" },
];

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Profile() {
  const { t } = useTranslation("profile");
  const user = getStaticUser();
  const isEmployer = user?.role?.name?.toLowerCase() === "employer" || (typeof user?.role === "string" && user.role.toLowerCase() === "employer");
  const [tab, setTab] = useState("Personal Information");
  // Admin-panel users manage sessions in Settings → Security & SSO; employees here (D15).
  const { me } = useSession();
  const showSessions = me?.account?.panel === "employee";

  const visibleTabs = TABS.filter(item => {
    if (isEmployer && item.id === "Work Information") return false;
    return true;
  });

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
          <div className="flex gap-0 -mb-px">
            {visibleTabs.map((item) => (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex-shrink-0 ${
                  tab === item.id
                    ? "border-cyan-600 text-cyan-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {t(item.labelKey)}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {tab === "Personal Information" ? (
          <>
            <PersonalInformation />
            {showSessions && <ActiveSessionsCard />}
          </>
        ) : (
          <WorkInformation />
        )}
      </div>
  
  );
}
