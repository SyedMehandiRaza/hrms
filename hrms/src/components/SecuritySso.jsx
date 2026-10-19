import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  MdOutlineShield,
  MdOutlineHistory,
  MdOutlineDownload,
  MdOutlineCheckCircle,
} from "react-icons/md";
import ActiveSessionsCard from "./sessions/ActiveSessionsCard";

// ── Data ──────────────────────────────────────────────────────────────────────

const ACTIVITY = [
  {
    eventKey: "security.events.successfulLogin",
    device: "Chrome on MacOS",
    location: "London, GB",
    datetime: "Oct 24, 2023 · 09:41 AM",
    statusKey: "security.statusLabels.verified",
    statusStyle: "text-green-700 bg-green-50 border-green-200",
  },
  {
    eventKey: "security.events.twoFaSent",
    device: "Safari on iOS",
    location: "Madrid, ES",
    datetime: "Oct 23, 2023 · 04:15 PM",
    statusKey: "security.statusLabels.sent",
    statusStyle: "text-blue-700 bg-blue-50 border-blue-200",
  },
  {
    eventKey: "security.events.passwordChangeAttempt",
    device: "Firefox on Windows",
    location: "Paris, FR",
    datetime: "Oct 21, 2023 · 11:02 PM",
    statusKey: "security.statusLabels.failed",
    statusStyle: "text-red-600 bg-red-50 border-red-200",
  },
  {
    eventKey: "security.events.successfulLogin",
    device: "Edge on Windows",
    location: "Berlin, DE",
    datetime: "Oct 19, 2023 · 08:14 AM",
    statusKey: "security.statusLabels.verified",
    statusStyle: "text-green-700 bg-green-50 border-green-200",
  },
  {
    eventKey: "security.events.twoFaDisabledAttempt",
    device: "Chrome on Android",
    location: "Rome, IT",
    datetime: "Oct 17, 2023 · 07:55 PM",
    statusKey: "security.statusLabels.blocked",
    statusStyle: "text-orange-700 bg-orange-50 border-orange-200",
  },
];

// ── Toggle ────────────────────────────────────────────────────────────────────
const Toggle = ({ checked, onChange }) => (
  <button
    type="button"
    onClick={onChange}
    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-cyan-600 focus:ring-offset-2 ${
      checked ? "bg-cyan-600" : "bg-gray-200"
    }`}
    role="switch"
    aria-checked={checked}
  >
    <span
      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
        checked ? "translate-x-5" : "translate-x-0"
      }`}
    />
  </button>
);

// ── Main ──────────────────────────────────────────────────────────────────────
export default function SecuritySsO() {
  const { t } = useTranslation("settings");
  const [twoFA, setTwoFA] = useState(true);

  return (
    <div className="space-y-5">
      {/* ── Top Row: 2FA + Active Sessions ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* 2FA Security */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 lg:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MdOutlineShield className="text-cyan-600 text-xl" />
              <h3 className="text-base font-bold text-gray-900">
                {t("security.twoFaTitle")}
              </h3>
            </div>
            <Toggle checked={twoFA} onChange={() => setTwoFA((v) => !v)} />
          </div>

          <p className="text-sm text-gray-500 leading-relaxed mb-5">
            {t("security.twoFaDesc")}
          </p>

          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl transition-colors ${
              twoFA
                ? "bg-green-50 border border-green-200"
                : "bg-gray-50 border border-gray-200"
            }`}
          >
            {twoFA ? (
              <>
                <MdOutlineCheckCircle className="text-green-500 text-xl flex-shrink-0" />
                <p className="text-sm font-semibold text-green-700">
                  {t("security.currentlyProtected")}
                </p>
              </>
            ) : (
              <>
                <MdOutlineShield className="text-gray-400 text-xl flex-shrink-0" />
                <p className="text-sm font-semibold text-gray-500">
                  {t("security.twoFaDisabled")}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Active Sessions (GET /auth/sessions) */}
        <ActiveSessionsCard />
      </div>

      {/* ── Recent Security Activity ── */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <MdOutlineHistory className="text-cyan-600 text-xl" />
            <h3 className="text-base font-bold text-gray-900">
              {t("security.recentActivity")}
            </h3>
          </div>
          <button className="flex items-center gap-1.5 text-sm font-semibold text-cyan-600 hover:text-cyan-700 transition-colors">
            <MdOutlineDownload className="text-base" /> {t("security.downloadReport")}
          </button>
        </div>

        {/* Desktop Table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {[
                  { id: "sn", labelKey: "security.table.sn" },
                  { id: "event", labelKey: "security.table.event" },
                  { id: "device", labelKey: "security.table.device" },
                  { id: "location", labelKey: "security.table.location" },
                  { id: "datetime", labelKey: "security.table.datetime" },
                  { id: "status", labelKey: "security.table.status" },
                ].map((h) => (
                  <th
                    key={h.id}
                    className={`px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider ${
                      h.id === "status" ? "text-end" : "text-start"
                    }`}
                  >
                    {t(h.labelKey)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {ACTIVITY.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-4 text-sm text-gray-500">
                    {i + 1}
                  </td>
                  <td className="px-5 py-4 text-sm font-medium text-gray-900">
                    {t(row.eventKey)}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-500">
                    {row.device}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-500">
                    {row.location}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-500 whitespace-nowrap">
                    {row.datetime}
                  </td>
                  <td className="px-5 py-4 text-end">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-bold border ${row.statusStyle}`}
                    >
                      {t(row.statusKey)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="sm:hidden divide-y divide-gray-100">
          {ACTIVITY.map((row, i) => (
            <div key={i} className="px-4 py-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-gray-900">
                  {t(row.eventKey)}
                </p>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border flex-shrink-0 ${row.statusStyle}`}
                >
                  {t(row.statusKey)}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                <span>{row.device}</span>
                <span>{row.location}</span>
                <span>{row.datetime}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
