import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Pagination from "../../components/Pagination";
import {
  MdOutlineAdd,
  MdOutlineSearch,
  MdOutlineVisibility,
  MdOutlineDeleteOutline,
  MdOutlineClear,
} from "react-icons/md";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import Ltr from "../../components/Ltr";
import CreateApprovalGroupModal from "../../components/CreateApprovalGroupModal";
import ApprovalSettings from "../../components/ApprovalSettings";
import Loader from "../../components/Loader";
import { ScreenError } from "../../components/ScreenState";
import Can from "../../components/Can";
import ConfirmationModal from "../../components/ConfirmationModal";
import { MODULES, ACTIONS } from "../../constants/permissions";
import CustomDropdown from "../../components/CustomDropdown";
import useApiQuery from "../../hooks/useApiQuery";
import { listApprovalGroups, setApprovalGroupStatus } from "../../api/approvalGroups";
import { toastApiError } from "../../utils/apiError";

const PAGE_SIZE = 10;

const getId = (g) => g?.id;

const levelsOf = (g) => g?.total_levels ?? 0;

// A short, stable reference for a group (its uuid's first block).
const shortId = (g) => String(getId(g) || "").slice(0, 8).toUpperCase();

function Approval() {
  const navigate = useNavigate();
  const { t } = useTranslation("approvals");

  const prettyModule = (key) => (key === "ALL" ? t("allRequests") : key);
  // The company's groups (a short list): search, sort and paging on this page.
  const { data, loading, error, reload } = useApiQuery(() => listApprovalGroups({ limit: 100 }), []);
  const groups = useMemo(() => data?.items || [], [data]);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("latest");
  const [currentPage, setCurrentPage] = useState(1);
  const [openModal, setOpenModal] = useState(false);
  const [tab, setTab] = useState("groups");

  const { rows: list, total, totalPages } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = groups.filter((g) => !q || [g.name, g.code].some((v) => String(v || "").toLowerCase().includes(q)));
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === "name") return String(a.name).localeCompare(String(b.name));
      if (sortBy === "levels") return levelsOf(b) - levelsOf(a);
      return String(b.created_at).localeCompare(String(a.created_at));
    });
    const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
    return { rows: sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE), total: sorted.length, totalPages: pages };
  }, [groups, search, sortBy, currentPage]);

  const handleSearch = (e) => {
    setSearch(e.target.value);
    setCurrentPage(1);
  };

  const [itemToDelete, setItemToDelete] = useState(null);

  // "Delete" deactivates the group (D20); a group in use can't be (APPROVAL_GROUP_IN_USE).
  const confirmDelete = async () => {
    if (!itemToDelete) return;
    setDeleteLoading(true);
    try {
      await setApprovalGroupStatus(getId(itemToDelete), "INACTIVE");
      toast.success(t("toast.groupDeactivated"));
      reload();
    } catch (err) {
      toastApiError(err, t("toast.deleteGroupFailed"));
    }
    setDeleteLoading(false);
    setItemToDelete(null);
  };

  const handleDelete = (group) => {
    setItemToDelete(group);
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
              {t("title")}
            </h1>
            <p className="text-gray-500 mt-1 text-sm">
              {t("subtitle")}
            </p>
          </div>
          {tab === "groups" && (
            <Can module={MODULES.APPROVAL_GROUP} action={ACTIONS.CREATE}>
              <button
                onClick={() => setOpenModal(true)}
                className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm transition-colors flex-shrink-0 self-start"
              >
                <MdOutlineAdd className="text-lg" />
                {t("createGroup")}
              </button>
            </Can>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex gap-0 -mb-px">
            {[
              { key: "groups", label: t("tabs.groups") },
              { key: "settings", label: t("tabs.settings") },
            ].map((tabItem) => (
              <button
                key={tabItem.key}
                onClick={() => setTab(tabItem.key)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === tabItem.key
                    ? "border-cyan-600 text-cyan-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tabItem.label}
              </button>
            ))}
          </div>
        </div>

        {tab === "settings" && <ApprovalSettings />}

        {tab === "groups" && (
          <>
        {/* Filter Bar */}
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[250px]">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                {t("search")}
              </p>
              <div className="relative border border-gray-200 rounded-lg">
                <MdOutlineSearch className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
                <input
                  type="text"
                  value={search}
                  onChange={handleSearch}
                  placeholder={t("searchGroupsPlaceholder")}
                  className="w-full ps-9 pe-3 py-2.5 text-sm bg-transparent focus:outline-none text-gray-700 placeholder-gray-400"
                />
              </div>
            </div>

            <div className="min-w-[180px]">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                {t("sortBy")}
              </p>
              <CustomDropdown
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setCurrentPage(1);
                }}
                options={[
                  { label: t("sort.latest"), value: "latest" },
                  { label: t("sort.name"), value: "name" },
                  { label: t("sort.levels"), value: "levels" }
                ]}
              />
            </div>

            <div className="flex-shrink-0">
              <button
                onClick={() => {
                  setSearch("");
                  setSortBy("latest");
                  setCurrentPage(1);
                }}
                className="w-full sm:w-auto flex justify-center items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-2.5 rounded-lg font-medium text-sm transition-colors"
              >
                <MdOutlineClear className="text-lg" />
                {t("clearFilters", "Clear Filters")}
              </button>
            </div>
          </div>
        </div>

        {/* Table Card */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {loading ? (
            <Loader label={t("loadingGroups")} />
          ) : error ? (
            <div className="p-4">
              <ScreenError error={error} onRetry={reload} />
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      {[
                        t("table.sn"),
                        t("table.id"),
                        t("table.groupName"),
                        t("table.module"),
                        t("table.levels"),
                        t("table.actions"),
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
                    {list.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-6 py-12 text-center text-sm text-gray-400"
                        >
                          {t("noGroupsFound")}
                        </td>
                      </tr>
                    ) : (
                      list.map((item, index) => (
                        <tr
                          key={getId(item)}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-6 py-4 text-sm text-gray-700 font-medium">
                            {(currentPage - 1) * PAGE_SIZE + index + 1}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-400 font-medium">
                            <Ltr>#{shortId(item)}</Ltr>
                          </td>
                          <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                            {item.name}
                            {item.status === "INACTIVE" && (
                              <span className="ms-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-500">
                                {t("view.inactive")}
                              </span>
                            )}
                            {item.code ? (
                              <Ltr className="block text-xs font-normal text-gray-400">
                                {item.code}
                              </Ltr>
                            ) : null}
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-50 text-cyan-700 border border-cyan-100">
                              {prettyModule(item.module)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm text-gray-700 font-medium">
                              {levelsOf(item)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() =>
                                  navigate(
                                    `/admin/approvals/approval-group/${getId(item)}`
                                  )
                                }
                                className="p-1.5 text-gray-400 hover:text-cyan-600"
                              >
                                <MdOutlineVisibility className="text-xl" />
                              </button>
                              <Can module={MODULES.APPROVAL_GROUP} action={ACTIONS.DELETE}>
                                <button
                                  onClick={() => handleDelete(item)}
                                  disabled={deleteLoading}
                                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                                >
                                  <MdOutlineDeleteOutline className="text-xl" />
                                </button>
                              </Can>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-gray-100">
                {list.length === 0 ? (
                  <div className="px-4 py-12 text-center text-sm text-gray-400">
                    {t("noGroupsFound")}
                  </div>
                ) : (
                  list.map((item) => (
                    <div key={getId(item)} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Ltr className="block text-xs text-gray-400 font-medium mb-0.5">
                            #{shortId(item)}
                          </Ltr>
                          <p className="text-sm font-semibold text-gray-900">
                            {item.name}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            onClick={() =>
                              navigate(
                                `/admin/approvals/approval-group/${getId(item)}`
                              )
                            }
                            className="p-1.5 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-md transition-colors"
                          >
                            <MdOutlineVisibility className="text-lg" />
                          </button>
                          <Can module={MODULES.APPROVAL_GROUP} action={ACTIONS.DELETE}>
                            <button
                              onClick={() => handleDelete(item)}
                              disabled={deleteLoading}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                            >
                              <MdOutlineDeleteOutline className="text-lg" />
                            </button>
                          </Can>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-50 text-cyan-700 border border-cyan-100">
                          {prettyModule(item.module)}
                        </span>
                        <span className="text-xs text-gray-600 font-medium">
                          {levelsOf(item)}{" "}
                          {levelsOf(item) === 1 ? t("level") : t("levelsPlural")}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Pagination */}
              <Pagination
                page={currentPage}
                totalPages={totalPages}
                total={total}
                limit={PAGE_SIZE}
                onPage={setCurrentPage}
                label={t("paginationLabel")}
                activeClass="bg-cyan-600 text-white"
                containerClass="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 lg:px-6 py-4 border-t border-gray-100"
              />
            </>
          )}
        </div>
          </>
        )}
      </div>

      {openModal && (
        <CreateApprovalGroupModal
          isOpen={openModal}
          onClose={() => setOpenModal(false)}
          onSuccess={() => reload()}
        />
      )}

      {itemToDelete && (
        <ConfirmationModal
          isOpen={true}
          onClose={() => setItemToDelete(null)}
          onConfirm={confirmDelete}
          title={t("deleteModal.title", "Deactivate Approval Group")}
          message={`Deactivate approval group "${itemToDelete.name}"? Groups with active requests cannot be removed.`}
          type="delete"
          isLoading={deleteLoading}
          confirmText={t("deleteModal.confirm", "Deactivate")}
        />
      )}
    </>
  );
}

export default Approval;
