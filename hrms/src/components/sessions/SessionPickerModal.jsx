import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { MdOutlineDevices, MdOutlineLogout } from "react-icons/md";
import SessionList from "./SessionList";
import * as authApi from "../../api/auth";
import { apiErrorMessage } from "../../utils/apiError";
import { revokeBody, selectableIds } from "../../utils/sessions";

// Session picker after a password change (D15): the user's other sessions with
// "Select all" checked by default; "End selected sessions" or "Keep all". The current
// session always stays. Opened by useChangePassword (Profile forms, forced change).
//
//   <SessionPickerModal sessions={otherSessions} onClose={() => ...} />
//
// sessions : GET /auth/sessions rows (the current one is filtered out here anyway)
// onClose  : called after the sessions were ended or the user kept them all
export default function SessionPickerModal({ sessions: initial, onClose }) {
  const { t } = useTranslation("shared");
  const [sessions, setSessions] = useState(() => initial.filter((s) => !s.current));
  const [selected, setSelected] = useState(() => new Set(selectableIds(initial)));
  const [ending, setEnding] = useState(false);

  const endSelected = async () => {
    if (ending || selected.size === 0) return;
    setEnding(true);
    try {
      await authApi.revokeSessions(revokeBody(sessions, selected));
      toast.success(t("sessions.toast.ended"));
      onClose();
    } catch (err) {
      toast.error(apiErrorMessage(err));
      // A session may have ended meanwhile (e.g. NOT_FOUND): show the list as it is now.
      try {
        const fresh = (await authApi.listSessions()).filter((s) => !s.current);
        if (fresh.length === 0) {
          onClose();
          return;
        }
        setSessions(fresh);
        setSelected((prev) => new Set(fresh.map((s) => s.id).filter((id) => prev.has(id))));
      } catch {
        // Keep the current rows; the user can retry or keep all.
      }
    } finally {
      setEnding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col"
        style={{ maxHeight: "90vh" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-picker-title"
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-6 pt-6 pb-4 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-cyan-50 flex items-center justify-center flex-shrink-0">
            <MdOutlineDevices className="text-cyan-600 text-xl" />
          </div>
          <div className="min-w-0">
            <h2 id="session-picker-title" className="text-xl font-bold text-gray-900">
              {t("sessions.picker.title")}
            </h2>
            <p className="text-sm text-gray-400 mt-0.5">{t("sessions.picker.subtitle")}</p>
          </div>
        </div>

        <hr className="border-gray-100 shrink-0" />

        {/* List */}
        <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar">
          <SessionList sessions={sessions} selected={selected} onChange={setSelected} disabled={ending} />
        </div>

        {/* Footer */}
        <hr className="border-gray-100 shrink-0" />
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 px-6 py-4 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={ending}
            className="px-6 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-60 transition-colors"
          >
            {t("sessions.keepAll")}
          </button>
          <button
            type="button"
            onClick={endSelected}
            disabled={ending || selected.size === 0}
            className="flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {ending ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {t("sessions.ending")}
              </>
            ) : (
              <>
                <MdOutlineLogout className="text-lg" /> {t("sessions.endSelected")}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
