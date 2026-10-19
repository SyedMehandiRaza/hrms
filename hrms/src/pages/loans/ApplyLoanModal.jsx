import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import { MdClose, MdOutlinePayments, MdOutlineSearch, MdOutlineError } from "react-icons/md";
import { EMPLOYEES } from "../../data/common";
import { applyLoan, resubmitLoan } from "../../data/groupE";
import { previewEmi, fmtMoney } from "./loanUi";
import { useTranslation, Trans } from "react-i18next";

// onBehalf=true → shows an employee picker (approver creating a loan for someone)
// loan set → RESUBMIT mode: re-apply on the same loan after a modification request
export default function ApplyLoanModal({ onBehalf = false, loan = null, onClose, onCreated }) {
  const { t } = useTranslation("loans");
  const { t: tx } = useTranslation("exits");
  const isResubmit = !!loan;
  // Notice-period block: `noticeBlocked` comes from the employee's own open
  // exit (pre-check); `submitError` is the server's message for a rejected
  // submit (e.g. "New loans are not allowed during the notice period").
  // Static build: the employee is not serving notice and the submit never fails.
  const noticeBlocked = false;
  const submitError = "";
  const modification = loan?.meta?.modification || null;
  const [amount, setAmount] = useState(loan ? String(loan.requested_amount ?? "") : "");
  const [installments, setInstallments] = useState(
    loan ? String(modification?.suggested_installments ?? loan.requested_installments ?? "") : ""
  );
  const [purpose, setPurpose] = useState(loan?.purpose || "");
  const [policy, setPolicy] = useState(loan?.on_insufficient_salary || "SKIP");
  const [saving, setSaving] = useState(false);

  // on-behalf employee picker
  const employees = useMemo(
    () => (onBehalf ? EMPLOYEES.filter((e) => e.status === "ACTIVE").map((e) => ({ ...e, country_emp_id: e.employee_code })) : []),
    [onBehalf],
  );
  const [employeeId, setEmployeeId] = useState(null);
  const [empQuery, setEmpQuery] = useState("");

  const empList = useMemo(() => {
    const q = empQuery.trim().toLowerCase();
    return employees.filter((e) => !q || (e.full_name || "").toLowerCase().includes(q) || String(e.country_emp_id || e.id).toLowerCase().includes(q));
  }, [employees, empQuery]);

  const { emi, last } = previewEmi(amount, installments);

  const submit = async () => {
    if (onBehalf && !employeeId) return toast.error(t("toast.selectEmployee"));
    if (!(Number(amount) > 0)) return toast.error(t("toast.invalidAmount"));
    if (!(Number(installments) >= 1)) return toast.error(t("toast.invalidInstallments"));
    setSaving(true);
    try {
      if (isResubmit) {
        resubmitLoan(loan.id, {
          requested_amount: Number(amount),
          requested_installments: Number(installments),
          purpose: purpose || undefined,
        });
        toast.success(t("toast.resubmitted"));
      } else {
        const payload = {
          requested_amount: Number(amount),
          requested_installments: Number(installments),
          purpose: purpose || undefined,
          on_insufficient_salary: policy,
        };
        if (onBehalf) payload.employee_id = employeeId;
        applyLoan(payload);
        toast.success(onBehalf ? t("toast.createdForEmployee") : t("toast.submitted"));
      }
      onCreated?.();
      onClose?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <MdOutlinePayments className="text-xl text-[#20B2AA]" />
            <h3 className="text-base font-bold text-gray-900">{isResubmit ? t("apply.titleResubmit") : onBehalf ? t("apply.titleOnBehalf") : t("apply.title")}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><MdClose className="text-xl" /></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {isResubmit && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2.5">
              <p className="text-[11px] font-bold text-orange-700 uppercase tracking-wider">{t("apply.changesRequested")}</p>
              {(modification?.reason || loan.rejection_reason) && (
                <p className="text-sm text-orange-800 mt-1">{modification?.reason || loan.rejection_reason}</p>
              )}
              {modification?.suggested_installments != null && (
                <p className="text-xs text-orange-600 mt-1"><Trans t={t} i18nKey="apply.suggestedInstallments" values={{ n: modification.suggested_installments }} components={{ strong: <strong /> }} /></p>
              )}
            </div>
          )}
          {onBehalf && (
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">{t("apply.employee")}</label>
              <div className="relative mb-2">
                <MdOutlineSearch className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input value={empQuery} onChange={(e) => setEmpQuery(e.target.value)} placeholder={t("apply.searchEmployee")}
                  className="w-full ps-9 pe-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500" />
              </div>
              <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-50">
                {empList.map((e) => (
                  <button key={e.id} onClick={() => setEmployeeId(e.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm ${employeeId === e.id ? "bg-cyan-50 text-cyan-700" : "hover:bg-gray-50"}`}>
                    <span className="truncate">{e.full_name || t("common.employeeFallback", { id: e.id })}</span>
                    <span className="text-[11px] text-gray-400">{e.country_emp_id || `#${e.id}`}</span>
                  </button>
                ))}
                {empList.length === 0 && <div className="px-3 py-4 text-center text-xs text-gray-400">{t("apply.noEmployees")}</div>}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">{t("apply.loanAmount")}</label>
              <input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="100000"
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#20B2AA] focus:bg-white" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">{t("apply.installments")}</label>
              <input type="number" min="1" max="240" value={installments} onChange={(e) => setInstallments(e.target.value)} placeholder="12"
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#20B2AA] focus:bg-white" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">{t("apply.purposeOptional")}</label>
            <textarea rows={2} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder={t("apply.purposePlaceholder")}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#20B2AA] focus:bg-white" />
          </div>

          {!isResubmit && (
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">{t("apply.insufficientSalary")}</label>
              <div className="flex gap-2">
                {["SKIP", "PARTIAL", "FORCE"].map((p) => (
                  <button key={p} onClick={() => setPolicy(p)}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${policy === p ? "border-cyan-400 bg-cyan-50 text-cyan-700" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                    {t(`apply.policy.${p}`)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* live EMI preview */}
          {emi > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">{t("apply.monthlyEmi")}</p>
                <p className="text-xl font-bold text-gray-900">{fmtMoney(emi)}</p>
              </div>
              <div className="text-right text-[11px] text-gray-500">
                <p>{t("apply.installmentsCount", { n: installments })}</p>
                <p>{t("apply.last", { amount: fmtMoney(last) })}</p>
              </div>
            </div>
          )}
        </div>

        {(noticeBlocked || submitError) && (
          <div className="px-5 pt-4 border-t border-gray-100">
            <div role="alert" className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
              <MdOutlineError className="text-red-500 text-base shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{submitError || tx("notice.loanBlocked")}</p>
            </div>
          </div>
        )}

        <div className={`px-5 py-4 flex items-center justify-end gap-2 ${noticeBlocked || submitError ? "" : "border-t border-gray-100"}`}>
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900">{t("common.cancel")}</button>
          <button onClick={submit} disabled={saving || noticeBlocked}
            className="px-5 py-2 text-sm font-bold text-white bg-[#20B2AA] hover:bg-[#1C9D96] rounded-lg disabled:opacity-60">
            {saving ? t("apply.submitting") : isResubmit ? t("apply.resubmit") : onBehalf ? t("apply.createLoan") : t("apply.submitRequest")}
          </button>
        </div>
      </div>
    </div>
  );
}
