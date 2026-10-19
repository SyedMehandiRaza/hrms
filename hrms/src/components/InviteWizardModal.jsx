import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import {
  MdOutlineClose,
  MdOutlineSearch,
  MdOutlineBusiness,
  MdOutlineCheckCircle,
} from "react-icons/md";

import {
  INVITABLE_PROJECTS,
  eligibleParents,
  searchCompanies,
  projectRolesFor,
  createInvitations,
} from "../data/groupB";

// Which child roles each role is allowed to invite.
const CHILD_ROLES = {
  OWNER: ["CONSULTANT", "EPC", "SUBCONTRACTOR"],
  CONSULTANT: ["EPC"],
  EPC: ["SUBCONTRACTOR"],
  SUBCONTRACTOR: [],
};

const ALL_ROLES = [
  { key: "CONSULTANT" },
  { key: "EPC" },
  { key: "SUBCONTRACTOR" },
];

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || "").trim());

function InviteWizardModal({ isOpen, onClose, onSuccess }) {
  const { t } = useTranslation("collaboration");
  const roleLabel = (r) => (r ? t(`role.${r}`, { defaultValue: r }) : r);
  const actionLoading = false;

  // Invitee
  const [query, setQuery] = useState("");
  const [selectedCompany, setSelectedCompany] = useState(null);
  const searching = false;

  // Projects (owned + invited-to) with my role on each
  const projects = INVITABLE_PROJECTS;
  const [selectedProjects, setSelectedProjects] = useState([]);
  const loadingProjects = false;

  const [chosenRole, setRole] = useState("");
  const [chosenParentId, setParentId] = useState("");
  const loadingParents = false;

  // Collaboration role — only when inviting to a SINGLE project the caller OWNS
  // (roles are project-scoped and owner-defined).
  const [chosenCollabRoleId, setCollabRoleId] = useState("");

  // Reset when the modal opens.
  const [wasOpen, setWasOpen] = useState(false);
  if (wasOpen !== !!isOpen) {
    setWasOpen(!!isOpen);
    if (isOpen) {
      setQuery("");
      setSelectedCompany(null);
      setSelectedProjects([]);
      setRole("");
      setParentId("");
      setCollabRoleId("");
    }
  }

  // Company search (static directory; skipped once a company is selected).
  const results = useMemo(
    () => (!isOpen || selectedCompany ? [] : searchCompanies(query)),
    [isOpen, selectedCompany, query],
  );

  // Roles the acting company may add = intersection of what its role allows on
  // every selected project.
  const allowedRoles = useMemo(() => {
    if (selectedProjects.length === 0) return [];
    const sets = selectedProjects.map((pid) => {
      const proj = projects.find((p) => p.id === pid);
      return new Set(CHILD_ROLES[proj?.myRole] || []);
    });
    return ALL_ROLES.map((r) => r.key).filter((k) =>
      sets.every((s) => s.has(k)),
    );
  }, [selectedProjects, projects]);

  // Keep the selected role valid as projects change.
  const role = allowedRoles.includes(chosenRole) ? chosenRole : allowedRoles[0] || "";

  const needsParent = role === "EPC" || role === "SUBCONTRACTOR";

  const singleOwnedProjectId =
    selectedProjects.length === 1 &&
    projects.find((p) => p.id === selectedProjects[0])?.myRole === "OWNER"
      ? selectedProjects[0]
      : null;

  // Cascading parent = intersection of eligible parents across selected
  // projects (auto-selected when there's only one).
  const parents = useMemo(() => {
    if (!isOpen || !needsParent || selectedProjects.length === 0) return [];
    const [first = [], ...rest] = selectedProjects.map((pid) => eligibleParents(pid, role));
    return first.filter((p) =>
      rest.every((l) => l.some((x) => x.employerId === p.employerId)),
    );
  }, [isOpen, needsParent, role, selectedProjects]);
  const parentId = parents.some((p) => String(p.employerId) === String(chosenParentId))
    ? chosenParentId
    : parents.length === 1
      ? String(parents[0].employerId)
      : "";

  // The project's collaboration roles when a single owned project is chosen.
  const collabRoles = useMemo(
    () => (isOpen && singleOwnedProjectId ? projectRolesFor(singleOwnedProjectId) : []),
    [isOpen, singleOwnedProjectId],
  );
  const collabRoleId = singleOwnedProjectId ? chosenCollabRoleId : "";

  const toggleProject = (id) =>
    setSelectedProjects((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const pickCompany = (c) => {
    setSelectedCompany(c);
    setQuery(c.name || c.email || "");
  };

  const clearCompany = () => {
    setSelectedCompany(null);
    setQuery("");
  };

  const inviteeValid = !!selectedCompany || isEmail(query);

  const canSubmit =
    inviteeValid &&
    selectedProjects.length > 0 &&
    role &&
    allowedRoles.includes(role) &&
    (!needsParent || parentId) &&
    !actionLoading;

  const onSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    const payload = { role, projectIds: selectedProjects };
    if (selectedCompany) payload.invitedEmployerId = selectedCompany.employerId;
    else payload.invitedEmail = query.trim();
    if (needsParent) payload.parentEmployerId = Number(parentId);
    if (singleOwnedProjectId && collabRoleId)
      payload.collaborationRoleId = Number(collabRoleId);

    // Static build: the invitation is added to the in-memory store.
    createInvitations(payload);
    toast.success(t("wizard.toast.sent"));
    onSuccess?.();
    onClose();
  };

  if (!isOpen) return null;

  const inputCls =
    "w-full ps-12 pe-4 py-2.5 bg-gray-100 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white transition-all";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-blue-900">{t("wizard.title")}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <MdOutlineClose className="text-xl" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="px-6 py-5 space-y-5">
          {/* 1. Invitee */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {t("wizard.company")}
            </label>
            <div className="relative">
              {selectedCompany ? (
                <MdOutlineCheckCircle className="absolute start-4 top-3 text-green-500 text-lg" />
              ) : (
                <MdOutlineSearch className="absolute start-4 top-3 text-gray-400 text-lg" />
              )}
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (selectedCompany) setSelectedCompany(null);
                }}
                placeholder={t("wizard.companyPlaceholder")}
                className={inputCls}
                autoComplete="off"
              />
              {selectedCompany && (
                <button
                  type="button"
                  onClick={clearCompany}
                  className="absolute end-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  <MdOutlineClose />
                </button>
              )}
              {!selectedCompany && results.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                  {results.map((c) => (
                    <button
                      type="button"
                      key={c.employerId}
                      onClick={() => pickCompany(c)}
                      className="w-full text-start px-4 py-2 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <MdOutlineBusiness className="text-gray-400 flex-shrink-0" />
                      <span className="min-w-0">
                        <span className="block text-sm text-gray-800 truncate">
                          {c.name || t("wizard.unnamed")}
                        </span>
                        {c.email && (
                          <span className="block text-xs text-gray-400 truncate">
                            {c.email}
                          </span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {selectedCompany
                ? t("wizard.hint.selected")
                : searching
                  ? t("wizard.hint.searching")
                  : isEmail(query)
                    ? t("wizard.hint.emailInvite")
                    : t("wizard.hint.pick")}
            </p>
          </div>

          {/* 2. Projects (owned + invited-to) */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {t("wizard.projects")}
            </label>
            {loadingProjects ? (
              <p className="text-sm text-gray-400">{t("wizard.loadingProjects")}</p>
            ) : projects.length === 0 ? (
              <p className="text-sm text-gray-400">
                {t("wizard.noProjects")}
              </p>
            ) : (
              <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                {projects.map((p) => (
                  <label
                    key={p.id}
                    className="flex items-center justify-between gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50"
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={selectedProjects.includes(p.id)}
                        onChange={() => toggleProject(p.id)}
                        className="accent-cyan-600 w-4 h-4"
                      />
                      <span className="text-sm text-gray-700 truncate">{p.name}</span>
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 flex-shrink-0">
                      {roleLabel(p.myRole)}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* 3. Role (only what my role can add on the selected projects) */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {t("wizard.inviteAs")}
            </label>
            {selectedProjects.length === 0 ? (
              <p className="text-sm text-gray-400">{t("wizard.selectProjectFirst")}</p>
            ) : allowedRoles.length === 0 ? (
              <p className="text-sm text-amber-600">
                {t("wizard.cannotInvite")}
              </p>
            ) : (
              <div className="flex gap-2">
                {ALL_ROLES.filter((r) => allowedRoles.includes(r.key)).map((r) => (
                  <button
                    type="button"
                    key={r.key}
                    onClick={() => setRole(r.key)}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                      role === r.key
                        ? "border-cyan-600 bg-cyan-50 text-cyan-700"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {roleLabel(r.key)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 4. Parent (cascading) */}
          {needsParent && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t("wizard.underParent", { role: roleLabel(role === "EPC" ? "CONSULTANT" : "EPC") })}
              </label>
              <div className="relative">
                <MdOutlineBusiness className="absolute start-4 top-3 text-gray-400 text-lg" />
                <select
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  disabled={loadingParents || parents.length === 0}
                  className={`${inputCls} appearance-none disabled:opacity-60`}
                >
                  <option value="">
                    {loadingParents
                      ? t("wizard.loading")
                      : parents.length === 0
                        ? t("wizard.noEligibleParent")
                        : t("wizard.selectParent")}
                  </option>
                  {parents.map((p) => (
                    <option key={p.employerId} value={p.employerId}>
                      {p.name || t("wizard.companyFallback", { id: p.employerId })}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {t("wizard.parentHint")}
              </p>
            </div>
          )}

          {/* 5. Collaboration role (only for a single project you own) */}
          {singleOwnedProjectId && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t("wizard.collabRole")}{" "}
                <span className="text-gray-400 font-normal">{t("wizard.optional")}</span>
              </label>
              <div className="relative">
                <MdOutlineBusiness className="absolute start-4 top-3 text-gray-400 text-lg" />
                <select
                  value={collabRoleId}
                  onChange={(e) => setCollabRoleId(e.target.value)}
                  className={`${inputCls} appearance-none`}
                >
                  <option value="">{t("wizard.noRole")}</option>
                  {collabRoles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {collabRoles.length === 0
                  ? t("wizard.noRolesHint")
                  : t("wizard.roleHint")}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100"
            >
              {t("wizard.cancel")}
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {actionLoading && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {t("wizard.send")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default InviteWizardModal;
