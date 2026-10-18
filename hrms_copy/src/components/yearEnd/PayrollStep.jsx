import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { MdChevronRight, MdDescription, MdOpenInNew } from "react-icons/md";

import Loader from "../Loader";
import { LoadError } from "./shared";
import { cardCls, primaryBtn, secondaryBtn } from "./styles";
import { getYearPayrollRuns } from "../../data/groupG";
import { runReportJob } from "./reportJob";
import JobProgress from "./JobProgress";
import { monthsOfFy } from "../../utils/fiscalYear";
import { useFormat } from "../../hooks/useFormat";

const MONTH_TONE = {
  NONE: "bg-gray-50 border-gray-200 text-gray-500",
  CREDITED: "bg-emerald-50 border-emerald-200 text-emerald-700",
  PENDING: "bg-amber-50 border-amber-200 text-amber-700",
};

// Month status from its runs: none → not generated; all credited → credited;
// otherwise the least advanced run's status.
const monthStatus = (runs) => {
  if (!runs.length) return "NONE";
  if (runs.every((r) => r.status === "CREDITED")) return "CREDITED";
  return runs.find((r) => r.status !== "CREDITED").status;
};

// Payroll of the FY's 12 months + the annual reports.
export default function PayrollStep({ yearKey, startMonth, readOnly, onGenerated }) {
  const { t } = useTranslation("fiscalYear");
  const { fmtNumber } = useFormat();
  const navigate = useNavigate();
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(null);
  const [job, setJob] = useState(null);

  // all runs of the FY (static) — not the rejected ones
  const runs = useMemo(() => getYearPayrollRuns(yearKey).filter((r) => r.status !== "REJECTED"), [yearKey]);
  const remote = { data: runs, loading: false, error: null, reload: () => {} };

  const generate = async () => {
    setGenerating(true);
    try {
      const done = await runReportJob(yearKey, {}, { onProgress: setJob });
      setGenerated(done ? done.done : 0);
      if (done && done.status === "FAILED") toast.error(t("annualReports.jobFailed", { count: done.failed || 0 }));
      else toast.success(t("payrollStep.generatedToast"));
      onGenerated?.();
    } catch {
      toast.error(t("ui.genericError"));
    } finally {
      setGenerating(false);
      setJob(null);
    }
  };

  const openPayroll = () => {
    navigate("/admin/payroll-overview");
  };

  if (remote.loading && !remote.data) return <Loader />;
  if (remote.error && !remote.data) return <LoadError onRetry={remote.reload} />;

  const months = monthsOfFy(startMonth, yearKey);
  const credited = months.filter((m) => monthStatus(runs.filter((r) => Number(r.period_year) === m.year && Number(r.period_month) === m.month)) === "CREDITED").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm text-gray-600">{t("payrollStep.summary", { credited, total: months.length })}</p>
        <button type="button" onClick={openPayroll} className={secondaryBtn}>
          {t("payrollStep.openPayroll")} <MdChevronRight className="rtl:rotate-180" />
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
        {months.map((m) => {
          const mr = runs.filter((r) => Number(r.period_year) === m.year && Number(r.period_month) === m.month);
          const st = monthStatus(mr);
          const tone = MONTH_TONE[st] || MONTH_TONE.PENDING;
          const net = mr.reduce((s, r) => s + (Number(r.total_net) || 0), 0);
          return (
            <div key={m.value} className={`rounded-xl border px-3 py-2.5 ${tone}`}>
              <p className="text-xs font-semibold text-gray-800">
                {t(`monthFull.${m.key}`)} {m.year}
              </p>
              <p className="text-[11px] font-bold mt-1">
                {st === "NONE" ? t("payrollStep.notGenerated") : t(`runStatus.${st}`, { defaultValue: st })}
              </p>
              {mr.length > 0 && <p className="text-[11px] text-gray-500 mt-0.5">{fmtNumber(net, { maximumFractionDigits: 2 })}</p>}
            </div>
          );
        })}
      </div>

      <div className={`${cardCls} p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0">
            <MdDescription className="text-xl" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">{t("payrollStep.reportsTitle")}</p>
            <p className="text-xs text-gray-500 mt-0.5">{t("payrollStep.reportsHint")}</p>
            {generated !== null && (
              <p className="text-xs text-emerald-700 mt-1">{t("payrollStep.generatedCount", { count: generated })}</p>
            )}
            {job && <JobProgress job={job} className="mt-2" />}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Link to="/admin/annual-reports" className={secondaryBtn}>
            <MdOpenInNew /> {t("payrollStep.viewReports")}
          </Link>
          {!readOnly && (
            <button type="button" onClick={generate} disabled={generating} className={primaryBtn}>
              {generating ? t("payrollStep.generating") : t("payrollStep.generate")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
