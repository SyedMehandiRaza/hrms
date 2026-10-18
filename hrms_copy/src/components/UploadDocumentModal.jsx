import { useEffect, useState } from "react";
import { FiX } from "react-icons/fi";
import { useForm } from "react-hook-form";
import { groupedDocumentTypes, uploadDocument } from "../data/groupB";
import { toast } from "react-toastify";
import { MdOutlineCloudUpload, MdOutlineDescription, MdOutlineDelete } from "react-icons/md";
import { useTranslation } from "react-i18next";

// `replaceDoc` (optional) switches the modal to "replace": the new file
// supersedes that document (replace_document_id) and keeps its type, so no
// type is picked; the form is prefilled from it. Expected shape: the flat
// document row ({ id, document_type_id, document_type, document_number,
// issuing_authority, issue_date, expiry_date }).
function UploadDocumentModal({ isOpen, onClose, onSuccess, employeeId, documents = [], replaceDoc = null }) {
  const { t } = useTranslation("documents");
  const [isSubmitting] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [dragging, setDragging] = useState(false);

  const documentTypes = groupedDocumentTypes();

  const {
    register,
    handleSubmit,
    reset,
    getValues,
    trigger,
    formState: { errors },
  } = useForm({
    defaultValues: {
      documentTypeId: "",
      issueDate: "",
      expiryDate: "",
      issuingAuthority: "",
      referenceNumber: "",
    },
  });

  useEffect(() => {
    if (isOpen) {
      reset(
        replaceDoc
          ? {
            documentTypeId: replaceDoc.document_type_id ? String(replaceDoc.document_type_id) : "",
            issueDate: replaceDoc.issue_date || "",
            expiryDate: replaceDoc.expiry_date || "",
            issuingAuthority: replaceDoc.issuing_authority || "",
            referenceNumber: replaceDoc.document_number || "",
          }
          : undefined,
      );
    }
  }, [isOpen, reset, replaceDoc]);

  // A fresh open starts without a picked file.
  const [openKey, setOpenKey] = useState(null);
  const currentOpenKey = isOpen ? `open:${replaceDoc?.id ?? "new"}` : null;
  if (openKey !== currentOpenKey) {
    setOpenKey(currentOpenKey);
    if (currentOpenKey) setUploadedFile(null);
  }

  if (!isOpen) return null;

  const handleFileDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer?.files?.[0] || e.target?.files?.[0];
    if (file) {
      setUploadedFile({
        name: file.name,
        size: (file.size / (1024 * 1024)).toFixed(1) + " MB",
        status: "COMPLETE",
        file: file,
      });
    }
  };

  const onSubmit = (data) => {
    if (!uploadedFile?.file) {
      toast.error(t("add.toasts.fileRequired"));
      return;
    }
    if (!employeeId) {
      toast.error(t("uploadModal.toasts.userMissing"));
      return;
    }

    const isDuplicate = !replaceDoc && documents?.some((doc) => {
      const typeIdStr = String(doc.document_type_id || doc.type?.id || doc.document_type?.id || "");
      return typeIdStr === String(data.documentTypeId);
    });

    if (isDuplicate) {
      toast.error(t("uploadModal.toasts.duplicate"));
      return;
    }

    // Static build: the document is added to the in-memory store.
    const created = uploadDocument({
      employeeId,
      documentTypeId: replaceDoc ? undefined : data.documentTypeId,
      replaceDocumentId: replaceDoc ? replaceDoc.id : undefined,
      documentNumber: data.referenceNumber,
      issuingAuthority: data.issuingAuthority,
      issueDate: data.issueDate,
      expiryDate: data.expiryDate,
      fileName: uploadedFile.file.name,
    });
    toast.success(t(replaceDoc ? "uploadModal.toasts.replaced" : "uploadModal.toasts.uploaded"));
    if (onSuccess) onSuccess(created);
    else onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 font-sans">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex justify-between items-start p-6 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-gray-800">
              {replaceDoc ? t("uploadModal.replaceTitle") : t("dashboard.uploadDocument")}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {replaceDoc ? t("uploadModal.replaceSubtitle") : t("uploadModal.subtitle")}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <FiX className="text-xl" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar">
          <form id="upload-doc-form" onSubmit={handleSubmit(onSubmit)} className="space-y-5">

            {/* Document Type */}
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wide">
                {t("add.documentType")} <span className="text-red-500">*</span>
              </label>
              {replaceDoc ? (
                <p className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 bg-gray-50">
                  {replaceDoc.document_type}
                </p>
              ) : (
              <select
                {...register("documentTypeId", { required: t("uploadModal.validation.docTypeRequired") })}
                className={`w-full border rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 transition ${
                  errors.documentTypeId ? "border-red-400 bg-red-50" : "border-gray-200"
                }`}
              >
                <option value="">{t("uploadModal.selectDocType")}</option>
                {Object.values(documentTypes?.data || {}).flat().filter(Boolean).map((dt) => (
                  <option key={dt.id} value={dt.id}>
                    {dt.label || dt.code}
                  </option>
                ))}
              </select>
              )}
              {errors.documentTypeId && (
                <p className="text-xs text-red-500 mt-1">{errors.documentTypeId.message}</p>
              )}
            </div>

            {/* Upload Area */}
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wide">
                {t("uploadModal.documentFile")} <span className="text-red-500">*</span>
              </label>

              {!uploadedFile ? (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleFileDrop}
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                    dragging ? "border-cyan-500 bg-cyan-50/50" : "border-gray-300 bg-gray-50/50 hover:bg-gray-50 hover:border-gray-400"
                  }`}
                >
                  <MdOutlineCloudUpload className="text-4xl text-gray-400 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-900">{t("uploadModal.dropTitle")}</p>
                  <p className="text-xs text-gray-500 mt-1 mb-4">{t("uploadModal.fileHint")}</p>
                  <label className="inline-block cursor-pointer px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-cyan-600 hover:bg-cyan-50 hover:border-cyan-200 transition-colors shadow-sm">
                    {t("add.dropzone.browseFiles")}
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={handleFileDrop}
                    />
                  </label>
                </div>
              ) : (
                <div className="flex items-center gap-3 border border-gray-200 rounded-xl px-4 py-3 bg-white">
                  <div className="w-9 h-9 bg-cyan-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <MdOutlineDescription className="text-cyan-600 text-xl" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{uploadedFile.name}</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      {uploadedFile.size} • {t(`statusLabels.${uploadedFile.status}`, { defaultValue: uploadedFile.status })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUploadedFile(null)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                  >
                    <MdOutlineDelete className="text-xl" />
                  </button>
                </div>
              )}
            </div>

            {/* Issue & Expiry Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">{t("add.issueDate")}</label>
                <input
                  type="date"
                  {...register("issueDate", {
                    required: t("uploadModal.validation.issueDateRequired"),
                    validate: (val) => {
                      const exp = getValues("expiryDate");
                      if (!val || !exp) return true;
                      return (
                        new Date(val) < new Date(exp) ||
                        t("add.validation.issueBeforeExpiry")
                      );
                    },
                    onChange: () => {
                      if (getValues("expiryDate")) trigger("expiryDate");
                    },
                  })}
                  className={`w-full border rounded-lg px-3 py-2.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 transition ${
                    errors.issueDate ? "border-red-400 bg-red-50" : "border-gray-200"
                  }`}
                />
                {errors.issueDate && (
                  <p className="text-xs text-red-500 mt-1">{errors.issueDate.message}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">{t("add.expiryDate")}</label>
                <input
                  type="date"
                  {...register("expiryDate", {
                    required: t("uploadModal.validation.expiryDateRequired"),
                    validate: (val) => {
                      const iss = getValues("issueDate");
                      if (!val || !iss) return true;
                      return (
                        new Date(val) > new Date(iss) ||
                        t("add.validation.expiryAfterIssue")
                      );
                    },
                    onChange: () => {
                      if (getValues("issueDate")) trigger("issueDate");
                    },
                  })}
                  className={`w-full border rounded-lg px-3 py-2.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 transition ${
                    errors.expiryDate ? "border-red-400 bg-red-50" : "border-gray-200"
                  }`}
                />
                {errors.expiryDate && (
                  <p className="text-xs text-red-500 mt-1">{errors.expiryDate.message}</p>
                )}
              </div>
            </div>

            {/* Issuing Authority */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">{t("add.issuingAuthority")}</label>
              <input
                type="text"
                {...register("issuingAuthority", {
                  required: t("uploadModal.validation.issuingAuthorityRequired"),
                  maxLength: { value: 150, message: t("add.validation.max150") }
                })}
                placeholder={t("uploadModal.issuingAuthorityPlaceholder")}
                className={`w-full border rounded-lg px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition ${
                  errors.issuingAuthority ? "border-red-400 bg-red-50" : "border-gray-200"
                }`}
              />
              {errors.issuingAuthority && (
                <p className="text-xs text-red-500 mt-1">{errors.issuingAuthority.message}</p>
              )}
            </div>

            {/* Reference Number */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">{t("add.referenceNumber")}</label>
              <input
                type="text"
                {...register("referenceNumber", {
                  required: t("uploadModal.validation.referenceRequired"),
                  maxLength: { value: 50, message: t("uploadModal.validation.max50") }
                })}
                onInput={(e) => {
                  e.target.value = e.target.value.replace(/[^a-zA-Z0-9]/g, "");
                }}
                placeholder={t("uploadModal.referencePlaceholder")}
                className={`w-full border rounded-lg px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition ${
                  errors.referenceNumber ? "border-red-400 bg-red-50" : "border-gray-200"
                }`}
              />
              {errors.referenceNumber && (
                <p className="text-xs text-red-500 mt-1">{errors.referenceNumber.message}</p>
              )}
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {t("add.cancel")}
          </button>
          <button
            type="submit"
            form="upload-doc-form"
            disabled={isSubmitting}
            className="px-5 py-2.5 text-sm font-bold text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm shadow-cyan-600/20"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {t("slideOver.uploading")}
              </>
            ) : (
              t("dashboard.uploadDocument")
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default UploadDocumentModal;
