import { useTranslation } from "react-i18next";
import { useFormat } from "../../../hooks/useFormat";
import Ltr from "../../Ltr";
import { encashMonthLabel } from "../../../utils/fyValidation/encashment";

// Shared bits of the leave-encashment screens (employee list + admin page).
const ENCASH_STATUS_STYLE = {
  PENDING: "text-amber-700 bg-amber-50 border-amber-200",
  APPROVED: "text-cyan-700 bg-cyan-50 border-cyan-200",
  PAID: "text-green-700 bg-green-50 border-green-200",
  REJECTED: "text-red-700 bg-red-50 border-red-200",
  CANCELLED: "text-gray-500 bg-gray-100 border-gray-200",
};

export function EncashStatusBadge({ status }) {
  const { t } = useTranslation("leaves");
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold border ${ENCASH_STATUS_STYLE[status] || "text-gray-700 bg-gray-50 border-gray-200"}`}
    >
      {t(`encashment.status.${status}`, { defaultValue: status })}
    </span>
  );
}

// "1,234.50 SAR"-style amount in the current language (digits LTR).
export function EncashAmount({ value, currency }) {
  const { fmtNumber } = useFormat();
  if (value === null || value === undefined) return <span className="text-gray-400">—</span>;
  return (
    <Ltr>
      {currency ? `${currency} ` : ""}
      {fmtNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </Ltr>
  );
}

export function EncashMonth({ value }) {
  return <Ltr>{encashMonthLabel(value) || "—"}</Ltr>;
}
