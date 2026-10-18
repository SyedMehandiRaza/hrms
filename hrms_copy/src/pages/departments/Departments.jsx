import { useState } from "react";
import {
  MdOutlineVisibility,
  MdOutlineEdit,
  MdOutlineDelete,
  MdOutlineAdd,
  MdOutlineClear,
} from "react-icons/md";
import { BiBuilding, BiCheckCircle, BiXCircle, BiIdCard } from "react-icons/bi";
import DepartmentModal from "../../components/DepartmentModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import { TableLoader } from "../../components/Loader";
import { useNavigate } from "react-router-dom";
import { DEPARTMENT_ROWS, ASSIGNABLE_EMPLOYEES } from "../../data/groupC";
import { nextId, paginate } from "../../data/common";
import { toast } from "react-toastify";
import CustomDropdown from "../../components/CustomDropdown";
import Pagination from "../../components/Pagination";
import { useCan } from "../../hooks/usePermission";
import { MODULES, ACTIONS } from "../../constants/permissions";
import { useTranslation } from "react-i18next";



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
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [departmentToDelete, setDepartmentToDelete] = useState(null);
  // Static build: departments live in local state; paging/filtering is client-side.
  const [departments, setDepartments] = useState(DEPARTMENT_ROWS);
  const loading = false;
  const pageData = paginate(
    departments.filter((d) => !statusFilter || d.status === statusFilter),
    page,
    PAGE_SIZE,
  );

  const allDepts = pageData.rows;

  // Company-wide stats (independent of the page).
  const totalDepartments = departments.length;
  const activeDepartments = departments.filter((d) => d.status === "ACTIVE").length;
  const inactiveDepartments = departments.filter((d) => d.status !== "ACTIVE").length;
  const totalDesignations = departments.reduce((s, d) => s + (d.designation_count || 0), 0);

  const total = pageData.total;
  const totalPages = pageData.totalPages;

  // Merge a created/edited department into the local list.
  const reloadDepartments = (saved) => {
    if (!saved) return;
    const head = ASSIGNABLE_EMPLOYEES.find((e) => e.id === saved.dept_head);
    const deptHead = head ? { id: head.id, full_name: head.full_name, profile_url: null } : null;
    setDepartments((prev) =>
      saved.id && prev.some((d) => d.id === saved.id)
        ? prev.map((d) => (d.id === saved.id ? { ...d, ...saved, deptHead } : d))
        : [
            {
              ...saved,
              id: nextId(prev),
              deptHead,
              designation_count: 0,
              employee_count: 0,
              created_at: new Date().toISOString(),
            },
            ...prev,
          ],
    );
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
    // console.log("handleDelete called! departmentToDelete is:", departmentToDelete);
    const targetId = departmentToDelete?.id || departmentToDelete?._id;

    if (targetId) {
      setDepartments((prev) => prev.filter((d) => d.id !== targetId));
      toast.success(t("departments.list.toast.deleted"));
    }
    closeDeleteModal();
  };

  const openCreateModal = () => {
    setModalMode("create");
    setSelectedDepartment(null);
    setIsModalOpen(true);
  };

  const openEditModal = (dept) => {
    setModalMode("edit");
    setSelectedDepartment({
      id: dept.id || dept._id,
      name: dept.name,
      code: dept.code,
      dept_head: dept.deptHead?.id || dept.deptHead || dept.head || "",
      description: dept.description,
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
        <button
          onClick={openCreateModal}
          disabled={!canCreateDept}
          title={canCreateDept ? "" : t("departments.list.noCreatePermission")}
          className="flex items-center gap-2 bg-[#17A2B8] hover:bg-[#138496] text-white px-4 py-2 rounded-md font-medium transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#17A2B8]"
        >
          <MdOutlineAdd className="text-lg" />
          {t("departments.list.createDepartment")}
        </button>
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
              {totalDepartments < 10 && totalDepartments > 0 ? `0${totalDepartments}` : totalDepartments}
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
              {activeDepartments < 10 && activeDepartments > 0 ? `0${activeDepartments}` : activeDepartments}
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
              {inactiveDepartments < 10 && inactiveDepartments > 0 ? `0${inactiveDepartments}` : inactiveDepartments}
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
              {totalDesignations < 10 && totalDesignations > 0 ? `0${totalDesignations}` : totalDesignations}
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
              ) : allDepts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">
                    {t("departments.list.empty")}
                  </td>
                </tr>
              ) : (
                allDepts.map((dept, index) => (
                  <tr
                    key={dept.id || index}
                    className="hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="py-4 px-6 text-sm text-gray-500">{(page - 1) * PAGE_SIZE + index + 1}</td>
                    <td className="py-4 px-6 text-sm font-semibold text-gray-800" title={dept.name}>
                      {truncate(dept.name, 20)}
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-700">
                      <div className="flex items-center gap-3">
                        <img
                          src={dept?.deptHead?.profile_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(dept?.deptHead?.full_name || dept.deptHead || 'NA')}&background=F3F4F6&color=6B7280`}
                          alt={t("departments.list.headAlt")}
                          className="w-8 h-8 rounded-full object-cover bg-gray-200"
                          onError={(e) => { e.target.src = "https://i.pravatar.cc/150?u=static"; }}
                        />
                        <span title={dept?.deptHead?.full_name || dept.deptHead || t("departments.list.notAssigned")}>
                          {truncate(dept?.deptHead?.full_name || dept.deptHead || t("departments.list.notAssigned"), 20)}
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
                      <div className="flex items-center justify-center gap-4 text-gray-400">
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
                        <button
                          onClick={() => openEditModal(dept)}
                          disabled={!canUpdateDept}
                          title={canUpdateDept ? t("departments.actions.edit") : t("departments.actions.noEditPermission")}
                          className="hover:text-blue-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-gray-400"
                        >
                          <MdOutlineEdit className="text-lg" />
                        </button>
                        <button
                          onClick={() => openDeleteModal(dept)}
                          disabled={!canDeleteDept}
                          title={canDeleteDept ? t("departments.actions.delete") : t("departments.actions.noDeletePermission")}
                          className="hover:text-red-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-gray-400"
                        >
                          <MdOutlineDelete className="text-lg" />
                        </button>
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
