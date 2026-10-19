import { useTranslation } from "react-i18next";

// Progress of a background annual-report job ({ done, failed, total, progress }).
export default function JobProgress({ job, className = "" }) {
  const { t } = useTranslation("fiscalYear");
  if (!job) return null;
  const pct = Math.max(0, Math.min(100, Number(job.progress) || 0));
  return (
    <div role="status" className={`rounded-lg border border-cyan-100 bg-cyan-50/60 px-3 py-2 ${className}`}>
      <div className="flex items-center justify-between gap-2 text-xs font-semibold text-cyan-800">
        <span>{t("annualReports.progress", { done: (job.done || 0) + (job.failed || 0), total: job.total || 0 })}</span>
        <span dir="ltr">{pct}%</span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-cyan-100 overflow-hidden">
        <div className="h-full bg-cyan-600 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
