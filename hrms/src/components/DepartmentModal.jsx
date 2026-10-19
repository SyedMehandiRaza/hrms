import { useEffect, useState, useRef } from "react";
import { FiX, FiSearch, FiChevronDown } from "react-icons/fi";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import { createDepartment, updateDepartment } from "../api/departments";
import { applyFieldErrors } from "../utils/applyFieldErrors";
import { apiErrorCode, apiErrorMessage, toastApiError } from "../utils/apiError";

// 409 duplicates belong under the input they are about.
const CONFLICT_FIELDS = { DEPARTMENT_NAME_TAKEN: "name", DEPARTMENT_CODE_TAKEN: "code" };

// Active employees for the Head dropdown. No employees endpoint exists yet (plan Q21),
// so the dropdown shows its "No employees found" state.
const HEAD_OPTIONS = [];

function DepartmentModal({ isOpen, onClose, onSaved, initialData, mode = "create" }) {
  const { t } = useTranslation("employees");
  const list = HEAD_OPTIONS;

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dropdownRef = useRef(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: "",
      code: "",
      dept_head: "",
      description: "",
      isActive: true,
    },
  });
  const selectedHeadId = watch("dept_head");
  const selectedEmployee = (list || []).find(
    (emp) => emp.id === selectedHeadId,
  );
  const filteredEmployees = (list || []).filter(
    (emp) =>
      (emp.full_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (emp.country_emp_id || "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase()),
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        reset({
          ...initialData,
          isActive:
            initialData.isActive === "ACTIVE" || initialData.isActive === true,
        });
      } else {
        reset({
          name: "",
          code: "",
          dept_head: "",
          description: "",
          isActive: true,
        });
      }
    }
  }, [isOpen, initialData, reset]);

  if (!isOpen) return null;

  const onSubmit = async (data) => {
    const payload = {
      name: data.name,
      code: data.code,
      description: data.description,
      status: data.isActive ? "ACTIVE" : "INACTIVE",
    };
    // The head goes out only when picked here: on edit an untouched head stays as stored.
    const headId = data.dept_head || "";
    if (mode === "edit" ? headId !== (initialData?.dept_head || "") : headId) payload.deptHeadId = headId;

    setIsSubmitting(true);
    try {
      const saved =
        mode === "edit" ? await updateDepartment(initialData.id, payload) : await createDepartment(payload);
      toast.success(t(mode === "edit" ? "departments.modal.toast.updated" : "departments.modal.toast.created"));
      if (onSaved) onSaved(saved);
      onClose();
    } catch (err) {
      const conflictField = CONFLICT_FIELDS[apiErrorCode(err)];
      if (conflictField) {
        setError(conflictField, { type: "server", message: apiErrorMessage(err) }, { shouldFocus: true });
      } else {
        const { mapped, unmapped } = applyFieldErrors(err, setError, {
          fieldMap: { deptHeadId: "dept_head" },
          knownFields: ["name", "code", "description", "dept_head"],
        });
        if (!mapped.length) toastApiError(err);
        unmapped.forEach((message) => toast.error(message));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEdit = mode === "edit";
  const title = isEdit ? t("departments.modal.editTitle") : t("departments.modal.createTitle");
  const subtitle = isEdit
    ? t("departments.modal.editSubtitle")
    : t("departments.modal.createSubtitle");
  const submitText = isEdit ? t("departments.actions.saveChanges") : t("departments.modal.createTitle");

  // Emoji validation regex rules with full field names
  const noEmojiRuleName = {
    value: /^[^\p{Emoji_Presentation}\p{Extended_Pictographic}]+$/u,
    message: t("departments.modal.validation.nameNoEmoji"),
  };

  const noEmojiRuleCode = {
    value: /^[^\p{Emoji_Presentation}\p{Extended_Pictographic}]+$/u,
    message: t("departments.modal.validation.codeNoEmoji"),
  };

  const noEmojiRuleDescription = {
    value: /^[^\p{Emoji_Presentation}\p{Extended_Pictographic}]+$/u,
    message: t("departments.validation.descriptionNoEmoji"),
  };

  // Actively block emoji insertion
  const blockEmoji = (field) => (e) => {
    const value = e.target.value;
    const stripped = value.replace(
      /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu,
      "",
    );
    if (value !== stripped) {
      setValue(field, stripped, { shouldValidate: true, shouldDirty: true });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 font-sans">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      ></div>
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
          <form
            id="department-form"
            noValidate
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-5"
          >
            <div className="flex gap-4">
              <div className="flex-[2]">
                <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wide">
                  {t("departments.list.table.name")} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder={t("departments.modal.namePlaceholder")}
                  className={`w-full border p-2.5 rounded-md focus:outline-none focus:ring-1 focus:ring-[#17A2B8] text-sm ${errors.name ? "border-red-500" : "border-gray-200"
                    }`}
                  {...register("name", {
                    required: t("departments.modal.validation.nameRequired"),
                    minLength: {
                      value: 2,
                      message: t("departments.modal.validation.nameMin"),
                    },
                    maxLength: {
                      value: 150,
                      message: t("departments.modal.validation.nameMax"),
                    },
                    pattern: noEmojiRuleName,
                    onChange: blockEmoji("name"),
                  })}
                />
                {errors.name && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.name.message}
                  </p>
                )}
              </div>
              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wide">
                  {t("departments.modal.code")} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder={t("departments.modal.codePlaceholder")}
                  className={`w-full border p-2.5 rounded-md focus:outline-none focus:ring-1 focus:ring-[#17A2B8] text-sm ${errors.code ? "border-red-500" : "border-gray-200"
                    }`}
                  {...register("code", {
                    required: t("departments.modal.validation.codeRequired"),
                    maxLength: {
                      value: 50,
                      message: t("departments.modal.validation.codeMax"),
                    },
                    pattern: noEmojiRuleCode,
                    onChange: blockEmoji("code"),
                  })}
                />
                {errors.code && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.code.message}
                  </p>
                )}
              </div>
            </div>

            <div className="relative" ref={dropdownRef}>
              <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wide">
                {t("departments.list.table.head")}
              </label>

              <div
                className={`w-full border p-2.5 rounded-md focus:outline-none focus:ring-1 focus:ring-[#17A2B8] text-sm bg-white cursor-pointer flex justify-between items-center ${errors.dept_head ? "border-red-500" : "border-gray-200"
                  }`}
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              >
                <span
                  className={
                    selectedEmployee ? "text-gray-900" : "text-gray-500"
                  }
                >
                  {selectedEmployee
                    ? selectedEmployee.full_name
                    : (selectedHeadId && initialData?.head_name) || t("departments.modal.selectEmployee")}
                </span>
                <FiChevronDown
                  className={`text-gray-400 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`}
                />
              </div>

              {isDropdownOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 flex flex-col">
                  <div className="p-2 border-b border-gray-100 flex items-center bg-gray-50 rounded-t-md">
                    <FiSearch className="text-gray-400 mr-2 ml-1" />
                    <input
                      type="text"
                      className="w-full focus:outline-none text-sm bg-transparent"
                      placeholder={t("departments.modal.searchEmployees")}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div className="overflow-y-auto">
                    {filteredEmployees.length > 0 ? (
                      filteredEmployees.map((emp) => (
                        <div
                          key={emp.id}
                          className="px-4 py-2.5 hover:bg-gray-50 cursor-pointer text-sm flex justify-between items-center border-b border-gray-50 last:border-0"
                          onClick={() => {
                            setValue("dept_head", emp.id, {
                              shouldValidate: true,
                              shouldDirty: true,
                            });
                            setIsDropdownOpen(false);
                            setSearchQuery("");
                          }}
                        >
                          <div>
                            <p className="font-medium text-gray-800">
                              {emp.full_name}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {emp.country_emp_id} • {emp.access_level}
                            </p>
                          </div>
                          {selectedHeadId === emp.id && (
                            <div className="w-2 h-2 rounded-full bg-[#17A2B8]"></div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-gray-500 text-center">
                        {t("departments.modal.noEmployees")}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {errors.dept_head && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.dept_head.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wide">
                {t("departments.fields.description")}
              </label>
              <textarea
                rows="3"
                maxLength={2000}
                placeholder={t("departments.modal.descriptionPlaceholder")}
                className={`w-full border p-2.5 rounded-md focus:outline-none focus:ring-1 focus:ring-[#17A2B8] text-sm resize-none ${errors.description ? "border-red-500" : "border-gray-200"
                  }`}
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
                <p className="text-red-500 text-xs mt-1">
                  {errors.description.message}
                </p>
              )}
            </div>

            <div className="bg-[#F8F9FA] p-4 rounded-lg flex items-center justify-between border border-gray-100">
              <div>
                <h4 className="text-sm font-semibold text-gray-800">
                  {t("departments.fields.activeStatus")}
                </h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  {t("departments.modal.activeStatusHint")}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  {...register("isActive")}
                />
                <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#17A2B8]"></div>
              </label>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-100 bg-[#F8F9FA] rounded-b-xl flex gap-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            {t("departments.actions.cancel")}
          </button>
          <button
            type="submit"
            form="department-form"
            disabled={isSubmitting}
            className="flex-1 py-2.5 px-4 bg-[#17A2B8] text-white rounded-md hover:bg-[#138496] transition-colors text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <svg className="w-4 h-4 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : null}
            {submitText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DepartmentModal;
