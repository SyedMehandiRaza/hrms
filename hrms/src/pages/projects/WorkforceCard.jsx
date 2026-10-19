import { useState } from "react";
import { MdOutlineGroups, MdOutlineSend, MdOutlineHourglassEmpty } from "react-icons/md";
import { useTranslation } from "react-i18next";
import { WORKFORCE_SUMMARY } from "../../data/groupC";

// Workforce distribution snapshot: on my projects / deployed to partners / bench.
export default function WorkforceCard() {
  const { t } = useTranslation("collaboration");
  const [s] = useState(WORKFORCE_SUMMARY);

  const tiles = [
    { key: "onMyProjects", label: t("workforce.onMyProjects"), value: s?.on_own_project, icon: MdOutlineGroups, color: "text-cyan-600", bg: "bg-cyan-50" },
    { key: "deployedToPartners", label: t("workforce.deployedToPartners"), value: s?.deployed_out, icon: MdOutlineSend, color: "text-violet-600", bg: "bg-violet-50" },
    { key: "onBench", label: t("workforce.onBench"), value: s?.bench, icon: MdOutlineHourglassEmpty, color: "text-amber-600", bg: "bg-amber-50" },
  ];

  const total = s?.total || 0;
  const bench = s?.bench || 0;
  const assigned = Math.max(0, total - bench);
  const assignedPct = total > 0 ? (assigned / total) * 100 : 0;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-gray-900">{t("workforce.title")}</h3>
        <span className="text-xs text-gray-400">{t("workforce.totalEmployees")} <b className="text-gray-700">{s?.total ?? "—"}</b></span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {tiles.map((tl) => (
          <div key={tl.key} className="flex items-center gap-3 rounded-xl border border-gray-100 p-4">
            <span className={`w-10 h-10 rounded-lg grid place-items-center flex-shrink-0 ${tl.bg} ${tl.color}`}><tl.icon className="text-xl" /></span>
            <div>
              <p className="text-2xl font-bold text-gray-900 leading-tight">{tl.value ?? "—"}</p>
              <p className="text-xs text-gray-500">{tl.label}</p>
            </div>
          </div>
        ))}
      </div>
      {s && total > 0 && (
        <div className="mt-4">
          <div className="flex h-2 rounded-full overflow-hidden bg-amber-100">
            <div className="bg-cyan-500" style={{ width: `${assignedPct}%` }} title={t("workforce.assigned", { count: assigned })} />
          </div>
          <div className="flex justify-between mt-1.5 text-[11px] text-gray-400">
            <span><span className="inline-block w-2 h-2 rounded-full bg-cyan-500 me-1" />{t("workforce.assigned", { count: assigned })}</span>
            <span><span className="inline-block w-2 h-2 rounded-full bg-amber-400 me-1" />{t("workforce.onBenchCount", { count: bench })}</span>
          </div>
        </div>
      )}
    </div>
  );
}
