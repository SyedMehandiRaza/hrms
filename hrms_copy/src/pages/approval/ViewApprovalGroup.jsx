import { useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  MdOutlineAdd,
  MdOutlineEdit,
  MdOutlineSearch,
  MdOutlineChevronRight,
} from "react-icons/md";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next"
import Ltr from "../../components/Ltr";
import AddApprovalMembersModal from "../../components/AddApprovalMembersModal";
import EditApprovalGroupModal from "../../components/EditApprovalGroupModal";
import Can from "../../components/Can";
import { MODULES, ACTIONS } from "../../constants/permissions";
import { TableLoader } from "../../components/Loader";
import { APPR_EMPLOYEES, APPR_findGroup, APPR_updateGroup } from "../../data/groupD";

const prettyModule = (key = "") =>
  key.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function ViewApprovalGroup() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation("approvals");

  // Look the group up by URL id; unknown ids render the "not found" state.
  const [overrides, setOverrides] = useState({});
  const group = overrides[id] || APPR_findGroup(id);
  const detailLoading = false;
  const updateLoading = false;
  const employees = APPR_EMPLOYEES;

  const [search, setSearch] = useState("");
  const [openModal, setOpenModal] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  // Flatten active members across levels.
  const members = useMemo(() => {
    if (!group?.levels) return [];
    return group.levels
      .flatMap((lvl) =>
        (lvl.members || [])
          .filter((m) => m.is_active !== false)
          .map((m) => ({
            id: m.id,
            employee_id: m.employee_id,
            full_name: m.full_name,
            level_no: lvl.level_no,
            is_mandatory: m.is_mandatory,
            can_skip: m.can_skip,
          }))
      )
      .sort((a, b) => a.level_no - b.level_no);
  }, [group]);

  const filteredMembers = useMemo(() => {
    if (!search) return members;
    const q = search.toLowerCase();
    return members.filter(
      (m) =>
        (m.full_name || "").toLowerCase().includes(q) ||
        String(m.employee_id).includes(q)
    );
  }, [members, search]);

  const handleSaveMembers = (membersPayload) => {
    const updated = APPR_updateGroup(id, { members: membersPayload });
    if (updated) setOverrides((prev) => ({ ...prev, [id]: updated }));
    toast.success(t("toast.membersUpdated"));
    setOpenModal(false);
  };

  if (detailLoading && !group) {
    return (
      <div className="py-20 flex items-center justify-center text-gray-400 text-sm">
        <span className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin me-3" />
        {t("view.loading")}
      </div>
    );
  }

  if (!group) {
    return (
      <div className="py-20 flex flex-col items-center gap-3 text-center">
        <p className="text-gray-500 text-sm">{t("view.notFound")}</p>
        <button
          onClick={() => navigate("/admin/approvals")}
          className="text-cyan-600 hover:text-cyan-700 text-sm font-semibold"
        >
          {t("view.backToApprovals")}
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-sm flex-wrap mb-2">
          <Link
            to="/admin/approvals"
            className="text-gray-400 hover:text-cyan-600 transition-colors"
          >
            {t("title")}
          </Link>
          <MdOutlineChevronRight className="text-gray-300 rtl:rotate-180" />
          <span className="text-cyan-600 font-semibold">
            {group.group_name || "—"}
          </span>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
                {group.group_name}
              </h1>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-50 text-cyan-700 border border-cyan-100">
                {prettyModule(group.module_key)}
              </span>
              {!group.is_active && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
                  {t("view.inactive")}
                </span>
              )}
            </div>
            <p className="text-gray-500 mt-1 text-sm">
              <Ltr>{group.group_code}</Ltr> • {group.total_levels}{" "}
              {group.total_levels === 1
                ? t("view.levelSingular")
                : t("view.levelsPlural")}{" "}
              • {t("view.approvers", { count: members.length })}
            </p>
            {group.description && (
              <p className="text-gray-500 mt-1 text-sm">{group.description}</p>
            )}
          </div>
          <Can module={MODULES.APPROVAL_GROUP} action={ACTIONS.UPDATE}>
            <button
              onClick={() => setEditOpen(true)}
              className="flex items-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors me-2"
            >
              <MdOutlineEdit className="text-lg" /> Edit details
            </button>
          </Can>
          <Can module={MODULES.APPROVAL_GROUP} action={ACTIONS.UPDATE}>
            <button
              onClick={() => setOpenModal(true)}
              className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm transition-colors"
            >
              {members.length ? (
                <>
                  <MdOutlineEdit className="text-lg" /> {t("view.editMembers")}
                </>
              ) : (
                <>
                  <MdOutlineAdd className="text-lg" /> {t("view.addMembers")}
                </>
              )}
            </button>
          </Can>
        </div>

        {/* Search */}
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-4">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
            {t("search")}
          </p>
          <div className="relative border border-gray-200 rounded-lg">
            <MdOutlineSearch className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("view.searchMembersPlaceholder")}
              className="w-full ps-9 pe-3 py-2.5 text-sm bg-transparent focus:outline-none text-gray-700 placeholder-gray-400"
            />
          </div>
        </div>

        {/* Members table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  {[
                    t("view.table.sn"),
                    t("view.table.employee"),
                    t("view.table.level"),
                    t("view.table.mandatory"),
                    t("view.table.canSkip"),
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-start px-6 py-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {detailLoading && filteredMembers.length === 0 ? (
                  <TableLoader colSpan={5} label={t("view.loadingMembers")} />
                ) : filteredMembers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-12 text-center text-sm text-gray-400"
                    >
                      {t("view.noMembers")}
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((m, index) => (
                    <tr
                      key={`${m.id}-${m.level_no}`}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-semibold text-gray-900">
                          {m.full_name ||
                            t("view.employeeFallback", { id: m.employee_id })}
                        </p>
                        <span className="text-xs text-gray-400">
                          {t("view.idLabel")} <Ltr>{m.employee_id}</Ltr>
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-cyan-50 text-cyan-700 text-xs font-semibold border border-cyan-100">
                          {t("view.levelTag", { level: m.level_no })}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`text-xs font-medium ${m.is_mandatory ? "text-green-600" : "text-gray-400"}`}
                        >
                          {m.is_mandatory ? t("view.yes") : t("view.no")}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`text-xs font-medium ${m.can_skip ? "text-amber-600" : "text-gray-400"}`}
                        >
                          {m.can_skip ? t("view.yes") : t("view.no")}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-gray-100">
            {filteredMembers.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-gray-400">
                {t("view.noMembersShort")}
              </div>
            ) : (
              filteredMembers.map((m) => (
                <div key={`${m.id}-${m.level_no}`} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {m.full_name ||
                          t("view.employeeFallback", { id: m.employee_id })}
                      </p>
                      <span className="text-xs text-gray-400">
                        {t("view.idLabel")} <Ltr>{m.employee_id}</Ltr>
                      </span>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-cyan-50 text-cyan-700 text-xs font-semibold border border-cyan-100">
                      {t("view.levelTag", { level: m.level_no })}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>
                      {t("view.mandatoryLabel")}{" "}
                      {m.is_mandatory ? t("view.yes") : t("view.no")}
                    </span>
                    <span>
                      {t("view.canSkipLabel")}{" "}
                      {m.can_skip ? t("view.yes") : t("view.no")}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <AddApprovalMembersModal
        isOpen={openModal}
        onClose={() => setOpenModal(false)}
        employees={employees}
        existingMembers={members}
        onSave={handleSaveMembers}
        saving={updateLoading}
      />

      <EditApprovalGroupModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        group={group}
        onSaved={(updated) =>
          updated && setOverrides((prev) => ({ ...prev, [id]: updated }))
        }
      />
    </>
  );
}

export default ViewApprovalGroup;
