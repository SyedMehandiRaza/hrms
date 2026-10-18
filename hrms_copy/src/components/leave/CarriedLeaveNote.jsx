import { MdOutlineHistory } from "react-icons/md";
import { useTranslation } from "react-i18next";
import useFiscalYear from "../../hooks/useFiscalYear";
import { useFormat } from "../../hooks/useFormat";
import { fyLabel } from "../../utils/fiscalYear";

// "Carried from FY 2026: 10 (use by 31 Mar)" for a leave-balance row.
//
//   <CarriedLeaveNote balance={row} className="" />
//
// Reads the row fields the backend adds to every balance (leaveBalance.service
// fyFieldsOf): carry_forward, carry_forward_used, carry_forward_expires_on, and
// balance_year when present (else the selected FY). The source year is the FY
// before the balance year. Renders nothing when nothing was carried.
export default function CarriedLeaveNote({ balance, className = "" }) {
  const { t } = useTranslation("leaves");
  const { fmtDate } = useFormat();
  const fy = useFiscalYear();

  const carried = Number(balance?.carry_forward || 0);
  if (!balance || !(carried > 0)) return null;

  const used = Number(balance.carry_forward_used || 0);
  const left = Math.max(0, Math.round((carried - used) * 100) / 100);
  const balanceYear = Number(balance.balance_year || fy.selected || 0);
  const sourceKey = balanceYear ? balanceYear - 1 : null;
  const label = sourceKey
    ? fy.years.find((y) => y.year_key === sourceKey)?.label || fyLabel(fy.startMonth, sourceKey)
    : "";
  const expires = balance.carry_forward_expires_on ? String(balance.carry_forward_expires_on).slice(0, 10) : null;
  const expired = !!expires && expires < fy.today;
  const date = expires ? fmtDate(expires, { day: "numeric", month: "short" }) : "";

  const text = expires
    ? t(expired ? "fy.carried.expired" : "fy.carried.withExpiry", { label, days: carried, date })
    : t("fy.carried.noExpiry", { label, days: carried });

  return (
    <p
      className={`flex items-start gap-1.5 text-[11px] leading-snug ${expired ? "text-gray-400" : "text-indigo-600"} ${className}`}
      title={used > 0 ? t("fy.carried.left", { left }) : undefined}
    >
      <MdOutlineHistory className="shrink-0 mt-px text-xs" />
      <span>
        {text}
        {used > 0 && !expired && <span className="text-gray-400"> · {t("fy.carried.left", { left })}</span>}
      </span>
    </p>
  );
}
