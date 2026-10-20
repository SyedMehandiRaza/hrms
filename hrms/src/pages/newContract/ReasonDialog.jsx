import { useRef, useState } from "react";
import { MdClose } from "react-icons/md";
import { useTranslation } from "react-i18next";
import { serverErrors } from "../../utils/applyFieldErrors";

// Reason dialog for HR revoke and signer reject (standards §7.3 "Reject / Revoke").
// onSubmit(reason) runs the request; a server "reason" error shows under the input,
// any other error goes to onError.

const EMOJI = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u;

const checkReason = (t, value) => {
  const v = value.trim();
  if (!v) return t("viewer.reason.validation.required");
  if (v.length < 10) return t("viewer.reason.validation.min");
  if (v.length > 500) return t("viewer.reason.validation.max");
  if (EMOJI.test(v)) return t("viewer.reason.validation.noEmojis");
  return null;
};

export default function ReasonDialog({ title, subtitle, submitLabel, busyLabel, onSubmit, onError, onClose }) {
  const { t } = useTranslation("contractStudio");
  const [reason, setReason] = useState("");
  const [error, setError] = useState(null);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const change = (value) => {
    setReason(value);
    setError(touched ? checkReason(t, value) : null);
  };

  const submit = async () => {
    if (inFlight.current) return;
    setTouched(true);
    const e = checkReason(t, reason);
    setError(e);
    if (e) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await onSubmit(reason.trim());
    } catch (err) {
      const fieldErr = serverErrors(err).find((x) => x.field === "reason");
      if (fieldErr) setError(fieldErr.message);
      else onError?.(err);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-gray-200 flex justify-between items-start">
          <div>
            <h2 className="text-[17px] font-bold text-gray-900">{title}</h2>
            {subtitle && <p className="text-[13px] text-gray-500 mt-1 font-medium">{subtitle}</p>}
          </div>
          <button onClick={onClose} disabled={busy} className="text-gray-400 hover:text-gray-600 transition-colors p-1">
            <MdClose size={20} />
          </button>
        </div>

        <div className="p-5">
          <label htmlFor="contract-reason" className="block text-[13px] font-bold text-gray-600 mb-2">
            {t("viewer.reason.label")} <span className="text-red-500">*</span>
          </label>
          <textarea
            id="contract-reason"
            rows="4"
            value={reason}
            disabled={busy}
            onChange={(e) => change(e.target.value)}
            className={`w-full border rounded-lg p-3 text-[13px] text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-red-300 focus:border-red-300 resize-none ${error ? "border-red-500" : "border-gray-200"}`}
            placeholder={t("viewer.reason.placeholder")}
          />
          {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
        </div>

        <div className="bg-[#fef7f7] p-4 border-t border-red-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={busy}
            className="px-5 py-2.5 border border-gray-300 bg-white text-gray-700 font-bold text-[13px] rounded-lg hover:bg-gray-50 transition-colors"
          >
            {t("actions.cancel")}
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="px-5 py-2.5 bg-[#b91c1c] hover:bg-[#991b1b] text-white font-bold text-[13px] rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <MdClose size={16} /> {busy ? busyLabel : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
