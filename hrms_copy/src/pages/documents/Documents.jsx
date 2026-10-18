import { useEffect, useMemo, useState } from "react";
import Pagination from "../../components/Pagination";
import { useTranslation } from "react-i18next";
import {
  MdOutlineDescription,
  MdOutlineCheckCircle,
  MdOutlineWarningAmber,
  MdOutlineError,
  MdOutlineUpload,
  MdOutlineSearch,
  MdOutlineRemoveRedEye,
  MdOutlineVisibilityOff,
  MdOutlineClear,
} from "react-icons/md";
import { useNavigate } from "react-router-dom";
import DocumentSlideOver from "./DocumentSlideOver";
import CustomDropdown from "../../components/CustomDropdown";
import { documentSummary, docsForEmployee, groupedDocumentTypes } from "../../data/groupB";
import { paginate } from "../../data/common";
import { TableLoader } from "../../components/Loader";



// Helper to get status dot and text color
const getStatusStyles = (status) => {
  switch (status) {
    case "VALID":
    case "APPROVED":
      return { text: "text-emerald-600", bg: "bg-emerald-100/60" };
    case "EXPIRING SOON":
      return { text: "text-red-600", bg: "bg-red-100/60" };
    case "EXPIRED":
      return { text: "text-red-700", bg: "bg-red-200/60" };
    case "PENDING":
      return { text: "text-amber-600", bg: "bg-amber-100/60" };
    default:
      return { text: "text-gray-600", bg: "bg-gray-100/60" };
  }
};

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Documents() {
  const { t } = useTranslation("documents");
  const navigate = useNavigate();
  const documentTypes = useMemo(() => groupedDocumentTypes(), []);
  const [searchInput, setSearchInput] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [version, setVersion] = useState(0);
  const itemsPerPage = 10;

  // Static summary, filtered + paged client-side.
  const employeeDocumentSummary = useMemo(() => {
    const { rows, dashboard_stats } = documentSummary({
      search: appliedSearch,
      type: typeFilter,
      status: statusFilter,
    });
    const block = paginate(rows, currentPage, itemsPerPage);
    return {
      data: {
        data: block.rows,
        total: block.total,
        total_pages: block.totalPages,
        dashboard_stats,
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedSearch, typeFilter, statusFilter, currentPage, version]);
  const employees = employeeDocumentSummary?.data?.data || [];
  const totalPages = employeeDocumentSummary?.data?.total_pages || 1;
  const dashboardStats = employeeDocumentSummary?.data?.dashboard_stats || {
    total_documents: 0,
    valid_documents: 0,
    expiring_soon: 0,
    expired_documents: 0,
  };

  const statCards = [
    {
      icon: <MdOutlineDescription className="text-[#14a0b3] text-2xl" />,
      iconBg: "bg-[#f4faff]",
      badge: { text: "Total", textKey: "list.badges.total", color: "text-[#14a0b3] bg-cyan-50" },
      labelKey: "dashboard.stats.totalDocuments",
      value: dashboardStats.total_documents,
    },
    {
      icon: <MdOutlineCheckCircle className="text-green-500 text-2xl" />,
      iconBg: "bg-green-50",
      badge: null,
      labelKey: "dashboard.stats.validDocuments",
      value: dashboardStats.valid_documents,
    },
    {
      icon: <MdOutlineWarningAmber className="text-amber-500 text-2xl" />,
      iconBg: "bg-amber-50",
      badge: {
        text: "Action Needed",
        textKey: "dashboard.stats.actionNeeded",
        color: "text-amber-600 bg-amber-100/50",
      },
      labelKey: "dashboard.stats.expiringSoon",
      value: dashboardStats.expiring_soon,
    },
    {
      icon: <MdOutlineError className="text-red-500 text-2xl" />,
      iconBg: "bg-red-50",
      badge: {
        text: "Critical",
        textKey: "dashboard.stats.critical",
        color: "text-red-600 bg-red-100/50",
      },
      labelKey: "dashboard.stats.expiredDocuments",
      value: dashboardStats.expired_documents,
    },
  ];

  const isFetchingSummary = false;
  const [expandedRows, setExpandedRows] = useState([]); // All rows collapsed by default
  const [employeeDocumentsMap, setEmployeeDocumentsMap] = useState({});
  const [slideOverOpen, setSlideOverOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [drawerMode, setDrawerMode] = useState("details"); // 'details' | 'renew'

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedSearch(searchInput);
      setCurrentPage(1); // Reset to page 1 on search
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);


  const openDetails = (doc) => {
    setSelectedDoc(doc);
    setDrawerMode("details");
    setSlideOverOpen(true);
  };

  const handleRefresh = () => {
    // Re-read the summary list
    setVersion((v) => v + 1);

    // Re-read the specific employee's documents if they are expanded
    if (selectedDoc && (selectedDoc.employee_id || selectedDoc.employeeId)) {
      const empId = selectedDoc.employee_id || selectedDoc.employeeId;
      setEmployeeDocumentsMap((prev) => ({ ...prev, [empId]: docsForEmployee(empId) }));
    }
  };

  const toggleRow = (empId) => {
    if (expandedRows.includes(empId)) {
      setExpandedRows((prev) => prev.filter((id) => id !== empId));
    } else {
      setExpandedRows((prev) => [...prev, empId]);
      if (!employeeDocumentsMap[empId]) {
        setEmployeeDocumentsMap((prev) => ({ ...prev, [empId]: docsForEmployee(empId) }));
      }
    }
  };

  return (
    <>
      <div className="space-y-5">
        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
              {t("dashboard.title")}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {t("dashboard.subtitle")}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0 self-start">
            <button
              onClick={() => navigate("/admin/documents/add-new-document")}
              className="flex items-center gap-2 bg-[#14a0b3] hover:bg-cyan-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm"
            >
              <MdOutlineUpload className="text-lg" />
              {t("dashboard.uploadDocument")}
            </button>
          </div>
        </div>

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card, i) => (
            <div
              key={i}
              className="bg-white border border-gray-200 rounded-xl p-5"
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className={`w-10 h-10 ${card.iconBg} rounded-lg flex items-center justify-center`}
                >
                  {card.icon}
                </div>
                {card.badge && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${card.badge.color}`}
                  >
                    {card.badge.textKey
                      ? t(card.badge.textKey)
                      : card.badge.text}
                  </span>
                )}
              </div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                {t(card.labelKey)}
              </p>
              <p className="text-3xl font-bold text-gray-900">{card.value}</p>
            </div>
          ))}
        </div>

        {/* ── Filters Section ── */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col lg:flex-row items-end gap-4">
          <div className="flex-1 w-full space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              {t("list.search")}
            </label>
            <div className="relative">
              <MdOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t("list.searchPlaceholder")}
                className="w-full bg-[#f8fafc] border border-gray-200 text-gray-900 text-sm rounded-lg pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-[#14a0b3] focus:border-[#14a0b3] outline-none transition-all"
              />
            </div>
          </div>

          <div className="w-full lg:w-48 space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              {t("list.type")}
            </label>
            <CustomDropdown
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              options={[
                { label: t("list.all"), value: "all" },
                ...Object.values(documentTypes?.data || {})
                  .flat()
                  .filter(Boolean)
                  .map((dt) => ({ label: dt.label, value: dt.id })),
              ]}
            />
          </div>

          <div className="w-full lg:w-48 space-y-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              {t("list.status")}
            </label>
            <CustomDropdown
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { label: t("list.allStatuses"), value: "all" },
                { label: t("list.statusFilter.valid"), value: "valid" },
                { label: t("list.statusFilter.expiring"), value: "expiring" },
                { label: t("list.statusFilter.expired"), value: "expired" },
              ]}
            />
          </div>

          <div className="flex w-full lg:w-auto items-center gap-3">
            <button
              onClick={() => {
                setSearchInput("");
                setAppliedSearch("");
                setTypeFilter("all");
                setStatusFilter("all");
                setCurrentPage(1);
              }}
              className="w-full sm:w-auto flex justify-center items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-2 rounded-lg font-medium text-sm transition-colors h-[42px]"
            >
              <MdOutlineClear className="text-lg" />
              {t("list.clearFilters")}
            </button>
          </div>
        </div>

        {/* ── Document List Table ── */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-[#f4f4f9]">
                <tr className="border-b border-gray-100">
                  <th className="text-start px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-widest w-[5%]">
                    {t("list.table.sno")}
                  </th>
                  <th className="text-start px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-widest w-[25%]">
                    {t("list.table.employeeName")}
                  </th>
                  <th className="text-start px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-widest w-[25%]">
                    {t("list.table.totalDocument")}
                  </th>
                  <th className="text-center px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-widest w-[15%]">
                    {t("list.table.pending")}
                  </th>
                  <th className="text-center px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-widest w-[15%]">
                    {t("list.table.expiring")}
                  </th>
                  <th className="text-center px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-widest w-[15%]">
                    {t("list.table.actions")}
                  </th>
                </tr>
              </thead>
              {isFetchingSummary && (
                <tbody>
                  <TableLoader colSpan={6} label={t("list.loading")} />
                </tbody>
              )}
              {!isFetchingSummary && employees.length === 0 && (
                <tbody>
                  <tr>
                    <td
                      colSpan="6"
                      className="px-6 py-8 text-center text-gray-500"
                    >
                      {t("list.empty")}
                    </td>
                  </tr>
                </tbody>
              )}
              {!isFetchingSummary &&
                employees.map((emp, index) => {
                  const empId = emp.employee_id || emp.id;
                  const isExpanded = expandedRows.includes(empId);
                  const employeeName =
                    emp.employee_name || emp.employeeName || t("list.unknown");
                  const employeeInitials = employeeName
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .substring(0, 2)
                    .toUpperCase();
                  const roleText =
                    [emp.department, emp.role].filter(Boolean).join(" • ") ||
                    emp.employeeRole ||
                    t("list.noRole");
                  const docsCount = emp.total_documents || 0;

                  return (
                    <tbody
                      key={empId}
                      className="border-b border-gray-100 last:border-b-0 bg-white"
                    >
                      <tr className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <span className="text-[14px] font-medium text-gray-600">
                            {String(index + 1).padStart(2, '0')}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            {(emp.profile_url || emp.employeeImg) ? (
                              <img
                                src={emp.profile_url || emp.employeeImg}
                                alt={employeeName}
                                className="w-10 h-10 rounded-full flex-shrink-0 object-cover border border-gray-100 shadow-sm"
                              />
                            ) : (
                              <div
                                className={`w-10 h-10 rounded-full bg-cyan-100 text-cyan-700 text-sm font-bold flex items-center justify-center flex-shrink-0 shadow-sm`}
                              >
                                {employeeInitials}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-[15px] font-bold text-gray-900 truncate tracking-tight">
                                {employeeName}
                              </p>
                              <p className="text-xs text-gray-400 mt-0.5 truncate font-medium">
                                {roleText}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[14px] font-medium text-gray-700">
                            {t("list.docCount", { count: docsCount })}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center">
                            <span className="w-9 h-6 flex items-center justify-center rounded-full bg-gray-100 text-gray-700 font-bold text-[11px] tracking-wide">
                              {emp.pending || emp.pendingCount || 0}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center">
                            <span className="w-9 h-6 flex items-center justify-center rounded-full bg-red-50 text-red-600 font-bold text-[11px] tracking-wide">
                              {emp.expiring || emp.expiringCount || 0}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center">
                            <button
                              onClick={() => toggleRow(empId)}
                              className="p-1.5 text-gray-400 hover:text-[#14a0b3] hover:bg-cyan-50 rounded transition-colors"
                            >
                              {isExpanded ? (
                                <MdOutlineVisibilityOff className="text-xl" />
                              ) : (
                                <MdOutlineRemoveRedEye className="text-xl" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td colSpan="6" className="p-0 border-none">
                          <div
                            className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                          >
                            <div className="overflow-hidden">
                              <div className="px-6 pb-6 pt-2">
                                <div className="border border-gray-100 rounded-xl overflow-hidden bg-white shadow-sm">
                                  <table className="w-full">
                                    <thead className="bg-[#f8fafc] border-b border-gray-100">
                                      <tr>
                                        <th className="text-start px-6 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider w-[5%]">
                                          {t("list.table.sno")}
                                        </th>
                                        <th className="text-start px-6 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider w-[20%]">
                                          {t("list.table.docType")}
                                        </th>
                                        <th className="text-start px-6 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider w-[20%]">
                                          {t("list.table.issueDate")}
                                        </th>
                                        <th className="text-start px-6 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider w-[20%]">
                                          {t("list.table.expiryDate")}
                                        </th>
                                        <th className="text-start px-6 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider w-[20%]">
                                          {t("list.table.status")}
                                        </th>
                                        <th className="text-center px-6 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider w-[15%]">
                                          {t("list.table.actions")}
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                      {!employeeDocumentsMap[empId] ||
                                        employeeDocumentsMap[empId].length ===
                                        0 ? (
                                        <tr>
                                          <td
                                            colSpan="6"
                                            className="px-6 py-4 text-center text-[12px] text-gray-500"
                                          >
                                            {!employeeDocumentsMap[empId]
                                              ? t("list.loadingShort")
                                              : t("list.noDetails")}
                                          </td>
                                        </tr>
                                      ) : (
                                        employeeDocumentsMap[empId].map(
                                          (doc, docIndex) => {
                                            const statusValue =
                                              doc.status ||
                                              doc.expiry_status ||
                                              "VALID";
                                            const statusStyle =
                                              getStatusStyles(statusValue);
                                            const isExpiringSoon =
                                              statusValue === "EXPIRING SOON" ||
                                              statusValue === "EXPIRING";
                                            const isExpired =
                                              statusValue === "EXPIRED";
                                            const docTypeLabel =
                                              doc.type?.label ||
                                              doc.type?.code ||
                                              doc.document_type ||
                                              t("list.documentFallback");

                                            return (
                                              <tr
                                                key={doc.id}
                                                className="hover:bg-gray-50/50 transition-colors"
                                              >
                                                <td className="px-6 py-4">
                                                  <span className="text-[13px] font-medium text-gray-600">
                                                    {String(docIndex + 1).padStart(2, '0')}
                                                  </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                  <p className="text-[13px] font-bold text-gray-800" title={docTypeLabel}>
                                                    {docTypeLabel?.length > 20 ? `${docTypeLabel.substring(0, 20)}...` : docTypeLabel}
                                                  </p>
                                                </td>
                                                <td className="px-6 py-4">
                                                  <span className="text-[13px] font-medium text-gray-600">
                                                    {doc.issue_date || "-"}
                                                  </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                  <span
                                                    className={`text-[13px] font-bold ${isExpired ? "text-red-600" : isExpiringSoon ? "text-red-500" : "text-gray-600"}`}
                                                  >
                                                    {doc.expiry_date || "-"}
                                                  </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                  <span
                                                    className={`inline-flex items-center px-2 py-1 rounded text-[9px] font-bold tracking-widest uppercase ${statusStyle.bg} ${statusStyle.text}`}
                                                  >
                                                    {t(`statusLabels.${statusValue}`, { defaultValue: statusValue })}
                                                  </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                  <button
                                                    onClick={() =>
                                                      openDetails({
                                                        ...doc,
                                                        docType: docTypeLabel,
                                                        issueDate:
                                                          doc.issue_date || "-",
                                                        expiryDate:
                                                          doc.expiry_date ||
                                                          "-",
                                                        status: statusValue,
                                                        employeeName,
                                                        employeeImg:
                                                          emp.profile_url || emp.employeeImg,
                                                        employeeAvatar:
                                                          employeeInitials,
                                                        employeeAvatarColor:
                                                          "bg-cyan-100 text-cyan-700",
                                                        employeeRole: roleText,
                                                      })
                                                    }
                                                    className="text-[#14a0b3] hover:text-cyan-700 font-bold text-xs uppercase tracking-widest transition-colors"
                                                  >
                                                    {t("list.view")}
                                                  </button>
                                                </td>
                                              </tr>
                                            );
                                          },
                                        )
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  );
                })}
            </table>
          </div>

          {/* Pagination Footer */}
          <Pagination
            page={currentPage}
            totalPages={totalPages}
            total={employeeDocumentSummary?.data?.total || 0}
            limit={itemsPerPage}
            onPage={setCurrentPage}
            label={t("list.paginationLabel")}
            activeClass="bg-[#14a0b3] text-white shadow-sm"
          />
        </div>
      </div>

      {/* ── Slide-Over Modal ── */}
      <DocumentSlideOver
        slideOverOpen={slideOverOpen}
        setSlideOverOpen={setSlideOverOpen}
        selectedDoc={selectedDoc}
        drawerMode={drawerMode}
        setDrawerMode={setDrawerMode}
        onRefresh={handleRefresh}
      />
    </>
  );
}

