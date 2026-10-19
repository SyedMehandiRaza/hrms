import { useTranslation } from "react-i18next";

import { isContractExpired } from "./contractHelpers";

// Contract status chip + the "Expired" chip (list and detail).
const STYLES = {
  DRAFT: ["bg-gray-100 text-gray-600", "bg-gray-400"],
  SENT: ["bg-indigo-50 text-indigo-600", "bg-indigo-500"],
  VIEWED: ["bg-sky-50 text-sky-700", "bg-sky-500"],
  SUBMITTED: ["bg-amber-50 text-amber-700", "bg-amber-500"],
  APPROVED: ["bg-green-50 text-green-700", "bg-green-500"],
  COMPLETED: ["bg-emerald-50 text-emerald-700", "bg-emerald-500"],
  REJECTED: ["bg-rose-50 text-rose-600", "bg-rose-500"],
  EXPIRED: ["bg-orange-50 text-orange-700", "bg-orange-500"],
};

export function ContractStatusBadge({ status }) {
  const { t } = useTranslation("contracts");
  if (!status) return null;
  const [chip, dot] = STYLES[status] || STYLES.DRAFT;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${chip}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {t(`status.${status}`, { defaultValue: status })}
    </span>
  );
}

// "Expired" — shown next to the status when the end date has passed but the
// backend has not flipped the status yet (or always, for an EXPIRED contract).
export function ExpiredBadge({ contract, today }) {
  const { t } = useTranslation("contracts");
  if (!isContractExpired(contract, today) || contract.status === "EXPIRED") return null;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border bg-orange-50 text-orange-700 border-orange-200 whitespace-nowrap">
      {t("term.expired")}
    </span>
  );
}
