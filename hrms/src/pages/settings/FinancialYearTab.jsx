import { useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  MdCalendarMonth,
  MdChevronRight,
  MdExpandLess,
  MdExpandMore,
  MdInfoOutline,
  MdOutlineEventNote,
  MdTune,
} from "react-icons/md";

import Loader from "../../components/Loader";
import CustomDropdown from "../../components/CustomDropdown";
import FieldError from "../../components/FieldError";
import Pagination from "../../components/Pagination";
import YearStatusBadge from "../../components/fiscalYear/YearStatusBadge";
import MonthLocksGrid from "../../components/yearEnd/MonthLocksGrid";
import { CardHeader, EmptyState, LoadError } from "../../components/yearEnd/shared";
import { DATE_OPTS, DATETIME_OPTS, inputCls, labelCls, primaryBtn, secondaryBtn } from "../../components/yearEnd/styles";
import { FISCAL_SETTINGS, FISCAL_YEARS, FISCAL_YEAR_CLOSED_BY } from "../../data/groupA";
import {
  FY_STATUSES,
  LIMITS,
  LOCK_MODES,
  PENDING_ON_CLOSE,
  fyCoreRules,
  timezoneList,
} from "../../utils/fyValidation/core";
import { MONTH_KEYS, fyLabel, fyRange, todayIn, yearKeyFor } from "../../utils/fiscalYear";
import { useCan } from "../../hooks/usePermission";
import { useFormat } from "../../hooks/useFormat";

const toForm = (s = {}) => ({
  fy_start_month: String(s.fy_start_month ?? 1),
  timezone: s.timezone || "",
  review_days_before: String(s.review_days_before ?? ""),
  auto_open_next_year: !!s.auto_open_next_year,
  reopen_window_days: String(s.reopen_window_days ?? ""),
  lock_mode: s.lock_mode || "YEARLY",
  pending_on_close: s.pending_on_close || "BLOCK",
  offline_backdate_days: String(s.offline_backdate_days ?? ""),
});

const addDays = (ymd, days) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

// Year-end may start once the year is in its review window (or already closing).
const canStartYearEnd = (year, reviewDays, today) =>
  year.status === "CLOSING" ||
  (year.status === "OPEN" && today >= addDays(year.end_date, -Number(reviewDays || 0)));

