import { MdOutlineChevronRight, MdOutlineFolder, MdOutlineShield } from "react-icons/md";
import { useTranslation } from "react-i18next";
import Ltr from "./Ltr";
import { useFormat } from "../hooks/useFormat";

import { useState } from "react";
import { getStaticUser } from "../data/session";
import { myProfile } from "../data/groupB";

// ── Info Card ─────────────────────────────────────────────────────────────────
const InfoCard = ({ label, value, extra, loading = false }) => (
  <div className="bg-white border border-gray-200 rounded-xl px-5 py-4">
    <p className="text-xs text-gray-400 mb-1.5">{label}</p>
    {loading ? (
      <div className="h-4 bg-gray-200 rounded animate-pulse w-2/3"></div>
    ) : extra ? (
      <div className="flex items-center gap-2">{extra}</div>
    ) : (
      <p className="text-sm font-bold text-gray-900">{value || "—"}</p>
    )}
  </div>
);

// `profile`: the signed-in employee's own record (Profile.jsx); without it the static profile.
function WorkInformation({ profile: given }) {
  const { t } = useTranslation("profile");
  const { fmtDate } = useFormat();
  const user = getStaticUser();
  const isEmployer = user?.role?.name?.toLowerCase() === "employer" || (typeof user?.role === "string" && user.role.toLowerCase() === "employer");

  const [profile] = useState(() => given || myProfile());
  const loading = false;

  // Sample/seed values that will come from the API later — kept as English
  // literals (NOT translated). Only the field labels/chrome are translated.
  const credentials = [
    { id: "systemAccessLevel", value: profile?.access_level ? profile.access_level.replace(/_/g, " ") : "—" },
    { id: "workLocation", value: "—" },
    { id: "primaryEquipment", value: "—" },
  ];

  return (
    <div className="space-y-5">
      {/* Info Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <InfoCard
          label={isEmployer ? "Employer ID" : t("work.employeeId")}
          value={<Ltr>{profile?.employee_id}</Ltr>}
          loading={loading}
        />
        <InfoCard label={t("work.department")} value={profile?.department} loading={loading} />
        <InfoCard label={t("work.role")} value={profile?.designation} loading={loading} />
        <InfoCard
          label={t("work.assignedProject")}
          loading={loading}
          extra={
            profile?.project ? (
              <>
                <MdOutlineFolder className="text-cyan-500 text-lg" />
                <span className="text-sm font-bold text-gray-900">
                  {profile.project}
                </span>
              </>
            ) : (
              <span className="text-sm font-bold text-gray-900">—</span>
            )
          }
        />
        {/* date_of_joining is the real joining date; joining_date is the older (created-at) field */}
        <InfoCard
          label={t("work.joiningDate")}
          value={profile?.date_of_joining || profile?.joining_date ? fmtDate(profile.date_of_joining || profile.joining_date) : "—"}
          loading={loading}
        />
        {!isEmployer && (
          <InfoCard
            label={t("work.employeeType")}
            loading={loading}
            extra={
              profile?.employment_type ? (
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-xs font-semibold text-indigo-700">
                  {profile.employment_type === "FULL_TIME" ? "Full Time" : profile.employment_type === "CONTRACT" ? "Contract" : profile.employment_type}
                </span>
              ) : (
                <span className="text-sm font-bold text-gray-900">—</span>
              )
            }
          />
        )}
      </div>

      {/* Reporting Manager */}
      {!isEmployer && (
        <div className="bg-white border border-gray-200 rounded-xl px-5 py-4">
          <p className="text-xs text-gray-400 mb-3">{t("work.reportingManager")}</p>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-cyan-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                —
              </div>
              <p className="text-sm font-bold text-gray-900">—</p>
            </div>
            <button className="flex items-center gap-1 text-sm font-semibold text-cyan-600 hover:text-cyan-700 transition-colors flex-shrink-0">
              {t("work.viewOrgChart")} <MdOutlineChevronRight className="text-base rtl:rotate-180" />
            </button>
          </div>
        </div>
      )}

      {/* Work Credentials & Access */}
      <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-indigo-100">
          <MdOutlineShield className="text-indigo-400 text-xl" />
          <h3 className="text-sm font-bold text-gray-900">
            {t("work.credentialsTitle")}
          </h3>
        </div>
        <div className="space-y-0 divide-y divide-indigo-100">
          {credentials.map(({ id, value }) => (
            <div
              key={id}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 py-3"
            >
              <span className="text-sm text-gray-500">{t(`work.${id}`)}</span>
              <span className="text-sm font-bold text-gray-900 sm:text-end">
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default WorkInformation;
