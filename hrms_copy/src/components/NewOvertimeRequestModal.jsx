import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import { MdClose, MdOutlineError } from "react-icons/md";

import { OT_buildRequest, OT_hoursBetween, OT_nextId } from "../data/groupD";
import { getStaticUser } from "../data/session";
import useFiscalYear from "../hooks/useFiscalYear";
import useYearLock from "../hooks/useYearLock";
import { closedDateRule } from "../utils/fyValidation/ops-time";

const inputBase =
  "w-full px-4 py-3 border rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#17a2b8] focus:border-transparent transition";

const inputCls = (err) =>
  `${inputBase} ${err ? "border-red-300 bg-red-50" : "border-gray-200 bg-white"}`;

const labelCls =
  "block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5";

const FieldErr = ({ error }) =>
  error ? (
    <p className="flex items-center gap-1 text-xs text-red-500 mt-1.5">
      <MdOutlineError className="text-sm flex-shrink-0" />
      {error.message}
    </p>
  ) : null;

export default function NewOvertimeRequestModal({ isOpen, onClose, onSuccess, editData }) {
  const { t } = useTranslation("attendance");
  const fy = useFiscalYear();
  const lock = useYearLock();
  const submitting = false;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm({
    defaultValues: { work_date: "", start_time: "", end_time: "", reason: "" },
  });

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      if (editData) {
        reset({
          work_date: editData.work_date ? editData.work_date.substring(0, 10) : "",
          start_time: editData.start_time || "",
          end_time: editData.end_time || "",
          reason: editData.reason || "",
        });
      } else {
        reset({ work_date: "", start_time: "", end_time: "", reason: "" });
      }
    } else {
      document.body.style.overflow = "";
      reset();
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen, reset, editData]);

  if (!isOpen) return null;

  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget && !submitting) onClose();
  };

  const onSubmit = (data) => {
    // No employee picked → the request belongs to the logged-in user.
    const fields = {
      work_date: data.work_date,
      start_time: data.start_time,
      end_time: data.end_time,
      reason: data.reason,
    };
    const row = editData
      ? { ...editData, ...fields, overtime_hours: OT_hoursBetween(fields.start_time, fields.end_time) }
      : OT_buildRequest(OT_nextId(), { ...fields, employee_id: getStaticUser().employee_id || 1 });

    toast.success(t("overtimeModal.submitted"));
    reset();
    onClose();
    onSuccess?.(row);
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={handleBackdrop}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col"
        style={{ maxHeight: "90vh" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {editData ? t("overtimeModal.editTitle") : t("overtimeModal.newTitle")}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {editData 
                ? t("overtimeModal.editSubtitle")
                : t("overtimeModal.newSubtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0 disabled:opacity-50"
          >
            <MdClose className="text-xl" />
          </button>
        </div>

        <hr className="border-gray-100 flex-shrink-0" />

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
            {/* Work Date */}
            <div>
              <label className={labelCls}>{t("overtimeModal.workDate")}</label>
              <input
                type="date"
                min={editData ? undefined : fy.range?.from}
                max={editData ? undefined : fy.range?.to}
                {...register("work_date", {
                  required: t("overtimeModal.workDateRequired"),
                  validate: { closed: closedDateRule(t, lock, fy.years) },
                })}
                className={inputCls(errors.work_date)}
              />
              <FieldErr error={errors.work_date} />
            </div>

            {/* Start and End Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className={labelCls}>{t("common.startTime")}</label>
                <input
                  type="time"
                  {...register("start_time", { required: t("overtimeModal.startTimeRequired") })}
                  className={inputCls(errors.start_time)}
                />
                <FieldErr error={errors.start_time} />
              </div>
              <div>
                <label className={labelCls}>{t("common.endTime")}</label>
                <input
                  type="time"
                  {...register("end_time", {
                    required: t("overtimeModal.endTimeRequired"),
                    // Same rule as the backend: the end must be after the
                    // start on the same day (no overnight requests).
                    validate: (v, values) =>
                      !values.start_time || v > values.start_time || t("common.endAfterStart"),
                  })}
                  className={inputCls(errors.end_time)}
                />
                <FieldErr error={errors.end_time} />
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className={labelCls}>{t("common.reason")}</label>
              <textarea
                rows={3}
                {...register("reason", {
                  required: t("common.reasonRequired"),
                  pattern: {
                    // Letters/digits in any language (Arabic included) + Arabic punctuation.
                    value: /^[\p{L}\p{M}\p{N}\s.,!?'\-،؟؛]+$/u,
                    message: t("common.specialChars"),
                  },
                })}
                onInput={(e) => {
                  e.target.value = e.target.value.replace(/[^\p{L}\p{M}\p{N}\s.,!?'\-،؟؛]/gu, "");
                }}
                placeholder={t("overtimeModal.reasonPlaceholder")}
                className={`${inputCls(errors.reason)} resize-none`}
              />
              <FieldErr error={errors.reason} />
            </div>

            {/* Attachment */}
            <div>
              <label className={labelCls}>
                {t("common.attachment")}{" "}
                <span className="text-gray-400 font-normal normal-case">{t("common.optional")}</span>
              </label>
              <input
                type="file"
                {...register("attachment")}
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-cyan-50 file:text-cyan-700 hover:file:bg-cyan-100 transition-all cursor-pointer border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          {/* Footer */}
          <hr className="border-gray-100 flex-shrink-0" />
          <div className="flex justify-end gap-3 px-6 py-4 flex-shrink-0 bg-gray-50/50 rounded-b-2xl">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-6 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 text-sm font-bold text-white bg-[#17a2b8] rounded-lg hover:bg-[#138496] transition-colors shadow-sm disabled:opacity-50"
            >
              {submitting ? (editData ? t("common.updating") : t("common.submitting")) : (editData ? t("common.updateRequest") : t("common.submitRequest"))}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
