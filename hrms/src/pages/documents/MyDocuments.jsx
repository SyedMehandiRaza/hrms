import { useState, useMemo } from "react";
import Pagination from "../../components/Pagination";
import { MdOutlineDescription, MdOutlineRemoveRedEye, MdOutlineDelete, MdOutlineCloudUpload, MdOutlineClear } from "react-icons/md";
import { toast } from "react-toastify";
import { TableLoader } from "../../components/Loader";
import CustomDropdown from "../../components/CustomDropdown";
import { docsForEmployee, deleteDocument, currentEmployeeRecord } from "../../data/groupB";
import { getStaticUser } from "../../data/session";
import { paginate } from "../../data/common";
import DocumentSlideOver from "./DocumentSlideOver";
import UploadDocumentModal from "../../components/UploadDocumentModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import { useTranslation } from "react-i18next";

const PAGE_SIZE = 10;

const STATUS_STYLE = {
  VALID: { bg: "bg-green-100", text: "text-green-700" },
  EXPIRED: { bg: "bg-red-100", text: "text-red-700" },
  "EXPIRING SOON": { bg: "bg-orange-100", text: "text-orange-700" },
  EXPIRING: { bg: "bg-orange-100", text: "text-orange-700" },
};

const getStatusStyles = (status) => {
  return STATUS_STYLE[status?.toUpperCase()] || { bg: "bg-gray-100", text: "text-gray-700" };
};

