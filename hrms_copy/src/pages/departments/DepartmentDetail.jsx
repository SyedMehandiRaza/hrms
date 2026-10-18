import { useState, useMemo } from "react";
import Pagination from "../../components/Pagination";
import {
  MdOutlineChevronRight,
  MdOutlineEdit,
  MdOutlineAdd,
  MdOutlinePeople,
  MdOutlineInfo,
  MdOutlineDelete,
  MdOutlineRemoveRedEye,
  MdOutlineClear,
} from "react-icons/md";
import { BiNetworkChart } from "react-icons/bi";
import { Link, useParams } from "react-router-dom";
import DesignationModal from "../../components/DesignationModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import { TableLoader } from "../../components/Loader";
import { departmentDetailById, DESIGNATION_ROWS } from "../../data/groupC";
import { nextId, paginate } from "../../data/common";
import { toast } from "react-toastify";
import CustomDropdown from "../../components/CustomDropdown";
import { useCan } from "../../hooks/usePermission";
import { MODULES, ACTIONS } from "../../constants/permissions";
import { useTranslation } from "react-i18next";

function DepartmentDetail() {
  const { t } = useTranslation("employees");
  const { id } = useParams();
  const can = useCan();
  const canCreateDesig = can(MODULES.DESIGNATION, ACTIONS.CREATE);
  const canUpdateDesig = can(MODULES.DESIGNATION, ACTIONS.UPDATE);
  const canDeleteDesig = can(MODULES.DESIGNATION, ACTIONS.DELETE);

  const currentDepartment = useMemo(() => departmentDetailById(id), [id]);
  const desigLoading = false;
  // Static build: this department's designations live in local state.
  const [allDesigs, setAllDesigs] = useState(() =>
    DESIGNATION_ROWS.filter((d) => String(d.department_id) === String(currentDepartment.id)),
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [selectedDesignation, setSelectedDesignation] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [desigToDelete, setDesigToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const LIMIT = 10;

  // After a designation is created/edited: merge it into the local list.
  const reloadAfterChange = (saved) => {
    if (!saved) return;
    setAllDesigs((prev) =>
      saved.id && prev.some((d) => d.id === saved.id)
        ? prev.map((d) => (d.id === saved.id ? { ...d, ...saved } : d))
        : [{ employee_count: 0, ...saved, id: nextId(DESIGNATION_ROWS.concat(prev)) }, ...prev],
    );
  };

  const openCreateModal = () => {
    setModalMode("create");
    setSelectedDesignation(null);
    setIsModalOpen(true);
  };

  const openViewModal = (desig) => {
    setModalMode("view");
    setSelectedDesignation({
      id: desig.id,
      name: desig.name,
      code: desig.code || "",
      description: desig.description || "",
      isActive: desig.status === "ACTIVE",
    });
    setIsModalOpen(true);
  };

  const openEditModal = (desig) => {
    setModalMode("edit");
    setSelectedDesignation({
      id: desig.id,
      name: desig.name,
      code: desig.code || "",
      description: desig.description || "",
      isActive: desig.status === "ACTIVE",
    });
    setIsModalOpen(true);
  };

  const handleDeleteDesignation = (desigId) => {
    setDesigToDelete(desigId);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteDesignation = async () => {
    if (!desigToDelete) return;
    setIsDeleting(true);
    setAllDesigs((prev) => prev.filter((d) => d.id !== desigToDelete));
    toast.success(t("departments.detail.toast.deleted"));
    // Deleting the last row of a page → step back a page.
    if (desigs.length === 1 && page > 1) setPage((p) => p - 1);
    setIsDeleteModalOpen(false);
    setIsDeleting(false);
    setDesigToDelete(null);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedDesignation(null);
  };

  const dept =
    currentDepartment?.department ||
    currentDepartment?.data ||
    currentDepartment ||
    {};

  const filteredDesigs = allDesigs.filter((d) => !statusFilter || d.status === statusFilter);
  const pageData = paginate(filteredDesigs, page, LIMIT);
  const desigs = pageData.rows;
  const designationList = { total: pageData.total };

  return (
    <div className="p-4 sm:p-6 lg:p-2 bg-gray-50 min-h-screen font-sans">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-1.5 text-sm flex-wrap mb-4">
        <Link
          to="/admin/departments"
          className="text-gray-400 hover:text-cyan-600 transition-colors"
        >
          {t("departments.list.title")}
        </Link>
        <MdOutlineChevronRight className="text-gray-300 rtl:rotate-180" />
        <span className="text-cyan-600 font-semibold">{dept.name || " "}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">
            {dept.name || t("departments.detail.title")}
          </h1>
          <p className="text-sm text-gray-500">
            {dept.description ||
              t("departments.detail.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={openCreateModal}
            disabled={!canCreateDesig}
            title={canCreateDesig ? "" : t("departments.detail.noCreatePermission")}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-[#17A2B8] text-white rounded-md font-medium hover:bg-[#138496] transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#17A2B8]"
          >
            <MdOutlineAdd />
            {t("departments.detail.addDesignation")}
          </button>
        </div>
      </div>

      {/* Cards Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">
        {/* General Information Card */}
        <div className="lg:col-span-8 bg-white p-6 rounded-lg border border-gray-200 relative">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-2 text-gray-800 font-semibold text-lg">
              <MdOutlineInfo className="text-[#17A2B8]" />
              {t("departments.detail.generalInfo")}
            </div>
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-bold ${dept.status === "ACTIVE" ? "bg-[#E6F8F3] text-[#00A859]" : "bg-[#FDE8E8] text-[#E02424]"}`}
            >
              {t(`departments.status.${dept.status || "UNKNOWN"}`, { defaultValue: dept.status || "UNKNOWN" })}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-4">
            <div>
              <p className="text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">
                {t("departments.list.table.name")}
              </p>
              <p className="text-sm font-semibold text-gray-900">
                {dept?.name || t("departments.detail.notAvailable")}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">
                {t("departments.detail.departmentCode")}
              </p>
              <p className="text-sm font-semibold text-gray-900">
                {dept.code || t("departments.detail.notAvailable")}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">
                {t("departments.detail.headOfDepartment")}
              </p>
              <div className="flex items-center gap-2">
                <img
                  src={
                    dept?.deptHead?.profile_url ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(dept?.deptHead?.full_name || dept.deptHead || "NA")}&background=F3F4F6&color=6B7280`
                  }
                  alt={dept?.deptHead?.full_name || t("departments.list.headAlt")}
                  className="w-6 h-6 rounded-full object-cover bg-gray-200"
                  onError={(e) => {
                    e.target.src = "https://i.pravatar.cc/150?u=static";
                  }}
                />
                <span className="text-sm font-semibold text-[#17A2B8]">
                  {dept?.deptHead?.full_name || dept.deptHead || t("departments.list.notAssigned")}
                </span>
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">
                {t("departments.detail.createdDate")}
              </p>
              <p className="text-sm font-semibold text-gray-900">
                {dept.created_at
                  ? new Date(dept.created_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : t("departments.detail.notAvailable")}
              </p>
            </div>
          </div>
        </div>

        {/* Total Employees Card */}
        <div className="lg:col-span-2 bg-white p-6 rounded-lg border border-gray-200 flex flex-col justify-center">
          <div className="w-10 h-10 rounded-md bg-blue-50 text-blue-500 flex items-center justify-center text-xl mb-4">
            <MdOutlinePeople />
          </div>
          <p className="text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide">
            {t("departments.detail.totalEmployees")}
          </p>
          <h3 className="text-4xl font-bold text-gray-800">
            {dept.employee_count ?? 0}
          </h3>
        </div>

        {/* Designations Card */}
        <div className="lg:col-span-2 bg-white p-6 rounded-lg border border-gray-200  flex flex-col justify-center">
          <div className="w-10 h-10 rounded-md bg-indigo-50 text-indigo-500 flex items-center justify-center text-xl mb-4">
            <BiNetworkChart />
          </div>
          <p className="text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide">
            {t("departments.list.table.designations")}
          </p>
          <h3 className="text-4xl font-bold text-gray-800">
            {designationList?.data?.total ||
              designationList?.total ||
              desigs.length ||
              0}
          </h3>
        </div>
      </div>

      {/* Designations Management Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col">
        {/* Table Header Section */}
        <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-lg font-bold text-gray-800">
            {t("departments.detail.designationsManagement")}
          </h2>
          <div className="flex gap-3 w-full sm:w-auto items-center">
            <div className="relative min-w-[150px]">
              <CustomDropdown
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                options={[
                  { label: t("departments.list.filters.allStatuses"), value: "" },
                  { label: t("status.active"), value: "ACTIVE" },
                  { label: t("status.inactive"), value: "INACTIVE" },
                ]}
              />
            </div>
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

        {/* Table Wrapper */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left border-collapse">
            <thead>
              <tr className="bg-[#F8F9FB] border-b border-gray-200">
                <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider w-20">
                  {t("departments.list.table.sno")}
                </th>
                <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {t("departments.detail.table.designationName")}
                </th>
                <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">
                  {t("departments.detail.table.employeesAssigned")}
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
              {desigLoading ? (
                <TableLoader colSpan={5} />
              ) : desigs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-4 text-center text-gray-500">
                    {t("departments.detail.empty")}
                  </td>
                </tr>
              ) : (
                desigs.map((desig, index) => (
                  <tr
                    key={desig.id}
                    className="hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="py-4 px-6 text-sm text-gray-500">
                      {(page - 1) * LIMIT + index + 1}
                    </td>
                    <td className="py-4 px-6 text-sm font-bold text-gray-800">
                      {desig.name}
                    </td>
                    <td className="py-4 px-6 text-sm font-semibold text-gray-800 text-center">
                      {desig.employee_count ?? 0}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                          desig.status === "ACTIVE"
                            ? "bg-[#E6F8F3] text-[#00A859]"
                            : "bg-[#FDE8E8] text-[#E02424]"
                        }`}
                      >
                        {t(`departments.status.${desig.status || "UNKNOWN"}`, { defaultValue: desig.status || "UNKNOWN" })}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-center gap-4 text-gray-400">
                        <button
                          onClick={() => openViewModal(desig)}
                          className="hover:text-cyan-500 transition-colors"
                          title={t("departments.actions.view")}
                        >
                          <MdOutlineRemoveRedEye className="text-lg" />
                        </button>
                        <button
                          onClick={() => openEditModal(desig)}
                          disabled={!canUpdateDesig}
                          title={canUpdateDesig ? t("departments.actions.edit") : t("departments.actions.noEditPermission")}
                          className="hover:text-blue-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-gray-400"
                        >
                          <MdOutlineEdit className="text-lg" />
                        </button>
                        <button
                          onClick={() => handleDeleteDesignation(desig.id)}
                          disabled={!canDeleteDesig}
                          title={canDeleteDesig ? t("departments.actions.delete") : t("departments.actions.noDeletePermission")}
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
          totalPages={
            Math.ceil(
              (designationList?.data?.total ||
                designationList?.total ||
                desigs.length) / LIMIT,
            ) || 1
          }
          total={
            designationList?.data?.total ||
            designationList?.total ||
            desigs.length
          }
          limit={LIMIT}
          onPage={setPage}
          label={t("departments.detail.paginationLabel")}
          activeClass="bg-[#17A2B8] text-white"
          containerClass="p-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4"
        />
      </div>

      {/* Designation Modal */}
      <DesignationModal
        isOpen={isModalOpen}
        onClose={closeModal}
        mode={modalMode}
        initialData={selectedDesignation}
        departmentName={dept.name}
        departmentId={id}
        onSaved={reloadAfterChange}
      />

      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDeleteDesignation}
        title={t("departments.detail.deleteModal.title")}
        message={t("departments.detail.deleteModal.message")}
        type="delete"
        confirmText={t("departments.actions.delete")}
        isLoading={isDeleting}
      />
    </div>
  );
}

export default DepartmentDetail;
