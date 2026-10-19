import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import {
  MdOutlineAdd,
  MdChevronRight,
  MdChevronLeft,
  MdOutlinePeople,
  MdOutlineMonetizationOn,
  MdOutlineCalendarToday,
  MdOutlineDescription,
  MdOutlineLocalHospital,
  MdOutlineBarChart,
  MdInfoOutline,
  MdOutlineOpenInNew,
  MdOutlineShield,
  MdOutlinePersonAdd,
  MdOutlineSync,
} from "react-icons/md";
import { TableLoader } from "./Loader";
import Can from "./Can";
import { MODULES, ACTIONS } from "../constants/permissions";
import { RBAC_MODULES, RBAC_ROLES, nextId } from "../data/groupA";

// ── Display labels for the 4 API CRUD flags ───────────────────────────────────
const PERM_KEYS = ["view", "create", "edit", "delete"];
const PERM_TO_API = {
  view: "can_read",
  create: "can_create",
  edit: "can_update",
  delete: "can_delete",
};

const PAGE_SIZE = 6;

// ── Module name → display metadata ────────────────────────────────────────────
// The API returns only { id, module }. We attach an icon / colors here; the
// human-readable label/sub are resolved from the "settings" namespace at render
// time (roles.modules.<module>.label / .sub), keyed by the module name.
const MODULE_META = {
  approval_group: {
    icon: MdOutlineShield,
    iconBg: "bg-indigo-50",
    iconColor: "text-indigo-600",
  },
  attendance: {
    icon: MdOutlineCalendarToday,
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
  },
  correction: {
    icon: MdOutlineSync,
    iconBg: "bg-yellow-50",
    iconColor: "text-yellow-600",
  },
  employee: {
    icon: MdOutlinePeople,
    iconBg: "bg-cyan-50",
    iconColor: "text-cyan-600",
  },
  holiday: {
    icon: MdOutlineCalendarToday,
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
  },
  staffing_company: {
    icon: MdOutlinePeople,
    iconBg: "bg-violet-50",
    iconColor: "text-violet-600",
  },
  leave: {
    icon: MdOutlineCalendarToday,
    iconBg: "bg-orange-50",
    iconColor: "text-orange-600",
  },
  leave_approval: {
    icon: MdOutlineShield,
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
  },
  leave_category: {
    icon: MdOutlineDescription,
    iconBg: "bg-fuchsia-50",
    iconColor: "text-fuchsia-600",
  },
  leave_policy: {
    icon: MdOutlineDescription,
    iconBg: "bg-pink-50",
    iconColor: "text-pink-600",
  },
  leave_type: {
    icon: MdOutlineDescription,
    iconBg: "bg-rose-50",
    iconColor: "text-rose-600",
  },
  module: {
    icon: MdOutlineBarChart,
    iconBg: "bg-gray-100",
    iconColor: "text-gray-600",
  },
  notification: {
    icon: MdOutlineDescription,
    iconBg: "bg-purple-50",
    iconColor: "text-purple-600",
  },
  office: {
    icon: MdOutlinePeople,
    iconBg: "bg-cyan-50",
    iconColor: "text-cyan-600",
  },
  office_location: {
    icon: MdOutlineLocalHospital,
    iconBg: "bg-teal-50",
    iconColor: "text-teal-600",
  },
  payroll: {
    icon: MdOutlineMonetizationOn,
    iconBg: "bg-green-50",
    iconColor: "text-green-600",
  },
  project: {
    icon: MdOutlineBarChart,
    iconBg: "bg-lime-50",
    iconColor: "text-lime-600",
  },
  role: {
    icon: MdOutlineShield,
    iconBg: "bg-slate-50",
    iconColor: "text-slate-600",
  },
  salary: {
    icon: MdOutlineMonetizationOn,
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
  },
  shift: {
    icon: MdOutlineCalendarToday,
    iconBg: "bg-sky-50",
    iconColor: "text-sky-600",
  },
};

const DEFAULT_META = {
  icon: MdOutlineShield,
  iconBg: "bg-gray-50",
  iconColor: "text-gray-500",
};

const decorateModule = (mod) => {
  const meta = MODULE_META[mod.module] || DEFAULT_META;
  return { ...mod, ...meta };
};

