import { useEffect } from "react";
import { MdClose } from "react-icons/md";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import CustomDropdown from "./CustomDropdown";
import { APPR_MODULES, APPR_PROJECTS, APPR_updateGroup } from "../data/groupD";

const prettyModule = (k = "") => k.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const inputCls = (err) =>
  `w-full h-[42px] border ${err ? "border-red-400" : "border-gray-200"} rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500`;
const labelCls = "block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5";

export default function EditApprovalGroupModal({ isOpen, onClose, group, onSaved }) {
  const { t } = useTranslation("approvals");
  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm({
    defaultValues: { group_name: "", group_code: "", module_key: "", scope: "GLOBAL", project_id: "" },
  });
  const modules = APPR_MODULES;
  const projects = APPR_PROJECTS;
  const saving = false;

  const scope = watch("scope");
  const moduleKey = watch("module_key");
  const projectId = watch("project_id");
  const isProject = scope === "PROJECT";

  useEffect(() => {
    if (!isOpen || !group) return;
    reset({
      group_name: group.group_name || "",
      group_code: group.group_code || "",
      module_key: group.module_key || "",
      scope: group.scope || "GLOBAL",
      project_id: group.project_id ? String(group.project_id) : "",
    });
  }, [isOpen, group, reset]);

  const onSubmit = (data) => {
    if (data.scope === "PROJECT" && !data.project_id) return toast.error(t("editModal.selectProjectToast"));
    const payload = {
      group_name: data.group_name.trim(),
      group_code: data.group_code.trim(),
      module_key: data.module_key,
      scope: data.scope,
      project_id: data.scope === "PROJECT" ? Number(data.project_id) : null,
    };
    const updated = APPR_updateGroup(group.id, payload) || { ...group, ...payload };
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
              <input {...register("group_name", { required: t("editModal.required"), minLength: { value: 2, message: t("editModal.tooShort") } })} className={inputCls(errors.group_name)} />
              {errors.group_name && <p className="text-red-500 text-xs mt-1">{errors.group_name.message}</p>}
            </div>
            <div>
              <label className={labelCls}>{t("editModal.groupCode")} <span className="text-red-500">*</span></label>
              <input {...register("group_code", { required: t("editModal.required"), minLength: { value: 2, message: t("editModal.tooShort") } })} className={inputCls(errors.group_code)} />
              {errors.group_code && <p className="text-red-500 text-xs mt-1">{errors.group_code.message}</p>}
            </div>
          </div>

          <div>
            <label className={labelCls}>{t("editModal.module")} <span className="text-red-500">*</span></label>
            <CustomDropdown
              {...register("module_key", { required: t("editModal.selectModuleRequired") })}
              value={moduleKey}
              error={!!errors.module_key}
              options={[{ label: t("createModal.selectModule"), value: "" }, ...modules.map((m) => ({ label: prettyModule(m.module || m.key || m), value: m.module || m.key || m }))]}
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
                options={[{ label: t("editModal.selectProject"), value: "" }, ...projects.map((p) => ({ label: `${p.project_name || p.name}${p.project_code ? ` (${p.project_code})` : ""}`, value: String(p.id) }))]}
              />
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