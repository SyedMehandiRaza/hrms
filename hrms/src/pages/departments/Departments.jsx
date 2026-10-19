import { useEffect, useState } from "react";
import {
  MdOutlineVisibility,
  MdOutlineEdit,
  MdOutlineDelete,
  MdOutlineAdd,
  MdOutlineClear,
  MdOutlineSearch,
} from "react-icons/md";
import { BiBuilding, BiCheckCircle, BiXCircle, BiIdCard } from "react-icons/bi";
import DepartmentModal from "../../components/DepartmentModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import { TableLoader } from "../../components/Loader";
import { ScreenError } from "../../components/ScreenState";
import { useNavigate } from "react-router-dom";
import { listDepartments, removeDepartment } from "../../api/departments";
import useApiQuery from "../../hooks/useApiQuery";
import { toastApiError } from "../../utils/apiError";
import { toast } from "react-toastify";
import CustomDropdown from "../../components/CustomDropdown";
import Pagination from "../../components/Pagination";
import { useCan } from "../../hooks/usePermission";
import { MODULES, ACTIONS } from "../../constants/permissions";
import { useTranslation } from "react-i18next";

const PAGE_SIZE = 10;

const twoDigits = (n) => (n < 10 && n > 0 ? `0${n}` : n);

const truncate = (str, length = 20) => {
  if (!str || typeof str !== 'string') return str;
  return str.length > length ? str.substring(0, length) + "..." : str;
};

