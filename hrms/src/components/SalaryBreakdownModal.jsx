import React from "react";
import { MdClose, MdOutlineReceiptLong } from "react-icons/md";
import { useTranslation } from "react-i18next";
import Ltr from "./Ltr";

const formatMoney = (val) => {
  const n = Number(val);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export default function SalaryBreakdownModal({ isOpen, onClose, salaryData }) {
  const { t } = useTranslation("payroll");

  if (!isOpen) return null;

  const current = salaryData?.current;
  const earnings = current?.earnings || [];
  const deductions = current?.deductions || [];
  
  const gross = current?.preview?.gross || 0;
  const totalDeductions = current?.preview?.deductions || 0;
  const net = current?.preview?.net || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <MdOutlineReceiptLong className="text-cyan-500 text-2xl" />
            <h2 className="text-xl font-bold text-gray-900">
              {t("breakdown.title")}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <MdClose className="text-xl text-gray-400 hover:text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Earnings */}
            <div>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">
                {t("breakdown.earnings")}
              </h3>
              <div className="space-y-3">
                {earnings.map((e, idx) => (
                  <div key={idx} className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">{e.name}</span>
                    <span className="text-sm font-semibold text-gray-900">
                      <Ltr>{formatMoney(e.amount || e.resolved_amount)}</Ltr>
                    </span>
                  </div>
                ))}
                {earnings.length === 0 && (
                  <p className="text-sm text-gray-400 italic">{t("breakdown.noEarnings")}</p>
                )}
              </div>
              <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center">
                <span className="text-sm font-bold text-gray-900">{t("breakdown.grossEarnings")}</span>
                <span className="text-sm font-bold text-gray-900">
                  <Ltr>{formatMoney(gross)}</Ltr>
                </span>
              </div>
            </div>

            {/* Deductions */}
            <div>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">
                {t("breakdown.deductions")}
              </h3>
              <div className="space-y-3">
                {deductions.map((d, idx) => (
                  <div key={idx} className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">{d.name}</span>
                    <span className="text-sm font-semibold text-red-500">
                      -<Ltr>{formatMoney(d.amount || d.resolved_amount)}</Ltr>
                    </span>
                  </div>
                ))}
                {deductions.length === 0 && (
                  <p className="text-sm text-gray-400 italic">{t("breakdown.noDeductions")}</p>
                )}
              </div>
              <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center">
                <span className="text-sm font-bold text-gray-900">{t("breakdown.totalDeductions")}</span>
                <span className="text-sm font-bold text-red-500">
                  -<Ltr>{formatMoney(totalDeductions)}</Ltr>
                </span>
              </div>
            </div>
          </div>

          {/* Net Pay */}
          <div className="mt-8 p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                {t("breakdown.netPayable")}
              </p>
              <p className="text-2xl font-bold text-cyan-600">
                <Ltr>{formatMoney(net)}</Ltr>
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-green-600 bg-green-100 px-3 py-1 rounded-full uppercase tracking-wider">
                {current?.is_active ? t("componentStatus.ACTIVE") : t("componentStatus.INACTIVE")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
