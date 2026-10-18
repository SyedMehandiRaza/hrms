import { useTranslation } from "react-i18next";

// Status chips for the Employee Exit feature. Values are the backend enums;
// only the label is translated.

const EXIT_STYLES = {
  IN_NOTICE: "bg-amber-50 text-amber-700 border-amber-200",
  EXITED: "bg-rose-50 text-rose-700 border-rose-200",
  COMPLETED: "bg-gray-100 text-gray-700 border-gray-200",
  CANCELLED: "bg-slate-50 text-slate-500 border-slate-200",
};

const EMPLOYMENT_STYLES = {
  IN_NOTICE: "bg-amber-50 text-amber-700 border-amber-200",
  EXITED: "bg-rose-50 text-rose-700 border-rose-200",
};

const chip = "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border whitespace-nowrap";

export function ExitStatusBadge({ status, className = "" }) {
  const { t } = useTranslation("exits");
  if (!status) return null;
  return (
    <span className={`${chip} ${EXIT_STYLES[status] || EXIT_STYLES.COMPLETED} ${className}`}>
      {t(`status.${status}`, { defaultValue: status })}
    </span>
  );
}

// "On notice" / "Exited" — renders nothing for ACTIVE employees.
export function EmploymentStatusBadge({ status, className = "" }) {
  const { t } = useTranslation("exits");
  if (!status || !EMPLOYMENT_STYLES[status]) return null;
  return (
    <span className={`${chip} ${EMPLOYMENT_STYLES[status]} ${className}`}>
      {t(`employmentStatus.${status}`, { defaultValue: status })}
    </span>
  );
}
