import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getStaticUser } from "../../data/session";
import { useSession } from "../../hooks/useSession";

import WorkInformation from "../../components/WorkInformation";
import PersonalInformation from "../../components/PersonalInformation";
import ActiveSessionsCard from "../../components/sessions/ActiveSessionsCard";
import Loader from "../../components/Loader";
import { ScreenError } from "../../components/ScreenState";
import useApiQuery from "../../hooks/useApiQuery";
import { getEmployee } from "../../api/employees";

// GET /employees/me (the Employee panel sees only its own profile, D57) → the profile sections' shape.
const toProfile = (d) => {
  const ov = d.overview;
  const main = d.projects.current.find((p) => p.is_main) || d.projects.current[0];
  return {
    full_name: ov.name,
    phone_number: ov.phone,
    email: ov.email,
    dob: ov.dob,
    nationality: ov.nationality?.name || "",
    gender: ov.gender,
    address: ov.address,
    profile_url: ov.profile_url,
    employee_id: ov.employee_code,
    department: ov.department?.name,
    designation: ov.designation?.name,
    project: main?.name || null,
    date_of_joining: ov.joining_date,
    employment_type: ov.employment_type,
    access_level: ov.access_level,
  };
};

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
  const isEmployeePanel = me?.account?.panel === "employee";
  const own = useApiQuery(() => (isEmployeePanel ? getEmployee("me") : Promise.resolve(null)), [isEmployeePanel]);
  const profile = own.data ? toProfile(own.data) : undefined;

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
        {isEmployeePanel && own.loading ? (
          <Loader />
        ) : isEmployeePanel && own.error ? (
          <ScreenError error={own.error} onRetry={own.reload} />
        ) : tab === "Personal Information" ? (
          <>
            <PersonalInformation profile={profile} />
            {showSessions && <ActiveSessionsCard />}
          </>
        ) : (
          <WorkInformation profile={profile} />
        )}
      </div>
  
  );
}
