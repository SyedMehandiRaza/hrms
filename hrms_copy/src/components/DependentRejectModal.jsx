import { useState } from "react";
import { MdClose, MdOutlineWarning } from "react-icons/md";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";

export default function DependentRejectModal({
  dependent,
  onClose,
  onSuccess,
}) {
  const { t } = useTranslation("employees");
  const [reason, setReason] = useState(dependent?.reject_reason || "");
  const [saving] = useState(false);

  if (!dependent) return null;

  // Static build: no request — the parent applies the rejection locally.
  const handleConfirmReject = () => {
    toast.success(
      t("dependent.rejectSuccess", { defaultValue: "Dependent rejected successfully" })
    );
    onSuccess?.(reason || "");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-rose-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0">
              <MdOutlineWarning className="text-lg" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">
                {t("dependent.rejectTitle", { defaultValue: "Reject Dependent" })}
              </h3>
              <p className="text-xs text-gray-500 font-medium truncate max-w-[220px] sm:max-w-[280px]">
                {dependent.full_name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <MdClose className="text-xl" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div className="p-3.5 bg-amber-50 border border-amber-200/80 rounded-xl flex items-start gap-3">
            <MdOutlineWarning className="text-amber-600 text-lg flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              {t("dependent.rejectNotice", {
                defaultValue:
                  "You are about to reject verification for this dependent. Please specify a reason below so the employee understands why their submission was not accepted.",
              })}
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
              {t("dependent.rejectionReason", { defaultValue: "Rejection Reason" })}{" "}
              <span className="text-gray-400 font-normal lowercase">
                ({t("common.optional", { defaultValue: "optional" })})
              </span>
            </label>
            <textarea
              rows="4"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("dependent.rejectionReasonPlaceholder", {
                defaultValue:
                  "Enter reason for rejection (e.g., Document expired, Date of birth mismatch, Invalid document attached)...",
              })}
              disabled={saving}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white resize-none transition-all"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50/50">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl transition-colors shadow-sm disabled:opacity-50"
          >
            {t("common.cancel", { defaultValue: "Cancel" })}
          </button>
          <button
            type="button"
            onClick={handleConfirmReject}
            disabled={saving}
            className="px-5 py-2 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl disabled:opacity-60 transition-colors shadow-sm shadow-rose-200 flex items-center justify-center min-w-[140px]"
          >
            {saving
              ? t("dependent.rejecting", { defaultValue: "Rejecting..." })
              : t("dependent.confirmRejection", { defaultValue: "Confirm Rejection" })}
          </button>
        </div>
      </div>
    </div>
  );
}
