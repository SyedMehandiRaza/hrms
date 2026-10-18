import { useTranslation } from "react-i18next";
import { MdOutlineBarChart } from "react-icons/md";

// Today's attendance split for the Projects dashboards (company-wide, or the
// staffing company's own staff). `data` is the API's attendance_today:
// { date, present, absent, on_leave, expected } — percentages are of the
// people expected at work today (weekly offs / holidays excluded).
export default function AttendanceTodayCard({ data }) {
  const { t } = useTranslation("projects");
  const expected = Number(data?.expected) || 0;
  const pct = (n) => (expected > 0 ? Math.round(((Number(n) || 0) / expected) * 100) : 0);

  const rows = [
    { key: "present", label: t("attendanceOverview.present"), count: data?.present, color: "bg-green-500" },
    { key: "absent", label: t("attendanceOverview.absent"), count: data?.absent, color: "bg-red-500" },
    { key: "onLeave", label: t("attendanceOverview.onLeave"), count: data?.on_leave, color: "bg-amber-400" },
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-5">
        <MdOutlineBarChart className="text-cyan-500 text-xl" />
        <h3 className="text-sm font-bold text-gray-900">
          {t("attendanceOverview.title")}
        </h3>
        <span className="ms-auto text-[11px] font-semibold text-gray-400">
          {t("attendanceOverview.today")}
        </span>
      </div>
      {expected === 0 ? (
        <p className="text-sm text-gray-400 py-6 text-center">
          {t("attendanceOverview.noData")}
        </p>
      ) : (
        <div className="space-y-5">
          {rows.map(({ key, label, count, color }) => (
            <div key={key}>
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="text-gray-700">{label}</span>
                <span className="font-bold text-gray-900">
                  {pct(count)}%{" "}
                  <span className="text-xs font-medium text-gray-400">({count ?? 0})</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${color} shrink-0`} />
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full ${color} rounded-full`} style={{ width: `${pct(count)}%` }} />
                </div>
              </div>
            </div>
          ))}
          <p className="text-xs text-gray-400 pt-2 border-t border-gray-50">
            {t("attendanceOverview.expected", { count: expected })}
          </p>
        </div>
      )}
    </div>
  );
}
