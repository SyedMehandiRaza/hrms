import React, { useEffect } from "react";
import { FiX } from "react-icons/fi";
import { useForm } from "react-hook-form";
import { createDocumentType, updateDocumentType } from "../data/groupB";
import { toast } from "react-toastify";
import CustomDropdown from "./CustomDropdown";
import { useTranslation } from "react-i18next";

function CreateDocumentTypeModal({ isOpen, onClose, onSuccess, initialData, mode = "create" }) {
  const { t } = useTranslation("documents");
  const [isSubmitting] = React.useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      code: "",
      label: "",
      category: "GENERAL",
      description: "",
      requires_expiry: false,
      requires_issuer: false,
      status: "ACTIVE",
    },
  });

  const categoryValue = watch("category");
  const statusValue = watch("status");

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        reset(initialData);
      } else {
        reset({
          code: "",
          label: "",
          category: "GENERAL",
          description: "",
          requires_expiry: false,
          requires_issuer: false,
          status: "ACTIVE",
        });
      }
    }
  }, [isOpen, initialData, reset]);

  if (!isOpen) return null;

  const onSubmit = (data) => {
    let payload;
    if (mode === "edit") {
      payload = {
        code: data.code,
        label: data.label,
        category: data.category,
        description: data.description,
        requires_expiry: data.requires_expiry,
        requires_issuer: data.requires_issuer,
        is_active: data.status === "ACTIVE",
      };
    } else {
      payload = {
        code: data.code,
        label: data.label,
        category: data.category,
        description: data.description,
        requires_expiry: data.requires_expiry,
        requires_issuer: data.requires_issuer,
        status: data.status,
      };
    }

    // Static build: the catalog lives in memory (src/data/groupB.js).
    if (mode === "edit") {
      updateDocumentType(initialData.id, payload);
      toast.success(t("typeModal.toasts.updated"));
      onClose();
    } else {
      createDocumentType(payload);
      // toast.success("Document type created successfully"); // Commenting out toast since we use a SuccessModal now
      if (onSuccess) onSuccess();
      else onClose();
    }
  };

  const isEdit = mode === "edit";
  const isView = mode === "view";

  const title = isView ? t("typeModal.viewTitle") : isEdit ? t("typeModal.editTitle") : t("typeModal.createTitle");
  const subtitle = isView
    ? t("typeModal.viewSubtitle")
    : isEdit
      ? t("typeModal.editSubtitle")
      : t("typeModal.createSubtitle");
  const submitText = isEdit ? t("typeModal.saveChanges") : t("typeModal.createTitle");

  // Emoji validation regex rule
  const noEmojiRule = {
    value: /^[^\p{Emoji_Presentation}\p{Extended_Pictographic}]+$/u,
    message: t("typeModal.validation.noEmoji"),
  };

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
        <div className="p-6 overflow-y-auto custom-scrollbar">
          <form id="document-type-form" onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wide">
                {t("typeModal.nameLabel")} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                disabled={isView}
                placeholder={t("typeModal.namePlaceholder")}
                className={`w-full border p-2.5 rounded-md focus:outline-none focus:ring-1 focus:ring-[#14a0b3] text-sm ${errors.label ? "border-red-500" : "border-gray-200"
                  } ${isView ? "bg-gray-50 cursor-not-allowed text-gray-500" : ""}`}
                {...register("label", {
                  required: t("typeModal.validation.nameRequired"),
                  pattern: noEmojiRule,
                  onChange: blockEmoji("label"),
                })}
              />
              {errors.label && <p className="text-red-500 text-xs mt-1">{errors.label.message}</p>}
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wide">
                  {t("typeModal.codeLabel")} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  disabled={isView}
                  placeholder={t("typeModal.codePlaceholder")}
                  className={`w-full border p-2.5 rounded-md focus:outline-none focus:ring-1 focus:ring-[#14a0b3] text-sm ${errors.code ? "border-red-500" : "border-gray-200"
                    } ${isView ? "bg-gray-50 cursor-not-allowed text-gray-500" : ""}`}
                  {...register("code", {
                    required: t("typeModal.validation.codeRequired"),
                    pattern: noEmojiRule,
                    onChange: blockEmoji("code"),
                  })}
                />
                {errors.code && <p className="text-red-500 text-xs mt-1">{errors.code.message}</p>}
              </div>
              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wide">
                  {t("types.table.category")}
                </label>
                <CustomDropdown
                  disabled={isView}
                  {...register("category")}
                  value={categoryValue}
                  error={!!errors.category}
                  options={[
                    { label: t("categories.GENERAL"), value: "GENERAL" },
                    { label: t("categories.LEGAL"), value: "LEGAL" },
                    { label: t("categories.IDENTITY"), value: "IDENTITY" },
                    { label: t("categories.PROFESSIONAL"), value: "PROFESSIONAL" },
                    { label: t("categories.SITE"), value: "SITE" },
                    { label: t("categories.CONTRACT"), value: "CONTRACT" }
                  ]}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wide">
                {t("types.table.description")}
              </label>
              <textarea
                rows="3"
                disabled={isView}
                placeholder={t("typeModal.descriptionPlaceholder")}
                className={`w-full border p-2.5 rounded-md focus:outline-none focus:ring-1 focus:ring-[#14a0b3] text-sm resize-none ${errors.description ? "border-red-500" : "border-gray-200"
                  } ${isView ? "bg-gray-50 cursor-not-allowed text-gray-500" : ""}`}
                {...register("description", {
                  pattern: noEmojiRule,
                  onChange: blockEmoji("description"),
                })}
              ></textarea>
              {errors.description && (
                <p className="text-red-500 text-xs mt-1">{errors.description.message}</p>
              )}
            </div>

            <div className="flex gap-4">
              <div className="flex-1 bg-[#F8F9FA] p-3 rounded-lg flex items-center justify-between border border-gray-100">
                <div>
                  <h4 className="text-sm font-semibold text-gray-800">{t("typeModal.requiresExpiry")}</h4>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={isView}
                    className="sr-only peer"
                    {...register("requires_expiry")}
                  />
                  <div className={`w-9 h-5 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all ${isView ? "opacity-60 cursor-not-allowed" : ""} peer-checked:bg-[#14a0b3]`}></div>
                </label>
              </div>

              <div className="flex-1 bg-[#F8F9FA] p-3 rounded-lg flex items-center justify-between border border-gray-100">
                <div>
                  <h4 className="text-sm font-semibold text-gray-800">{t("typeModal.requiresIssuer")}</h4>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={isView}
                    className="sr-only peer"
                    {...register("requires_issuer")}
                  />
                  <div className={`w-9 h-5 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all ${isView ? "opacity-60 cursor-not-allowed" : ""} peer-checked:bg-[#14a0b3]`}></div>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wide">
                {t("list.status")}
              </label>
              <CustomDropdown
                disabled={isView}
                {...register("status")}
                value={statusValue}
                options={[
                  { label: t("types.active"), value: "ACTIVE" },
                  { label: t("types.inactive"), value: "INACTIVE" }
                ]}
              />
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
            {isView ? t("typeModal.close") : t("add.cancel")}
          </button>
          {!isView && (
            <button
              type="submit"
              form="document-type-form"
              disabled={isSubmitting}
              className="flex-1 py-2.5 px-4 bg-[#14a0b3] text-white rounded-md hover:bg-[#118898] transition-colors text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <svg className="w-4 h-4 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : null}
              {submitText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default CreateDocumentTypeModal;
