import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { MdOutlineDesktopMac, MdOutlineSmartphone } from "react-icons/md";
import Ltr from "../Ltr";
import { useFormat } from "../../hooks/useFormat";
import { selectableIds } from "../../utils/sessions";

// The user's sessions with checkboxes (D15): a "Select all" row, then one row per
// session showing device, IP and last used. The current session (`current: true`) is
// marked "This device" and can't be selected. Used by the session picker after a
// password change and by the Active sessions lists (Settings → Security & SSO, Profile).
//
//   <SessionList sessions={rows} selected={selectedIds} onChange={setSelectedIds} />
//
// sessions : GET /auth/sessions rows { id, device, ip, created_at, last_used_at, current }
// selected : Set of selected session ids
// onChange : (nextSet) => void

const DATETIME_OPTS = { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" };
const MOBILE = /\b(iOS|Android)\b/;

export default function SessionList({ sessions, selected, onChange, disabled = false }) {
  const { t } = useTranslation("shared");
  const { fmtDate } = useFormat();
  const allRef = useRef(null);

  const ids = selectableIds(sessions);
  const count = ids.filter((id) => selected.has(id)).length;
  const allChecked = ids.length > 0 && count === ids.length;

  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = count > 0 && count < ids.length;
  }, [count, ids.length]);

  const toggleAll = () => onChange(new Set(allChecked ? [] : ids));
  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {ids.length > 0 && (
        <label className="flex items-center gap-3 px-3 cursor-pointer">
          <input
            ref={allRef}
            type="checkbox"
            checked={allChecked}
            disabled={disabled}
            onChange={toggleAll}
            className="w-4 h-4 accent-cyan-600 cursor-pointer disabled:cursor-default"
          />
          <span className="text-sm font-semibold text-gray-700">{t("sessions.selectAll")}</span>
        </label>
      )}

      {sessions.map((s) => {
        const Icon = MOBILE.test(s.device || "") ? MdOutlineSmartphone : MdOutlineDesktopMac;
        return (
          <label
            key={s.id}
            className={`flex items-center gap-3 p-3 bg-gray-50 border border-gray-100 rounded-xl ${
              s.current ? "cursor-default" : "cursor-pointer hover:bg-gray-100"
            }`}
          >
            <input
              type="checkbox"
              checked={!s.current && selected.has(s.id)}
              disabled={disabled || s.current}
              onChange={() => toggle(s.id)}
              aria-label={s.device}
              className="w-4 h-4 accent-cyan-600 cursor-pointer disabled:cursor-default disabled:opacity-40"
            />
            <div className="w-9 h-9 bg-white border border-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
              <Icon className="text-gray-500 text-xl" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{s.device}</p>
              <p className="text-xs text-gray-400">
                {s.ip && (
                  <>
                    <Ltr>{s.ip}</Ltr>
                    {" · "}
                  </>
                )}
                {t("sessions.lastUsed")}{" "}
                <Ltr>{fmtDate(s.last_used_at || s.created_at, DATETIME_OPTS)}</Ltr>
              </p>
            </div>
            {s.current && (
              <span className="text-[10px] font-bold text-cyan-700 bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded-full shrink-0">
                {t("sessions.thisDevice")}
              </span>
            )}
          </label>
        );
      })}
    </div>
  );
}

