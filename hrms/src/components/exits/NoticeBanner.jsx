import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MdOutlineEventBusy, MdInfoOutline } from "react-icons/md";

import { getMyExit } from "../../data/groupG";
import { useFormat } from "../../hooks/useFormat";

// "You are serving notice" banner for the logged-in employee. Renders nothing
// when there is no open exit, or when the lookup fails (never blocks a page).
export default function NoticeBanner({ className = "" }) {
  const { t } = useTranslation("exits");
  const { fmtDate } = useFormat();
  const [exit] = useState(() => getMyExit() || null);

  if (!exit || (exit.status && exit.status !== "IN_NOTICE")) return null;

  const daysLeft = Number(exit.days_left);
  const hasDays = Number.isFinite(daysLeft);

  return (
    <div
      role="status"
      className={`flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3.5 ${className}`}
    >
      <div className="w-9 h-9 shrink-0 rounded-lg bg-amber-100 flex items-center justify-center">
        <MdOutlineEventBusy className="text-amber-600 text-lg" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-sm font-bold text-amber-900">{t("notice.servingNotice")}</p>
          <span className="text-amber-300" aria-hidden="true">·</span>
          <p className="text-sm text-amber-800">
            {t("notice.lastWorkingDay", { date: fmtDate(exit.last_working_day) })}
          </p>
          {hasDays && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold">
              {daysLeft > 0 ? t("notice.daysLeft", { count: daysLeft }) : t("notice.lastDayToday")}
            </span>
          )}
        </div>
        <p className="flex items-center gap-1.5 text-xs text-amber-700 mt-1.5">
          <MdInfoOutline className="shrink-0 text-sm" />
          {exit.allow_leave_during_notice ? t("notice.leaveExtends") : t("notice.leaveNotAllowed")}
        </p>
      </div>
    </div>
  );
}
