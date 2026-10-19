import { useTranslation } from "react-i18next";

// Status → badge colours. A closed + locked year shows "Closed 🔒".
const BADGE = {
  OPEN: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CLOSING: "bg-amber-50 text-amber-700 border-amber-200",
  CLOSED: "bg-gray-100 text-gray-600 border-gray-200",
  PLANNED: "bg-sky-50 text-sky-700 border-sky-200",
};

export default function YearStatusBadge({ year, className = "" }) {
  const { t } = useTranslation("fiscalYear");
  if (!year) return null;
  const text = year.status === "CLOSED" && year.is_locked
    ? t("status.locked")
    : t(`status.${year.status}`, { defaultValue: year.status });
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded-md border text-[10px] font-semibold whitespace-nowrap ${BADGE[year.status] || BADGE.CLOSED} ${className}`}
    >
      {text}
    </span>
  );
}

