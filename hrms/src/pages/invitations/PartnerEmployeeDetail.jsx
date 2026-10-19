import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  MdArrowBack,
  MdOutlinePerson,
  MdOutlineEventAvailable,
  MdChevronLeft,
  MdChevronRight,
} from "react-icons/md";
import { initials } from "./partnerMock";
import { partnerAttendanceSummary } from "../../data/groupB";
import useFiscalYear from "../../hooks/useFiscalYear";

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

const Field = ({ label, value }) => (
  <div>
    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
    <p className="text-sm text-gray-800 mt-0.5">{value || "—"}</p>
  </div>
);

const StatTile = ({ label, value, tone = "text-gray-800" }) => (
  <div className="rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3">
    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
    <p className={`text-xl font-bold mt-1 ${tone}`}>{value ?? "—"}</p>
  </div>
);

// Scoped detail a parent company may see for a partner-company employee —
// OVERVIEW + ATTENDANCE only.
export default function PartnerEmployeeDetail({ employee, company, onBack }) {
  const { t } = useTranslation("collaboration");
  const [tab, setTab] = useState("overview");
  const overview = employee;
  // Attendance month: one of the header's financial-year months (FY order),
  // back to the year's default month when the year changes.
  const fy = useFiscalYear();
  const [month, setMonth] = useState(fy.defaultMonth);
  const [fyVersion, setFyVersion] = useState(fy.version);
  if (fyVersion !== fy.version) {
    setFyVersion(fy.version);
    setMonth(fy.defaultMonth);
  }
  const ym = { year: Number(month.slice(0, 4)), month: Number(month.slice(5, 7)) };
  const monthIdx = fy.months.findIndex((m) => m.value === month);
  const summary = useMemo(() => partnerAttendanceSummary(employee.id, month), [employee.id, month]);
  const attLoading = false;

  // Step within the FY only (no FY loaded yet → plain calendar steps).
  const canPrev = fy.months.length ? monthIdx > 0 : true;
  const canNext = fy.months.length ? monthIdx >= 0 && monthIdx < fy.months.length - 1 : true;
  const shiftMonth = (d) => {
    if (fy.months.length && monthIdx >= 0) {
      const next = fy.months[monthIdx + d];
      if (next) setMonth(next.value);
      return;
    }
    const dt = new Date(Date.UTC(ym.year, ym.month - 1 + d, 1));
    setMonth(`${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`);
  };

  const TABS = [
    { key: "overview", label: t("employeeDetail.tabs.overview"), icon: MdOutlinePerson },
    { key: "attendance", label: t("employeeDetail.tabs.attendance"), icon: MdOutlineEventAvailable },
  ];
  const o = overview || employee;
  const mainProject = o.projects?.[0]?.project_name || (o.main_project_id ? `#${o.main_project_id}` : "—");

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900">
        <MdArrowBack /> {t("employeeDetail.backToEmployees")}
      </button>

      <div className="bg-white border border-gray-200 rounded-2xl p-5 flex items-center gap-4">
        <span className="flex-shrink-0 w-14 h-14 rounded-full grid place-items-center text-lg font-bold bg-cyan-100 text-cyan-700">{initials(o.full_name)}</span>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-gray-900 truncate">{o.full_name}</h2>
          <p className="text-sm text-gray-500">{o.roles?.[0]?.name || "—"} · {o.country_emp_id || `#${o.id}`}{company?.name ? ` · ${company.name}` : ""}</p>
        </div>
        <span className={`ms-auto inline-flex px-2.5 py-1 rounded-md text-[10px] font-bold uppercase ${String(o.user_status).toUpperCase() === "ACTIVE" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>{o.user_status ? t(`userStatus.${String(o.user_status).toUpperCase()}`, { defaultValue: o.user_status }) : "—"}</span>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        {TABS.map((tb) => (
          <button key={tb.key} onClick={() => setTab(tb.key)} className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${tab === tb.key ? "border-cyan-600 text-cyan-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            <tb.icon className="text-lg" /> {tb.label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 grid grid-cols-2 md:grid-cols-3 gap-y-5 gap-x-6">
          <Field label={t("employeeDetail.fields.fullName")} value={o.full_name} />
          <Field label={t("employeeDetail.fields.employeeCode")} value={o.country_emp_id} />
          <Field label={t("employeeDetail.fields.role")} value={o.roles?.[0]?.name} />
          <Field label={t("employeeDetail.fields.employmentType")} value={o.employment_type ? t(`employmentType.${o.employment_type}`, { defaultValue: String(o.employment_type).replace("_", "-") }) : null} />
          <Field label={t("employeeDetail.fields.email")} value={o.email} />
          <Field label={t("employeeDetail.fields.phone")} value={o.phone_number} />
          <Field label={t("employeeDetail.fields.company")} value={company?.name} />
          <Field label={t("employeeDetail.fields.mainProject")} value={mainProject} />
          <Field label={t("employeeDetail.fields.status")} value={o.user_status ? t(`userStatus.${String(o.user_status).toUpperCase()}`, { defaultValue: o.user_status }) : o.user_status} />
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center justify-center gap-4">
            <button type="button" onClick={() => shiftMonth(-1)} disabled={!canPrev} aria-label={t("employeeDetail.prevMonth")} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"><MdChevronLeft className="text-lg rtl:rotate-180" /></button>
            <span className="text-sm font-bold text-gray-800 w-40 text-center">{t(`months.${MONTHS[ym.month - 1]}`)} {ym.year}</span>
            <button type="button" onClick={() => shiftMonth(1)} disabled={!canNext} aria-label={t("employeeDetail.nextMonth")} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"><MdChevronRight className="text-lg rtl:rotate-180" /></button>
          </div>
          {attLoading ? (
            <p className="text-center text-sm text-gray-400 py-8">{t("employeeDetail.loadingAttendance")}</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <StatTile label={t("employeeDetail.stats.workingDays")} value={summary?.working_days} />
              <StatTile label={t("employeeDetail.stats.present")} value={summary?.present_days} tone="text-green-600" />
              <StatTile label={t("employeeDetail.stats.absent")} value={summary?.absent_days} tone="text-red-600" />
              <StatTile label={t("employeeDetail.stats.paidLeave")} value={summary?.paid_leave_days} tone="text-blue-600" />
              <StatTile label={t("employeeDetail.stats.workedHrs")} value={summary?.worked_hours} />
            </div>
          )}
          <p className="text-xs text-gray-400 text-center">{t("employeeDetail.attendanceNote", { company: company?.name || "" })}</p>
        </div>
      )}
    </div>
  );
}
