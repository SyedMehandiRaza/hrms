import { useEffect, useMemo } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import {
  MdOutlineClose,
  MdOutlineError,
  MdOutlineAdd,
  MdOutlineDeleteOutline,
} from "react-icons/md";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import {
  APPR_EMPLOYEES,
  APPR_PROJECTS,
  APPR_MODULES,
  APPR_projectEmployees,
  APPR_addGroup,
} from "../data/groupD";
import CustomDropdown from "./CustomDropdown";

const inputCls = (err) =>
  `w-full px-4 py-2.5 border rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-cyan-500 focus:outline-none focus:border-transparent transition ${
    err ? "border-red-300 bg-red-50" : "border-gray-200 bg-white"
  }`;

const labelCls =
  "block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5";

const FieldErr = ({ error }) =>
  error ? (
    <p className="flex items-center gap-1 text-xs text-red-500 mt-1.5">
      <MdOutlineError className="flex-shrink-0 text-sm" />
      {error.message}
    </p>
  ) : null;

const prettyModule = (key = "") =>
  key
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

const getEmpId = (e) => e?.id ?? e?._id ?? e?.employee_id;

const removeEmojis = (e) => {
  const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
  if (emojiRegex.test(e.target.value)) {
    e.target.value = e.target.value.replace(emojiRegex, "");
  }
};

