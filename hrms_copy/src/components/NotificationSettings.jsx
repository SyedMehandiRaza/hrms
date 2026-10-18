import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  MdMonetizationOn,
  MdSecurity,
  MdPeople,
  MdBarChart,
  MdEmail,
  MdNotifications,
  MdCheckCircle,
  MdSmartphone,
  MdQrCode2,
} from "react-icons/md";
import Ltr from "./Ltr";

// ── Data ──────────────────────────────────────────────────────────────────────
// Static display metadata + default channel prefs. Visible labels/descriptions
// are resolved at render time from the "settings" namespace via section/alert id.
const SECTIONS = [
  {
    id: "payroll",
    icon: MdMonetizationOn,
    iconBg: "bg-cyan-50",
    iconColor: "text-cyan-600",
    alerts: [
      { id: "payroll_processed", email: true, system: true },
      { id: "tax_filing_reminders", email: false, system: true },
    ],
  },
  {
    id: "operations",
    icon: MdSecurity,
    iconBg: "bg-green-50",
    iconColor: "text-green-600",
    alerts: [
      { id: "leave_requests", email: true, system: true },
      { id: "document_expiry", email: true, system: true },
      { id: "contract_approvals", email: false, system: true },
    ],
  },
  {
    id: "hr",
    icon: MdPeople,
    iconBg: "bg-purple-50",
    iconColor: "text-purple-600",
    alerts: [
      { id: "new_hire_onboarded", email: true, system: false },
      { id: "interview_scheduled", email: true, system: true },
    ],
  },
  {
    id: "reports",
    icon: MdBarChart,
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
    alerts: [
      { id: "monthly_report", email: true, system: false },
      { id: "anomaly_detected", email: true, system: true },
      { id: "export_complete", email: false, system: true },
    ],
  },
];

