import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  MdClose,
  MdOutlineCloudUpload,
  MdOutlinePictureAsPdf,
  MdOutlineArticle,
  MdOutlineDownload
} from "react-icons/md";
import { toast } from "react-toastify";
import { updateDocument, uploadDocument } from "../../data/groupB";
import RejectReasonModal from "../../components/RejectReasonModal";

// Status dot and text colour (same mapping as the Documents list).
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

export default function DocumentSlideOver({
  slideOverOpen,
  setSlideOverOpen,
  selectedDoc,
  drawerMode,
  setDrawerMode,
  onRefresh // Callback to parent to refresh the lists
}) {
  const { t } = useTranslation("documents");
  const fileInputRef = useRef(null);

  const [isSubmitting] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);

  // Replace Form State
  const [replaceForm, setReplaceForm] = useState({
    docType: "",
    issueDate: "",
    expiryDate: "",
    issuingAuthority: "",
    referenceNumber: "",
    file: null
  });

  if (!selectedDoc) return null;

  // Initialize replace form when entering renew mode
  const handleOpenRenew = () => {
    setReplaceForm({
      docType: selectedDoc.docType || "",
      issueDate: "",
      expiryDate: "",
      issuingAuthority: "",
      referenceNumber: "",
      file: null
    });
    setDrawerMode("renew");
  };

  // Static build: review actions update the in-memory document store.
  const handleApprove = () => {
    updateDocument(selectedDoc.id, { status: "APPROVED", review_note: null });
    toast.success(t("slideOver.toasts.approved"));
    setSlideOverOpen(false);
    if (onRefresh) onRefresh();
  };

  const handleReject = (reason) => {
    updateDocument(selectedDoc.id, { status: "REJECTED", review_note: reason || null });
    toast.success(t("slideOver.toasts.rejected"));
    setSlideOverOpen(false);
    if (onRefresh) onRefresh();
  };

  const handleDownload = () => {
    toast.info(t("slideOver.toasts.downloadUnavailable"));
  };

  const handleReplaceSubmit = () => {
    if (!replaceForm.file) {
      toast.error(t("slideOver.toasts.selectFile"));
      return;
    }
    if (replaceForm.issueDate && replaceForm.expiryDate) {
      if (new Date(replaceForm.expiryDate) <= new Date(replaceForm.issueDate)) {
        toast.error(t("slideOver.toasts.expiryAfterIssue"));
        return;
      }
    }

    uploadDocument({
      employeeId: selectedDoc.employee_id || selectedDoc.employeeId,
      replaceDocumentId: selectedDoc.id,
      issueDate: replaceForm.issueDate,
      expiryDate: replaceForm.expiryDate,
      issuingAuthority: replaceForm.issuingAuthority,
      documentNumber: replaceForm.referenceNumber,
      fileName: replaceForm.file.name,
      status: "APPROVED",
    });
    toast.success(t("slideOver.toasts.replaced"));
    setSlideOverOpen(false);
    if (onRefresh) onRefresh();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/20 backdrop-blur-sm transition-opacity duration-300 ${
          slideOverOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setSlideOverOpen(false)}
      />

      {/* Drawer Panel */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out ${
          slideOverOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >

        {drawerMode === "details" ? (
          // ── D1 / D3: Document Details ──
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{t("slideOver.detailsTitle")}</h2>
                <p className="text-sm text-gray-500 mt-0.5">{t("slideOver.detailsSubtitle")}</p>
              </div>
              <button onClick={() => setSlideOverOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <MdClose className="text-xl" />
              </button>
            </div>

            {/* Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {/* Badges */}
              <div className="flex gap-2">
                <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded">{t("slideOver.idBadge", { id: "EMP-0942" })}</span>
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded">{t("slideOver.fullTime")}</span>
              </div>

              {/* Profile Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {selectedDoc.employeeImg ? (
                    <img src={selectedDoc.employeeImg} alt={selectedDoc.employeeName} className="w-14 h-14 rounded-xl object-cover border border-cyan-600 p-0.5 shadow-sm" />
                  ) : (
                    <div className={`w-14 h-14 rounded-xl ${selectedDoc.employeeAvatarColor} text-lg font-bold flex items-center justify-center border border-cyan-600 p-0.5 shadow-sm`}>
                      {selectedDoc.employeeAvatar}
                    </div>
                  )}
                  <div>
                    <h3 className="text-[17px] font-bold text-gray-900">{selectedDoc.employeeName}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{selectedDoc.employeeRole}</p>
                  </div>
                </div>
                {/* Status badge right side */}
                {selectedDoc.status === "VALID" ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-green-50 text-green-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    {t("statusLabels.APPROVED")}
                  </span>
                ) : selectedDoc.status === "PENDING" ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-yellow-100/50 text-yellow-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                    {t("statusLabels.PENDING")}
                  </span>
                ) : (
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${getStatusStyles(selectedDoc.status).bg} ${getStatusStyles(selectedDoc.status).text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${getStatusStyles(selectedDoc.status).dot}`} />
                    {t(`statusLabels.${selectedDoc.status}`, { defaultValue: selectedDoc.status })}
                  </span>
                )}
              </div>

              {/* Document Metadata Block */}
              <div className="bg-[#f8fafc] rounded-xl p-5 border border-gray-100 space-y-4">
                <h4 className="text-[11px] font-bold text-[#14a0b3] uppercase tracking-wider">{t("add.sections.documentMetadata")}</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{t("add.issueDate")}</label>
                    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 font-medium min-h-[38px]">{selectedDoc.issueDate || "—"}</div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{t("add.expiryDate")}</label>
                    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 font-medium min-h-[38px]">{selectedDoc.expiryDate || "—"}</div>
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{t("add.issuingAuthority")}</label>
                    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 font-medium min-h-[38px]">{selectedDoc.issuingAuthority || t("slideOver.defaultAuthority")}</div>
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{t("add.referenceNumber")}</label>
                    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 font-medium min-h-[38px]">{selectedDoc.document_number || selectedDoc.docId || "—"}</div>
                  </div>
                </div>
              </div>

              {/* Document Preview Block */}
              <div className="bg-[#f2fbf9] rounded-xl p-5 border border-green-50 space-y-4">
                <h4 className="text-[11px] font-bold text-[#14a0b3] uppercase tracking-wider">{t("slideOver.documentPreview")}</h4>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{t("add.documentType")}</label>
                  <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 font-medium min-h-[38px]">{selectedDoc.docType || "—"}</div>
                </div>
                {/* File box */}
                <div className="bg-white border border-gray-200 rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-[8px] font-bold tracking-widest shadow-inner">
                      PDF
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate max-w-[150px]">m_chen_{selectedDoc.docType.toLowerCase().replace(" ", "_")}_2024.pdf</p>
                      <p className="text-xs text-gray-500 mt-0.5">2.4 MB</p>
                    </div>
                  </div>
                  <button onClick={handleDownload} className="flex items-center gap-1.5 text-[11px] font-bold text-[#14a0b3] hover:text-cyan-700 flex-shrink-0">
                    <MdOutlineDownload className="text-sm" /> {t("slideOver.download")}
                  </button>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="p-6 border-t border-gray-100 flex gap-3">
              {selectedDoc.status === "PENDING" ? (
                <>
                  <button onClick={() => setRejectModalOpen(true)} disabled={isSubmitting} className="flex-1 py-3 border border-red-200 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-50 transition-colors disabled:opacity-50">
                    {t("slideOver.reject")}
                  </button>
                  <button onClick={handleApprove} disabled={isSubmitting} className="flex-[2] py-3 bg-[#14a0b3] hover:bg-[#118898] text-white rounded-lg text-sm font-semibold transition-colors shadow-sm disabled:opacity-50">
                    {isSubmitting ? t("slideOver.approving") : t("slideOver.approveDocument")}
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setSlideOverOpen(false)} className="flex-1 py-3 border border-gray-200 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors">
                    {t("add.cancel")}
                  </button>
                  <button onClick={handleOpenRenew} className="flex-[2] py-3 bg-[#14a0b3] hover:bg-[#118898] text-white rounded-lg text-sm font-semibold transition-colors shadow-sm">
                    {t("slideOver.replaceDocument")}
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          // ── D2: Renew Document ──
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{t("slideOver.renewTitle")}</h2>
                <p className="text-sm text-gray-500 mt-0.5">{t("slideOver.renewSubtitle", { name: selectedDoc.employeeName })}</p>
              </div>
              <button onClick={() => setSlideOverOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <MdClose className="text-xl" />
              </button>
            </div>

            {/* Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {/* Reference Document (Expired) block */}
              <div className="bg-[#f8fafc] rounded-xl p-5 border border-gray-200 space-y-4">
                <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{t("slideOver.referenceDocument", { status: t(`statusLabels.${selectedDoc.status}`, { defaultValue: selectedDoc.status }) })}</h4>
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 bg-gray-200 rounded-lg flex-shrink-0 flex items-center justify-center border border-gray-300">
                    <MdOutlineArticle className="text-gray-400 text-3xl" />
                  </div>
                  <div className="space-y-3 flex-1 min-w-0">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">{t("slideOver.currentFile")}</p>
                      <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 truncate"><MdOutlinePictureAsPdf className="text-gray-400 flex-shrink-0" /> {selectedDoc.docType.replace(" ", "_")}_2023.pdf</p>
                    </div>
                    <div className="flex gap-4 sm:gap-6">
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">{t("slideOver.originalIssue")}</p>
                        <p className="text-xs font-semibold text-gray-700">{selectedDoc.issueDate}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">{t("slideOver.expiredOn")}</p>
                        <p className="text-xs font-semibold text-red-500">{selectedDoc.expiryDate}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* New Document Detail Block */}
              <div className="border border-[#14a0b3]/20 bg-[#f4faff]/30 rounded-xl p-5 space-y-5">
                <h4 className="text-[11px] font-bold text-[#14a0b3] uppercase tracking-wider">{t("slideOver.newDocumentDetail")}</h4>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-700 uppercase tracking-widest">{t("add.documentType")}</label>
                  <input
                    type="text"
                    value={replaceForm.docType}
                    onChange={(e) => setReplaceForm(prev => ({...prev, docType: e.target.value}))}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#14a0b3]"
                    disabled
                  />
                </div>

                {/* Drag and drop */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center justify-center text-center hover:border-cyan-400 transition-colors cursor-pointer bg-white"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={(e) => setReplaceForm(prev => ({...prev, file: e.target.files[0]}))}
                    accept=".pdf,.jpg,.jpeg,.png"
                  />
                  <MdOutlineCloudUpload className="text-3xl text-gray-300 mb-2" />
                  <p className="text-sm text-gray-600 font-medium">
                    {replaceForm.file ? (
                      <span className="text-[#14a0b3] font-bold">{replaceForm.file.name}</span>
                    ) : (
                      <>{t("slideOver.dropPrefix")}<span className="text-[#14a0b3] underline underline-offset-2">{t("slideOver.browse")}</span></>
                    )}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider">{t("slideOver.fileHint")}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-700 uppercase tracking-widest">{t("slideOver.newIssueDate")}</label>
                    <input
                      type="date"
                      value={replaceForm.issueDate}
                      onChange={(e) => setReplaceForm(prev => ({...prev, issueDate: e.target.value}))}
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#14a0b3]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-700 uppercase tracking-widest">{t("slideOver.newExpiryDate")}</label>
                    <input
                      type="date"
                      value={replaceForm.expiryDate}
                      onChange={(e) => setReplaceForm(prev => ({...prev, expiryDate: e.target.value}))}
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#14a0b3]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-700 uppercase tracking-widest">{t("add.issuingAuthority")}</label>
                  <input
                    type="text"
                    value={replaceForm.issuingAuthority}
                    onChange={(e) => setReplaceForm(prev => ({...prev, issuingAuthority: e.target.value}))}
                    maxLength={150}
                    placeholder={t("add.issuingAuthorityPlaceholder")}
                    className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#14a0b3]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-700 uppercase tracking-widest">{t("add.referenceNumber")}</label>
                  <input
                    type="text"
                    value={replaceForm.referenceNumber}
                    onChange={(e) => setReplaceForm(prev => ({...prev, referenceNumber: e.target.value.replace(/[^a-zA-Z0-9]/g, "")}))}
                    placeholder={t("add.referenceNumberPlaceholder")}
                    className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#14a0b3]"
                  />
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button onClick={() => setDrawerMode("details")} disabled={isSubmitting} className="flex-1 py-3 border border-gray-200 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50">
                {t("add.cancel")}
              </button>
              <button onClick={handleReplaceSubmit} disabled={isSubmitting} className="flex-[2] py-3 bg-[#14a0b3] hover:bg-[#118898] text-white rounded-lg text-sm font-semibold transition-colors shadow-sm disabled:opacity-50">
                {isSubmitting ? t("slideOver.uploading") : t("slideOver.replaceDocument")}
              </button>
            </div>
          </div>
        )}
      </div>

      <RejectReasonModal
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        onReject={handleReject}
        title={t("slideOver.rejectTitle")}
        subtitle={t("slideOver.rejectSubtitle")}
      />
    </>
  );
}
