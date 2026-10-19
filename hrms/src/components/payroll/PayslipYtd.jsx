import { useTranslation } from "react-i18next";
import { MdOutlineInsights } from "react-icons/md";
import useFiscalYear from "../../hooks/useFiscalYear";
import { fyLabel, yearKeyFor } from "../../utils/fiscalYear";
import Ltr from "../Ltr";

const money = (n) =>
  Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// "Year to date (FY …)" block for one payslip — the backend's `ytd`
// ({ gross, deductions, net, months }: credited payslips from the start of the
// payslip's financial year through its month). Renders nothing without ytd.
//
//   <PayslipYtd ytd={p.ytd} period={p.period} currency="SAR" />
export default function PayslipYtd({ ytd, period, currency = "SAR", className = "" }) {
  const { t } = useTranslation("payroll");
  const fy = useFiscalYear();
  if (!ytd) return null;

  // The FY the payslip's month belongs to (label from the loaded years, else computed).
  let label = "";
  if (period?.year && period?.month) {
    const key = yearKeyFor(fy.startMonth, `${period.year}-${String(period.month).padStart(2, "0")}`);
    label = fy.years.find((y) => y.year_key === key)?.label || fyLabel(fy.startMonth, key);
  }

  const cells = [
    { key: "gross", label: t("ytd.gross"), value: money(ytd.gross), tone: "text-gray-900" },
    { key: "deductions", label: t("ytd.deductions"), value: money(ytd.deductions), tone: "text-red-600" },
    { key: "net", label: t("ytd.net"), value: money(ytd.net), tone: "text-cyan-700" },
  ];

  return (
    <div className={`border border-cyan-100 bg-cyan-50/40 rounded-xl p-4 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-widest text-cyan-700">
          <MdOutlineInsights className="text-base" />
          {label ? t("ytd.titleWithFy", { label }) : t("ytd.title")}
        </h3>
        <span className="text-xs text-gray-500">{t("ytd.months", { count: Number(ytd.months) || 0 })}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {cells.map((c) => (
          <div key={c.key} className="bg-white border border-gray-100 rounded-lg px-3 py-2.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{c.label}</p>
            <p className={`text-sm font-bold mt-0.5 ${c.tone}`}>
              <Ltr>{`${currency} ${c.value}`}</Ltr>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
