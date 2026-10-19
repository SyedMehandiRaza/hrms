import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { MdCheckCircle, MdChevronRight, MdError, MdRefresh, MdWarning } from "react-icons/md";

import Loader from "../Loader";
import { LoadError } from "./shared";
import { DATE_OPTS, secondaryBtn } from "./styles";
import { useFormat } from "../../hooks/useFormat";
import { READINESS_FIX, READINESS_ORDER, fixPath } from "./readinessLinks";
import { getReadiness } from "../../data/groupG";

const TONE = {
  BLOCK: { card: "border-red-200 bg-red-50/60", icon: MdError, iconCls: "text-red-500", chip: "bg-red-100 text-red-700" },
  WARN: { card: "border-amber-200 bg-amber-50/60", icon: MdWarning, iconCls: "text-amber-500", chip: "bg-amber-100 text-amber-700" },
  OK: { card: "border-emerald-200 bg-emerald-50/40", icon: MdCheckCircle, iconCls: "text-emerald-500", chip: "bg-emerald-100 text-emerald-700" },
};

// One readiness card (also used by the Close step for the blocking list).
// (`yearKey` is kept for callers; the static build needs no year switch before a fix.)
// eslint-disable-next-line no-unused-vars
export function ReadinessCard({ item, yearKey, onGoStep }) {
  const { t } = useTranslation("fiscalYear");
  const navigate = useNavigate();
  const tone = TONE[item.status] || TONE.OK;
  const Icon = tone.icon;
  const fix = READINESS_FIX[item.key];
  const { fmtDate } = useFormat();

  const goFix = () => {
    if (!fix) return;
    if (fix.step) return onGoStep?.(fix.step);
    // static build: every year is available — go straight to the fix
    navigate(fixPath(fix, item));
  };

  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-2 ${tone.card}`}>
      <div className="flex items-start gap-2.5">
        <Icon className={`text-xl shrink-0 mt-0.5 ${tone.iconCls}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-gray-900">{t(`readiness.items.${item.key}`, { defaultValue: item.key })}</p>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${tone.chip}`}>
              {t(`readiness.status.${item.status}`)}
            </span>
          </div>
          <p className="text-xs text-gray-600 mt-1">
            {item.status === "OK"
              ? item.note
                ? t("readiness.notUsed")
                : t("readiness.ok")
              : t(`readiness.hints.${item.key}`, {
                  count: item.count,
                  date: item.end_date ? fmtDate(item.end_date, DATE_OPTS) : "",
                  defaultValue: t("readiness.countHint", { count: item.count }),
                })}
          </p>
          {Array.isArray(item.months) && item.months.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {item.months.map((m) => (
                <span key={m} className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white border border-gray-200 text-gray-600" dir="ltr">
                  {m}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      {item.status !== "OK" && fix && (
        <button
          type="button"
          onClick={goFix}
          className="self-end inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 hover:text-cyan-800"
        >
          {t("readiness.fix")}
          <MdChevronRight className="rtl:rotate-180" />
        </button>
      )}
    </div>
  );
}

export default function ReadinessStep({ yearKey, onGoStep }) {
  const { t } = useTranslation("fiscalYear");
  const [data, setData] = useState(() => getReadiness(yearKey));
  const loading = false;
  const failed = false;
  const load = () => setData(getReadiness(yearKey));

  if (loading && !data) return <Loader />;
  if (failed) return <LoadError onRetry={load} />;

  const items = [...(data?.items || [])].sort((a, b) => READINESS_ORDER[a.status] - READINESS_ORDER[b.status]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <span className="px-2 py-1 rounded-md bg-red-50 text-red-700 border border-red-100">
            {t("readiness.blockCount", { count: data?.block || 0 })}
          </span>
          <span className="px-2 py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-100">
            {t("readiness.warnCount", { count: data?.warn || 0 })}
          </span>
        </div>
        <button type="button" onClick={load} disabled={loading} className={secondaryBtn}>
          <MdRefresh className={loading ? "animate-spin" : ""} /> {t("readiness.recheck")}
        </button>
      </div>
      <p className="text-sm text-gray-500">{data?.block ? t("readiness.blockedIntro") : t("readiness.readyIntro")}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {items.map((it) => (
          <ReadinessCard key={it.key} item={it} yearKey={yearKey} onGoStep={onGoStep} />
        ))}
      </div>
    </div>
  );
}