// Resolve the display label/sub for a module from translations, falling back to
// the raw module name when the module isn't in the known set.
const moduleLabel = (t, mod) =>
  MODULE_META[mod.module]
    ? t(`roles.modules.${mod.module}.label`)
    : mod.module;
const moduleSub = (t, mod) =>
  MODULE_META[mod.module] ? t(`roles.modules.${mod.module}.sub`) : "";

// Build the local perms shape { [moduleId]: { view, create, edit, delete } } for a role.
const buildPermsFromRole = (role, modules) => {
  const result = {};
  modules.forEach((mod) => {
    const rolePerm = role.permissions?.find((p) => p.module_id === mod.id);
    result[mod.id] = PERM_KEYS.reduce((acc, key) => {
      acc[key] = rolePerm?.[PERM_TO_API[key]] ?? false;
      return acc;
    }, {});
  });
  return result;
};

// ── Checkbox ──────────────────────────────────────────────────────────────────
const PermCheckbox = ({ checked, onChange, disabled }) => (
  <button
    type="button"
    onClick={onChange}
    disabled={disabled}
    className={`w-5 h-5 rounded flex items-center justify-center transition-colors border-2 ${checked
      ? "bg-cyan-600 border-cyan-600"
      : "bg-white border-gray-300 hover:border-cyan-400"
      } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
  >
    {checked && (
      <svg
        className="w-3 h-3 text-white"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={3}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    )}
  </button>
);

// ── Main ──────────────────────────────────────────────────────────────────────
export default function RolesPermissions() {
  const { t } = useTranslation("settings");
  const [modules] = useState(() => RBAC_MODULES.map(decorateModule));
  const [roles, setRoles] = useState(RBAC_ROLES);
  const [activeRole, setActiveRole] = useState(RBAC_ROLES[0]?.id ?? null);
  const [perms, setPerms] = useState(() => {
    const decoratedMods = RBAC_MODULES.map(decorateModule);
    const initialPerms = {};
    RBAC_ROLES.forEach((role) => {
      initialPerms[role.id] = buildPermsFromRole(role, decoratedMods);
    });
    return initialPerms;
  });
  const [modPage, setModPage] = useState(1);
  const [showRoleModal, setShowRoleModal] = useState(false);

  const loading = false;
  const [savingPerms, setSavingPerms] = useState(false);
  const [creatingRole, setCreatingRole] = useState(false);
  const [saved, setSaved] = useState(false);

  const totalModPages = Math.max(1, Math.ceil(modules.length / PAGE_SIZE));
  const visibleModules = modules.slice(
    (modPage - 1) * PAGE_SIZE,
    modPage * PAGE_SIZE,
  );
  const currentRole = roles.find((r) => r.id === activeRole) || null;

  const toggle = (moduleId, key) => {
    if (!activeRole) return;
    setPerms((prev) => ({
      ...prev,
      [activeRole]: {
        ...prev[activeRole],
        [moduleId]: {
          ...prev[activeRole]?.[moduleId],
          [key]: !prev[activeRole]?.[moduleId]?.[key],
        },
      },
    }));
  };


  const handleSave = () => {
    if (!activeRole) return;

    const rolePerms = perms[activeRole] || {};
    const permissions = Object.entries(rolePerms).map(([moduleId, flags]) => ({
      module_id: Number(moduleId),
      can_create: !!flags.create,
      can_read: !!flags.view,
      can_update: !!flags.edit,
      can_delete: !!flags.delete,
    }));

    setSavingPerms(false);
    // Sync the saved snapshot in local roles state so Discard works correctly.
    setRoles((prev) =>
      prev.map((r) =>
        r.id === activeRole
          ? {
            ...r,
            permissions: permissions.map((p) => ({
              ...p,
              module:
                modules.find((m) => m.id === p.module_id)?.module || "",
            })),
          }
          : r,
      ),
    );

    toast.success(t("roles.toast.permissionsUpdated"));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleDiscard = () => {
    if (!activeRole || !currentRole) return;
    setPerms((prev) => ({
      ...prev,
      [activeRole]: buildPermsFromRole(currentRole, modules),
    }));
  };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const handleCreateRole = (data) => {
    setCreatingRole(false);
    const newRole = {
      id: nextId(roles),
      name: data.name.trim(),
      description: data.description.trim(),
      permissions: [],
    };

    setRoles((prev) => [...prev, newRole]);
    setPerms((prev) => ({
      ...prev,
      [newRole.id]: buildPermsFromRole(newRole, modules),
    }));
    setActiveRole(newRole.id);
    setModPage(1);

    toast.success(t("roles.toast.created"));
    setShowRoleModal(false);
    reset();
  };

  return (
    <div className="space-y-6">
      {/* Page-level action buttons */}
      <div className="flex items-center justify-end gap-3">
        <Can module={MODULES.ROLE} action={ACTIONS.CREATE}>
          <button
            onClick={() => setShowRoleModal(true)}
            className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm transition-colors"
          >
            <MdOutlineAdd className="text-lg" /> {t("roles.createCustomRole")}
          </button>
        </Can>
      </div>

      {/* ── Two-column layout ── */}
      <div className="flex flex-col lg:flex-row gap-5 items-start">
        {/* Left: Role List + About */}
        <div className="w-full lg:w-64 xl:w-72 flex-shrink-0 space-y-4">
          {/* Organization Roles */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                {t("roles.organizationRoles")}
              </p>
            </div>
            <div className="divide-y divide-gray-50 max-h-[500px] overflow-y-auto custom-scrollbar" style={{ scrollbarWidth: 'thin' }}>
              {loading && roles.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-gray-400">
                  {t("roles.loadingRoles")}
                </div>
              ) : roles.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-gray-400">
                  {t("roles.noRoles")}
                </div>
              ) : (
                roles.map((role) => (
                  <button
                    key={role.id}
                    onClick={() => {
                      setActiveRole(role.id);
                      setModPage(1);
                    }}
                    className={`w-full flex items-center justify-between px-4 py-4 text-start transition-colors group relative ${activeRole === role.id
                      ? "bg-gray-50"
                      : "hover:bg-gray-50"
                      }`}
                  >
                    {activeRole === role.id && (
                      <div className="absolute start-0 top-2 bottom-2 w-0.5 bg-cyan-600 rounded-e-full" />
                    )}
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-semibold ${activeRole === role.id
                          ? "text-cyan-600"
                          : "text-gray-900"
                          }`}
                      >
                        {role.name}
                      </p>
                      <p
                        className={`text-xs mt-0.5 truncate ${activeRole === role.id
                          ? "text-cyan-500"
                          : "text-gray-400"
                          }`}
                      >
                        {role.description || t("roles.noDescription")}
                      </p>
                    </div>
                    <MdChevronRight
                      className={`text-xl flex-shrink-0 rtl:rotate-180 ${activeRole === role.id
                        ? "text-cyan-500"
                        : "text-gray-300"
                        }`}
                    />
                  </button>
                ))
              )}
            </div>
          </div>

          {/* About Roles */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="w-10 h-10 bg-cyan-50 rounded-xl flex items-center justify-center mb-3">
              <MdInfoOutline className="text-cyan-600 text-xl" />
            </div>
            <p className="text-sm font-bold text-gray-900 mb-2">
              {t("roles.aboutRoles")}
            </p>
            <p className="text-xs text-gray-500 leading-relaxed mb-3">
              {t("roles.aboutRolesDesc")}
            </p>
            <button className="flex items-center gap-1 text-xs font-semibold text-cyan-600 hover:text-cyan-700 transition-colors">
              {t("roles.readDocumentation")} <MdOutlineOpenInNew className="text-sm" />
            </button>
          </div>
        </div>

        {/* Right: Permissions Table */}
        <div className="flex-1 bg-white border border-gray-200 rounded-xl overflow-hidden min-w-0">
          {/* Panel Header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 px-5 py-4 border-b border-gray-100">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-gray-900 break-all">
                  {t("roles.permissionsFor", {
                    name: currentRole?.name || t("roles.noDescription"),
                  })}
                </h3>
                {activeRole === 1 && (
                  <span className="text-[10px] font-bold text-cyan-700 bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded-full uppercase tracking-wider flex-shrink-0">
                    {t("roles.defaultRole")}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1 break-all">
                {currentRole?.description || t("roles.selectRolePrompt")}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
              <button
                onClick={handleDiscard}
                disabled={!activeRole || savingPerms}
                className="px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
              >
                {t("roles.discard")}
              </button>
              <Can module={MODULES.ROLE} action={ACTIONS.UPDATE}>
                <button
                  onClick={handleSave}
                  disabled={!activeRole || savingPerms}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors text-white disabled:opacity-60 disabled:cursor-not-allowed ${saved ? "bg-green-500" : "bg-cyan-600 hover:bg-cyan-700"
                    }`}
                >
                  {savingPerms
                    ? t("roles.saving")
                    : saved
                      ? t("roles.saved")
                      : t("roles.saveChanges")}
                </button>
              </Can>
            </div>
          </div>

          {/* Desktop Table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-start px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    {t("roles.table.sn")}
                  </th>
                  <th className="text-start px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    {t("roles.table.module")}
                  </th>
                  {PERM_KEYS.map((k) => (
                    <th
                      key={k}
                      className="text-center px-3 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider w-20"
                    >
                      {t(`roles.table.${k}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading && modules.length === 0 ? (
                  <TableLoader
                    colSpan={2 + PERM_KEYS.length}
                    label={t("roles.loadingModules")}
                  />
                ) : modules.length === 0 ? (
                  <tr>
                    <td
                      colSpan={2 + PERM_KEYS.length}
                      className="px-5 py-10 text-center text-sm text-gray-400"
                    >
                      {t("roles.noModules")}
                    </td>
                  </tr>
                ) : (
                  visibleModules.map((mod, index) => {
                    const Icon = mod.icon;
                    return (
                      <tr
                        key={mod.id}
                        className="hover:bg-gray-50/50 transition-colors"
                      >
                        <td className="px-5 py-4 text-sm text-gray-700">
                          {(modPage - 1) * PAGE_SIZE + index + 1}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 ${mod.iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}
                            >
                              <Icon className={`${mod.iconColor} text-lg`} />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-900">
                                {moduleLabel(t, mod)}
                              </p>
                              <p className="text-xs text-gray-400">
                                {moduleSub(t, mod)}
                              </p>
                            </div>
                          </div>
                        </td>
                        {PERM_KEYS.map((key) => (
                          <td key={key} className="px-3 py-4 text-center">
                            <div className="flex justify-center">
                              <PermCheckbox
                                checked={
                                  perms[activeRole]?.[mod.id]?.[key] ?? false
                                }
                                onChange={() => toggle(mod.id, key)}
                                disabled={!activeRole}
                              />
                            </div>
                          </td>
                        ))}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="sm:hidden divide-y divide-gray-100">
            {visibleModules.map((mod) => {
              const Icon = mod.icon;
              return (
                <div key={mod.id} className="px-4 py-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 ${mod.iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}
                    >
                      <Icon className={`${mod.iconColor} text-lg`} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {moduleLabel(t, mod)}
                      </p>
                      <p className="text-xs text-gray-400">
                        {moduleSub(t, mod)}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {PERM_KEYS.map((key) => (
                      <div
                        key={key}
                        className="flex flex-col items-center gap-1"
                      >
                        <p className="text-[9px] font-bold text-gray-400 uppercase">
                          {t(`roles.table.${key}`)}
                        </p>
                        <PermCheckbox
                          checked={perms[activeRole]?.[mod.id]?.[key] ?? false}
                          onChange={() => toggle(mod.id, key)}
                          disabled={!activeRole}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Table Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 order-2 sm:order-1">
              {t("roles.footerNote")}
            </p>
            <div className="flex items-center gap-2 order-1 sm:order-2">
              <span className="text-xs text-gray-400 hidden sm:inline">
                {t("roles.viewing", {
                  from: modules.length === 0 ? 0 : (modPage - 1) * PAGE_SIZE + 1,
                  to: Math.min(modPage * PAGE_SIZE, modules.length),
                  total: modules.length,
                })}
              </span>
              <button
                onClick={() => setModPage((p) => Math.max(1, p - 1))}
                disabled={modPage === 1}
                className="w-7 h-7 flex items-center justify-center border border-gray-200 rounded-md text-gray-400 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <MdChevronLeft className="text-base rtl:rotate-180" />
              </button>
              <button
                onClick={() =>
                  setModPage((p) => Math.min(totalModPages, p + 1))
                }
                disabled={modPage === totalModPages}
                className="w-7 h-7 flex items-center justify-center border border-gray-200 rounded-md text-gray-400 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <MdChevronRight className="text-base rtl:rotate-180" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom Stats ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            id: "activeRoles",
            icon: MdOutlineShield,
            iconBg: "bg-cyan-50",
            iconColor: "text-cyan-600",
            tag: t("roles.stats.activeRoles"),
            value: String(roles.length),
          },
          {
            id: "assignedUsers",
            icon: MdOutlinePersonAdd,
            iconBg: "bg-green-50",
            iconColor: "text-green-600",
            tag: t("roles.stats.assignedUsers"),
            value: "1,248",
          },
          {
            id: "lastSync",
            icon: MdOutlineSync,
            iconBg: "bg-amber-50",
            iconColor: "text-amber-600",
            tag: t("roles.stats.lastSync"),
            value: t("roles.stats.lastSyncValue"),
          },
        ].map(({ id, icon: Icon, iconBg, iconColor, tag, value }) => (
          <div
            key={id}
            className="bg-white border border-gray-200 rounded-xl p-5 flex items-center gap-4"
          >
            <div
              className={`w-12 h-12 ${iconBg} rounded-xl flex items-center justify-center flex-shrink-0`}
            >
              <Icon className={`${iconColor} text-2xl`} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                {tag}
              </p>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Create Role Modal ───────────────────────────── */}
      {showRoleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {t("roles.modal.title")}
                </h2>

                <p className="text-sm text-gray-400 mt-1">
                  {t("roles.modal.subtitle")}
                </p>
              </div>

              <button
                onClick={() => {
                  setShowRoleModal(false);
                  reset();
                }}
                className="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(handleCreateRole)}>
              {/* Body */}
              <div className="p-6 space-y-5">
                {/* Role Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {t("roles.modal.roleName")}
                  </label>

                  <input
                    type="text"
                    placeholder={t("roles.modal.roleNamePlaceholder")}
                    onInput={(e) => {
                      const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
                      e.target.value = e.target.value
                        .replace(emojiRegex, "")
                        .replace(/_/g, "")
                        .replace(/^\s+/, "")
                        .replace(/\s{2,}/g, " ");
                    }}
                    {...register("name", {
                      required: t("roles.validation.nameRequired"),
                      minLength: {
                        value: 2,
                        message: t("roles.validation.nameMin"),
                      },
                      maxLength: {
                        value: 50,
                        message: t("roles.validation.nameMax"),
                      },
                    })}
                    className={`w-full h-11 px-4 border rounded-xl focus:outline-none focus:ring-2 text-sm transition-colors ${errors.name
                      ? "border-red-300 focus:ring-red-500"
                      : "border-gray-200 focus:ring-cyan-500"
                      }`}
                  />

                  {errors.name && (
                    <p className="text-red-500 text-xs mt-2">
                      {errors.name.message}
                    </p>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {t("roles.modal.description")}
                  </label>

                  <textarea
                    rows={4}
                    placeholder={t("roles.modal.descriptionPlaceholder")}
                    onInput={(e) => {
                      const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
                      e.target.value = e.target.value
                        .replace(emojiRegex, "")
                        .replace(/_/g, "")
                        .replace(/^\s+/, "")
                        .replace(/\s{2,}/g, " ");
                    }}
                    {...register("description", {
                      required: t("roles.validation.descriptionRequired"),
                      validate: (v) => v.trim().length >= 10 || t("roles.validation.descriptionMin"),
                      maxLength: {
                        value: 255,
                        message: t("roles.validation.descriptionMax"),
                      },
                    })}
                    className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 text-sm resize-none transition-colors ${errors.description
                      ? "border-red-300 focus:ring-red-500"
                      : "border-gray-200 focus:ring-cyan-500"
                      }`}
                  />

                  {errors.description && (
                    <p className="text-red-500 text-xs mt-2">
                      {errors.description.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
                <button
                  type="button"
                  onClick={() => {
                    setShowRoleModal(false);
                    reset();
                  }}
                  disabled={creatingRole}
                  className="px-4 py-2 border border-gray-200 text-gray-600 hover:bg-white disabled:opacity-60 rounded-lg text-sm font-medium transition-colors"
                >
                  {t("roles.modal.cancel")}
                </button>

                <button
                  type="submit"
                  disabled={creatingRole}
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  {creatingRole ? t("roles.modal.creating") : t("roles.modal.createRole")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
