import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import {
  MdOutlinePayments,
  MdFileDownload,
  MdOutlineChevronRight,
} from "react-icons/md";
import useFiscalYear from "../../../hooks/useFiscalYear";
import useFyResetState from "../../../hooks/useFyResetState";
import { MY_PAYSLIPS } from "../../../data/groupH";
import { paginate } from "../../../data/common";
import PayslipYtd from "../../../components/payroll/PayslipYtd";
import SalaryHistory from "../../../components/payroll/SalaryHistory";

const LIMIT = 10;

const fmt = (n) =>
  Number(n || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const MyPayslips = () => {
  const { t } = useTranslation("payroll");
  const fy = useFiscalYear();
  // FY-scoped list: page 1 again on a year change.
  const [page, setPage] = useFyResetState(1, fy.version);
  const [expanded, setExpanded] = useState(null);
  const downloadingId = null;
  const myPayslipsLoading = false;

  const fyPayslips = MY_PAYSLIPS.filter(
    (p) => !fy.selected || p.period.year === fy.selected,
  );
  const { rows: myPayslips, totalPages } = paginate(fyPayslips, page, LIMIT);

  // Static build: no PDF to fetch — just confirm.
  const download = (payslipId) => {
    const p = MY_PAYSLIPS.find((x) => x.payslip_id === payslipId);
    toast.success(
      `${p?.period ? `${p.period.label} ${p.period.year}` : t("myPayslips.payslipFallback")} — ${t("myPayslips.pdf")}`,
    );
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 text-cyan-600">
          <MdOutlinePayments className="text-2xl" />
          <span className="text-sm font-semibold">{t("myPayslips.eyebrow")}</span>
        </div>
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">{t("myPayslips.title")}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {t("myPayslips.subtitle")}
        </p>
      </div>

      {myPayslipsLoading ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-sm text-gray-400">
          {t("myPayslips.loading")}
        </div>
      ) : myPayslips.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <MdOutlinePayments className="text-4xl text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">{t("myPayslips.empty")}</p>
          <p className="text-xs text-gray-400 mt-1">
            {t("myPayslips.emptyHint")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {myPayslips.map((p) => {
            const isOpen = expanded === p.payslip_id;
            const earnings = [...(p.earnings || []), ...(p.incentives || [])];
            return (
              <div
                key={p.payslip_id}
                className="bg-white border border-gray-200 rounded-xl overflow-hidden"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-cyan-50 flex items-center justify-center text-cyan-600">
                      <MdOutlinePayments className="text-2xl" />
                    </div>
                    <div>
                      <div className="text-base font-bold text-gray-900">
                        {p.period ? `${p.period.label} ${p.period.year}` : t("myPayslips.payslipFallback")}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {t("myPayslips.netPay")}{" "}
                        <span className="font-semibold text-gray-800">
                          SAR {fmt(p.totals?.net_salary)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="bg-green-100 text-green-700 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                      {t(`status.${p.payslip_status || "CREDITED"}`, { defaultValue: p.payslip_status || "CREDITED" })}
                    </span>
                    <button
                      onClick={() => download(p.payslip_id)}
                      disabled={downloadingId === p.payslip_id}
                      className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                    >
                      {downloadingId === p.payslip_id ? (
                        <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <MdFileDownload className="w-4 h-4" />
                      )}
                      {t("myPayslips.pdf")}
                    </button>
                    <button
                      onClick={() => setExpanded(isOpen ? null : p.payslip_id)}
                      className="p-2 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors"
                    >
                      <MdOutlineChevronRight
                        className={`text-xl transition-transform ${isOpen ? "rotate-90" : ""}`}
                      />
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-gray-100 p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border border-gray-200 rounded-xl p-4">
                      <h3 className="text-[12px] font-bold uppercase tracking-widest text-emerald-600 mb-3">
                        {t("myPayslips.earnings")}
                      </h3>
                      <div className="space-y-2.5">
                        {earnings.map((e) => (
                          <div key={e.id} className="flex justify-between text-sm">
                            <span className="text-gray-500">{e.label}</span>
                            <span className="font-semibold text-gray-900">
                              SAR {fmt(e.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-sm font-bold text-cyan-600">
                        <span>{t("myPayslips.gross")}</span>
                        <span>SAR {fmt(p.totals?.gross_salary)}</span>
                      </div>
                    </div>

                    <div className="border border-gray-200 rounded-xl p-4">
                      <h3 className="text-[12px] font-bold uppercase tracking-widest text-red-500 mb-3">
                        {t("myPayslips.deductions")}
                      </h3>
                      <div className="space-y-2.5">
                        {(p.deductions || []).length === 0 ? (
                          <p className="text-sm text-gray-400 italic">{t("myPayslips.none")}</p>
                        ) : (
                          (p.deductions || []).map((d) => (
                            <div key={d.id} className="flex justify-between text-sm">
                              <span className="text-gray-500">{d.label}</span>
                              <span className="font-semibold text-gray-900">
                                SAR {fmt(d.amount)}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-sm font-bold text-red-600">
                        <span>{t("myPayslips.totalDeductions")}</span>
                        <span>SAR {fmt(p.totals?.total_deductions)}</span>
                      </div>
                    </div>

                    <PayslipYtd ytd={p.ytd} period={p.period} className="md:col-span-2" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {myPayslips.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="w-8 h-8 flex items-center justify-center rounded-md border border-gray-200 text-gray-400 hover:bg-gray-50 disabled:opacity-40"
          >
            &lt;
          </button>
          <span className="px-3 text-sm text-gray-600">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="w-8 h-8 flex items-center justify-center rounded-md border border-gray-200 text-gray-400 hover:bg-gray-50 disabled:opacity-40"
          >
            &gt;
          </button>
        </div>
      )}

      {/* My salary history (read-only; GET /payroll/employees/me/salary-history) */}
      <SalaryHistory self />
    </div>
  );
};

export default MyPayslips;