import React, { useState } from "react";
import { MdClose } from "react-icons/md";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";

import useFiscalYear from "../hooks/useFiscalYear";
import useYearLock from "../hooks/useYearLock";
import { closedDateRule } from "../utils/fyValidation/ops-time";

export default function CorrectionRequestModal({ isOpen, onClose, onSuccess, editData, viewData }) {
  const { t } = useTranslation("attendance");
  const fy = useFiscalYear();
  const lock = useYearLock();
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm();
  const startTime = watch("start_time");
  const endTime = watch("end_time");

  // Helper to format DB datetime string (like "2026-07-01T09:00:00.000Z") to "HH:mm"
  const extractTime = (isoString) => {
    if (!isoString) return "";
    try {
      const dt = new Date(isoString);
      if (isNaN(dt.getTime())) return "";
      const hrs = String(dt.getUTCHours()).padStart(2, "0");
      const mins = String(dt.getUTCMinutes()).padStart(2, "0");
      return `${hrs}:${mins}`;
    } catch {
      return "";
    }
  };

  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      const dataToLoad = editData || viewData;
      if (dataToLoad) {
        reset({
          correction_date: dataToLoad.work_date ? dataToLoad.work_date.substring(0, 10) : "",
          start_time: extractTime(dataToLoad.requested_check_in),
          end_time: extractTime(dataToLoad.requested_check_out),
          reason: dataToLoad.reason || "",
        });
      } else {
        reset({ correction_date: "", start_time: "", end_time: "", reason: "" });
      }
    } else {
      document.body.style.overflow = "";
      reset();
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen, reset, editData, viewData]);

  if (!isOpen) return null;

  const close = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const onSubmitForm = (data) => {
    // A check-out before the check-in is the next morning (night shift) —
    // allowed; identical times are not.
    setSubmitting(true);
    // Static build: build the saved request locally (times stored as UTC
    // wall-clock, like the API returns them) and hand it to the parent.
    const file = data.attachment?.[0] || null;
    const saved = {
      ...(editData || {
        id: Date.now(),
        employee_id: null,
        status: "PENDING",
        attachment_url: null,
        current_level: 1,
        levels_summary: [
          { level_no: 1, total: 1, approved: 0, pending: 1 },
          { level_no: 2, total: 1, approved: 0, pending: 1 },
        ],
        created_at: new Date().toISOString(),
      }),
      work_date: data.correction_date,
      requested_check_in: `${data.correction_date}T${data.start_time}:00.000Z`,
      requested_check_out: `${data.correction_date}T${data.end_time}:00.000Z`,
      reason: data.reason,
      ...(file ? { attachment_url: `uploads/corrections/${file.name}` } : {}),
    };
    toast.success(t("correctionModal.submitted"));
    reset();
    onClose();
    onSuccess?.(saved);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            {viewData ? t("correctionModal.detailsTitle") : editData ? t("correctionModal.editTitle") : t("correctionModal.newTitle")}
          </h2>
          <button
            onClick={close}
            disabled={submitting}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
          >
            <MdClose className="text-xl" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmitForm)} noValidate className="p-5 overflow-y-auto custom-scrollbar flex-1">
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">{t("correctionModal.correctionDate")}</label>
                <input
                  type="date"
                  disabled={!!viewData}
                  min={editData || viewData ? undefined : fy.range?.from}
                  max={editData || viewData ? undefined : fy.range?.to}
                  {...register("correction_date", {
                    required: t("correctionModal.correctionDateRequired"),
                    validate: { closed: closedDateRule(t, lock, fy.years) },
                  })}
                  className={`w-full border rounded-lg px-4 py-2.5 text-sm outline-none transition ${errors.correction_date ? 'border-red-500 focus:ring-2 focus:ring-red-500' : 'border-gray-300 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500'} ${viewData ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
                />
                {errors.correction_date && <p className="text-red-500 text-xs mt-1">{errors.correction_date.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">{t("common.startTime")}</label>
                  <input
                    type="time"
                    disabled={!!viewData}
                    {...register("start_time", { required: t("correctionModal.required") })}
                    className={`w-full border rounded-lg px-3 py-2.5 text-sm outline-none transition ${errors.start_time ? 'border-red-500 focus:ring-2 focus:ring-red-500' : 'border-gray-300 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500'} ${viewData ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
                  />
                  {errors.start_time && <p className="text-red-500 text-xs mt-1">{errors.start_time.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">{t("common.endTime")}</label>
                  <input
                    type="time"
                    disabled={!!viewData}
                    {...register("end_time", {
                      required: t("correctionModal.required"),
                      validate: (v, values) => v !== values.start_time || t("common.sameStartEnd"),
                    })}
                    className={`w-full border rounded-lg px-3 py-2.5 text-sm outline-none transition ${errors.end_time ? 'border-red-500 focus:ring-2 focus:ring-red-500' : 'border-gray-300 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500'} ${viewData ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
                  />
                  {errors.end_time && <p className="text-red-500 text-xs mt-1">{errors.end_time.message}</p>}
                  {!errors.end_time && startTime && endTime && endTime < startTime && (
                    <p className="text-amber-600 text-xs mt-1">{t("common.endsNextDay")}</p>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">{t("common.reason")}</label>
              <textarea
                rows={3}
                placeholder={t("correctionModal.reasonPlaceholder")}
                disabled={!!viewData}
                {...register("reason", {
                  required: t("common.reasonRequired"),
                  pattern: {
                    // Letters/digits in any language (Arabic included) + Arabic punctuation.
                    value: /^[\p{L}\p{M}\p{N}\s.,!?'\-،؟؛]+$/u,
                    message: t("common.specialChars")
                  }
                })}
                onInput={(e) => {
                  e.target.value = e.target.value.replace(/[^\p{L}\p{M}\p{N}\s.,!?'\-،؟؛]/gu, "");
                }}
                className={`w-full border rounded-lg px-4 py-3 text-sm resize-none outline-none transition ${errors.reason ? 'border-red-500 focus:ring-2 focus:ring-red-500' : 'border-gray-300 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500'} ${viewData ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
              />
              {errors.reason && <p className="text-red-500 text-xs mt-1">{errors.reason.message}</p>}
            </div>

            {!viewData && (
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">{t("common.attachment")} <span className="text-gray-400 font-normal normal-case">{t("common.optional")}</span></label>
                <input
                  type="file"
                  {...register("attachment")}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-cyan-50 file:text-cyan-700 hover:file:bg-cyan-100 transition-all cursor-pointer border border-gray-300 rounded-lg"
                />
              </div>
            )}
            
            {viewData && viewData.attachment_url && (
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">{t("common.attachment")}</label>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    toast.info(t("correctionModal.viewAttachment"));
                  }}
                  className="text-cyan-600 hover:underline text-sm font-medium"
                >
                  {t("correctionModal.viewAttachment")}
                </a>
              </div>
            )}
          </div>

          <div className="mt-8 flex items-center justify-end gap-3 border-t border-gray-100 pt-5">
            <button
              type="button"
              onClick={close}
              disabled={submitting}
              className="px-5 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
            >
              {viewData ? t("common.close") : t("common.cancel")}
            </button>
            {!viewData && (
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 text-sm font-bold bg-[#17a2b8] hover:bg-[#138496] text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {submitting ? (editData ? t("common.updating") : t("common.submitting")) : (editData ? t("common.updateRequest") : t("common.submitRequest"))}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
