import { useEffect, useState } from "react";
import { MdClose } from "react-icons/md";
import { useForm, Controller, useWatch } from "react-hook-form";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import CustomDropdown from "./CustomDropdown";
import useFiscalYear from "../hooks/useFiscalYear";
import { lockedYearOf } from "../hooks/useYearLock";

const labelCls =
  "block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5";

const inputCls =
  "w-full border border-gray-200 bg-white rounded-lg px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition";

const errorCls = "text-xs text-red-500 mt-1";

const removeEmojis = (e) => {
  const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
  if (emojiRegex.test(e.target.value)) {
    e.target.value = e.target.value.replace(emojiRegex, "");
  }
};

const ToggleRow = ({ checked, onChange, title, subtitle }) => (
  <div
    className={`flex items-center justify-between border rounded-xl px-4 py-3 transition-colors ${
      checked ? "bg-cyan-50 border-cyan-200" : "bg-white border-gray-200"
    }`}
  >
    <div>
      <p className="text-sm font-semibold text-gray-800">{title}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors focus:outline-none ${
        checked ? "bg-cyan-600" : "bg-gray-200"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform mt-0.5 ${
          checked ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  </div>
);

// The API returns times as "HH:MM:SS"; <input type="time"> wants "HH:MM".
const withShortTimes = (h) => ({
  ...h,
  from_time: h.from_time ? String(h.from_time).slice(0, 5) : "",
  to_time: h.to_time ? String(h.to_time).slice(0, 5) : "",
});

export default function CreateHolidayModal({ onClose, onSuccess, initialData = null, mode = "create" }) {
  const { t } = useTranslation("holidays");
  const { t: tFy } = useTranslation("fiscalYear");
  const fy = useFiscalYear();
  // Dates stay inside the selected financial year; in the current year a new
  // holiday starts from company "today". A past (open) year keeps its whole
  // range — the backend refuses only closed periods, not past dates.
  const minDate =
    mode === "edit"
      ? fy.range?.from
      : fy.range && fy.today > fy.range.from && fy.today <= fy.range.to
        ? fy.today
        : fy.range?.from;
  const maxDate = fy.range?.to;
  const {
    register,
    handleSubmit,
    control,
    reset,
    getValues,
    formState: { errors },
  } = useForm({
    defaultValues: initialData ? withShortTimes(initialData) : {
      holiday_name: "",
      holiday_date: "",
      holiday_type: "PUBLIC",
      description: "",
      is_global: true,
      is_optional: false,
      is_half_day: false,
      from_time: "",
      to_time: "",
      is_active: true,
    },
  });
  const isHalfDay = useWatch({ control, name: "is_half_day" });

  const [saving, setSaving] = useState(false);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // Update form if initialData changes
  useEffect(() => {
    if (mode === "edit" && initialData) {
      reset(withShortTimes(initialData));
    }
  }, [mode, initialData, reset]);

  const onSubmit = async (data) => {
    const payload = {
      holiday_name: data.holiday_name.trim(),
      holiday_date: data.holiday_date,
      holiday_type: data.holiday_type,
      description: data.description?.trim() || null,
      is_global: !!data.is_global,
      is_optional: !!data.is_optional,
      is_half_day: !!data.is_half_day,
      // Times only apply to a half-day holiday; the server clears them otherwise.
      from_time: data.is_half_day ? data.from_time : null,
      to_time: data.is_half_day ? data.to_time : null,
      is_active: !!data.is_active,
    };

    setSaving(true);
    // Static build: hand the saved row back so the caller updates its list.
    if (mode === "edit" && initialData?.id) {
      toast.success(t("toast.updated"));
      if (onSuccess) onSuccess({ ...initialData, ...payload });
    } else {
      toast.success(t("toast.created"));
      if (onSuccess) onSuccess(payload);
    }
    setSaving(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col"
        style={{ maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Fixed Header ── */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {mode === "edit" ? t("modal.editTitle") : t("modal.createTitle")}
            </h2>
            <p className="text-sm text-gray-400 mt-0.5">
              {mode === "edit"
                ? t("modal.editSubtitle")
                : t("modal.createSubtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0"
          >
            <MdClose className="text-xl" />
          </button>
        </div>

        <hr className="border-gray-100 flex-shrink-0" />

        {/* ── Form: scrollable body + fixed footer ── */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col flex-1 min-h-0"
        >
          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 custom-scrollbar">
            {/* ── Basic Information ── */}
            <div className="space-y-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                • {t("modal.detailsSection")}
              </p>

              {/* Holiday Name */}
              <div>
                <label className={labelCls}>{t("modal.holidayName")}</label>
                <input
                  onInput={removeEmojis}
                  {...register("holiday_name", { required: t("validation.nameRequired") })}
                  placeholder={t("modal.holidayNamePlaceholder")}
                  className={`${inputCls} ${errors.holiday_name ? "border-red-500" : ""}`}
                />
                {errors.holiday_name && <p className={errorCls}>{errors.holiday_name.message}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Date */}
                <div>
                  <label className={labelCls}>{t("modal.date")}</label>
                  <input
                    type="date"
                    // New holidays can't be in the past; an existing past
                    // holiday must stay editable (the browser blocks submit
                    // when the current value is below min).
                    min={minDate}
                    max={maxDate}
                    {...register("holiday_date", {
                      required: t("validation.dateRequired"),
                      validate: (v) => {
                        if (fy.range && (v < fy.range.from || v > fy.range.to))
                          return t("validation.dateInFy", { label: fy.label });
                        const closed = lockedYearOf(fy.years, v);
                        if (closed) return tFy("locked.tooltip", { label: closed.label });
                        return true;
                      },
                    })}
                    className={`${inputCls} ${errors.holiday_date ? "border-red-500" : ""}`}
                  />
                  {errors.holiday_date && <p className={errorCls}>{errors.holiday_date.message}</p>}
                </div>

                {/* Holiday Type */}
                <div>
                  <label className={labelCls}>{t("modal.holidayType")}</label>
                  <CustomDropdown
                    {...register("holiday_type")}
                    options={[
                      { label: t("types.public"), value: "PUBLIC" },
                      { label: t("types.festival"), value: "FESTIVAL" },
                      { label: t("types.national"), value: "NATIONAL" },
                      { label: t("types.company"), value: "COMPANY" },
                      { label: t("types.optional"), value: "OPTIONAL" },
                      { label: t("types.weeklyOff"), value: "WEEKLY_OFF" }
                    ]}
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className={labelCls}>{t("modal.description")}</label>
                <textarea
                  onInput={removeEmojis}
                  rows={3}
                  {...register("description")}
                  placeholder={t("modal.descriptionPlaceholder")}
                  className={`${inputCls} resize-none`}
                />
              </div>
            </div>

            {/* ── Configuration Options ── */}
            <div className="space-y-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                • {t("modal.configSection")}
              </p>

              <Controller
                name="is_global"
                control={control}
                render={({ field: { value, onChange } }) => (
                  <ToggleRow
                    checked={value}
                    onChange={onChange}
                    title={t("modal.globalTitle")}
                    subtitle={t("modal.globalSubtitle")}
                  />
                )}
              />

              <Controller
                name="is_optional"
                control={control}
                render={({ field: { value, onChange } }) => (
                  <ToggleRow
                    checked={value}
                    onChange={onChange}
                    title={t("modal.optionalTitle")}
                    subtitle={t("modal.optionalSubtitle")}
                  />
                )}
              />

              <Controller
                name="is_half_day"
                control={control}
                render={({ field: { value, onChange } }) => (
                  <ToggleRow
                    checked={value}
                    onChange={onChange}
                    title={t("modal.halfDayTitle")}
                    subtitle={t("modal.halfDaySubtitle")}
                  />
                )}
              />

              {isHalfDay && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>{t("modal.fromTime")}</label>
                    <input
                      type="time"
                      {...register("from_time", {
                        validate: (v) =>
                          !getValues("is_half_day") || !!v || t("validation.timeRequired"),
                      })}
                      className={`${inputCls} ${errors.from_time ? "border-red-500" : ""}`}
                    />
                    {errors.from_time && <p className={errorCls}>{errors.from_time.message}</p>}
                  </div>
                  <div>
                    <label className={labelCls}>{t("modal.toTime")}</label>
                    <input
                      type="time"
                      {...register("to_time", {
                        validate: (v) => {
                          if (!getValues("is_half_day")) return true;
                          if (!v) return t("validation.timeRequired");
                          const from = getValues("from_time");
                          return !from || from < v || t("validation.timeOrder");
                        },
                      })}
                      className={`${inputCls} ${errors.to_time ? "border-red-500" : ""}`}
                    />
                    {errors.to_time && <p className={errorCls}>{errors.to_time.message}</p>}
                  </div>
                </div>
              )}

              <Controller
                name="is_active"
                control={control}
                render={({ field: { value, onChange } }) => (
                  <ToggleRow
                    checked={value}
                    onChange={onChange}
                    title={t("modal.activeTitle")}
                    subtitle={t("modal.activeSubtitle")}
                  />
                )}
              />
            </div>
          </div>

          {/* ── Fixed Footer ── */}
          <hr className="border-gray-100 flex-shrink-0" />
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 px-6 py-4 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="w-full sm:w-auto px-6 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-60 transition-colors"
            >
              {t("modal.cancel")}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-700 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {saving && (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {mode === "edit" ? t("modal.update") : t("modal.create")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
