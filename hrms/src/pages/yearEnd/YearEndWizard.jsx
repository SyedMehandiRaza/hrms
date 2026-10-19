import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import {
  MdArrowBack,
  MdCheck,
  MdChevronRight,
  MdInfoOutline,
  MdPlayArrow,
  MdRemove,
} from "react-icons/md";

import Loader from "../../components/Loader";
import YearStatusBadge from "../../components/fiscalYear/YearStatusBadge";
import ReadinessStep from "../../components/yearEnd/ReadinessStep";
import LeaveStep from "../../components/yearEnd/LeaveStep";
import PayrollStep from "../../components/yearEnd/PayrollStep";
import BillingStep from "../../components/yearEnd/BillingStep";
import SetupStep from "../../components/yearEnd/SetupStep";
import CloseStep from "../../components/yearEnd/CloseStep";
import { LoadError } from "../../components/yearEnd/shared";
import { DATE_OPTS, cardCls, primaryBtn, secondaryBtn } from "../../components/yearEnd/styles";
import { getFiscalSettings, getFiscalYear, setYearStep, startYearReview } from "../../data/groupG";
import { CLOSE_STEPS } from "../../utils/fyValidation/core";
import { useCan } from "../../hooks/usePermission";
import { useFormat } from "../../hooks/useFormat";

const isDone = (s) => s && (s.status === "DONE" || s.status === "SKIPPED");
const SKIPPABLE = ["LEAVE", "PAYROLL", "BILLING", "SETUP"];

