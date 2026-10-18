import { useCallback, useMemo } from "react";
import { useForm, Controller, useFieldArray, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import {
  MdAdd,
  MdArrowDownward,
  MdArrowUpward,
  MdChecklist,
  MdDeleteOutline,
  MdErrorOutline,
  MdInfoOutline,
  MdRefresh,
  MdTune,
} from "react-icons/md";

import Loader from "../Loader";
import CustomDropdown from "../CustomDropdown";
import FieldError from "../FieldError";
import { getExitSettings, updateExitSettings, getExitTemplate, replaceExitTemplate } from "../../data/groupG";
import { exitRules, validateTemplateItems, CHECKLIST_CATEGORIES, LIMITS } from "../../utils/exitValidation";

// ── shared bits ───────────────────────────────────────────────────────────────
const inputCls = (err) =>
  `w-full border rounded-lg px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-cyan-500 focus:outline-none focus:border-transparent transition disabled:bg-gray-50 disabled:text-gray-400 ${
    err ? "border-red-400 bg-red-50" : "border-gray-200 bg-white"
  }`;
const labelCls = "block text-xs font-semibold text-gray-500 mb-1.5";
const primaryBtn =
  "inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-cyan-600 hover:bg-cyan-700 text-white transition disabled:opacity-50 disabled:cursor-not-allowed";

// RTL-safe switch: the knob is placed with flex justification, which follows
// the document direction.
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

function CardHeader({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-start gap-3 px-5 sm:px-6 py-4 border-b border-gray-100">
      <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0">
        <Icon className="text-xl" />
      </div>
      <div className="min-w-0">
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

function LoadError({ onRetry }) {
  const { t } = useTranslation("exits");
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-4">
      <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center">
        <MdErrorOutline className="text-2xl" />
      </div>
      <p className="text-sm text-gray-600">{t("settings.loadError")}</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50"
      >
        <MdRefresh /> {t("settings.retry")}
      </button>
    </div>
  );
}

// ── A. Defaults ───────────────────────────────────────────────────────────────
const TOGGLES = [
  { name: "default_allow_leave_during_notice", key: "allowLeave" },
  { name: "default_encash_leave", key: "encashLeave" },
  { name: "block_loans_during_notice", key: "blockLoans" },
];

// Number inputs hold strings; keep form values as strings so isDirty compares like with like.
const toFormDefaults = (s) => ({
  default_notice_days: String(s?.default_notice_days ?? ""),
  default_cooling_days: String(s?.default_cooling_days ?? ""),
  default_allow_leave_during_notice: !!s?.default_allow_leave_during_notice,
  default_encash_leave: !!s?.default_encash_leave,
  block_loans_during_notice: !!s?.block_loans_during_notice,
});

function DefaultsCard() {
  const { t } = useTranslation("exits");
  const R = useMemo(() => exitRules(t), [t]);
  const loading = false;
  const loadFailed = false;

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm({ mode: "onTouched", reValidateMode: "onChange", defaultValues: toFormDefaults(getExitSettings()) });

  const load = useCallback(() => reset(toFormDefaults(getExitSettings())), [reset]);

  const onSubmit = async (v) => {
    try {
      const saved = updateExitSettings({
        default_notice_days: Number(String(v.default_notice_days).trim()),
        default_cooling_days: Number(String(v.default_cooling_days).trim()),
        default_allow_leave_during_notice: !!v.default_allow_leave_during_notice,
        default_encash_leave: !!v.default_encash_leave,
        block_loans_during_notice: !!v.block_loans_during_notice,
      });
      reset(toFormDefaults(saved));
      toast.success(t("settings.defaults.saved"));
    } catch {
      toast.error(t("common.genericError"));
    }
  };

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <CardHeader icon={MdTune} title={t("settings.defaults.title")} subtitle={t("settings.defaults.subtitle")} />
      {loading ? (
        <Loader className="py-12" />
      ) : loadFailed ? (
        <LoadError onRetry={load} />
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="p-5 sm:p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label htmlFor="exit-default-notice" className={labelCls}>
                {t("settings.defaults.noticeDays")}
              </label>
              <input
                id="exit-default-notice"
                type="number"
                inputMode="numeric"
                min={0}
                max={LIMITS.noticeDaysMax}
                step={1}
                disabled={isSubmitting}
                className={inputCls(errors.default_notice_days)}
                {...register("default_notice_days", R.default_notice_days)}
              />
              <FieldError error={errors.default_notice_days} />
              <p className="text-xs text-gray-400 mt-1.5">
                {t("settings.defaults.noticeDaysHelp", { max: LIMITS.noticeDaysMax })}
              </p>
            </div>
            <div>
              <label htmlFor="exit-default-cooling" className={labelCls}>
                {t("settings.defaults.coolingDays")}
              </label>
              <input
                id="exit-default-cooling"
                type="number"
                inputMode="numeric"
                min={0}
                max={LIMITS.coolingDaysMax}
                step={1}
                disabled={isSubmitting}
                className={inputCls(errors.default_cooling_days)}
                {...register("default_cooling_days", R.default_cooling_days)}
              />
              <FieldError error={errors.default_cooling_days} />
              <p className="text-xs text-gray-400 mt-1.5">
                {t("settings.defaults.coolingDaysHelp", { max: LIMITS.coolingDaysMax })}
              </p>
            </div>
          </div>

          <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl">
            {TOGGLES.map(({ name, key }) => (
              <Controller
                key={name}
                name={name}
                control={control}
                rules={R.yes_no}
                render={({ field }) => (
                  <div className="flex items-start justify-between gap-4 px-4 py-3.5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{t(`settings.defaults.${key}`)}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{t(`settings.defaults.${key}Help`)}</p>
                      <FieldError error={errors[name]} />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-medium text-gray-500 w-8 text-end">
                        {field.value ? t("common.yes") : t("common.no")}
                      </span>
                      <Toggle
                        name={name}
                        checked={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        disabled={isSubmitting}
                        label={t(`settings.defaults.${key}`)}
                      />
                    </div>
                  </div>
                )}
              />
            ))}
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={hasErrors || !isDirty || isSubmitting} className={primaryBtn}>
              {isSubmitting ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

// ── B. Clearance checklist template ──────────────────────────────────────────
const toRows = (rows) =>
  (rows || []).map((r) => ({
    id: r.id,
    category: r.category,
    label: r.label,
    is_required: !!r.is_required,
    is_active: !!r.is_active,
  }));

function TemplateCard() {
  const { t } = useTranslation("exits");
  const R = useMemo(() => exitRules(t), [t]);
  const loading = false;
  const loadFailed = false;
  // A list-level server error ("items") — none in the static build.
  const listServerError = null;

  const {
    register,
    control,
    handleSubmit,
    reset,
    trigger,
    formState: { errors, isDirty, isSubmitting },
  } = useForm({ mode: "onTouched", reValidateMode: "onChange", defaultValues: { items: toRows(getExitTemplate()) } });

  // keyName keeps the backend `id` intact in the row values.
  const { fields, append, remove, swap } = useFieldArray({ control, name: "items", keyName: "_key" });
  const items = useWatch({ control, name: "items" }) || [];
  const itemsSig = JSON.stringify(items);

  const { listError, rowErrors } = useMemo(
    () => validateTemplateItems(t, items),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, itemsSig],
  );

  const load = useCallback(() => reset({ items: toRows(getExitTemplate()) }), [reset]);

  const addRow = () =>
    append(
      { category: "", label: "", is_required: true, is_active: true },
      { focusName: `items.${fields.length}.category` },
    );

  const moveRow = (from, to) => {
    if (to < 0 || to >= fields.length) return;
    swap(from, to);
    // the duplicate rule depends on order; re-check moved labels that were already shown
    if (errors.items?.[from] || errors.items?.[to]) trigger([`items.${from}`, `items.${to}`]);
  };

  const onSubmit = async (v) => {
    const check = validateTemplateItems(t, v.items);
    if (check.listError || Object.keys(check.rowErrors).length) return;
    const payload = v.items.map((it) => ({
      ...(it.id ? { id: it.id } : {}),
      category: it.category,
      label: String(it.label).trim(),
      is_required: !!it.is_required,
      is_active: it.is_active !== false,
    }));
    try {
      const saved = replaceExitTemplate(payload);
      reset({ items: toRows(saved) });
      toast.success(t("settings.template.saved"));
    } catch {
      toast.error(t("common.genericError"));
    }
  };

  const hasErrors =
    Object.keys(errors).length > 0 ||
    Object.keys(rowErrors).length > 0 ||
    !!listError ||
    !!listServerError ||
    fields.length === 0;

  const categoryOptions = [
    { value: "", label: t("settings.template.selectCategory") },
    ...CHECKLIST_CATEGORIES.map((c) => ({ value: c, label: t(`checklistCategory.${c}`) })),
  ];

  return (
    <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <CardHeader icon={MdChecklist} title={t("settings.template.title")} subtitle={t("settings.template.subtitle")} />
      {loading ? (
        <Loader className="py-12" />
      ) : loadFailed ? (
        <LoadError onRetry={load} />
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="p-5 sm:p-6 space-y-5">
          <div className="flex items-start gap-2.5 rounded-lg bg-cyan-50 border border-cyan-100 px-4 py-3 text-sm text-cyan-800">
            <MdInfoOutline className="text-lg shrink-0 mt-0.5" />
            <p>{t("settings.template.intro")}</p>
          </div>

          {fields.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-center border border-dashed border-gray-200 rounded-xl">
              <MdChecklist className="text-3xl text-gray-300" />
              <p className="text-sm text-gray-500">{t("settings.template.empty")}</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {fields.map((f, i) => {
                const row = items[i] || {};
                const saved = !!row.id;
                const inactive = row.is_active === false;
                const rowErr = errors.items?.[i] || {};
                const labelError = rowErr.label?.message || rowErrors[i];
                return (
                  <li
                    key={f._key}
                    className={`border rounded-xl p-3 sm:p-4 transition ${
                      inactive ? "bg-gray-50 border-gray-200" : "bg-white border-gray-200"
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start gap-3">
                      {/* order */}
                      <div className="flex lg:flex-col items-center gap-1 shrink-0">
                        <span className="text-xs font-semibold text-gray-400 w-6 text-center">{i + 1}</span>
                        <button
                          type="button"
                          onClick={() => moveRow(i, i - 1)}
                          disabled={i === 0 || isSubmitting}
                          aria-label={t("settings.template.moveUp")}
                          title={t("settings.template.moveUp")}
                          className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <MdArrowUpward />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveRow(i, i + 1)}
                          disabled={i === fields.length - 1 || isSubmitting}
                          aria-label={t("settings.template.moveDown")}
                          title={t("settings.template.moveDown")}
                          className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <MdArrowDownward />
                        </button>
                      </div>

                      {/* fields */}
                      <div className={`flex-1 grid grid-cols-1 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] gap-3 ${inactive ? "opacity-60" : ""}`}>
                        <div>
                          <label className={labelCls}>{t("settings.template.category")}</label>
                          <Controller
                            name={`items.${i}.category`}
                            control={control}
                            rules={R.category}
                            render={({ field }) => (
                              <CustomDropdown
                                name={field.name}
                                ref={field.ref}
                                value={field.value}
                                onChange={(e) => field.onChange(e.target.value)}
                                onBlur={field.onBlur}
                                options={categoryOptions}
                                error={!!rowErr.category}
                                disabled={isSubmitting}
                              />
                            )}
                          />
                          <FieldError error={rowErr.category} />
                        </div>
                        <div>
                          <label htmlFor={`exit-tpl-label-${f._key}`} className={labelCls}>
                            {t("settings.template.label")}
                          </label>
                          <input
                            id={`exit-tpl-label-${f._key}`}
                            type="text"
                            maxLength={LIMITS.labelMax + 50}
                            placeholder={t("settings.template.labelPlaceholder")}
                            disabled={isSubmitting}
                            className={inputCls(labelError)}
                            {...register(`items.${i}.label`, R.label)}
                          />
                          <FieldError message={labelError} />
                        </div>
                      </div>

                      {/* flags + remove */}
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 lg:pt-6 shrink-0">
                        <Controller
                          name={`items.${i}.is_required`}
                          control={control}
                          render={({ field }) => (
                            <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
                              <Toggle
                                name={field.name}
                                checked={field.value}
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                                disabled={isSubmitting || inactive}
                                label={t("settings.template.required")}
                              />
                              {t("settings.template.required")}
                            </label>
                          )}
                        />
                        <Controller
                          name={`items.${i}.is_active`}
                          control={control}
                          render={({ field }) => (
                            <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
                              <Toggle
                                name={field.name}
                                checked={field.value}
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                                disabled={isSubmitting}
                                label={t("settings.template.active")}
                              />
                              {t("settings.template.active")}
                            </label>
                          )}
                        />
                        {saved ? (
                          inactive && (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">
                              {t("settings.template.inactiveBadge")}
                            </span>
                          )
                        ) : (
                          <button
                            type="button"
                            onClick={() => remove(i)}
                            disabled={isSubmitting}
                            aria-label={t("common.remove")}
                            title={t("common.remove")}
                            className="p-2 rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-40"
                          >
                            <MdDeleteOutline className="text-lg" />
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <button
            type="button"
            onClick={addRow}
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border border-dashed border-cyan-300 text-cyan-700 hover:bg-cyan-50 disabled:opacity-50"
          >
            <MdAdd className="text-lg" /> {t("settings.template.addItem")}
          </button>

          <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0">
              <FieldError message={listServerError || listError} className="mt-0" />
              {!listError && !listServerError && (
                <p className="text-xs text-gray-400">{t("settings.template.deactivateHint")}</p>
              )}
            </div>
            <button type="submit" disabled={hasErrors || !isDirty || isSubmitting} className={`${primaryBtn} shrink-0`}>
              {isSubmitting ? t("common.saving") : t("settings.template.save")}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

// ── Tab ───────────────────────────────────────────────────────────────────────
export default function ExitSettingsTab() {
  const { t } = useTranslation("exits");
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">{t("settings.title")}</h2>
        <p className="text-sm text-gray-500 mt-0.5">{t("settings.subtitle")}</p>
      </div>
      <DefaultsCard />
      <TemplateCard />
    </div>
  );
}
