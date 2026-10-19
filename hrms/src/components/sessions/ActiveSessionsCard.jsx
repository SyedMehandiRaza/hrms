import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { MdOutlineDesktopMac, MdOutlineDevices, MdOutlineLogout } from "react-icons/md";
import SessionList from "./SessionList";
import { ScreenEmpty, ScreenError, ScreenLoader } from "../ScreenState";
import useApiQuery from "../../hooks/useApiQuery";
import * as authApi from "../../api/auth";
import { apiErrorMessage } from "../../utils/apiError";
import { revokeBody, selectableIds } from "../../utils/sessions";

// The user's active sessions (D15): Settings → Security & SSO (Admin) and the Profile
// page (Employee, Staffing company). Same card look as the Security & SSO tab. The
// current device is marked "This device" and can't be selected; the others can be
// ended with "End selected sessions".
export default function ActiveSessionsCard() {
  const { t } = useTranslation("shared");
  const { data, loading, error, reload } = useApiQuery(() => authApi.listSessions(), []);
  const [picked, setPicked] = useState(() => new Set());
  const [ending, setEnding] = useState(false);

  const sessions = data || [];
  const others = selectableIds(sessions);
  // Only ids still in the list count (it may have changed after a reload).
  const selected = new Set(others.filter((id) => picked.has(id)));

  const endSelected = async () => {
    if (ending || selected.size === 0) return;
    setEnding(true);
    try {
      await authApi.revokeSessions(revokeBody(sessions, selected));
      toast.success(t("sessions.toast.ended"));
      setPicked(new Set());
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setEnding(false);
      reload();
    }
  };

  let body;
  if (loading && !data) body = <ScreenLoader label={t("sessions.loading")} />;
  else if (error) body = <ScreenError error={error} onRetry={reload} />;
  else {
    body = (
      <>
        <div className="mb-4">
          <SessionList sessions={sessions} selected={selected} onChange={setPicked} disabled={ending || loading} />
          {others.length === 0 && <ScreenEmpty icon={MdOutlineDevices} title={t("sessions.empty")} />}
        </div>
        {others.length > 0 && (
          <button
            type="button"
            onClick={endSelected}
            disabled={ending || loading || selected.size === 0}
            className="w-full flex items-center justify-center gap-2 border rounded-xl py-3 text-sm font-semibold transition-colors border-gray-200 text-red-500 hover:bg-red-50 hover:border-red-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:border-gray-200"
          >
            {ending ? (
              <>
                <span className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                {t("sessions.ending")}
              </>
            ) : (
              <>
                <MdOutlineLogout className="text-lg" /> {t("sessions.endSelected")}
              </>
            )}
          </button>
        )}
      </>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 lg:p-6">
      <div className="flex items-center gap-2 mb-2">
        <MdOutlineDesktopMac className="text-cyan-600 text-xl" />
        <h3 className="text-base font-bold text-gray-900">{t("sessions.title")}</h3>
      </div>
      <p className="text-sm text-gray-400 leading-relaxed mb-5">{t("sessions.description")}</p>
      {body}
    </div>
  );
}
