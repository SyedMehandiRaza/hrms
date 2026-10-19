import { useState } from "react";
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
import { ScreenError, ScreenLoader } from "../../components/ScreenState";
import { getDepartment } from "../../api/departments";
import { listByDepartment, removeDesignation } from "../../api/designations";
import useApiQuery from "../../hooks/useApiQuery";
import { useFormat } from "../../hooks/useFormat";
import { toastApiError } from "../../utils/apiError";
import { toast } from "react-toastify";
import CustomDropdown from "../../components/CustomDropdown";
import { useCan } from "../../hooks/usePermission";
import { MODULES, ACTIONS } from "../../constants/permissions";
import { useTranslation } from "react-i18next";

const LIMIT = 10;

function DepartmentDetail() {
  const { t } = useTranslation("employees");
  const { fmtDate } = useFormat();
  const { id } = useParams();
  const can = useCan();
  const canCreateDesig = can(MODULES.DESIGNATION, ACTIONS.CREATE);
  const canUpdateDesig = can(MODULES.DESIGNATION, ACTIONS.UPDATE);
  const canDeleteDesig = can(MODULES.DESIGNATION, ACTIONS.DELETE);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [selectedDesignation, setSelectedDesignation] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [desigToDelete, setDesigToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const {
    data: dept,
    loading: deptLoading,
    error: deptError,
    reload: reloadDept,
  } = useApiQuery(() => getDepartment(id), [id]);

  const {
    data: designationList,
    loading: desigLoading,
    error: desigError,
    reload: reloadDesigs,
  } = useApiQuery(() => listByDepartment(id, { page, limit: LIMIT, status: statusFilter }), [id, page, statusFilter]);

  const desigs = designationList?.items || [];
  const desigTotal = designationList?.total ?? 0;

  // After a designation is created (newest first → page 1), edited or deleted: fetch the
  // table and the department's counts again.
  const reloadAfterChange = () => {
    if (modalMode === "create" && page !== 1) setPage(1);
    else reloadDesigs();
    reloadDept();
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
    try {
      await removeDesignation(desigToDelete);
      toast.success(t("departments.detail.toast.deleted"));
      // Deleting the last row of a page → step back a page.
      if (desigs.length === 1 && page > 1) setPage((p) => p - 1);
      else reloadDesigs();
      reloadDept();
    } catch (err) {
      // e.g. 409 "This designation has employees and can't be deleted."
      toastApiError(err);
      reloadDesigs();
    } finally {
      setIsDeleteModalOpen(false);
      setIsDeleting(false);
      setDesigToDelete(null);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedDesignation(null);
  };

  const breadcrumbs = (name) => (
    <div className="flex items-center gap-1.5 text-sm flex-wrap mb-4">
      <Link
        to="/admin/departments"
        className="text-gray-400 hover:text-cyan-600 transition-colors"
      >
        {t("departments.list.title")}
      </Link>
      <MdOutlineChevronRight className="text-gray-300 rtl:rotate-180" />
      <span className="text-cyan-600 font-semibold">{name || " "}</span>
    </div>
  );

  // The department itself: loading, then the page or the server's message
  // (e.g. "The requested record was not found.").
  // A reload after a change keeps the page on screen.
  if (deptError || !dept || (deptLoading && dept.id !== id)) {
    return (
      <div className="p-4 sm:p-6 lg:p-2 bg-gray-50 min-h-screen font-sans">
        {breadcrumbs("")}
        <div className="bg-white rounded-lg border border-gray-200">
          {deptError ? <ScreenError error={deptError} onRetry={reloadDept} /> : <ScreenLoader />}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-2 bg-gray-50 min-h-screen font-sans">
      {/* Breadcrumbs */}
      {breadcrumbs(dept.name)}

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
          {canCreateDesig && (
            <button
              onClick={openCreateModal}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-[#17A2B8] text-white rounded-md font-medium hover:bg-[#138496] transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#17A2B8]"
            >
              <MdOutlineAdd />
              {t("departments.detail.addDesignation")}
            </button>
          )}
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
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(dept.head_name || "NA")}&background=F3F4F6&color=6B7280`}
                  alt={dept.head_name || t("departments.list.headAlt")}
                  className="w-6 h-6 rounded-full object-cover bg-gray-200"
                  onError={(e) => {
                    e.target.src = "https://i.pravatar.cc/150?u=static";
                  }}
                />
                <span className="text-sm font-semibold text-[#17A2B8]">
                  {dept.head_name || t("departments.list.notAssigned")}
                </span>
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">
                {t("departments.detail.createdDate")}
              </p>
              <p className="text-sm font-semibold text-gray-900">
                {dept.created_at
                  ? fmtDate(dept.created_at, {
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
            {dept.total_employees ?? 0}
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
            {dept.designation_count ?? 0}
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
              ) : desigError ? (
                <tr>
                  <td colSpan={5}>
                    <ScreenError error={desigError} onRetry={reloadDesigs} />
                  </td>
                </tr>
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
                        {canUpdateDesig && (
                          <button
                            onClick={() => openEditModal(desig)}
                            title={t("departments.actions.edit")}
                            className="hover:text-blue-500 transition-colors"
                          >
                            <MdOutlineEdit className="text-lg" />
                          </button>
                        )}
                        {canDeleteDesig && (
                          <button
                            onClick={() => handleDeleteDesignation(desig.id)}
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
          totalPages={Math.max(1, Math.ceil(desigTotal / LIMIT))}
          total={desigTotal}
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
