import { useState } from "react";
import { toast } from "react-toastify";
import { MdClose, MdOutlineDescription, MdOutlineSkipNext } from "react-icons/md";
import { getLoan, requestLoanSkip } from "../../data/groupE";
import useYearLock from "../../hooks/useYearLock";
import { LOAN_STATUS_STYLES, INSTALLMENT_STATUS_STYLES, fmtMoney, fmtDate, installmentPeriod } from "./loanUi";
import { useTranslation } from "react-i18next";

// canSkip → the loan owner viewing their own ACTIVE loan can request an EMI skip
export default function LoanDetailModal({ loanId, canSkip = false, onClose, onChanged }) {
  const { t } = useTranslation("loans");
  const lock = useYearLock();
  const [tick, setTick] = useState(0);
  const loading = false;
  // The loan from the static store; pending skip requests mark their installments.
  const loan = tick >= 0 ? getLoan(loanId) : null;
  const requestedSkips = new Set((loan?.skipRequests || []).filter((req) => req.status === "PENDING").map((req) => req.installment_id));
  const load = () => setTick((n) => n + 1);

  const [skippingId, setSkippingId] = useState(null);

  const skip = async (installmentId) => {
    if (skippingId || requestedSkips.has(installmentId)) return;
    setSkippingId(installmentId);
    try {
      requestLoanSkip(loanId, installmentId, "Requested by employee");
      toast.success(t("toast.skipSubmitted"));
      load();
      onChanged?.();
    } finally {
      setSkippingId(null);
    }
  };

  const st = loan ? LOAN_STATUS_STYLES[loan.status] || LOAN_STATUS_STYLES.PENDING : null;
  const installments = loan?.installments || [];
  const payments = loan?.payments || [];

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 backdrop-blur-sm p-3 sm:p-6">
      <div className="w-full max-w-3xl h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center">
              <MdOutlineDescription className="text-lg" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-gray-900 truncate">{loan?.loan_number || t("common.loan")}</h3>
              <p className="text-[11px] text-gray-400">{loan?.employee?.full_name || ""}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {st && (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${st.chip}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />{t(`status.${LOAN_STATUS_STYLES[loan.status] ? loan.status : "PENDING"}`)}
              </span>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><MdClose className="text-xl" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading ? (
            <div className="py-16 text-center text-sm text-gray-400">{t("common.loading")}</div>
          ) : !loan ? (
            <div className="py-16 text-center text-sm text-gray-400">{t("common.notFound")}</div>
          ) : (
            <>
              {/* summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { k: t("table.amount"), v: fmtMoney(loan.approved_amount ?? loan.requested_amount) },
                  { k: t("table.emi"), v: loan.emi_amount ? fmtMoney(loan.emi_amount) : "—" },
                  { k: t("table.installments"), v: loan.approved_installments ?? loan.requested_installments },
                  { k: t("table.outstanding"), v: fmtMoney(loan.outstanding_principal) },
                ].map((c) => (
                  <div key={c.k} className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{c.k}</p>
                    <p className="text-sm font-bold text-gray-900 truncate">{c.v}</p>
                  </div>
                ))}
              </div>
              {loan.purpose && <p className="text-sm text-gray-500">{t("common.purpose", { purpose: loan.purpose })}</p>}
              {loan.rejection_reason && <p className="text-sm text-rose-600">{t("common.rejected", { reason: loan.rejection_reason })}</p>}

              {/* schedule */}
              {installments.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-gray-900 mb-2">{t("detail.emiSchedule")}</h4>
                  <div className="border border-gray-200 rounded-xl overflow-hidden overflow-x-auto">
                    <table className="w-full text-left min-w-[520px]">
                      <thead>
                        <tr className="bg-gray-50/60 border-b border-gray-100">
                          {[t("table.number"), t("table.due"), t("table.emi"), t("table.balance"), t("table.status"), ""].map((h) => (
                            <th key={h} className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {installments.map((i) => {
                          const is = INSTALLMENT_STATUS_STYLES[i.status] || INSTALLMENT_STATUS_STYLES.PENDING;
                          return (
                            <tr key={i.id} className="hover:bg-gray-50/60">
                              <td className="px-4 py-2 text-sm text-gray-600">{i.installment_no}</td>
                              <td className="px-4 py-2 text-sm text-gray-500">{fmtDate(i.due_date)}</td>
                              <td className="px-4 py-2 text-sm text-gray-800">{fmtMoney(i.emi_amount)}</td>
                              <td className="px-4 py-2 text-sm text-gray-500">{fmtMoney(i.closing_balance)}</td>
                              <td className="px-4 py-2">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${is.chip}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${is.dot}`} />{t(`installmentStatus.${i.status}`, { defaultValue: i.status })}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-right">
                                {canSkip && i.status === "PENDING" && !requestedSkips.has(i.id) && (
                                  <button onClick={() => skip(i.id)} disabled={skippingId === i.id || lock.isLockedDate(installmentPeriod(i))} title={lock.isLockedDate(installmentPeriod(i)) ? lock.titleFor(installmentPeriod(i)) : t("actions.requestSkip")}
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-600 hover:text-cyan-700 disabled:opacity-50">
                                    {skippingId === i.id ? t("actions.submitting") : <><MdOutlineSkipNext className="text-sm" /> {t("actions.skip")}</>}
                                  </button>
                                )}
                                {canSkip && i.status === "PENDING" && requestedSkips.has(i.id) && (
                                  <span className="text-[11px] font-semibold text-amber-500">{t("actions.skipRequested")}</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* payments */}
              {payments.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-gray-900 mb-2">{t("detail.paymentHistory")}</h4>
                  <div className="space-y-1.5">
                    {payments.map((p) => (
                      <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-lg border border-gray-100 text-sm">
                        <span className="text-gray-600">{t(`paymentMethod.${p.method}`, { defaultValue: p.method })} · {p.period_month ? `${p.period_year}-${String(p.period_month).padStart(2, "0")}` : fmtDate(p.paid_at)}</span>
                        <span className="flex items-center gap-2">
                          <span className="font-semibold text-gray-800">{fmtMoney(p.amount)}</span>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${p.status === "SUCCESS" ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-500"}`}>{t(`paymentStatus.${p.status}`, { defaultValue: p.status })}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