export default function CreateApprovalGroupModal({ isOpen, onClose, onSuccess }) {
  const { t } = useTranslation("approvals");
  const createLoading = false;
  const employees = APPR_EMPLOYEES;
  const loadingEmployees = false;
  const projects = APPR_PROJECTS;

  const modules = APPR_MODULES;
  const loadingModules = false;

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      group_name: "",
      group_code: "",
      module_key: "",
      scope: "GLOBAL",
      project_id: "",
      description: "",
      members: [
        { employee_id: "", level_no: 1, is_mandatory: true, can_skip: false },
      ],
    },
  });

  const scope = watch("scope");
  const projectId = watch("project_id");
  const isProjectScope = scope === "PROJECT";
  const moduleKeyValue = watch("module_key");
  const membersValue = watch("members");

  const projectEmployees = useMemo(
    () => (isProjectScope && projectId ? APPR_projectEmployees(projectId) : []),
    [isProjectScope, projectId],
  );

  // Approvers can be ANY company employee. For project-level groups we just tag
  // which ones belong to the project (≥1 of them is required).
  const memberEmployees = employees;
  const memberLoading = loadingEmployees;
  const projectEmployeeIds = new Set(
    (projectEmployees || [])
      .map((e) => Number(getEmpId(e)))
      .filter(Boolean),
  );

  const { fields, append, remove } = useFieldArray({ control, name: "members" });

  useEffect(() => {
    if (!isOpen) return;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleClose = () => {
    reset();
    onClose();
  };

  const onSubmit = (data) => {
    if (data.scope === "PROJECT" && !data.project_id) {
      toast.error(t("createModal.toast.selectProjectForScope"));
      return;
    }

    const members = data.members.map((m) => ({
      employee_id: Number(m.employee_id),
      level_no: Number(m.level_no),
      is_mandatory: !!m.is_mandatory,
      can_skip: !!m.can_skip,
    }));

    // Block duplicate employees — an employee can only be selected once overall.
    const seen = new Set();
    for (const m of members) {
      if (seen.has(m.employee_id)) {
        toast.error(
          t("createModal.toast.duplicateEmployee")
        );
        return;
      }
      seen.add(m.employee_id);
    }

    // Project-level groups must include at least one approver from that project.
    if (data.scope === "PROJECT") {
      const hasProjectApprover = members.some((m) =>
        projectEmployeeIds.has(Number(m.employee_id)),
      );
      if (!hasProjectApprover) {
        toast.error(
          t("createModal.toast.projectApproverRequired"),
        );
        return;
      }
    }

    const payload = {
      group_name: data.group_name.trim(),
      group_code: data.group_code.trim(),
      module_key: data.module_key,
      scope: data.scope || "GLOBAL",
      ...(data.scope === "PROJECT" && data.project_id
        ? { project_id: Number(data.project_id) }
        : {}),
      description: data.description?.trim() || null,
      members,
    };

    const created = APPR_addGroup(payload);
    toast.success(t("createModal.toast.created"));
    onSuccess?.(created);
    handleClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div
        className="bg-white w-full max-w-lg flex flex-col rounded-2xl shadow-2xl"
        style={{ maxHeight: "90vh" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {t("createModal.title")}
            </h2>
            <p className="text-sm text-gray-400 mt-0.5">
              {t("createModal.subtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0"
          >
            <MdOutlineClose className="text-xl" />
          </button>
        </div>

        <hr className="border-gray-100 flex-shrink-0" />

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col flex-1 min-h-0"
        >
          <div
            className="flex-1 overflow-y-auto px-6 py-5 space-y-4 custom-scrollbar"
          >
            {/* Group Name + Code */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>
                  {t("createModal.groupName")}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder={t("createModal.groupNamePlaceholder")}
                  {...register("group_name", {
                    required: t("createModal.validation.groupNameRequired"),
                    maxLength: { value: 100, message: t("createModal.validation.max100") },
                    validate: {
                      notEmpty: (v) => v.trim() !== "" || t("createModal.validation.cannotBeEmpty"),
                      minLen: (v) =>
                        v.trim().length >= 2 || t("createModal.validation.min2"),
                    },
                  })}
                  maxLength={100}
                  onInput={(e) => {
                    removeEmojis(e);
                    e.target.value = e.target.value.replace(/^\s+/, "");
                  }}
                  className={inputCls(errors.group_name)}
                />
                <FieldErr error={errors.group_name} />
              </div>

              <div>
                <label className={labelCls}>
                  {t("createModal.groupCode")}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder={t("createModal.groupCodePlaceholder")}
                  {...register("group_code", {
                    required: t("createModal.validation.groupCodeRequired"),
                    maxLength: { value: 50, message: t("createModal.validation.max50") },
                    validate: {
                      minLen: (v) =>
                        v.trim().length >= 2 || t("createModal.validation.min2"),
                    },
                  })}
                  maxLength={50}
                  onInput={(e) => {
                    removeEmojis(e);
                    e.target.value = e.target.value.replace(/^\s+/, "");
                  }}
                  className={inputCls(errors.group_code)}
                />
                <FieldErr error={errors.group_code} />
              </div>
            </div>

            {/* Module (from backend) */}
            <div>
              <label className={labelCls}>
                {t("createModal.module")} <span className="text-red-500">*</span>
              </label>
              <CustomDropdown
                {...register("module_key", {
                  required: t("createModal.validation.moduleRequired"),
                })}
                value={moduleKeyValue}
                error={!!errors.module_key}
                disabled={loadingModules}
                options={[
                  { label: loadingModules ? t("createModal.loadingModules") : t("createModal.selectModule"), value: "" },
                  ...modules.map((m) => ({
                    label: prettyModule(m.module),
                    value: m.module
                  }))
                ]}
              />
              <FieldErr error={errors.module_key} />
            </div>

            {/* Scope: Global vs Project-level */}
            <div>
              <label className={labelCls}>
                {t("createModal.scope", "Approval Scope")}
              </label>
              <div className="flex gap-2">
                {[
                  { value: "GLOBAL", label: t("createModal.scopeGlobal", "Global") },
                  { value: "PROJECT", label: t("createModal.scopeProject", "Project-level") },
                ].map((opt) => {
                  const activeOpt = scope === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setValue("scope", opt.value);
                        if (opt.value === "GLOBAL") setValue("project_id", "");
                      }}
                      className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold border transition-colors ${
                        activeOpt
                          ? "bg-cyan-600 border-cyan-600 text-white"
                          : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Project (only for project-level groups) */}
            {isProjectScope && (
              <div>
                <label className={labelCls}>
                  {t("createModal.project", "Project")}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <CustomDropdown
                  {...register("project_id", {
                    required: isProjectScope ? t("createModal.validation.projectRequired") : false,
                  })}
                  value={projectId}
                  error={!!errors.project_id}
                  options={[
                    { label: t("createModal.selectProject", "Select a project"), value: "" },
                    ...projects.map((p) => ({
                      label: `${p.project_name}${p.project_code ? ` (${p.project_code})` : ""}`,
                      value: p.id
                    }))
                  ]}
                />
                <FieldErr error={errors.project_id} />
                <p className="text-xs text-gray-400 mt-1.5">
                  {t(
                    "createModal.projectMemberHint",
                    "At least one approver must be an employee assigned to this project.",
                  )}
                </p>
              </div>
            )}

            {/* Description */}
            <div>
              <label className={labelCls}>{t("createModal.description")}</label>
              <textarea
                rows={2}
                placeholder={t("createModal.descriptionPlaceholder")}
                {...register("description", {
                  maxLength: { value: 1000, message: t("createModal.validation.max1000") },
                })}
                maxLength={1000}
                onInput={(e) => {
                  removeEmojis(e);
                  e.target.value = e.target.value.replace(/^\s+/, "");
                }}
                className={`${inputCls(errors.description)} resize-none`}
              />
              <FieldErr error={errors.description} />
            </div>

            {/* Members / approvers */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={`${labelCls} mb-0`}>
                  {t("createModal.approvers")}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() =>
                    append({
                      employee_id: "",
                      level_no: fields.length + 1,
                      is_mandatory: true,
                      can_skip: false,
                    })
                  }
                  className="flex items-center gap-1 text-cyan-600 hover:text-cyan-700 text-xs font-semibold"
                >
                  <MdOutlineAdd className="text-base" /> {t("createModal.addApprover")}
                </button>
              </div>

              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="border border-gray-200 rounded-lg p-3 space-y-3"
                  >
                    <div className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-7">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                          {t("createModal.employee")}
                        </label>
                        <CustomDropdown
                          {...register(`members.${index}.employee_id`, {
                            required: t("createModal.validation.required"),
                          })}
                          value={membersValue?.[index]?.employee_id}
                          error={!!errors?.members?.[index]?.employee_id}
                          disabled={memberLoading}
                          options={[
                            { label: memberLoading ? t("createModal.loadingEmployees") : t("createModal.selectEmployee"), value: "" },
                            ...memberEmployees.map((e) => {
                              const eid = getEmpId(e);
                              const inProject = isProjectScope && projectEmployeeIds.has(Number(eid));
                              return {
                                label: `${e.full_name || e.name}${e.country_emp_id ? ` (${e.country_emp_id})` : ""}${inProject ? ` • ${t("createModal.inProject", "In project")}` : ""}`,
                                value: eid
                              };
                            })
                          ]}
                        />
                      </div>

                      <div className="col-span-4">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                          {t("createModal.level")}
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          {...register(`members.${index}.level_no`, {
                            required: t("createModal.validation.required"),
                            min: { value: 1, message: t("createModal.validation.min1") },
                          })}
                          className={`${inputCls(
                            errors?.members?.[index]?.level_no
                          )} py-2`}
                        />
                      </div>

                      <div className="col-span-1 flex justify-center pb-1">
                        <button
                          type="button"
                          onClick={() => fields.length > 1 && remove(index)}
                          disabled={fields.length <= 1}
                          className="p-1.5 text-gray-400 hover:text-red-500 disabled:opacity-30 rounded-md"
                        >
                          <MdOutlineDeleteOutline className="text-lg" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-5">
                      <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                        <input
                          type="checkbox"
                          {...register(`members.${index}.is_mandatory`)}
                          className="w-4 h-4 accent-cyan-600"
                        />
                        {t("createModal.mandatory")}
                      </label>
                      <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                        <input
                          type="checkbox"
                          {...register(`members.${index}.can_skip`)}
                          className="w-4 h-4 accent-cyan-600"
                        />
                        {t("createModal.canSkip")}
                      </label>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {t("createModal.levelsHint")}
              </p>
            </div>
          </div>

          {/* Footer */}
          <hr className="border-gray-100 flex-shrink-0" />
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 px-6 py-4 flex-shrink-0">
            <button
              type="button"
              onClick={handleClose}
              disabled={createLoading}
              className="w-full sm:w-auto px-6 py-2.5 border border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-60 transition-colors"
            >
              {t("createModal.cancel")}
            </button>
            <button
              type="submit"
              disabled={createLoading}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-colors"
            >
              {createLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {t("createModal.creating")}
                </>
              ) : (
                t("createModal.createGroup")
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
