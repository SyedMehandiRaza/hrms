import { useMemo, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";

import {
  MdOutlineNotifications,
  MdOutlineCalendarToday,
  MdOutlineMonetizationOn,
  MdOutlineBadge,
  MdOutlineAccessTime,
  MdOutlinePayments,
  MdOutlineClose,
} from "react-icons/md";

import { notificationStore } from "../data/groupA";

// ── Presentation helpers ─────────────────────────────────────────────────────
// Map the notification's module (carried in meta_data) to an icon + colors.
const MODULE_STYLE = {
  LEAVE: { icon: MdOutlineCalendarToday, iconBg: "bg-cyan-50", iconColor: "text-cyan-600" },
  OVERTIME: { icon: MdOutlineAccessTime, iconBg: "bg-amber-50", iconColor: "text-amber-600" },
  CORRECTION: { icon: MdOutlineBadge, iconBg: "bg-purple-50", iconColor: "text-purple-600" },
  PAYROLL: { icon: MdOutlineMonetizationOn, iconBg: "bg-green-50", iconColor: "text-green-600" },
  LOAN: { icon: MdOutlinePayments, iconBg: "bg-teal-50", iconColor: "text-teal-600" },
  DEFAULT: { icon: MdOutlineNotifications, iconBg: "bg-gray-100", iconColor: "text-gray-500" },
};

const styleFor = (n) => {
  const mod = n?.meta_data?.module;
  return MODULE_STYLE[mod] || MODULE_STYLE.DEFAULT;
};

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

// TODAY / YESTERDAY / EARLIER bucket from the created_at timestamp.
const groupFor = (createdAt) => {
  if (!createdAt) return "EARLIER";
  const today = startOfDay(new Date());
  const day = startOfDay(createdAt);
  const diffDays = Math.round((today - day) / 86400000);
  if (diffDays <= 0) return "TODAY";
  if (diffDays === 1) return "YESTERDAY";
  return "EARLIER";
};

// Compact relative time ("2m", "3h", "5d") with an absolute fallback.
const relativeTime = (createdAt) => {
  if (!createdAt) return "";
  const then = new Date(createdAt).getTime();
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return "just now";
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(createdAt).toLocaleDateString();
};

const GROUPS_ORDER = ["TODAY", "YESTERDAY", "EARLIER"];

const GROUP_LABEL_KEYS = {
  TODAY: "notifications.groups.today",
  YESTERDAY: "notifications.groups.yesterday",
  EARLIER: "notifications.groups.earlier",
};

function NotificationPanel({ onClose }) {
  const { t } = useTranslation("shared");
  const { list, unreadCount, loading } = useSyncExternalStore(
    notificationStore.subscribe,
    notificationStore.get,
  );
  const [tab, setTab] = useState("All");

  const markAllRead = () => notificationStore.markAllRead();

  const onItemClick = (n) => {
    if (!n.is_read) notificationStore.markRead(n.id);
  };

  const visible = useMemo(() => {
    const rows = Array.isArray(list) ? list : [];
    return tab === "Unread" ? rows.filter((n) => !n.is_read) : rows;
  }, [list, tab]);

  const grouped = useMemo(
    () =>
      GROUPS_ORDER.reduce((acc, g) => {
        const items = visible.filter((n) => groupFor(n.created_at) === g);
        if (items.length) acc[g] = items;
        return acc;
      }, {}),
    [visible]
  );

  return (
    <div className="flex flex-col h-full max-h-[85vh] sm:max-h-[600px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100 flex-shrink-0">
        <h3 className="text-lg font-bold text-gray-900">
          {t("notifications.title")}
        </h3>

        <div className="flex items-center gap-3">
          <button
            onClick={markAllRead}
            disabled={unreadCount === 0}
            className="text-sm font-semibold text-cyan-600 hover:text-cyan-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t("notifications.markAllRead")}
          </button>

          <button
            onClick={onClose}
            className="sm:hidden p-1 text-gray-400 hover:text-gray-700 rounded-md transition-colors"
          >
            <MdOutlineClose className="text-xl" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 px-4 flex-shrink-0">
        {[
          { key: "All", label: t("notifications.tabAll", { count: visible.length }) },
          { key: "Unread", label: t("notifications.tabUnread", { count: unreadCount }) },
        ].map(({ key, label }) => {
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`pb-3 pt-2 me-5 text-sm font-semibold border-b-2 transition-colors ${tab === key
                  ? "border-cyan-600 text-cyan-600"
                  : "border-transparent text-gray-400 hover:text-gray-700"
                }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Notifications */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {loading && visible.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            {t("notifications.loading", "Loading…")}
          </div>
        ) : Object.entries(grouped).length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            {t("notifications.empty")}
          </div>
        ) : (
          Object.entries(grouped).map(([group, items]) => (
            <div key={group}>
              <div className="px-4 pt-4 pb-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  {GROUP_LABEL_KEYS[group] ? t(GROUP_LABEL_KEYS[group]) : group}
                </p>
              </div>

              {items.map((notif) => {
                const { icon: Icon, iconBg, iconColor } = styleFor(notif);
                const unread = !notif.is_read;

                return (
                  <button
                    type="button"
                    key={notif.id}
                    onClick={() => onItemClick(notif)}
                    className={`relative w-full text-start flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-gray-50 ${unread ? "bg-blue-50/50" : ""
                      }`}
                  >
                    {unread && (
                      <div className="absolute start-0 top-4 bottom-4 w-0.5 bg-cyan-500 rounded-e-full" />
                    )}

                    <div
                      className={`w-10 h-10 ${iconBg} rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5`}
                    >
                      <Icon className={`${iconColor} text-xl`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900 leading-snug">
                          {notif.title}
                        </p>

                        <span className="text-[11px] text-gray-400 font-medium flex-shrink-0 mt-0.5">
                          {relativeTime(notif.created_at)}
                        </span>
                      </div>

                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                        {notif.message}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 px-4 py-3 flex-shrink-0">
        <button
          onClick={() => {}}
          className="w-full text-center text-sm font-semibold text-cyan-600 hover:text-cyan-700 transition-colors py-1"
        >
          {t("notifications.refresh", "Refresh")}
        </button>
      </div>
    </div>
  );
}

export default NotificationPanel;