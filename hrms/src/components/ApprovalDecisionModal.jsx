import { useState } from "react";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import { MdClose } from "react-icons/md";
import { approveRequest, rejectRequest } from "../api/approvals";
import { apiErrorCode, apiErrorMessage } from "../utils/apiError";

// Approve / reject one inbox request (workforce D25, D27), used by the employee inbox and the
// admin dashboard's Action Center.
//   <ApprovalDecisionModal request={inboxRow} action="APPROVE"|"REJECT" onClose={fn} onDone={fn} />
// A rejection needs a reason; so does the owner approving on someone's behalf (an owner-only or
// blocked request). The server's "Reason must be 5–500 characters" shows under the box. A request
// decided meanwhile (APPROVAL_ALREADY_DECIDED…) closes the dialog and refreshes the list.
export default function ApprovalDecisionModal({ request, action, onClose, onDone }) {
  const { t } = useTranslation("approvals");
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const onBehalf = !!(request?.owner_only || request?.blocked);

  if (!request) return null;

  const close = () => {
    if (!saving) onClose();
  };

  const submit = async () => {
    setError("");
    setSaving(true);
    try {
      if (action === "REJECT") await rejectRequest(request.id, comment.trim());
      else await approveRequest(request.id, onBehalf ? { reason: comment.trim() } : { comment: comment.trim() || undefined });
    } catch (err) {
      setSaving(false);
      const reasonError = err?.response?.data?.errors?.reason;
      if (reasonError) {
        setError(reasonError);
        return;
      }
      toast.error(apiErrorMessage(err, t("inbox.toast.actionFailed")));
      if (["APPROVAL_ALREADY_DECIDED", "APPROVAL_NOT_YOUR_TURN", "NOT_FOUND"].includes(apiErrorCode(err))) onDone?.();
      return;
    }
    setSaving(false);
    toast.success(t("inbox.toast.done"));
    onDone?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <p className="text-base font-bold text-gray-900">
            {action === "APPROVE" ? t("inbox.approveRequest") : t("inbox.rejectRequest")}
          </p>
          <button onClick={close} className="text-gray-400 hover:text-gray-600 disabled:opacity-40" disabled={saving}>
            <MdClose className="text-xl" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-3">
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            {action === "REJECT" || onBehalf ? t("inbox.reasonRequired") : t("inbox.commentOptional")}
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder={action === "REJECT" ? t("inbox.rejectPlaceholder") : t("inbox.commentPlaceholder")}
            className={`w-full border rounded-lg px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 ${error ? "border-red-300" : "border-gray-200"}`}
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button
            onClick={close}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
          >
            {t("inbox.cancel")}
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-colors ${
              action === "APPROVE" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
            }`}
          >
            {saving ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : action === "APPROVE" ? (
              t("inbox.approve")
            ) : (
              t("inbox.reject")
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
