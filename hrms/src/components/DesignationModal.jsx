import React, { useEffect } from "react";
import { FiX, FiLock, FiSave } from "react-icons/fi";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import { createDesignation, updateDesignation } from "../api/designations";
import { applyFieldErrors } from "../utils/applyFieldErrors";
import { apiErrorCode, apiErrorMessage, toastApiError } from "../utils/apiError";

// 409 duplicates belong under the input they are about.
const CONFLICT_FIELDS = { DESIGNATION_NAME_TAKEN: "name", DESIGNATION_CODE_TAKEN: "code" };

function DesignationModal({ isOpen, onClose, initialData, mode = "create", departmentName = "", departmentId, onSaved }) {
  const { t } = useTranslation("employees");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: "",
      code: "",
      description: "",
      isActive: true,
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        reset(initialData);
      } else {
        reset({
          name: "",
          code: "",
          description: "",
          isActive: true,
        });
      }
    }
  }, [isOpen, initialData, reset]);

  if (!isOpen) return null;

  const onSubmit = async (data) => {
    // "" clears the code / description on edit.
    const payload = {
      name: data.name,
      code: data.code || "",
      description: data.description || "",
      status: data.isActive ? "ACTIVE" : "INACTIVE",
    };

    setIsSubmitting(true);
    try {
      const saved =
        mode === "edit"
          ? await updateDesignation(initialData.id, payload)
          : await createDesignation(departmentId, payload);
      toast.success(
        t(mode === "edit" ? "departments.designationModal.toast.updated" : "departments.designationModal.toast.created"),
      );
      if (onSaved) onSaved(saved);
      onClose();
    } catch (err) {
      const conflictField = CONFLICT_FIELDS[apiErrorCode(err)];
      if (conflictField) {
        setError(conflictField, { type: "server", message: apiErrorMessage(err) }, { shouldFocus: true });
      } else {
        const { mapped, unmapped } = applyFieldErrors(err, setError, {
          knownFields: ["name", "code", "description"],
        });
        if (!mapped.length) toastApiError(err);
        unmapped.forEach((message) => toast.error(message));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEdit = mode === "edit";
  const isView = mode === "view";
  
  const title = isView ? t("departments.designationModal.viewTitle") : isEdit ? t("departments.designationModal.editTitle") : t("departments.detail.addDesignation");
  const subtitle = isView
    ? t("departments.designationModal.viewSubtitle")
    : isEdit
      ? t("departments.designationModal.editSubtitle")
      : t("departments.designationModal.createSubtitle");
  const submitText = isEdit ? t("departments.actions.saveChanges") : t("departments.designationModal.saveDesignation");

  // Emoji validation regex rules with full field names
  const noEmojiRuleName = {
    value: /^[^\p{Emoji_Presentation}\p{Extended_Pictographic}]+$/u,
    message: t("departments.designationModal.validation.nameNoEmoji"),
  };

  const noEmojiRuleCode = {
    value: /^[^\p{Emoji_Presentation}\p{Extended_Pictographic}]+$/u,
    message: t("departments.designationModal.validation.codeNoEmoji"),
  };

  const noEmojiRuleDescription = {
    value: /^[^\p{Emoji_Presentation}\p{Extended_Pictographic}]+$/u,
    message: t("departments.validation.descriptionNoEmoji"),
  };

  // Actively block emoji insertion
  const blockEmoji = (field) => (e) => {
    const value = e.target.value;
    const stripped = value.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "");
    if (value !== stripped) {
      setValue(field, stripped, { shouldValidate: true, shouldDirty: true });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 font-sans">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-start p-6 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-gray-800">{title}</h2>
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <FiX className="text-xl" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto">
          <form id="designation-form" noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wide">
                {t("departments.detail.table.designationName")} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                disabled={isView}
                placeholder={t("departments.designationModal.namePlaceholder")}
                className={`w-full border p-2.5 rounded-md focus:outline-none focus:ring-1 focus:ring-[#17A2B8] text-sm ${
                  errors.name ? "border-red-500" : "border-gray-200"
                } ${isView ? "bg-gray-50 cursor-not-allowed text-gray-500" : ""}`}
                {...register("name", {
                  required: t("departments.designationModal.validation.nameRequired"),
                  minLength: {
                    value: 2,
                    message: t("departments.designationModal.validation.nameMin"),
                  },
                  maxLength: {
                    value: 150,
                    message: t("departments.designationModal.validation.nameMax"),
                  },
                  pattern: noEmojiRuleName,
                  onChange: blockEmoji("name"),
                })}
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wide">
                  {t("departments.designationModal.code")}
                </label>
                <input
                  type="text"
                  disabled={isView}
                  placeholder={t("departments.designationModal.codePlaceholder")}
                  className={`w-full border p-2.5 rounded-md focus:outline-none focus:ring-1 focus:ring-[#17A2B8] text-sm ${
                    errors.code ? "border-red-500" : "border-gray-200"
                  } ${isView ? "bg-gray-50 cursor-not-allowed text-gray-500" : ""}`}
                  {...register("code", {
                    maxLength: {
                      value: 50,
                      message: t("departments.designationModal.validation.codeMax"),
                    },
                    pattern: noEmojiRuleCode,
                    onChange: blockEmoji("code"),
                  })}
                />
                {errors.code && <p className="text-red-500 text-xs mt-1">{errors.code.message}</p>}
              </div>
              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wide">
                  {t("departments.fields.department")}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={departmentName}
                    disabled
                    className="w-full border border-gray-200 bg-[#F8F9FA] text-gray-500 p-2.5 rounded-md text-sm cursor-not-allowed"
                  />
                  <FiLock className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wide">
                {t("departments.fields.description")}
              </label>
              <textarea
                rows="3"
                disabled={isView}
                maxLength={2000}
                placeholder={t("departments.designationModal.descriptionPlaceholder")}
                className={`w-full border p-2.5 rounded-md focus:outline-none focus:ring-1 focus:ring-[#17A2B8] text-sm resize-none ${
                  errors.description ? "border-red-500" : "border-gray-200"
                } ${isView ? "bg-gray-50 cursor-not-allowed text-gray-500" : ""}`}
                {...register("description", {
                  maxLength: {
                    value: 2000,
                    message: t("departments.validation.descriptionMax"),
                  },
                  pattern: noEmojiRuleDescription,
                  onChange: blockEmoji("description"),
                })}
              ></textarea>
              {errors.description && (
                <p className="text-red-500 text-xs mt-1">{errors.description.message}</p>
              )}
            </div>

            <div className="bg-[#F8F9FA] p-4 rounded-lg flex items-center justify-between border border-gray-100">
              <div>
                <h4 className="text-sm font-semibold text-gray-800">{t("departments.fields.activeStatus")}</h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  {t("departments.designationModal.activeStatusHint")}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  disabled={isView}
                  className="sr-only peer"
                  {...register("isActive")}
                />
                <div className={`w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${isView ? "opacity-60 cursor-not-allowed" : ""} peer-checked:bg-[#17A2B8]`}></div>
              </label>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-100 bg-[#F8F9FA] rounded-b-xl flex gap-4">
          <button
            type="button"
            onClick={onClose}
            className={`${isView ? "w-full" : "flex-1"} py-2.5 px-4 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors text-sm font-medium`}
          >
            {isView ? t("departments.actions.close") : t("departments.actions.cancel")}
          </button>
          {!isView && (
            <button
              type="submit"
              form="designation-form"
              disabled={isSubmitting}
              className="flex-1 py-2.5 px-4 bg-[#17A2B8] text-white rounded-md hover:bg-[#138496] transition-colors text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <svg className="w-4 h-4 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <FiSave className="text-base" />
              )}
              {submitText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default DesignationModal;
