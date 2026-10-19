import { useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { MdOutlineSkipNext, MdOutlineChevronRight, MdOutlineCheckCircle, MdOutlineCancel } from "react-icons/md";
import { actLoanSkip, getLoan, requestLoanSkip } from "../../data/groupE";
import useYearLock from "../../hooks/useYearLock";
import { LOAN_STATUS_STYLES, INSTALLMENT_STATUS_STYLES, fmtMoney, fmtDate, installmentPeriod } from "./loanUi";
import { useTranslation } from "react-i18next";

export default function LoanDetailPage() {
  const { t } = useTranslation("loans");
  const lock = useYearLock();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdminView = location.pathname.includes('/loan-approvals');
  const [tick, setTick] = useState(0);
  const loading = false;
  // The loan from the static store; pending skip requests mark their installments.
  const loan = id && tick >= 0 ? getLoan(id) : null;
  const requestedSkips = new Set((loan?.skipRequests || []).filter((req) => req.status === "PENDING").map((req) => req.installment_id));
  const [skippingId, setSkippingId] = useState(null);
  const load = () => setTick((n) => n + 1);

  const skip = async (installmentId) => {
    if (skippingId || requestedSkips.has(installmentId)) return;
    setSkippingId(installmentId);
    try {
      requestLoanSkip(id, installmentId, "Requested by employee");
      toast.success(t("toast.skipSubmitted"));
      load();
    } finally {
      setSkippingId(null);
    }
  };

  const actSkip = async (skipReqId, kind) => {
    actLoanSkip(skipReqId, kind);
    toast.success(kind === "approve" ? t("toast.skipApproved") : t("toast.skipRejected"));
    load();
  };

  const st = loan ? LOAN_STATUS_STYLES[loan.status] || LOAN_STATUS_STYLES.PENDING : null;
  const installments = loan?.installments || [];
  const payments = loan?.payments || [];
  
  const canSkip = loan?.status === "ACTIVE"; // If they are viewing, they can request skip if active. (Assuming they only see their own skips, or admins don't skip from this view)

  return (
    <div className="space-y-6 pb-10 max-w-7xl mx-auto">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-sm flex-wrap mb-2">
            <button
              onClick={() => navigate(-1)}
              className="text-gray-400 hover:text-cyan-600 transition-colors font-medium"
            >
              {t("common.back")}
            </button>
            <MdOutlineChevronRight className="text-gray-300 rtl:rotate-180" />
            <span className="text-cyan-600 font-semibold">
              {t("common.loanDetails")}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900 flex flex-wrap items-center gap-3">
              {loan?.loan_number || t("common.loanFallback", { id })}
              {st && (
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${st.chip}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`}></span>
                  {t(`status.${LOAN_STATUS_STYLES[loan.status] ? loan.status : "PENDING"}`)}
                </span>
              )}
            </h1>
          </div>
          <p className="text-sm text-gray-500">
            {loan?.employee?.full_name || ""}
          </p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-8 shadow-sm">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">{t("common.loading")}</div>
        ) : !loan ? (
          <div className="py-16 text-center text-sm text-gray-400">{t("common.notFound")}</div>
        ) : (
          <>
            {/* summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { k: t("table.amount"), v: fmtMoney(loan.approved_amount ?? loan.requested_amount) },
                { k: t("table.emi"), v: loan.emi_amount ? fmtMoney(loan.emi_amount) : "—" },
                { k: t("table.installments"), v: loan.approved_installments ?? loan.requested_installments },
                { k: t("table.outstanding"), v: fmtMoney(loan.outstanding_principal) },
              ].map((c) => (
                <div key={c.k} className="p-5 rounded-xl bg-gray-50 border border-gray-100">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">{c.k}</p>
                  <p className="text-base font-bold text-gray-900 truncate">{c.v}</p>
                </div>
              ))}
            </div>
            {loan.purpose && <p className="text-sm text-gray-500 font-medium">{t("common.purpose", { purpose: loan.purpose })}</p>}
            {loan.rejection_reason && <p className="text-sm text-rose-600 font-medium">{t("common.rejected", { reason: loan.rejection_reason })}</p>}

            {/* schedule */}
            {installments.length > 0 && (
              <div>
                <h4 className="text-base font-bold text-gray-900 mb-4">{t("detail.emiSchedule")}</h4>
                <div className="border border-gray-200 rounded-xl overflow-x-auto w-full">
                  <table className="w-full text-left min-w-[600px]">
                    <thead>
                      <tr className="bg-gray-50/60 border-b border-gray-100">
                        {[t("table.number"), t("table.due"), t("table.emi"), t("table.balance"), t("table.status"), ""].map((h) => (
                          <th key={h} className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {installments.map((i) => {
                        const is = INSTALLMENT_STATUS_STYLES[i.status] || INSTALLMENT_STATUS_STYLES.PENDING;
                        return (
                          <tr key={i.id} className="hover:bg-gray-50/60">
                            <td className="px-5 py-3 text-sm text-gray-600 font-medium">{i.installment_no}</td>
                            <td className="px-5 py-3 text-sm text-gray-500">{fmtDate(i.due_date)}</td>
                            <td className="px-5 py-3 text-sm text-gray-800 font-medium">{fmtMoney(i.emi_amount)}</td>
                            <td className="px-5 py-3 text-sm text-gray-500">{fmtMoney(i.closing_balance)}</td>
                            <td className="px-5 py-3">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${is.chip}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${is.dot}`} />{t(`installmentStatus.${i.status}`, { defaultValue: i.status })}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-right">
                              {(() => {
                                const skipReq = loan?.skipRequests?.find(r => r.installment_id === i.id && r.status === "PENDING");
                                if (skipReq) {
                                  return isAdminView ? (
                                    <div className="flex items-center justify-end gap-2">
                                      <span className="text-[11px] font-bold uppercase tracking-wider text-amber-500 mr-2">{t("actions.skipRequested")}</span>
                                      <button onClick={() => actSkip(skipReq.id, 'approve')} disabled={lock.isLockedDate(installmentPeriod(i))} title={lock.isLockedDate(installmentPeriod(i)) ? lock.titleFor(installmentPeriod(i)) : t("actions.approveSkip")} className="hover:text-emerald-600 text-gray-400 disabled:opacity-40 disabled:cursor-not-allowed"><MdOutlineCheckCircle className="text-lg" /></button>
                                      <button onClick={() => actSkip(skipReq.id, 'reject')} disabled={lock.isLockedDate(installmentPeriod(i))} title={lock.isLockedDate(installmentPeriod(i)) ? lock.titleFor(installmentPeriod(i)) : t("actions.rejectSkip")} className="hover:text-rose-500 text-gray-400 disabled:opacity-40 disabled:cursor-not-allowed"><MdOutlineCancel className="text-lg" /></button>
                                    </div>
                                  ) : (
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-500">{t("actions.skipRequested")}</span>
                                  );
                                }
                                return (!isAdminView && canSkip && i.status === "PENDING") ? (
                                  <button onClick={() => skip(i.id)} disabled={skippingId === i.id || lock.isLockedDate(installmentPeriod(i))} title={lock.isLockedDate(installmentPeriod(i)) ? lock.titleFor(installmentPeriod(i)) : t("actions.requestSkip")}
                                    className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-cyan-600 hover:text-cyan-700 disabled:opacity-50">
                                    {skippingId === i.id ? t("actions.submitting") : <><MdOutlineSkipNext className="text-sm" /> {t("actions.skip")}</>}
                                  </button>
                                ) : null;
                              })()}
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
                <h4 className="text-base font-bold text-gray-900 mb-4">{t("detail.paymentHistory")}</h4>
                <div className="space-y-2">
                  {payments.map((p) => (
                    <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 rounded-xl border border-gray-100 bg-gray-50/30 text-sm gap-2">
                      <span className="text-gray-600 font-medium break-all">{t(`paymentMethod.${p.method}`, { defaultValue: p.method })} · {p.period_month ? `${p.period_year}-${String(p.period_month).padStart(2, "0")}` : fmtDate(p.paid_at)}</span>
                      <span className="flex items-center gap-3 self-start sm:self-auto">
                        <span className="font-bold text-gray-800">{fmtMoney(p.amount)}</span>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded ${p.status === "SUCCESS" ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-500"}`}>{t(`paymentStatus.${p.status}`, { defaultValue: p.status })}</span>
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
  );
}