// ── Checkbox ──────────────────────────────────────────────────────────────────
const NotifCheckbox = ({ checked, label, onChange }) => (
  <label className="flex items-center gap-1.5 cursor-pointer select-none">
    <button
      type="button"
      onClick={onChange}
      className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-colors border-2 ${
        checked
          ? "bg-cyan-600 border-cyan-600"
          : "bg-white border-gray-300 hover:border-cyan-400"
      }`}
    >
      {checked && (
        <svg
          className="w-3 h-3 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
          />
        </svg>
      )}
    </button>
    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
      {label}
    </span>
  </label>
);

// ── Main ──────────────────────────────────────────────────────────────────────
export default function NotificationSettings() {
  const { t } = useTranslation("settings");

  // Build initial prefs from SECTIONS data
  const buildInitial = () =>
    SECTIONS.reduce((acc, sec) => {
      sec.alerts.forEach((a) => {
        acc[a.id] = { email: a.email, system: a.system };
      });
      return acc;
    }, {});

  const [prefs, setPrefs] = useState(buildInitial);
  const [saved, setSaved] = useState(false);

  const toggle = (id, channel) =>
    setPrefs((p) => ({ ...p, [id]: { ...p[id], [channel]: !p[id][channel] } }));

  const enabledCount = Object.values(prefs).reduce(
    (n, v) => n + (v.email ? 1 : 0) + (v.system ? 1 : 0),
    0,
  );

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };
  const handleCancel = () => {
    setPrefs(buildInitial());
  };

  return (
    <div className="flex flex-col lg:flex-row gap-5 items-start">
      {/* ── Left: Notification Groups ── */}
      <div className="flex-1 space-y-5">
        {SECTIONS.map((sec) => {
          const Icon = sec.icon;
          return (
            <div
              key={sec.id}
              className="bg-white border border-gray-200 rounded-xl overflow-hidden"
            >
              {/* Section Header */}
              <div className="flex items-start gap-4 px-5 py-5 border-b border-gray-100">
                <div
                  className={`w-11 h-11 ${sec.iconBg} rounded-xl flex items-center justify-center flex-shrink-0`}
                >
                  <Icon className={`${sec.iconColor} text-xl`} />
                </div>
                <div>
                  <p className="text-base font-bold text-gray-900">
                    {t(`notification.sections.${sec.id}.title`)}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                    {t(`notification.sections.${sec.id}.desc`)}
                  </p>
                </div>
              </div>

              {/* Alert Rows */}
              <div className="divide-y divide-gray-50">
                {sec.alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4"
                  >
                    {/* Label */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">
                        {t(`notification.sections.${sec.id}.${alert.id}.label`)}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                        {t(`notification.sections.${sec.id}.${alert.id}.desc`)}
                      </p>
                    </div>
                    {/* Toggles */}
                    <div className="flex items-center gap-5 flex-shrink-0 ps-0 sm:ps-6">
                      <NotifCheckbox
                        checked={prefs[alert.id]?.email ?? false}
                        label={t("notification.channels.email")}
                        onChange={() => toggle(alert.id, "email")}
                      />
                      <NotifCheckbox
                        checked={prefs[alert.id]?.system ?? false}
                        label={t("notification.channels.system")}
                        onChange={() => toggle(alert.id, "system")}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleCancel}
            className="w-full sm:w-auto px-6 py-2.5 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors"
          >
            {t("notification.cancel")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className={`w-full sm:w-auto px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors text-white ${
              saved ? "bg-green-500" : "bg-cyan-600 hover:bg-cyan-700"
            }`}
          >
            {saved ? t("notification.saved") : t("notification.save")}
          </button>
        </div>
      </div>

      {/* ── Right Sidebar ── */}
      <div className="w-full lg:w-64 xl:w-72 flex-shrink-0 space-y-4">
        {/* Summary */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-base font-bold text-gray-900 mb-4">
            {t("notification.summary")}
          </h3>
          <div className="space-y-3 mb-4">
            {[
              {
                id: "activeChannels",
                label: t("notification.activeChannels"),
                value: "2 / 2",
              },
              {
                id: "enabledAlerts",
                label: t("notification.enabledAlerts"),
                value: t("notification.enabledAlertsValue", {
                  count: enabledCount,
                }),
              },
              {
                id: "avgFrequency",
                label: t("notification.avgFrequency"),
                value: "~4/day",
              },
            ].map(({ id, label, value }) => (
              <div key={id} className="flex items-center justify-between">
                <span className="text-sm text-gray-500">{label}</span>
                <span
                  className={`text-sm font-bold ${id === "enabledAlerts" ? "text-cyan-600" : "text-gray-900"}`}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>

          {/* Primary Email */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              {t("notification.primaryEmail")}
            </p>
            <div className="flex items-center gap-2">
              <MdEmail className="text-gray-400 text-base flex-shrink-0" />
              <p className="text-xs font-semibold text-gray-700 truncate">
                <Ltr>admin.hrms@enterprise.com</Ltr>
              </p>
            </div>
          </div>
        </div>

        {/* Smart Alerts */}
        <div className="bg-cyan-600 rounded-xl p-5 relative overflow-hidden">
          <div className="absolute top-4 end-4 opacity-10">
            <MdNotifications className="text-[80px] text-white" />
          </div>
          <div className="relative z-10">
            <p className="text-base font-bold text-cyan-300 mb-2">
              {t("notification.smartAlerts")}
            </p>
            <p className="text-xs text-cyan-100 leading-relaxed">
              {t("notification.smartAlertsDesc")}
            </p>
          </div>
        </div>

        {/* Mobile Access */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-base font-bold text-gray-900 mb-4">
            {t("notification.mobileAccess")}
          </h3>
          <div className="flex items-start gap-4">
            {/* QR Code placeholder */}
            <div className="w-16 h-16 bg-gray-100 border border-gray-200 rounded-xl flex items-center justify-center flex-shrink-0">
              <MdQrCode2 className="text-3xl text-gray-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-1">
                {t("notification.scanToDownload")}
              </p>
              <p className="text-xs text-gray-400 leading-relaxed">
                {t("notification.scanToDownloadDesc")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
