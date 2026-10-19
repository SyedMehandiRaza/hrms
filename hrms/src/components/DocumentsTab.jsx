import { useCallback, useMemo, useState } from "react";
import Pagination from "./Pagination";
import { useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import {
  MdInfoOutline,
  MdOutlineBusiness,
  MdOutlineCheck,
  MdOutlineClose,
  MdOutlineCloudUpload,
  MdOutlineDelete,
  MdOutlineDescription,
  MdOutlineDownload,
  MdOutlineFolder,
  MdOutlineGavel,
  MdOutlineHome,
  MdOutlineSchool,
  MdOutlineShield,
  MdOutlineVisibility,
  MdOutlineWarning,
} from "react-icons/md";
import { TableLoader } from "./Loader";
import Ltr from "./Ltr";
import Can from "./Can";
import UploadDocumentModal from "./UploadDocumentModal";
import RejectReasonModal from "./RejectReasonModal";
import ConfirmationModal from "./ConfirmationModal";
import { useFormat } from "../hooks/useFormat";
import { useCan } from "../hooks/usePermission";
import { MODULES, ACTIONS } from "../constants/permissions";
import { docsForEmployee, updateDocument, deleteDocument } from "../data/groupB";

// ── Document type → display metadata ──────────────────────────────────────────
// Keyed by type_code: the fixed enum of legacy (Add Employee wizard) documents.
// Catalog types fall back to DEFAULT_META and show their own label.
const DOC_TYPE_META = {
  PASSPORT: {
    labelKey: "documents.types.passport",
    icon: MdOutlineBusiness,
    iconBg: "bg-red-50",
    iconColor: "text-red-500",
  },
  IQAMA: {
    labelKey: "documents.types.iqama",
    icon: MdOutlineDescription,
    iconBg: "bg-blue-50",
    iconColor: "text-blue-500",
  },
  NATIONAL_ID: {
    labelKey: "documents.types.nationalId",
    icon: MdOutlineShield,
    iconBg: "bg-cyan-50",
    iconColor: "text-cyan-500",
  },
  DRIVER_LICENSE: {
    labelKey: "documents.types.driverLicense",
    icon: MdOutlineDescription,
    iconBg: "bg-orange-50",
    iconColor: "text-orange-500",
  },
  WORK_PERMIT: {
    labelKey: "documents.types.workPermit",
    icon: MdOutlineShield,
    iconBg: "bg-gray-100",
    iconColor: "text-gray-500",
  },
  OTHER: {
    labelKey: "documents.types.other",
    icon: MdOutlineHome,
    iconBg: "bg-cyan-50",
    iconColor: "text-cyan-500",
  },
};

const DEFAULT_META = {
  labelKey: null,
  icon: MdOutlineDescription,
  iconBg: "bg-gray-100",
  iconColor: "text-gray-500",
};

const fileExt = (name) => {
  if (!name) return null;
  const dot = name.lastIndexOf(".");
  return dot === -1 ? null : name.slice(dot + 1).toUpperCase();
};

// Expiry status comes from the server: VALID | EXPIRING (≤30 days) | EXPIRED.
const STATUS_STYLE = {
  VALID: "text-green-700 bg-green-50 border-green-200",
  EXPIRING: "text-amber-700 bg-amber-50 border-amber-200",
  EXPIRED: "text-red-700 bg-red-50 border-red-200",
};

const EXPIRY_COLOR = {
  VALID: "text-gray-700",
  EXPIRING: "text-amber-500",
  EXPIRED: "text-red-500",
};

const STATUS_LABEL_KEY = {
  VALID: "documents.statusLabels.valid",
  EXPIRING: "documents.statusLabels.expiringSoon",
  EXPIRED: "documents.statusLabels.expired",
};

// Review status (employee uploads / contracts). null = HR or wizard document,
// which needs no review — no badge.
const REVIEW_STYLE = {
  PENDING: "text-amber-700 bg-amber-50 border-amber-200",
  APPROVED: "text-green-700 bg-green-50 border-green-200",
  REJECTED: "text-red-700 bg-red-50 border-red-200",
  DRAFT: "text-gray-600 bg-gray-50 border-gray-200",
};

// Category cards — counts are computed from the employee's documents.
const CATEGORY_META = {
  LEGAL: { icon: MdOutlineGavel, iconBg: "bg-blue-50", iconColor: "text-blue-500" },
  IDENTITY: { icon: MdOutlineFolder, iconBg: "bg-cyan-50", iconColor: "text-cyan-500" },
  PROFESSIONAL: { icon: MdOutlineSchool, iconBg: "bg-purple-50", iconColor: "text-purple-500" },
  SITE: { icon: MdOutlineBusiness, iconBg: "bg-teal-50", iconColor: "text-teal-500" },
  CONTRACT: { icon: MdOutlineDescription, iconBg: "bg-orange-50", iconColor: "text-orange-500" },
  GENERAL: { icon: MdOutlineHome, iconBg: "bg-gray-100", iconColor: "text-gray-500" },
};
const CATEGORY_ORDER = Object.keys(CATEGORY_META);

const decorate = (apiDoc) => {
  // Legacy rows have no catalog type → their enum code drives icon + label.
  const meta =
    (!apiDoc.document_type_id && DOC_TYPE_META[apiDoc.type_code]) || DEFAULT_META;
  const status = apiDoc.expiry_status || "VALID";
  const ext = fileExt(apiDoc.file_name);
  const metaLine = [ext, apiDoc.document_number ? `#${apiDoc.document_number}` : null]
    .filter(Boolean)
    .join(" • ");
  return {
    ...apiDoc,
    _labelKey: meta.labelKey,
    _icon: meta.icon,
    _iconBg: meta.iconBg,
    _iconColor: meta.iconColor,
    _meta: metaLine,
    _status: status,
    _statusStyle: STATUS_STYLE[status] || STATUS_STYLE.VALID,
    _expiryColor: EXPIRY_COLOR[status] || EXPIRY_COLOR.VALID,
    _replace: status === "EXPIRED" || apiDoc.status === "REJECTED",
  };
};

const pad2 = (n) => String(n).padStart(2, "0");

function DocumentsTab() {
  const { t } = useTranslation("employees");
  const { fmtDate } = useFormat();
  const { id } = useParams();
  const can = useCan();
  const [docs, setDocs] = useState(() => docsForEmployee(id).map(decorate));
  const loading = false;
  const forbidden = false;
  const [currentPage, setCurrentPage] = useState(1);
  const [category, setCategory] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [replaceDoc, setReplaceDoc] = useState(null);
  const [rejectDoc, setRejectDoc] = useState(null);
  const [deleteDoc, setDeleteDoc] = useState(null);
  const [busyId] = useState(null);
  const itemsPerPage = 10;

  const canReview = can(MODULES.DOCUMENT, ACTIONS.UPDATE);
  const canDelete = can(MODULES.DOCUMENT, ACTIONS.DELETE);

  const docLabel = (doc) =>
    doc._labelKey ? t(doc._labelKey) : doc.document_type || t("documents.types.default");
  const fmtDocDate = (iso) => (iso ? fmtDate(iso) : t("documents.na"));

  const load = useCallback(() => {
    setDocs(docsForEmployee(id).map(decorate));
  }, [id]);

  // Static build: files aren't served — viewing/downloading is acknowledged only.
  const handleDownload = (e) => {
    e.preventDefault();
    toast.info(t("documents.toast.linkUnavailable"));
  };

  const review = (doc, action, note) => {
    updateDocument(doc.id, {
      status: action === "APPROVE" ? "APPROVED" : "REJECTED",
      review_note: action === "APPROVE" ? null : note || null,
    });
    toast.success(
      t(action === "APPROVE" ? "documents.toast.approved" : "documents.toast.rejected"),
    );
    setRejectDoc(null);
    load();
  };

  const confirmDelete = () => {
    if (!deleteDoc) return;
    deleteDocument(deleteDoc.id);
    toast.success(t("documents.toast.deleted"));
    setDeleteDoc(null);
    load();
  };

  const categoryCounts = useMemo(() => {
    const counts = {};
    docs.forEach((d) => {
      const c = d.category || "GENERAL";
      counts[c] = (counts[c] || 0) + 1;
    });
    return counts;
  }, [docs]);

  // Stable object: the modal re-prefills its form whenever this changes.
  const replaceTarget = useMemo(
    () =>
      replaceDoc
        ? {
          ...replaceDoc,
          document_type: replaceDoc._labelKey ? t(replaceDoc._labelKey) : replaceDoc.document_type,
        }
        : null,
    [replaceDoc, t],
  );

  const visibleDocs = category ? docs.filter((d) => (d.category || "GENERAL") === category) : docs;

  const total = docs.length;
  const expiringSoon = docs.filter((d) => d._status === "EXPIRING").length;
  const expired = docs.filter((d) => d._status === "EXPIRED").length;

  const isEmpty = !loading && visibleDocs.length === 0;
  const emptyText = forbidden ? t("documents.noPermission") : t("documents.empty");

  // Pagination logic
  const totalPages = Math.ceil(visibleDocs.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedDocs = visibleDocs.slice(startIndex, startIndex + itemsPerPage);

  const selectCategory = (c) => {
    setCategory((prev) => (prev === c ? null : c));
    setCurrentPage(1);
  };

  const reviewBadge = (doc, small = false) =>
    doc.status && REVIEW_STYLE[doc.status] ? (
      <span
        title={doc.status === "REJECTED" && doc.review_note ? t("documents.rejectedReason", { note: doc.review_note }) : undefined}
        className={`inline-flex items-center px-2 py-0.5 rounded ${small ? "text-[10px]" : "text-[11px]"} font-bold border ${REVIEW_STYLE[doc.status]}`}
      >
        {t(`documents.reviewLabels.${doc.status}`)}
      </span>
    ) : null;

  // Approve / reject a PENDING employee upload (contracts are accepted by the
  // employee themself, so they are excluded).
  const isReviewable = (doc) =>
    canReview && doc.status === "PENDING" && doc.category !== "CONTRACT";

  const renderActions = (doc, mobile = false) => {
    const iconBtn = "p-1.5 rounded-lg transition-colors disabled:opacity-50";
    return (
      <div className={`flex items-center gap-2 ${mobile ? "flex-wrap mt-2" : ""}`}>
        {doc.has_file && (
          <>
            <button
              onClick={(e) => handleDownload(e, doc.id)}
              className={`${iconBtn} text-gray-400 hover:text-cyan-600 hover:bg-cyan-50`}
              title={t("documents.view")}
            >
              <MdOutlineVisibility className="text-lg" />
            </button>
            <button
              onClick={(e) => handleDownload(e, doc.id)}
              className={`${iconBtn} text-gray-400 hover:text-gray-700 hover:bg-gray-100`}
              title={t("documents.download")}
            >
              <MdOutlineDownload className="text-lg" />
            </button>
          </>
        )}
        {isReviewable(doc) && (
          <>
            <button
              onClick={() => review(doc, "APPROVE")}
              disabled={busyId === doc.id}
              className={`${iconBtn} text-green-600 hover:bg-green-50`}
              title={t("documents.approve")}
            >
              <MdOutlineCheck className="text-lg" />
            </button>
            <button
              onClick={() => setRejectDoc(doc)}
              disabled={busyId === doc.id}
              className={`${iconBtn} text-red-500 hover:bg-red-50`}
              title={t("documents.reject")}
            >
              <MdOutlineClose className="text-lg" />
            </button>
          </>
        )}
        <Can module={MODULES.DOCUMENT} action={ACTIONS.CREATE}>
          <button
            onClick={() => setReplaceDoc(doc)}
            className={`px-3 py-1.5 border rounded-lg text-xs font-semibold transition-colors ${
              doc._replace
                ? "bg-cyan-600 border-cyan-600 text-white hover:bg-cyan-700"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {t("documents.replace")}
          </button>
        </Can>
        {canDelete && (
          <button
            onClick={() => setDeleteDoc(doc)}
            disabled={busyId === doc.id}
            className={`${iconBtn} text-gray-400 hover:text-red-500 hover:bg-red-50`}
            title={t("documents.delete")}
          >
            <MdOutlineDelete className="text-lg" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            tag: t("documents.totalDocuments"),
            value: pad2(total),
            valueColor: "text-gray-900",
            icon: MdOutlineFolder,
            iconBg: "bg-blue-50",
            iconColor: "text-blue-400",
            border: "",
          },
          {
            tag: t("documents.expiringSoon"),
            value: pad2(expiringSoon),
            valueColor: "text-amber-500",
            icon: MdOutlineWarning,
            iconBg: "bg-amber-50",
            iconColor: "text-amber-500",
            border: "",
          },
          {
            tag: t("documents.expiredDocuments"),
            value: pad2(expired),
            valueColor: "text-red-500",
            icon: MdInfoOutline,
            iconBg: "bg-red-50",
            iconColor: "text-red-500",
            border: expired > 0 ? "border-s-4 border-red-400" : "",
          },
        ].map(
          ({
            tag,
            value,
            valueColor,
            icon: Icon,
            iconBg,
            iconColor,
            border,
          }) => (
            <div
              key={tag}
              className={`bg-white border border-gray-200 rounded-xl p-4 ${border}`}
            >
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                {tag}
              </p>
              <div className="flex items-center justify-between">
                <p className={`text-3xl font-bold ${valueColor}`}>{value}</p>
                <div
                  className={`w-9 h-9 ${iconBg} rounded-lg flex items-center justify-center`}
                >
                  <Icon className={`${iconColor} text-xl`} />
                </div>
              </div>
            </div>
          ),
        )}
      </div>

      {/* ── Document Repository ── */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900">
            {t("documents.repository")}
            {category && (
              <button
                onClick={() => selectCategory(category)}
                className="ms-3 text-xs font-semibold text-cyan-600 hover:text-cyan-700"
              >
                {t(`documents.categories.${category}`)} ✕
              </button>
            )}
          </h3>
          <Can module={MODULES.DOCUMENT} action={ACTIONS.CREATE}>
            <button
              onClick={() => setUploadOpen(true)}
              className="flex items-center gap-2 px-3 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-semibold transition-colors"
            >
              <MdOutlineCloudUpload className="text-base" />
              {t("documents.uploadDocument")}
            </button>
          </Can>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {[
                  t("documents.table.sn"),
                  t("documents.table.documentType"),
                  t("documents.table.issueDate"),
                  t("documents.table.expiryDate"),
                  t("documents.table.status"),
                  t("documents.table.actions"),
                ].map((h) => (
                  <th
                    key={h}
                    className="text-start px-5 py-3 text-xs font-semibold text-gray-500"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <TableLoader colSpan={6} label={t("documents.loading")} />
              ) : isEmpty ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-12 text-center text-sm text-gray-400"
                  >
                    {emptyText}
                  </td>
                </tr>
              ) : (
                paginatedDocs.map((doc, index) => {
                  const Icon = doc._icon;
                  return (
                    <tr
                      key={doc.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-5 py-4 text-sm text-gray-600">
                        {startIndex + index + 1}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 ${doc._iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}
                          >
                            <Icon className={`${doc._iconColor} text-lg`} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              {docLabel(doc)}
                            </p>
                            {doc._meta && (
                              <p className="text-xs text-gray-400">
                                <Ltr>{doc._meta}</Ltr>
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-600">
                        <Ltr>{fmtDocDate(doc.issue_date)}</Ltr>
                      </td>
                      <td
                        className={`px-5 py-4 text-sm font-medium ${doc._expiryColor}`}
                      >
                        <Ltr>{fmtDocDate(doc.expiry_date)}</Ltr>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-bold border ${doc._statusStyle}`}
                          >
                            {t(STATUS_LABEL_KEY[doc._status])}
                          </span>
                          {reviewBadge(doc)}
                        </div>
                      </td>
                      <td className="px-5 py-4">{renderActions(doc)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden divide-y divide-gray-100">
          {loading ? (
            <div className="px-4 py-12 text-center text-sm text-gray-400">
              {t("documents.loading")}
            </div>
          ) : isEmpty ? (
            <div className="px-4 py-12 text-center text-sm text-gray-400">
              {emptyText}
            </div>
          ) : (
            paginatedDocs.map((doc) => {
              const Icon = doc._icon;
              return (
                <div key={doc.id} className="px-4 py-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 ${doc._iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}
                      >
                        <Icon className={`${doc._iconColor} text-lg`} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {docLabel(doc)}
                        </p>
                        {doc._meta && (
                          <p className="text-xs text-gray-400">
                            <Ltr>{doc._meta}</Ltr>
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${doc._statusStyle}`}
                      >
                        {t(STATUS_LABEL_KEY[doc._status])}
                      </span>
                      {reviewBadge(doc, true)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                    <span>
                      {t("documents.issued")} <Ltr>{fmtDocDate(doc.issue_date)}</Ltr>
                    </span>
                    <span className={`font-medium ${doc._expiryColor}`}>
                      {t("documents.expires")} <Ltr>{fmtDocDate(doc.expiry_date)}</Ltr>
                    </span>
                  </div>
                  {renderActions(doc, true)}
                </div>
              );
            })
          )}
        </div>

        {/* Pagination Footer */}
        <Pagination
          page={currentPage}
          limit={itemsPerPage}
          total={visibleDocs.length}
          totalPages={totalPages}
          onPage={setCurrentPage}
          label={t("documents.paginationLabel")}
          activeClass="bg-[#14a0b3] text-white"
          containerClass="px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white border-t border-gray-100"
        />
      </div>

      {/* ── Category Cards (real counts; click to filter the table) ── */}
      {CATEGORY_ORDER.some((c) => categoryCounts[c]) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {CATEGORY_ORDER.filter((c) => categoryCounts[c]).map((c) => {
            const { icon: Icon, iconBg, iconColor } = CATEGORY_META[c];
            return (
              <button
                type="button"
                key={c}
                onClick={() => selectCategory(c)}
                className={`text-start bg-white border rounded-xl p-5 hover:shadow-sm transition-shadow ${
                  category === c ? "border-cyan-500" : "border-gray-200"
                }`}
              >
                <div
                  className={`w-11 h-11 ${iconBg} rounded-xl flex items-center justify-center mb-4`}
                >
                  <Icon className={`${iconColor} text-xl`} />
                </div>
                <p className="text-sm font-bold text-gray-900 mb-1">
                  {t(`documents.categories.${c}`)}
                </p>
                <span className="text-xs font-bold text-cyan-600">
                  {t("documents.files", { count: categoryCounts[c] })} &rsaquo;
                </span>
              </button>
            );
          })}
        </div>
      )}

      <UploadDocumentModal
        isOpen={uploadOpen || !!replaceDoc}
        onClose={() => {
          setUploadOpen(false);
          setReplaceDoc(null);
        }}
        onSuccess={() => {
          setUploadOpen(false);
          setReplaceDoc(null);
          load();
        }}
        employeeId={id}
        documents={docs}
        replaceDoc={replaceTarget}
      />

      <RejectReasonModal
        isOpen={!!rejectDoc}
        onClose={() => setRejectDoc(null)}
        onReject={(reason) => rejectDoc && review(rejectDoc, "REJECT", reason)}
        title={t("documents.rejectTitle")}
        subtitle={t("documents.rejectSubtitle")}
      />

      <ConfirmationModal
        isOpen={!!deleteDoc}
        onClose={() => setDeleteDoc(null)}
        onConfirm={confirmDelete}
        title={t("documents.deleteTitle")}
        message={t("documents.deleteMessage")}
        type="delete"
        confirmText={t("documents.delete")}
        isLoading={!!deleteDoc && busyId === deleteDoc.id}
      />
    </div>
  );
}
export default DocumentsTab;
