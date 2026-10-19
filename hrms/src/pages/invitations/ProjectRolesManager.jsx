import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import {
  MdOutlineAdd,
  MdOutlineEdit,
  MdOutlineDelete,
  MdOutlineShield,
  MdOutlineClose,
} from "react-icons/md";

import {
  INVITABLE_PROJECTS,
  ROLE_CATALOG,
  projectRolesFor,
  saveProjectRole,
  deleteProjectRole,
} from "../../data/groupB";

const ACTIONS = [
  { key: "can_read", labelKey: "roles.actions.read" },
  { key: "can_create", labelKey: "roles.actions.create" },
  { key: "can_update", labelKey: "roles.actions.update" },
  { key: "can_delete", labelKey: "roles.actions.delete" },
];

const blankPerms = (catalog) =>
  catalog.reduce((acc, m) => {
    acc[m.key] = { can_read: false, can_create: false, can_update: false, can_delete: false };
    return acc;
  }, {});

export default function ProjectRolesManager() {
  const { t } = useTranslation("collaboration");
  // Owned projects + the capability catalog (static).
  const [projects] = useState(() => INVITABLE_PROJECTS.filter((p) => p.myRole === "OWNER"));
  const [projectId, setProjectId] = useState(() => (projects.length ? String(projects[0].id) : ""));
  const catalog = ROLE_CATALOG;
  const [version, setVersion] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const roles = useMemo(() => (projectId ? projectRolesFor(projectId) : []), [projectId, version]);
  const loading = false;

  // Editor modal state
  const [editor, setEditor] = useState(null); // { id?, name, description, perms }
  const [saving] = useState(false);

  const loadRoles = () => setVersion((v) => v + 1);

  const openCreate = () =>
    setEditor({ name: "", description: "", perms: blankPerms(catalog) });

  const openEdit = (role) => {
    const perms = blankPerms(catalog);
    (role.permissions || []).forEach((p) => {
      if (perms[p.module_key]) {
        perms[p.module_key] = {
          can_read: p.can_read,
          can_create: p.can_create,
          can_update: p.can_update,
          can_delete: p.can_delete,
        };
      }
    });
    setEditor({ id: role.id, name: role.name, description: role.description || "", perms });
  };

  const togglePerm = (moduleKey, action) =>
    setEditor((ed) => ({
      ...ed,
      perms: {
        ...ed.perms,
        [moduleKey]: { ...ed.perms[moduleKey], [action]: !ed.perms[moduleKey][action] },
      },
    }));

  const toggleRow = (moduleKey) =>
    setEditor((ed) => {
      const row = ed.perms[moduleKey];
      const all = row.can_read && row.can_create && row.can_update && row.can_delete;
      return {
        ...ed,
        perms: {
          ...ed.perms,
          [moduleKey]: {
            can_read: !all,
            can_create: !all,
            can_update: !all,
            can_delete: !all,
          },
        },
      };
    });

  const save = () => {
    if (!editor.name.trim()) {
      toast.error(t("roles.toast.nameRequired"));
      return;
    }
    const permissions = catalog
      .map((m) => ({ module_key: m.key, ...editor.perms[m.key] }))
      .filter((p) => p.can_read || p.can_create || p.can_update || p.can_delete);
    saveProjectRole(projectId, {
      id: editor.id,
      name: editor.name.trim(),
      description: editor.description,
      permissions,
    });
    toast.success(t(editor.id ? "roles.toast.updated" : "roles.toast.created"));
    setEditor(null);
    loadRoles();
  };

  const remove = (role) => {
    if (!window.confirm(t("roles.confirmDelete", { name: role.name }))) return;
    deleteProjectRole(role.id);
    toast.success(t("roles.toast.deleted"));
    loadRoles();
  };

  const grantSummary = (role) => {
    const n = (role.permissions || []).filter((p) => p.can_read || p.can_create || p.can_update || p.can_delete).length;
    return n ? t("roles.moduleCount", { count: n }) : t("roles.noAccess");
  };

  const catalogLabel = useMemo(() => {
    const m = {};
    catalog.forEach((c) => (m[c.key] = c.label));
    return m;
  }, [catalog]);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      {/* Project picker + create */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="min-w-0">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            {t("roles.project")}
          </label>
          {projects.length === 0 ? (
            <p className="text-sm text-gray-400">{t("roles.noOwnedProjects")}</p>
          ) : (
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full sm:w-72 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
        </div>
        {projectId && (
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#17A2B8] hover:bg-[#138496] whitespace-nowrap self-start sm:self-auto"
          >
            <MdOutlineAdd className="text-lg" /> {t("roles.newRole")}
          </button>
        )}
      </div>

      {/* Roles list */}
      {!projectId ? null : loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">{t("roles.loading")}</p>
      ) : roles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
            <MdOutlineShield className="text-2xl text-gray-400" />
          </div>
          <h3 className="text-sm font-semibold text-gray-700">{t("roles.empty.title")}</h3>
          <p className="text-sm text-gray-400 mt-1 max-w-sm">
            {t("roles.empty.subtitle")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {roles.map((role) => (
            <div key={role.id} className="border border-gray-200 rounded-lg px-4 py-3 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-800">{role.name}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-700 font-semibold">
                    {grantSummary(role)}
                  </span>
                  {role.is_active === false && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-semibold">{t("roles.inactive")}</span>
                  )}
                </div>
                {role.description && <p className="text-sm text-gray-500 mt-0.5">{role.description}</p>}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(role.permissions || [])
                    .filter((p) => p.can_read || p.can_create || p.can_update || p.can_delete)
                    .map((p) => (
                      <span key={p.module_key} className="text-[11px] px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                        {catalogLabel[p.module_key] || p.module_key}
                        {" "}
                        <span className="text-gray-400">
                          {[p.can_read && t("roles.abbr.read"), p.can_create && t("roles.abbr.create"), p.can_update && t("roles.abbr.update"), p.can_delete && t("roles.abbr.delete")].filter(Boolean).join("")}
                        </span>
                      </span>
                    ))}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => openEdit(role)} title={t("roles.edit")} className="p-2 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded">
                  <MdOutlineEdit />
                </button>
                <button onClick={() => remove(role)} title={t("roles.delete")} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
                  <MdOutlineDelete />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor modal */}
      {editor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setEditor(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-blue-900">{editor.id ? t("roles.editRole") : t("roles.newRole")}</h2>
              <button onClick={() => setEditor(null)} className="text-gray-400 hover:text-gray-600">
                <MdOutlineClose className="text-xl" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t("roles.form.name")}</label>
                <input
                  value={editor.name}
                  onChange={(e) => setEditor({ ...editor, name: e.target.value })}
                  placeholder={t("roles.form.namePlaceholder")}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t("roles.form.description")} <span className="text-gray-400 font-normal">{t("roles.form.optional")}</span></label>
                <input
                  value={editor.description}
                  onChange={(e) => setEditor({ ...editor, description: e.target.value })}
                  placeholder={t("roles.form.descriptionPlaceholder")}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              {/* Permission grid */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t("roles.form.permissions")}</label>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
                      <tr>
                        <th className="text-left px-3 py-2">{t("roles.form.module")}</th>
                        {ACTIONS.map((a) => (
                          <th key={a.key} className="text-center px-2 py-2 w-16">{t(a.labelKey)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {catalog.map((m) => (
                        <tr key={m.key} className="hover:bg-gray-50/50">
                          <td className="px-3 py-2">
                            <button type="button" onClick={() => toggleRow(m.key)} className="text-gray-700 hover:text-cyan-600 text-left">
                              {m.label}
                            </button>
                          </td>
                          {ACTIONS.map((a) => (
                            <td key={a.key} className="text-center px-2 py-2">
                              <input
                                type="checkbox"
                                checked={!!editor.perms[m.key]?.[a.key]}
                                onChange={() => togglePerm(m.key, a.key)}
                                className="accent-cyan-600 w-4 h-4"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-gray-400 mt-1.5">{t("roles.form.tip")}</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setEditor(null)} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100">{t("roles.cancel")}</button>
              <button
                onClick={save}
                disabled={saving}
                className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {editor.id ? t("roles.saveChanges") : t("roles.createRole")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