// Year-end close wizard — /admin/fiscal-years/:yearKey/close[?step=LEAVE].
// Resumes from the year's close steps; each step is marked via POST /steps.
export default function YearEndWizard() {
  const { t } = useTranslation("fiscalYear");
  const { fmtDate } = useFormat();
  const can = useCan();
  const canUpdate = can("financial_year", "update");
  const { yearKey: rawKey } = useParams();
  const yearKey = Number(rawKey);
  const validKey = Number.isInteger(yearKey) && yearKey >= 2000 && yearKey <= 2100;
  const [params, setParams] = useSearchParams();

  const [busy, setBusy] = useState(null);

  // The static year (+ settings), re-read when the route's year changes.
  const readYear = (key) => ({
    key,
    detail: Number.isInteger(key) && key >= 2000 && key <= 2100 ? getFiscalYear(key) : null,
    settings: getFiscalSettings(),
  });
  const [data, setData] = useState(() => readYear(yearKey));
  if (data.key !== yearKey && !(Number.isNaN(data.key) && Number.isNaN(yearKey))) setData(readYear(yearKey));
  const detail = data.detail || null;
  const settings = data.settings || null;
  const loading = false;
  const load = () => setData(readYear(yearKey));
  const error = validKey && !detail ? t("wizard.notFound") : null;
  const setDetail = useCallback((d) => setData((x) => ({ ...(x || {}), detail: d })), []);

  // quiet refresh (keeps the current step mounted)
  const refresh = useCallback(() => {
    setDetail(getFiscalYear(yearKey));
  }, [yearKey, setDetail]);

  const steps = detail?.steps || [];
  const stepOf = (key) => steps.find((s) => s.step === key);
  const firstOpen = CLOSE_STEPS.find((k) => !isDone(stepOf(k))) || "CLOSE";
  const isClosedYear = detail?.status === "CLOSED";
  // A step opens only once every step before it is DONE / SKIPPED (a closed
  // year can be browsed freely). A ?step= further ahead falls back to the first
  // open step, so the wizard always resumes from the saved close steps.
  const reachable = (key) =>
    isClosedYear || CLOSE_STEPS.slice(0, CLOSE_STEPS.indexOf(key)).every((k) => isDone(stepOf(k)));
  const requested = params.get("step");
  const active =
    CLOSE_STEPS.includes(requested) && reachable(requested) ? requested : isClosedYear ? "CLOSE" : firstOpen;
  const idx = CLOSE_STEPS.indexOf(active);
  const nextOpen = idx < CLOSE_STEPS.length - 1 && reachable(CLOSE_STEPS[idx + 1]);

  const go = (key) => setParams({ step: key }, { replace: true });

  const mark = async (status) => {
    setBusy(status);
    try {
      const d = setYearStep(yearKey, active, status);
      setDetail(d);
      if (idx < CLOSE_STEPS.length - 1) go(CLOSE_STEPS[idx + 1]);
    } catch {
      toast.error(t("ui.genericError"));
    } finally {
      setBusy(null);
    }
  };

  const startReview = async () => {
    setBusy("review");
    try {
      setDetail(startYearReview(yearKey));
      toast.success(t("wizard.reviewStarted"));
    } catch {
      toast.error(t("ui.genericError"));
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <Loader className="py-24" />;
  if (!validKey || error || !detail)
    return (
      <div className="space-y-4">
        <BackLink />
        <div className={cardCls}>
          <LoadError message={!validKey ? t("wizard.notFound") : error} onRetry={validKey ? load : undefined} />
        </div>
      </div>
    );

  const closed = detail.status === "CLOSED";
  const readOnly = !canUpdate || closed;
  const startMonth = settings?.fy_start_month || Number(detail.months?.[0]?.month) || 1;
  const leaveDone = stepOf("LEAVE")?.status === "DONE";
  const current = stepOf(active);

  const body = () => {
    switch (active) {
      case "READINESS":
        return <ReadinessStep yearKey={yearKey} onGoStep={go} />;
      case "LEAVE":
        return <LeaveStep yearKey={yearKey} readOnly={readOnly} leaveClosed={leaveDone || closed} onClosed={refresh} />;
      case "PAYROLL":
        return <PayrollStep yearKey={yearKey} startMonth={startMonth} readOnly={readOnly} />;
      case "BILLING":
        return <BillingStep yearKey={yearKey} readOnly={readOnly} />;
      case "SETUP":
        return <SetupStep yearKey={yearKey} startMonth={startMonth} readOnly={readOnly} />;
      default:
        return (
          <CloseStep
            detail={detail}
            pendingOnClose={settings?.pending_on_close}
            readOnly={!canUpdate}
            onChanged={setDetail}
            onGoStep={go}
          />
        );
    }
  };

  return (
    <div className="space-y-6">
      <BackLink />
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">{t("wizard.title", { label: detail.label })}</h1>
            <YearStatusBadge year={detail} className="text-xs" />
          </div>
          <p className="text-gray-400 mt-1 text-sm">
            {fmtDate(detail.start_date, DATE_OPTS)} – {fmtDate(detail.end_date, DATE_OPTS)}
          </p>
        </div>
      </div>

      {detail.status === "OPEN" && canUpdate && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-cyan-50 border border-cyan-100 px-4 py-3">
          <p className="flex items-start gap-2 text-sm text-cyan-800">
            <MdInfoOutline className="text-lg shrink-0 mt-0.5" />
            {t("wizard.startHint")}
          </p>
          <button type="button" onClick={startReview} disabled={busy === "review"} className={`${primaryBtn} shrink-0`}>
            <MdPlayArrow /> {t("wizard.startReview")}
          </button>
        </div>
      )}
      {detail.status === "PLANNED" && (
        <div className="flex items-start gap-2 rounded-xl bg-sky-50 border border-sky-100 px-4 py-3 text-sm text-sky-800">
          <MdInfoOutline className="text-lg shrink-0 mt-0.5" />
          {t("wizard.plannedHint")}
        </div>
      )}
      {!canUpdate && (
        <div className="flex items-start gap-2 rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-600">
          <MdInfoOutline className="text-lg shrink-0 mt-0.5" />
          {t("wizard.readOnly")}
        </div>
      )}

      {/* stepper */}
      <ol className="flex overflow-x-auto scrollbar-hide gap-2 pb-1">
        {CLOSE_STEPS.map((key, i) => {
          const s = stepOf(key);
          const done = isDone(s) || (closed && key === "CLOSE");
          const isActive = key === active;
          const open = reachable(key);
          return (
            <li key={key} className="shrink-0">
              <button
                type="button"
                onClick={() => open && go(key)}
                disabled={!open}
                title={open ? undefined : t("wizard.stepLocked")}
                aria-current={isActive ? "step" : undefined}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${
                  isActive
                    ? "border-cyan-600 bg-cyan-50 text-cyan-700"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    done
                      ? s?.status === "SKIPPED"
                        ? "bg-gray-300 text-white"
                        : "bg-emerald-500 text-white"
                      : isActive
                        ? "bg-cyan-600 text-white"
                        : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {done ? s?.status === "SKIPPED" ? <MdRemove /> : <MdCheck /> : i + 1}
                </span>
                <span className="whitespace-nowrap">{t(`steps.${key}`)}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <section className={`${cardCls} overflow-hidden`}>
        <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-gray-900">{t(`steps.${active}`)}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{t(`stepIntro.${active}`)}</p>
          </div>
          {current && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-600 self-start sm:self-center">
              {t(`stepStatus.${current.status}`)}
            </span>
          )}
        </div>
        <div className="p-5 sm:p-6">{body()}</div>

        {active !== "CLOSE" && (
          <div className="px-5 sm:px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2">
            <button type="button" onClick={() => idx > 0 && go(CLOSE_STEPS[idx - 1])} disabled={idx === 0} className={secondaryBtn}>
              <MdArrowBack className="rtl:rotate-180" /> {t("wizard.back")}
            </button>
            <div className="flex flex-col-reverse sm:flex-row gap-2">
              {readOnly || isDone(current) ? (
                <button
                  type="button"
                  onClick={() => nextOpen && go(CLOSE_STEPS[idx + 1])}
                  disabled={!nextOpen}
                  title={nextOpen ? undefined : t("wizard.stepLocked")}
                  className={primaryBtn}
                >
                  {t("wizard.next")} <MdChevronRight className="rtl:rotate-180" />
                </button>
              ) : (
                <>
                  {SKIPPABLE.includes(active) && (
                    <button type="button" onClick={() => mark("SKIPPED")} disabled={!!busy} className={secondaryBtn}>
                      {t("wizard.skip")}
                    </button>
                  )}
                  {(active !== "LEAVE" || leaveDone) && (
                    <button type="button" onClick={() => mark("DONE")} disabled={!!busy} className={primaryBtn}>
                      {busy === "DONE" ? t("ui.saving") : t("wizard.markDone")} <MdChevronRight className="rtl:rotate-180" />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function BackLink() {
  const { t } = useTranslation("fiscalYear");
  return (
    <Link to="/admin/settings" state={{ tab: "Financial Year" }} className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800">
      <MdArrowBack className="rtl:rotate-180" /> {t("wizard.backToSettings")}
    </Link>
  );
}
