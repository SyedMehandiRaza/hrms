import { useEffect, useState } from "react";
import { MdClose } from "react-icons/md";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import { createSalaryComponent, updateSalaryComponent } from "../api/salaryComponents";
import { applyFieldErrors } from "../utils/applyFieldErrors";
import { apiErrorCode, apiErrorMessage, toastApiError } from "../utils/apiError";
import CustomDropdown from "./CustomDropdown";

const labelCls = "block text-[13px] text-gray-700 mb-1.5";
const inputCls = "w-full border border-gray-200 bg-white rounded-lg px-4 py-2.5 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition disabled:bg-gray-50 disabled:text-gray-500";
const errorCls = "text-[11px] text-red-500 mt-1";

const removeEmojis = (e) => {
  const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
  if (emojiRegex.test(e.target.value)) {
    e.target.value = e.target.value.replace(emojiRegex, "");
  }
};

export default function SalaryComponentModal({ isOpen, onClose, mode = "create", initialData = null, onSuccess }) {
  const { t } = useTranslation("payroll");
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, reset, control, setError, formState: { errors } } = useForm({
    defaultValues: {
      name: "",
      type: "",
      status: "ACTIVE",
      description: ""
    }
  });

  const typeValue = useWatch({ control, name: "type" });
  const statusValue = useWatch({ control, name: "status" });

  useEffect(() => {
    if (isOpen) {
      if (mode === "edit" || mode === "view") {
        reset(initialData || {});
      } else {
        reset({ name: "", type: "", status: "ACTIVE", description: "" });
      }
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen, mode, initialData, reset]);

  if (!isOpen) return null;

  const isView = mode === "view";

  const onSubmit = async (data) => {
    if (isView) {
      onClose();
      return;
    }
    const payload = {
      name: data.name?.trim(),
      type: data.type,
      description: data.description?.trim() || "",
    };

    setSaving(true);
    try {
      if (mode === "edit") await updateSalaryComponent(initialData?.id, { ...payload, status: data.status });
      else await createSalaryComponent(payload);
    } catch (err) {
      setSaving(false);
      const code = apiErrorCode(err);
      // 409 SALARY_COMPONENT_NAME_TAKEN belongs under the name; TYPE_LOCKED under the type.
      if (code === "SALARY_COMPONENT_NAME_TAKEN" || code === "SALARY_COMPONENT_TYPE_LOCKED") {
        setError(code === "SALARY_COMPONENT_NAME_TAKEN" ? "name" : "type", { type: "server", message: apiErrorMessage(err) }, { shouldFocus: true });
        return;
      }
      const { mapped } = applyFieldErrors(err, setError, { knownFields: ["name", "type", "description", "status"] });
      if (!mapped.length) toastApiError(err);
      return;
    }
    setSaving(false);
    toast.success(mode === "edit" ? t("componentModal.toast.updated") : t("componentModal.toast.created"));
    onSuccess?.();
    onClose();
  };

  const getTitle = () => {
    if (mode === "edit") return t("componentModal.titleEdit");
    if (mode === "view") return t("componentModal.titleView");
    return t("componentModal.titleCreate");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-gray-200">
          <div>
            <h2 className="text-[17px] font-bold text-gray-900">{getTitle()}</h2>
            <p className="text-[13px] text-gray-500 mt-1">
              {t("componentModal.subtitle")}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
            <MdClose className="text-xl" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col">
          <div className="p-6 space-y-5">
            <div>
              <label className={labelCls}>{t("componentModal.name")}</label>
              <input
                onInput={removeEmojis}
                {...register("name", { required: t("componentModal.nameRequired") })}
                placeholder={t("componentModal.namePlaceholder")}
                className={`${inputCls} ${errors.name ? "border-red-500 focus:ring-red-500" : ""}`}
                disabled={isView}
              />
              {errors.name && <p className={errorCls}>{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className={labelCls}>{t("componentModal.type")}</label>
                <CustomDropdown
                  {...register("type", { required: t("componentModal.typeRequired") })}
                  value={typeValue}
                  disabled={isView}
                  error={!!errors.type}
                  options={[
                    { label: t("componentModal.selectType"), value: "" },
                    { label: t("componentType.EARNING"), value: "EARNING" },
                    { label: t("componentType.DEDUCTION"), value: "DEDUCTION" }
                  ]}
                />
                {errors.type && <p className={errorCls}>{errors.type.message}</p>}
              </div>

              <div>
                <label className={labelCls}>{t("componentModal.status")}</label>
                <CustomDropdown
                  {...register("status", { required: t("componentModal.statusRequired") })}
                  value={statusValue}
                  disabled={isView}
                  error={!!errors.status}
                  options={[
                    { label: t("componentStatus.ACTIVE"), value: "ACTIVE" },
                    { label: t("componentStatus.INACTIVE"), value: "INACTIVE" }
                  ]}
                />
                {errors.status && <p className={errorCls}>{errors.status.message}</p>}
              </div>
            </div>

            <div>
              <label className={labelCls}>{t("componentModal.description")}</label>
              <textarea
                onInput={removeEmojis}
                {...register("description")}
                placeholder={t("componentModal.descriptionPlaceholder")}
                rows={4}
                className={`${inputCls} resize-none`}
                disabled={isView}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="bg-[#f8f9fa] px-6 py-4 flex justify-end gap-3 border-t border-gray-100">
            {isView ? (
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 text-sm font-medium text-gray-700 border border-gray-300 bg-white rounded-lg hover:bg-gray-50 transition-colors"
              >
                {t("componentModal.close")}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2 text-sm font-medium text-gray-700 border border-gray-300 bg-white rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {t("componentModal.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 text-sm font-medium text-white bg-[#17A2B8] hover:bg-[#0c4ab5] rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {saving ? t("componentModal.saving") : mode === "edit" ? t("componentModal.update") : t("componentModal.create")}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
