import { useState } from "react";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import Loader from "./Loader";
import Can from "./Can";
import { MODULES, ACTIONS } from "../constants/permissions";
import {
  APPR_GROUPS,
  APPR_PROJECTS,
  APPR_ASSIGNMENTS,
  APPR_bindingFor,
  APPR_groupRef,
} from "../data/groupD";
import CustomDropdown from "./CustomDropdown";

const getId = (g) => g?.id ?? g?._id;
const getProjId = (p) => p?.id ?? p?._id ?? p?.project_id;

const EMPTY_EDITOR = { groupId: "", projectIds: [], setDefault: false };

// Bind each purpose (Leave, Salary) to the approval group(s) that govern it —
// per project and/or a company-wide default. One group can govern many projects.
export default function ApprovalSettings() {
  const { t } = useTranslation("approvals");
  const groups = APPR_GROUPS;
  const projects = APPR_PROJECTS;

  const [assignments, setAssignments] = useState(APPR_ASSIGNMENTS);
  const loading = false;
  const [editor, setEditor] = useState({}); // module_key -> { groupId, projectIds[], setDefault }
  const savingModule = null;

  const activeGroups = (groups || []).filter(
    (g) => g.is_active === undefined || g.is_active,
  );

  const ed = (moduleKey) => editor[moduleKey] || EMPTY_EDITOR;

  // Picking a group prefills the projects it currently governs + default flag,
  // so saving edits that group's binding rather than wiping it.
  const pickGroup = (a, value) => {
    const gid = value ? Number(value) : "";
    let projectIds = [];
    let setDefault = false;
    if (gid) {
      projectIds = (a.bindings || [])
        .filter((b) => getId(b.group) === gid)
        .map((b) => b.project_id);
      setDefault = !!a.default_group && getId(a.default_group) === gid;
    }
    setEditor((prev) => ({
      ...prev,
      [a.module_key]: { groupId: gid, projectIds, setDefault },
    }));
  };

  const toggleProject = (moduleKey, pid) => {
    setEditor((prev) => {
      const cur = prev[moduleKey] || EMPTY_EDITOR;
      const has = cur.projectIds.includes(pid);
      return {
        ...prev,
        [moduleKey]: {
          ...cur,
          projectIds: has
            ? cur.projectIds.filter((x) => x !== pid)
            : [...cur.projectIds, pid],
        },
      };
    });
  };

  const toggleDefault = (moduleKey) => {
    setEditor((prev) => {
      const cur = prev[moduleKey] || EMPTY_EDITOR;
      return { ...prev, [moduleKey]: { ...cur, setDefault: !cur.setDefault } };
    });
  };

  const save = (moduleKey) => {
    const cur = ed(moduleKey);
    if (!cur.groupId) {
      toast.error(t("settings.toast.pickGroupFirst"));
      return;
    }
    // The group's project set becomes exactly `projectIds`; other groups lose
    // any of those projects (one group per project per module).
    setAssignments((prev) =>
      prev.map((a) => {
        if (a.module_key !== moduleKey) return a;
        const kept = (a.bindings || []).filter(
          (b) =>
            getId(b.group) !== cur.groupId &&
            !cur.projectIds.includes(b.project_id),
        );
        const added = cur.projectIds.map((pid) => APPR_bindingFor(pid, cur.groupId));
        let defaultGroup = a.default_group;
        if (cur.setDefault) defaultGroup = APPR_groupRef(cur.groupId);
        else if (getId(a.default_group) === cur.groupId) defaultGroup = null;
        return { ...a, default_group: defaultGroup, bindings: [...kept, ...added] };
      }),
    );
    toast.success(t("settings.toast.saved"));
    setEditor((prev) => ({ ...prev, [moduleKey]: EMPTY_EDITOR }));
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl">
      <div className="px-5 py-4 border-b border-gray-100">
        <p className="text-sm font-bold text-gray-900">{t("settings.title")}</p>
        <p className="text-xs text-gray-400 mt-0.5">{t("settings.subtitle")}</p>
      </div>

      {loading ? (
        <Loader label={t("settings.loading")} />
      ) : assignments.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-400">
          {t("settings.noPurposes")}
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {assignments.map((a) => {
            const cur = ed(a.module_key);
            return (
              <div key={a.module_key} className="px-5 py-5 space-y-4">
                {/* Header */}
                <div>
                  <p className="text-sm font-bold text-gray-900">{a.label}</p>
                  <p className="text-[11px] text-gray-400">{a.module_key}</p>
                </div>

                {/* Current state */}
                <div className="rounded-lg bg-gray-50 border border-gray-100 px-4 py-3 text-sm space-y-1.5">
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-500">{t("settings.companyDefault")}</span>
                    <span className="font-medium text-gray-900">
                      {a.default_group
                        ? a.default_group.group_name
                        : t("settings.notSet")}
                    </span>
                  </div>
                  {(a.bindings || []).length > 0 && (
                    <div className="pt-1 border-t border-gray-100 mt-1.5 space-y-1">
                      {a.bindings.map((b) => (
                        <div
                          key={b.project_id}
                          className="flex justify-between gap-3"
                        >
                          <span className="text-gray-500">
                            {b.project_name || t("settings.projectNumber", { id: b.project_id })}
                          </span>
                          <span className="font-medium text-gray-900">
                            {b.group ? b.group.group_name : "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Editor */}
                <Can module={MODULES.APPROVAL_GROUP} action={ACTIONS.UPDATE}>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                        {t("settings.assignGroup")}
                      </label>
                      <div className="w-full sm:w-80">
                        <CustomDropdown
                          value={cur.groupId || ""}
                          onChange={(e) => pickGroup(a, e.target.value)}
                          options={[
                            { label: t("settings.selectGroup"), value: "" },
                            ...activeGroups.map((g) => ({
                              label: `${g.group_name}${g.group_code ? ` (${g.group_code})` : ""}`,
                              value: getId(g)
                            }))
                          ]}
                        />
                      </div>
                    </div>

                    {cur.groupId ? (
                      <>
                        <div>
                          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                            {t("settings.projectsGoverned")}
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-52 overflow-auto border border-gray-100 rounded-lg p-3">
                            {(projects || []).length === 0 && (
                              <p className="text-xs text-gray-400 italic">
                                {t("settings.noProjects")}
                              </p>
                            )}
                            {(projects || []).map((p) => {
                              const pid = getProjId(p);
                              return (
                                <label
                                  key={pid}
                                  className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={cur.projectIds.includes(pid)}
                                    onChange={() =>
                                      toggleProject(a.module_key, pid)
                                    }
                                    className="rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                                  />
                                  {p.project_name || t("settings.projectNumber", { id: pid })}
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={cur.setDefault}
                            onChange={() => toggleDefault(a.module_key)}
                            className="rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                          />
                          {t("settings.makeCompanyDefault")}
                        </label>

                        <button
                          onClick={() => save(a.module_key)}
                          disabled={savingModule === a.module_key}
                          className="inline-flex items-center justify-center gap-2 min-w-[84px] bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors"
                        >
                          {savingModule === a.module_key ? (
                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            t("settings.save")
                          )}
                        </button>
                      </>
                    ) : null}
                  </div>
                </Can>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}