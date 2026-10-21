import { useEffect, useState } from "react";
import { MdClose } from "react-icons/md";
import { useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import CustomDropdown from "./CustomDropdown";
import useApiQuery from "../hooks/useApiQuery";
import { MODULE_ALL, updateApprovalGroup } from "../api/approvalGroups";
import { listProjects } from "../api/projects";
import { applyFieldErrors } from "../utils/applyFieldErrors";
import { apiErrorCode, apiErrorMessage } from "../utils/apiError";

// API field → form field, so the server's field errors land under the right input.
const FIELD_MAP = { name: "group_name", code: "group_code", projectId: "project_id", description: "description", moduleKey: "module_key" };
const CODE_FIELDS = { APPROVAL_GROUP_NAME_TAKEN: "group_name", APPROVAL_GROUP_CODE_TAKEN: "group_code", APPROVAL_GROUP_PROJECT_MISMATCH: "project_id" };

const inputCls = (err) =>
  `w-full h-[42px] border ${err ? "border-red-400" : "border-gray-200"} rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500`;
const labelCls = "block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5";

export default function EditApprovalGroupModal({ isOpen, onClose, group, onSaved }) {
  const { t } = useTranslation("approvals");
  const { register, handleSubmit, setValue, control, reset, setError, formState: { errors } } = useForm({
    defaultValues: { group_name: "", group_code: "", module_key: MODULE_ALL, scope: "GLOBAL", project_id: "" },
  });
  // Groups aren't tied to a module yet: the only one is "All requests" (D17).
  const modules = [MODULE_ALL];
  const { data: projectData } = useApiQuery(() => (isOpen ? listProjects({ limit: 100, status: "ACTIVE" }) : Promise.resolve(null)), [isOpen]);
  const projects = projectData?.items || [];
  const [saving, setSaving] = useState(false);

  const scope = useWatch({ control, name: "scope" });
  const moduleKey = useWatch({ control, name: "module_key" });
  const projectId = useWatch({ control, name: "project_id" });
  const isProject = scope === "PROJECT";

  useEffect(() => {
    if (!isOpen || !group) return;
    reset({
      group_name: group.name || "",
      group_code: group.code || "",
      module_key: group.module || MODULE_ALL,
      scope: group.scope || "GLOBAL",
      project_id: group.project?.id || "",
    });
  }, [isOpen, group, reset]);

  // The group's own project stays offered even if it's no longer active.
  const projectOptions = [...projects];
  if (group?.project && !projectOptions.some((p) => p.id === group.project.id)) projectOptions.unshift(group.project);

  const onSubmit = async (data) => {
    if (data.scope === "PROJECT" && !data.project_id) {
      setError("project_id", { type: "required", message: t("createModal.validation.projectRequired") }, { shouldFocus: true });
      return;
    }
    const payload = {
      name: data.group_name.trim(),
      code: data.group_code.trim(),
      moduleKey: data.module_key || MODULE_ALL,
      scope: data.scope,
      ...(data.scope === "PROJECT" ? { projectId: data.project_id } : {}),
      description: group.description ?? null,
    };
    setSaving(true);
    let updated;
    try {
      updated = await updateApprovalGroup(group.id, payload);
    } catch (err) {
      setSaving(false);
      const code = apiErrorCode(err);
      if (CODE_FIELDS[code]) {
        setError(CODE_FIELDS[code], { type: "server", message: apiErrorMessage(err) }, { shouldFocus: true });
        return;
      }
      const { mapped } = applyFieldErrors(err, setError, { fieldMap: FIELD_MAP, knownFields: Object.values(FIELD_MAP) });
      if (!mapped.length) toast.error(apiErrorMessage(err));
      return;
    }
    setSaving(false);
    toast.success(t("editModal.updated"));
    onSaved?.(updated);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
        <div className="flex justify-between items-center p-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">{t("editModal.title")}</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><MdClose className="text-xl" /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{t("editModal.groupName")} <span className="text-red-500">*</span></label>
              <input {...register("group_name", { required: t("createModal.validation.groupNameRequired"), maxLength: { value: 100, message: t("createModal.validation.max100") }, validate: (v) => v.trim().length >= 2 || t("createModal.validation.min2") })} maxLength={100} className={inputCls(errors.group_name)} />
              {errors.group_name && <p className="text-red-500 text-xs mt-1">{errors.group_name.message}</p>}
            </div>
            <div>
              <label className={labelCls}>{t("editModal.groupCode")} <span className="text-red-500">*</span></label>
              <input {...register("group_code", { required: t("createModal.validation.groupCodeRequired"), maxLength: { value: 50, message: t("createModal.validation.max50") }, validate: (v) => v.trim().length >= 2 || t("createModal.validation.min2") })} maxLength={50} className={inputCls(errors.group_code)} />
              {errors.group_code && <p className="text-red-500 text-xs mt-1">{errors.group_code.message}</p>}
            </div>
          </div>

          <div>
            <label className={labelCls}>{t("editModal.module")} <span className="text-red-500">*</span></label>
            <CustomDropdown
              {...register("module_key", { required: t("editModal.selectModuleRequired") })}
              value={moduleKey}
              error={!!errors.module_key}
              options={modules.map((m) => ({ label: t("allRequests"), value: m }))}
            />
            {errors.module_key && <p className="text-red-500 text-xs mt-1">{errors.module_key.message}</p>}
          </div>

          <div>
            <label className={labelCls}>{t("editModal.approvalScope")}</label>
            <div className="flex gap-2">
              {[{ v: "GLOBAL", l: t("editModal.scopes.GLOBAL") }, { v: "PROJECT", l: t("editModal.scopes.PROJECT") }].map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => { setValue("scope", o.v); if (o.v === "GLOBAL") setValue("project_id", ""); }}
                  className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold border ${scope === o.v ? "bg-cyan-600 border-cyan-600 text-white" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                >
                  {o.l}
                </button>
              ))}
            </div>
          </div>

          {isProject && (
            <div>
              <label className={labelCls}>{t("editModal.project")} <span className="text-red-500">*</span></label>
              <CustomDropdown
                {...register("project_id")}
                value={projectId}
                error={!!errors.project_id}
                options={[{ label: t("editModal.selectProject"), value: "" }, ...projectOptions.map((p) => ({ label: `${p.name}${p.code ? ` (${p.code})` : ""}`, value: p.id }))]}
              />
              {errors.project_id && <p className="text-red-500 text-xs mt-1">{errors.project_id.message}</p>}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-900">{t("createModal.cancel")}</button>
            <button type="submit" disabled={saving} className="px-5 py-2.5 bg-cyan-600 text-white text-sm font-semibold rounded-lg hover:bg-cyan-700 disabled:opacity-50">{saving ? t("editModal.saving") : t("editModal.saveChanges")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}