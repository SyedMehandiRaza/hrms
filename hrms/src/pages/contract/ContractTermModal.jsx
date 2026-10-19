import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { MdClose, MdOutlineEventNote } from "react-icons/md";

import FieldError from "../../components/FieldError";
import { validateContractTerm, CONTRACT_TERM_FIELDS } from "../../utils/fyValidation/misc";
import { updateLegacyContract } from "../../data/groupF";
import { termOf } from "./contractHelpers";

const inputCls = (bad) =>
  `w-full px-4 py-2.5 border rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition ${
    bad ? "border-red-400 bg-red-50" : "border-gray-200 bg-white"
  }`;


// Start / end / renewal-due inputs with their errors under each one.
//   <ContractTermFields values={v} errors={e} onChange={(field, value) => …} />
export function ContractTermFields({ values, errors = {}, onChange, disabled = false }) {
  const { t } = useTranslation("contracts");
  const fields = [
    { key: "start_date", label: t("term.startDate") },
    { key: "end_date", label: t("term.endDate"), min: values.start_date || undefined },
    { key: "renewal_due", label: t("term.renewalDue") },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {fields.map((f) => (
        <div key={f.key} className="min-w-0">
          <label htmlFor={`term-${f.key}`} className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
            {f.label}
          </label>
          <input
            id={`term-${f.key}`}
            type="date"
            value={values[f.key] || ""}
            min={f.min}
            disabled={disabled}
            aria-invalid={!!errors[f.key]}
            onChange={(e) => onChange(f.key, e.target.value)}
            className={inputCls(!!errors[f.key])}
          />
          <FieldError message={errors[f.key]} />
        </div>
      ))}
    </div>
  );
}

// Edit a contract's term: PATCH /contracts/:id/term (only the changed dates).
export default function ContractTermModal({ contract, onClose, onSaved }) {
  const { t } = useTranslation("contracts");
  const initial = termOf(contract);
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const change = (field, value) => {
    const next = { ...values, [field]: value };
    setValues(next);
    // live re-check once the user tried to save; drop a server error on edit
    setErrors(touched ? validateContractTerm(t, next) : { ...errors, [field]: undefined });
  };

  const changed = CONTRACT_TERM_FIELDS.filter((f) => values[f] !== initial[f]);

  const submit = async (e) => {
    e.preventDefault();
    setTouched(true);
    const errs = validateContractTerm(t, values);
    setErrors(errs);
    if (Object.keys(errs).length || !changed.length || saving) return;
    setSaving(true);
    try {
      const payload = Object.fromEntries(changed.map((f) => [f, values[f] || null]));
      const saved = updateLegacyContract(contract.id, payload) || { ...contract, ...payload };
      toast.success(t("term.saved"));
      onSaved?.(saved);
      onClose?.();
    } finally {
      setSaving(false);
    }
  };

  const hasErrors = Object.values(errors).some(Boolean);

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <form noValidate onSubmit={submit} className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2 min-w-0">
            <MdOutlineEventNote className="text-lg text-cyan-600 shrink-0" />
            <h3 className="text-base font-bold text-gray-900 truncate">{t("term.editTitle")}</h3>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors" aria-label={t("term.close")}>
            <MdClose className="text-xl" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-500">{t("term.editHint", { name: contract?.name || "" })}</p>
          <ContractTermFields values={values} errors={errors} onChange={change} disabled={saving} />
        </div>
        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-2 bg-gray-50/50">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50"
          >
            {t("term.cancel")}
          </button>
          <button
            type="submit"
            disabled={saving || hasErrors || !changed.length}
            className="px-5 py-2 text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? t("term.saving") : t("term.save")}
          </button>
        </div>
      </form>
    </div>
  );
}
