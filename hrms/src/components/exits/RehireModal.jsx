import { useMemo } from "react";
import useApiQuery from "../../hooks/useApiQuery";
import useFiscalYear from "../../hooks/useFiscalYear";
import { listProjects } from "../../api/projects";
import { rehireExit } from "../../api/exits";
import { apiErrorMessage } from "../../utils/apiError";
import { serverErrors } from "../../utils/applyFieldErrors";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { MdClose, MdOutlineInfo } from "react-icons/md";

import { exitRules, diffDays } from "../../utils/exitValidation";
import { useFormat } from "../../hooks/useFormat";
import FieldError from "../FieldError";
import CustomDropdown from "../CustomDropdown";

// Bring an exited employee back (D67): same Employee ID. Allowed only when rehire-eligible and on
// or after the cooling period's end; the server answers both.
export default function RehireModal({ exit, onClose, onRehired }) {
  const { t } = useTranslation("exits");
  const { fmtDate } = useFormat();
  const allowedFrom = exit?.rehire?.allowed_from || null;
  const eligible = !!exit?.rehire?.eligible;
  const today = useFiscalYear().today;
  const beforeAllowed = !!allowedFrom && diffDays(today, allowedFrom) < 0;
  // The cooling period is the server's answer (REHIRE_NOT_ALLOWED), so it isn't pre-checked here.
  const R = exitRules(t);

  // Active projects (the rehire's main project); none = keep the previous main project.
  const { data: projectData } = useApiQuery(() => listProjects({ limit: 100, status: "ACTIVE" }).catch(() => null), []);
  const projects = useMemo(() => projectData?.items || [], [projectData]);

  const projectOptions = useMemo(
    () => [
      { value: "", label: t("rehireModal.noProject") },
      ...projects.map((p) => ({ value: String(p.id), label: p.name || t("rehireModal.projectFallback", { id: p.id }) })),
    ],
    [projects, t],
  );

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: { rehire_date: beforeAllowed ? allowedFrom : today, project_id: "" },
  });
  const hasErrors = Object.keys(errors).length > 0;

  const onSubmit = async (values) => {
    let rehired;
    try {
      rehired = await rehireExit(exit.id, {
        rehireDate: String(values.rehire_date).trim(),
        ...(values.project_id ? { mainProjectId: values.project_id } : {}),
      });
    } catch (err) {
      // Field errors under their input; eligibility and cooling (409) under the date.
      const rows = serverErrors(err);
      const project = rows.find((r) => r.field === "mainProjectId");
      const date = rows.find((r) => r.field === "rehireDate");
      if (project) setError("project_id", { type: "server", message: project.message });
      if (date || !rows.length) setError("rehire_date", { type: "server", message: date?.message || apiErrorMessage(err) }, { shouldFocus: true });
      if (rows.length && !project && !date) toast.error(rows[0].message);
      return;
    }
    toast.success(t("rehireModal.done", { name: exit?.employee?.full_name || "" }));
    onRehired?.(rehired);
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="w-full max-w-md bg-white rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-gray-900">{t("rehireModal.title")}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{exit?.employee?.full_name}</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors" aria-label={t("common.close")}>
            <MdClose className="text-xl" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {!eligible ? (
            <Note tone="gray">{t("rehireModal.notEligible")}</Note>
          ) : (
            beforeAllowed && <Note tone="amber">{t("rehireModal.beforeAllowed", { date: fmtDate(allowedFrom) })}</Note>
          )}

          {/* The form shows even when not eligible: the server gives the reason. */}
          <>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("rehireModal.rehireDate")}</label>
                <input
                  type="date"
                  {...register("rehire_date", R.rehire_date)}
                  className={`w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${
                    errors.rehire_date ? "border-red-400 bg-red-50" : "border-gray-200 bg-white"
                  }`}
                />
                <FieldError error={errors.rehire_date} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  {t("rehireModal.project")} <span className="font-normal text-gray-400">({t("rehireModal.optional")})</span>
                </label>
                <Controller
                  name="project_id"
                  control={control}
                  rules={R.project_id}
                  render={({ field }) => (
                    <CustomDropdown
                      name={field.name}
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                      onBlur={field.onBlur}
                      options={projectOptions}
                      placeholder={t("rehireModal.noProject")}
                      error={!!errors.project_id}
                      isSearchable
                    />
                  )}
                />
                <FieldError error={errors.project_id} />
                {!errors.project_id && <p className="text-[11px] text-gray-400 mt-1">{t("rehireModal.projectHint")}</p>}
              </div>
          </>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-2 bg-gray-50/50 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50"
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            disabled={isSubmitting || hasErrors}
            className="px-5 py-2 text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? t("rehireModal.rehiring") : t("rehireModal.confirm")}
          </button>
        </div>
      </form>
    </div>
  );
}

function Note({ tone, children }) {
  const cls = tone === "amber" ? "bg-amber-50 border-amber-100 text-amber-700" : "bg-gray-50 border-gray-200 text-gray-600";
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs ${cls}`}>
      <MdOutlineInfo className="text-base shrink-0 mt-px" />
      <span>{children}</span>
    </div>
  );
}