function Departments() {
  const { t } = useTranslation("employees");
  const navigate = useNavigate();
  const can = useCan();
  const canCreateDept = can(MODULES.DEPARTMENT, ACTIONS.CREATE);
  const canUpdateDept = can(MODULES.DEPARTMENT, ACTIONS.UPDATE);
  const canDeleteDept = can(MODULES.DEPARTMENT, ACTIONS.DELETE);
  const canViewDesignation = can(MODULES.DESIGNATION, ACTIONS.READ);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [departmentToDelete, setDepartmentToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Search is sent once typing pauses; a new term starts again at page 1.
  useEffect(() => {
    const term = searchInput.trim();
    if (term === search) return undefined;
    const timer = setTimeout(() => {
      setSearch(term);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput, search]);

  const { data, loading, error, reload } = useApiQuery(
    () => listDepartments({ page, limit: PAGE_SIZE, search, status: statusFilter }),
    [page, search, statusFilter],
  );

  const allDepts = data?.items || [];

  // Company-wide stats (independent of the filters and the page).
  const stats = data?.stats || { total: 0, active: 0, inactive: 0, designations: 0 };

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // After a create (newest first → page 1) or an edit: fetch the list and stats again.
  const reloadDepartments = () => {
    if (modalMode === "create" && page !== 1) setPage(1);
    else reload();
  };

  const openDeleteModal = (dept) => {
    setDepartmentToDelete(dept);
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setDepartmentToDelete(null);
  };

  const handleDelete = async () => {
    if (!departmentToDelete?.id) return;
    setIsDeleting(true);
    try {
      await removeDepartment(departmentToDelete.id);
      toast.success(t("departments.list.toast.deleted"));
      // Deleting the last row of a page → step back a page.
      if (allDepts.length === 1 && page > 1) setPage((p) => p - 1);
      else reload();
    } catch (err) {
      // e.g. 409 "This department has employees and can't be deleted."
      toastApiError(err);
      reload();
    } finally {
      setIsDeleting(false);
      closeDeleteModal();
    }
  };

  const openCreateModal = () => {
    setModalMode("create");
    setSelectedDepartment(null);
    setIsModalOpen(true);
  };

  const openEditModal = (dept) => {
    setModalMode("edit");
    setSelectedDepartment({
      id: dept.id,
      name: dept.name,
      code: dept.code,
      dept_head: dept.dept_head_id || "",
      head_name: dept.head_name || "",
      description: dept.description || "",
      isActive: dept.status === "ACTIVE",
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedDepartment(null);
  };

  return (
    <div className="p-2 sm:p-6 lg:p-2 bg-gray-50 min-h-screen font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">{t("departments.list.title")}</h1>
          <p className="text-sm text-gray-500 max-w-xl">
            {t("departments.list.subtitle")}
          </p>
        </div>
        {canCreateDept && (
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-[#17A2B8] hover:bg-[#138496] text-white px-4 py-2 rounded-md font-medium transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#17A2B8]"
          >
            <MdOutlineAdd className="text-lg" />
            {t("departments.list.createDepartment")}
          </button>
        )}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Card 1 */}
        <div className="bg-white p-5 rounded-lg border border-gray-200  flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">
              {t("departments.list.stats.totalDepartments")}
            </p>
            <h3 className="text-3xl font-bold text-gray-800">
              {twoDigits(stats.total)}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center text-xl">
            <BiBuilding />
          </div>
        </div>
        {/* Card 2 */}
        <div className="bg-white p-5 rounded-lg border border-gray-200  flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">
              {t("departments.list.stats.activeDepartments")}
            </p>
            <h3 className="text-3xl font-bold text-gray-800">
              {twoDigits(stats.active)}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-md bg-green-50 text-green-500 flex items-center justify-center text-xl">
            <BiCheckCircle />
          </div>
        </div>
        {/* Card 3 */}
        <div className="bg-white p-5 rounded-lg border border-gray-200  flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">
              {t("departments.list.stats.inactiveDepartments")}
            </p>
            <h3 className="text-3xl font-bold text-gray-800">
              {twoDigits(stats.inactive)}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-md bg-red-50 text-red-500 flex items-center justify-center text-xl">
            <BiXCircle />
          </div>
        </div>
        {/* Card 4 */}
        <div className="bg-white p-5 rounded-lg border border-gray-200 flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">
              {t("departments.list.stats.totalDesignations")}
            </p>
            <h3 className="text-3xl font-bold text-gray-800">
              {twoDigits(stats.designations)}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-md bg-gray-100 text-gray-500 flex items-center justify-center text-xl">
            <BiIdCard />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border border-gray-200  mb-6 flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 w-full md:w-auto">
          <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">
            {t("departments.list.filters.search")}
          </label>
          <div className="relative">
            <MdOutlineSearch className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              maxLength={150}
              placeholder={t("departments.list.filters.searchPlaceholder")}
              className="w-full h-[42px] bg-[#F8F9FA] border border-gray-200 text-gray-900 text-sm rounded-lg ps-10 pe-4 focus:ring-2 focus:ring-[#17A2B8] focus:border-[#17A2B8] outline-none transition-all"
            />
          </div>
        </div>
        <div className="flex-1 w-full md:w-auto">
          <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">
            {t("departments.list.filters.status")}
          </label>
          <div className="relative">
            <CustomDropdown
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { label: t("departments.list.filters.allStatuses"), value: "" },
                { label: t("status.active"), value: "ACTIVE" },
                { label: t("status.inactive"), value: "INACTIVE" }
              ]}
              className="bg-[#F8F9FA]"
            />
          </div>
        </div>
        <div className="flex gap-3 w-full md:w-auto mt-4 md:mt-0">
          <button
            onClick={() => {
              setStatusFilter("");
              setSearchInput("");
              setSearch("");
              setPage(1);
            }}
            className="w-full sm:w-auto flex justify-center items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-2 rounded-lg font-medium text-sm transition-colors h-[42px]"
          >
            <MdOutlineClear className="text-lg" />
            {t("departments.list.filters.clear")}
          </button>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left border-collapse">
            <thead>
              <tr className="bg-[#F8F9FB] border-b border-gray-200">
                <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider w-20">
                  {t("departments.list.table.sno")}
                </th>
                <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {t("departments.list.table.name")}
                </th>
                <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {t("departments.list.table.head")}
                </th>
                <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">
                  {t("departments.list.table.designations")}
                </th>
                <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">
                  {t("departments.list.table.status")}
                </th>
                <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider text-center w-32">
                  {t("departments.list.table.actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <TableLoader colSpan={6} />
              ) : error ? (
                <tr>
                  <td colSpan={6}>
                    <ScreenError error={error} onRetry={reload} />
                  </td>
                </tr>
              ) : allDepts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">
                    {t("departments.list.empty")}
                  </td>
                </tr>
              ) : (
                allDepts.map((dept, index) => (
                  <tr
                    key={dept.id}
                    onClick={canUpdateDept ? () => openEditModal(dept) : undefined}
                    className={`hover:bg-gray-50/50 transition-colors ${canUpdateDept ? "cursor-pointer" : ""}`}
                  >
                    <td className="py-4 px-6 text-sm text-gray-500">{(page - 1) * PAGE_SIZE + index + 1}</td>
                    <td className="py-4 px-6 text-sm font-semibold text-gray-800" title={dept.name}>
                      {truncate(dept.name, 20)}
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-700">
                      <div className="flex items-center gap-3">
                        <img
                          src={`https://ui-avatars.com/api/?name=${encodeURIComponent(dept.head_name || 'NA')}&background=F3F4F6&color=6B7280`}
                          alt={t("departments.list.headAlt")}
                          className="w-8 h-8 rounded-full object-cover bg-gray-200"
                          onError={(e) => { e.target.src = "https://i.pravatar.cc/150?u=static"; }}
                        />
                        <span title={dept.head_name || t("departments.list.notAssigned")}>
                          {truncate(dept.head_name || t("departments.list.notAssigned"), 20)}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm font-semibold text-gray-800 text-center">
                      {dept.designation_count || 0}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${dept.status === "ACTIVE"
                          ? "bg-[#E6F8F3] text-[#00A859]"
                          : "bg-gray-100 text-gray-500"
                          }`}
                      >
                        {t(`departments.status.${dept.status}`, { defaultValue: dept.status })}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      {/* Action clicks don't also trigger the row's edit. */}
                      <div
                        className="flex items-center justify-center gap-4 text-gray-400"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {canViewDesignation && (
                          <button
                            className="hover:text-blue-500 transition-colors"
                            title={t("departments.list.actions.viewDesignations")}
                            onClick={() =>
                              navigate(`/admin/departments/${dept.id}`)
                            }
                          >
                            <MdOutlineVisibility className="text-lg" />
                          </button>
                        )}
                        {canUpdateDept && (
                          <button
                            onClick={() => openEditModal(dept)}
                            title={t("departments.actions.edit")}
                            className="hover:text-blue-500 transition-colors"
                          >
                            <MdOutlineEdit className="text-lg" />
                          </button>
                        )}
                        {canDeleteDept && (
                          <button
                            onClick={() => openDeleteModal(dept)}
                            title={t("departments.actions.delete")}
                            className="hover:text-red-500 transition-colors"
                          >
                            <MdOutlineDelete className="text-lg" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          limit={PAGE_SIZE}
          onPage={setPage}
          label={t("departments.list.paginationLabel")}
        />
      </div>

      {/* Department Modal */}
      <DepartmentModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onSaved={reloadDepartments}
        mode={modalMode}
        initialData={selectedDepartment}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={closeDeleteModal}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title={t("departments.list.deleteModal.title")}
        message={t("departments.list.deleteModal.message", { name: departmentToDelete?.name })}
        type="delete"
        confirmText={t("departments.actions.delete")}
        cancelText={t("departments.actions.cancel")}
      />
    </div>
  );
}

export default Departments;