function Toggle({ checked, onChange, onBlur, disabled, label, name }) {
  return (
    <button
      type="button"
      role="switch"
      name={name}
      aria-checked={!!checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      onBlur={onBlur}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? "bg-cyan-600 justify-end" : "bg-gray-300 justify-start"
      }`}
    >
      <span className="h-5 w-5 rounded-full bg-white shadow" />
    </button>
  );
}

// ── A. Settings ───────────────────────────────────────────────────────────────
function SettingsCard({ canUpdate, startMonthLocked, onSaved, loading, failed, settings, onRetry }) {
  const { t } = useTranslation("fiscalYear");
  const { fmtDate } = useFormat();
  const R = useMemo(() => fyCoreRules(t), [t]);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm({ mode: "onTouched", reValidateMode: "onChange", defaultValues: toForm(settings || {}) });

  useEffect(() => {
    if (settings) reset(toForm(settings));
  }, [settings, reset]);

  const startMonth = Number(useWatch({ control, name: "fy_start_month" })) || 1;
  const tz = useWatch({ control, name: "timezone" });

  const tzOptions = useMemo(() => {
    const list = timezoneList();
    const withCurrent = settings?.timezone && !list.includes(settings.timezone) ? [settings.timezone, ...list] : list;
    return withCurrent.map((z) => ({ value: z, label: z.replace(/_/g, " ") }));
  }, [settings]);

  // Live example: the FY containing today with the chosen start month.
  const example = useMemo(() => {
    let today;
    try {
      today = todayIn(tz || undefined);
    } catch {
      today = todayIn();
    }
    const key = yearKeyFor(startMonth, today);
    const r = fyRange(startMonth, key);
    return t("settingsTab.example", {
      label: fyLabel(startMonth, key),
      from: fmtDate(r.from, DATE_OPTS),
      to: fmtDate(r.to, DATE_OPTS),
    });
  }, [startMonth, tz, t, fmtDate]);

  const onSubmit = (v) => {
    const payload = {
      timezone: String(v.timezone).trim(),
      review_days_before: Number(String(v.review_days_before).trim()),
      auto_open_next_year: !!v.auto_open_next_year,
      reopen_window_days: Number(String(v.reopen_window_days).trim()),
      lock_mode: v.lock_mode,
      pending_on_close: v.pending_on_close,
      offline_backdate_days: Number(String(v.offline_backdate_days).trim()),
    };
    if (!startMonthLocked) payload.fy_start_month = Number(v.fy_start_month);
    const saved = { ...settings, ...payload };
    reset(toForm(saved));
    toast.success(t("settingsTab.saved"));
    onSaved?.(saved);
  };

  const disabled = !canUpdate || isSubmitting;
  const hasErrors = Object.keys(errors).length > 0;

  const select = (name, options, rules, extra = {}) => (
    <Controller
      name={name}
      control={control}
      rules={rules}
      render={({ field }) => (
        <CustomDropdown
          name={field.name}
          ref={field.ref}
          value={field.value}
          onChange={(e) => field.onChange(e.target.value)}
          onBlur={field.onBlur}
          options={options}
          error={!!errors[name]}
          disabled={disabled || extra.disabled}
          isSearchable={extra.searchable}
        />
      )}
    />
  );

  const number = (name, max, help) => (
    <div>
      <label htmlFor={`fy-${name}`} className={labelCls}>
        {t(`settingsTab.fields.${name}`)}
      </label>
      <input
        id={`fy-${name}`}
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        step={1}
        disabled={disabled}
        className={inputCls(errors[name])}
        {...register(name, R[name])}
      />
      <FieldError error={errors[name]} />
      <p className="text-xs text-gray-400 mt-1.5">{t(help, { max })}</p>
    </div>
  );

  return (
    <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <CardHeader icon={MdTune} title={t("settingsTab.settingsTitle")} subtitle={t("settingsTab.settingsSubtitle")} />
      {loading ? (
        <Loader className="py-12" />
      ) : failed ? (
        <LoadError onRetry={onRetry} />
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="p-5 sm:p-6 space-y-6">
          {!canUpdate && (
            <div className="flex items-start gap-2.5 rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-600">
              <MdInfoOutline className="text-lg shrink-0 mt-0.5" />
              <p>{t("settingsTab.readOnly")}</p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className={labelCls}>{t("settingsTab.fields.fy_start_month")}</label>
              {select(
                "fy_start_month",
                MONTH_KEYS.map((k, i) => ({ value: String(i + 1), label: t(`monthFull.${k}`) })),
                R.fy_start_month,
                { disabled: startMonthLocked },
              )}
              <FieldError error={errors.fy_start_month} />
              {startMonthLocked ? (
                <p className="flex items-start gap-1.5 text-xs text-amber-700 mt-1.5">
                  <MdInfoOutline className="shrink-0 mt-0.5" />
                  {t("settingsTab.startMonthLocked")}
                </p>
              ) : (
                <p className="text-xs text-gray-400 mt-1.5">{t("settingsTab.startMonthHelp")}</p>
              )}
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-cyan-50 text-cyan-800 px-2.5 py-1 text-xs font-medium">
                <MdCalendarMonth className="shrink-0" />
                <span dir="auto">{example}</span>
              </p>
            </div>
            <div>
              <label className={labelCls}>{t("settingsTab.fields.timezone")}</label>
              {select("timezone", tzOptions, R.timezone, { searchable: true })}
              <FieldError error={errors.timezone} />
              <p className="text-xs text-gray-400 mt-1.5">{t("settingsTab.timezoneHelp")}</p>
            </div>
            {number("review_days_before", LIMITS.reviewDaysMax, "settingsTab.reviewDaysHelp")}
            {number("reopen_window_days", LIMITS.reopenWindowMax, "settingsTab.reopenWindowHelp")}
            <div>
              <label className={labelCls}>{t("settingsTab.fields.lock_mode")}</label>
              {select(
                "lock_mode",
                LOCK_MODES.map((m) => ({ value: m, label: t(`lockMode.${m}`) })),
                R.lock_mode,
              )}
              <FieldError error={errors.lock_mode} />
              <p className="text-xs text-gray-400 mt-1.5">{t("settingsTab.lockModeHelp")}</p>
            </div>
            <div>
              <label className={labelCls}>{t("settingsTab.fields.pending_on_close")}</label>
              {select(
                "pending_on_close",
                PENDING_ON_CLOSE.map((m) => ({ value: m, label: t(`pendingOnClose.${m}`) })),
                R.pending_on_close,
              )}
              <FieldError error={errors.pending_on_close} />
              <p className="text-xs text-gray-400 mt-1.5">{t("settingsTab.pendingOnCloseHelp")}</p>
            </div>
            {number("offline_backdate_days", LIMITS.offlineBackdateMax, "settingsTab.offlineBackdateHelp")}
          </div>

          <Controller
            name="auto_open_next_year"
            control={control}
            rules={R.auto_open_next_year}
            render={({ field }) => (
              <div className="flex items-start justify-between gap-4 border border-gray-100 rounded-xl px-4 py-3.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{t("settingsTab.fields.auto_open_next_year")}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{t("settingsTab.autoOpenHelp")}</p>
                  <FieldError error={errors.auto_open_next_year} />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-medium text-gray-500 w-8 text-end">
                    {field.value ? t("ui.yes") : t("ui.no")}
                  </span>
                  <Toggle
                    name={field.name}
                    checked={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    disabled={disabled}
                    label={t("settingsTab.fields.auto_open_next_year")}
                  />
                </div>
              </div>
            )}
          />

          {canUpdate && (
            <div className="flex justify-end">
              <button type="submit" disabled={hasErrors || !isDirty || isSubmitting} className={primaryBtn}>
                {isSubmitting ? t("ui.saving") : t("ui.save")}
              </button>
            </div>
          )}
        </form>
      )}
    </section>
  );
}

// Who closed the year: the actor of its latest CLOSED event (the year list
// only carries the user id).
function ClosedBy({ yearKey }) {
  const { t } = useTranslation("fiscalYear");
  const email = FISCAL_YEAR_CLOSED_BY[yearKey] || null;
  return email ? <span> · {t("settingsTab.closedBy", { name: email })}</span> : null;
}

// ── B. Years + month locks ────────────────────────────────────────────────────
const YEARS_PER_PAGE = 5;

function YearsCard({ years, loading, failed, onRetry, settings, canUpdate, onLocksChanged }) {
  const { t } = useTranslation("fiscalYear");
  const { fmtDate } = useFormat();
  const navigate = useNavigate();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null);

  const today = todayIn(settings?.timezone || undefined);
  const filtered = [...years]
    .sort((a, b) => b.year_key - a.year_key)
    .filter((y) => !status || y.status === status);
  const totalPages = Math.max(1, Math.ceil(filtered.length / YEARS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const rows = filtered.slice((safePage - 1) * YEARS_PER_PAGE, safePage * YEARS_PER_PAGE);

  return (
    <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <CardHeader
        icon={MdOutlineEventNote}
        title={t("settingsTab.yearsTitle")}
        subtitle={t("settingsTab.yearsSubtitle")}
        actions={
          <div className="w-44">
            <CustomDropdown
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              options={[
                { value: "", label: t("settingsTab.allStatuses") },
                ...FY_STATUSES.map((s) => ({ value: s, label: t(`status.${s}`, { defaultValue: s }) })),
              ]}
            />
          </div>
        }
      />
      {loading ? (
        <Loader className="py-12" />
      ) : failed ? (
        <LoadError onRetry={onRetry} />
      ) : !rows.length ? (
        <EmptyState title={t("settingsTab.noYears")} />
      ) : (
        <>
          <ul className="divide-y divide-gray-100">
            {rows.map((y) => {
              const startable = canStartYearEnd(y, settings?.review_days_before, today);
              const expanded = open === y.year_key;
              return (
                <li key={y.year_key} className="px-5 sm:px-6 py-4">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-gray-900">{y.label}</p>
                        <YearStatusBadge year={y} />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {fmtDate(y.start_date, DATE_OPTS)} – {fmtDate(y.end_date, DATE_OPTS)}
                      </p>
                      {y.closed_at && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {t("settingsTab.closedAt", { date: fmtDate(y.closed_at, DATETIME_OPTS) })}
                          <ClosedBy yearKey={y.year_key} />
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setOpen(expanded ? null : y.year_key)}
                        aria-expanded={expanded}
                        className={secondaryBtn}
                      >
                        {expanded ? <MdExpandLess /> : <MdExpandMore />}
                        {t("settingsTab.monthLocks")}
                      </button>
                      {y.status === "CLOSED" ? (
                        <button type="button" onClick={() => navigate(`/admin/fiscal-years/${y.year_key}/close`)} className={secondaryBtn}>
                          {t("settingsTab.viewYearEnd")}
                          <MdChevronRight className="rtl:rotate-180" />
                        </button>
                      ) : (
                        // starting the year-end is a change (update); a running one can be followed
                        startable &&
                        (canUpdate || y.status === "CLOSING") && (
                          <button
                            type="button"
                            onClick={() => navigate(`/admin/fiscal-years/${y.year_key}/close`)}
                            className={primaryBtn}
                          >
                            {y.status === "CLOSING" ? t("settingsTab.continueYearEnd") : t("settingsTab.startYearEnd")}
                            <MdChevronRight className="rtl:rotate-180" />
                          </button>
                        )
                      )}
                    </div>
                  </div>
                  {expanded && (
                    <div className="mt-4">
                      <MonthLocksGrid
                        year={y}
                        startMonth={settings?.fy_start_month || 1}
                        canUpdate={canUpdate}
                        onChanged={onLocksChanged}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {filtered.length > YEARS_PER_PAGE && (
            <Pagination
              page={safePage}
              totalPages={totalPages}
              total={filtered.length}
              limit={YEARS_PER_PAGE}
              onPage={setPage}
              label={t("settingsTab.yearsLabel")}
            />
          )}
        </>
      )}
    </section>
  );
}

// ── Tab ───────────────────────────────────────────────────────────────────────
export default function FinancialYearTab() {
  const { t } = useTranslation("fiscalYear");
  const can = useCan();
  const canUpdate = can("financial_year", "update");
  const [settings, setSettings] = useState(FISCAL_SETTINGS);
  const [years] = useState(FISCAL_YEARS);
  const settingsState = { loading: false, failed: false };
  const yearsState = { loading: false, failed: false };
  const loadSettings = () => {};
  const loadYears = () => {};

  const startMonthLocked = years.some((y) => y.status === "CLOSED" && y.is_locked);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">{t("settingsTab.title")}</h2>
        <p className="text-sm text-gray-500 mt-0.5">{t("settingsTab.subtitle")}</p>
      </div>
      <SettingsCard
        canUpdate={canUpdate}
        startMonthLocked={startMonthLocked}
        settings={settings}
        loading={settingsState.loading}
        failed={settingsState.failed}
        onRetry={loadSettings}
        onSaved={(s) => {
          setSettings(s);
          loadYears();
        }}
      />
      <YearsCard
        years={years}
        loading={yearsState.loading}
        failed={yearsState.failed}
        onRetry={loadYears}
        settings={settings}
        canUpdate={canUpdate}
        onLocksChanged={loadYears}
      />
    </div>
  );
}