export default function MyDocuments() {
  const { t } = useTranslation("documents");
  const authUser = getStaticUser();

  const loading = false;
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);

  const [slideOverOpen, setSlideOverOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [drawerMode, setDrawerMode] = useState("details");
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ open: false, id: null });
  const [isDeleting] = useState(false);

  const empId = currentEmployeeRecord()?.id || authUser?.employeeId || authUser?.id || "me";

  const EXPIRY_PARAM = {
    VALID: "VALID",
    "EXPIRING SOON": "EXPIRING",
    EXPIRED: "EXPIRED",
  };

  // Static documents of the signed-in employee, filtered + paged client-side.
  const block = useMemo(() => {
    const rows = docsForEmployee(empId).filter(
      (d) => !statusFilter || d.expiry_status === (EXPIRY_PARAM[statusFilter] || statusFilter),
    );
    return paginate(rows, page, PAGE_SIZE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empId, page, statusFilter, version]);
  const documents = block.rows;
  const total = block.total;
  const totalPages = block.totalPages;
  const loadData = () => setVersion((v) => v + 1);

  const handleDelete = () => {
    if (!deleteModal.id) return;
    deleteDocument(deleteModal.id);
    toast.success(t("my.toasts.deleted"));
    setDeleteModal({ open: false, id: null });
    loadData();
  };

  // Backend already returns the filtered, paginated page.
  const currentDocs = documents;

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MdOutlineDescription className="text-cyan-600" />
            {t("my.title")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t("my.subtitle")}
          </p>
        </div>
        <button
          onClick={() => setIsUploadModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white text-sm font-medium rounded-lg hover:bg-cyan-700 transition-colors shadow-sm"
        >
          <MdOutlineCloudUpload className="text-lg" />
          {t("dashboard.uploadDocument")}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 sm:p-5 border border-gray-200 rounded-xl">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="w-full sm:w-64">
            <label className="block text-[11px] font-bold text-gray-500 tracking-wider uppercase mb-2">{t("list.status")}</label>
            <CustomDropdown
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { label: t("list.allStatuses"), value: "" },
                { label: t("list.statusFilter.valid"), value: "VALID" },
                { label: t("list.statusFilter.expiring"), value: "EXPIRING SOON" },
                { label: t("list.statusFilter.expired"), value: "EXPIRED" },
              ]}
            />
          </div>
          <div className="flex-shrink-0 w-full sm:w-auto h-[42px]">
            <button
              onClick={() => {
                setStatusFilter("");
                setPage(1);
              }}
              className="w-full sm:w-auto flex justify-center items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-2 rounded-lg font-medium text-sm transition-colors h-[42px]"
            >
              <MdOutlineClear className="text-lg" />
              {t("list.clearFilters")}
            </button>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-sm text-gray-600 min-w-[800px]">
            <thead className="bg-gray-50/80 border-b border-gray-200 text-gray-500 uppercase tracking-wider text-[11px] font-semibold">
              <tr>
                {["list.table.sno", "add.documentType", "add.issueDate", "add.expiryDate", "list.table.status", "list.table.actions"].map((h) => (
                  <th key={h} className="px-6 py-4">{t(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <TableLoader colSpan={6} label={t("list.loading")} />
              ) : currentDocs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center">
                    <MdOutlineDescription className="text-4xl text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">{t("my.empty")}</p>
                  </td>
                </tr>
              ) : (
                currentDocs.map((doc, i) => {
                  let statusValue = (doc.document_status || doc.status || "VALID").toUpperCase();
                  if (doc.expiry_date) {
                    const expiry = new Date(doc.expiry_date);
                    const now = new Date();
                    now.setHours(0, 0, 0, 0);
                    const diffDays = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
                    if (diffDays < 0) {
                      statusValue = "EXPIRED";
                    } else if (diffDays <= 30) {
                      statusValue = "EXPIRING SOON";
                    }
                  }
                  const statusStyle = getStatusStyles(statusValue);
                  const isExpiringSoon = statusValue === "EXPIRING SOON" || statusValue === "EXPIRING";
                  const isExpired = statusValue === "EXPIRED";
                  const docTypeLabel = doc.type?.label || doc.type?.code || doc.document_type || t("list.documentFallback");

                  return (
                    <tr key={doc.id || i} className="hover:bg-gray-50/50 transition">
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600 font-medium">
                        {(page - 1) * PAGE_SIZE + i + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-3 py-1 text-xs font-medium rounded-md bg-blue-50 text-blue-700 border border-blue-100">
                          {docTypeLabel?.length > 20 ? `${docTypeLabel.substring(0, 20)}...` : docTypeLabel}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                        {doc.issue_date || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-[13px] font-bold ${isExpired ? "text-red-600" : isExpiringSoon ? "text-red-500" : "text-gray-600"}`}>
                          {doc.expiry_date || "-"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
                          {t(`statusLabels.${statusValue}`, { defaultValue: statusValue })}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            const empNameStr = authUser?.employee?.full_name || authUser?.full_name || authUser?.name || `${authUser?.first_name || ""} ${authUser?.last_name || ""}`.trim();
                            const unknownEmployee = t("my.unknownEmployee");
                            const empName = empNameStr || unknownEmployee;
                            const empInitials = empName !== unknownEmployee ? empName.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase() : "U";

                            setSelectedDoc({
                              ...doc,
                              docType: typeof docTypeLabel === "object" ? (docTypeLabel.name || docTypeLabel.label || t("list.documentFallback")) : docTypeLabel,
                              issueDate: doc.issue_date || "-",
                              expiryDate: doc.expiry_date || "-",
                              docId: doc.document_number || doc.reference_number || doc.id || "-",
                              status: statusValue,
                              employeeName: empName,
                              employeeImg: authUser?.profile_image || null,
                              employeeAvatar: empInitials,
                              employeeAvatarColor: "bg-cyan-100 text-cyan-700",
                              employeeRole: typeof authUser?.role === "object" ? authUser.role.name : (authUser?.role || t("my.employeeRole"))
                            });
                            setDrawerMode("details");
                            setSlideOverOpen(true);
                          }}
                          className="text-gray-400 hover:text-indigo-600 transition-colors p-1"
                          title={t("list.view")}
                        >
                          <MdOutlineRemoveRedEye className="text-lg" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteModal({ open: true, id: doc.id || doc._id || doc.document_id })}
                          className="text-gray-400 hover:text-red-600 transition-colors p-1"
                          title={t("my.delete")}
                        >
                          <MdOutlineDelete className="text-lg" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          limit={PAGE_SIZE}
          onPage={setPage}
          label={t("my.paginationLabel")}
          activeClass="bg-[#14a0b3] text-white"
          containerClass="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-gray-200 bg-white"
        />
      </div>
      <DocumentSlideOver
        slideOverOpen={slideOverOpen}
        setSlideOverOpen={setSlideOverOpen}
        selectedDoc={selectedDoc}
        drawerMode={drawerMode}
        setDrawerMode={setDrawerMode}
        onRefresh={loadData}
      />

      {/* Upload Document Modal */}
      <UploadDocumentModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={() => {
          setIsUploadModalOpen(false);
          loadData();
        }}
        employeeId={empId}
        documents={documents}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, id: null })}
        onConfirm={handleDelete}
        title={t("my.deleteTitle")}
        message={t("my.deleteMessage")}
        type="delete"
        confirmText={t("my.delete")}
        isLoading={isDeleting}
      />
    </div>
  );
}
