import { useEffect } from "react";
import { MdClose, MdOutlineDescription, MdOutlinePerson } from "react-icons/md";
import { useTranslation } from "react-i18next";
import { useFormat } from "../hooks/useFormat";
import Ltr from "./Ltr";

const labelCls =
  "block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5";
const valueCls =
  "text-sm font-medium text-gray-900 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 min-h-[42px] flex items-center";

export default function DependentDetailModal({
  onClose,
  dependent,
  relationshipLabel,
  statusLabel,
  statusStyles,
  relStyles,
}) {
  const { t } = useTranslation("employees");
  const { fmtDate } = useFormat();

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  if (!dependent) return null;

  const formatDob = (iso) => (iso ? fmtDate(iso) : "—");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden"
        style={{ maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Fixed Header ── */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 flex-shrink-0 bg-gray-50/50 border-b border-gray-100">
          <div className="flex items-center gap-3.5 min-w-0">
            {dependent.photo_url ? (
              <img
                src={dependent.photo_url}
                alt={dependent.full_name}
                className="w-12 h-12 rounded-full object-cover border border-gray-200 flex-shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-cyan-100 text-cyan-700 font-bold text-lg flex items-center justify-center flex-shrink-0">
                {dependent.full_name
                  ?.trim()
                  .split(/\s+/)
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase() || <MdOutlinePerson className="text-2xl" />}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-900 leading-tight truncate">
                {dependent.full_name}
              </h2>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${relStyles?.[dependent.relationship] || "text-gray-600 bg-gray-100 border-gray-200"}`}
                >
                  {relationshipLabel ? relationshipLabel(dependent.relationship) : dependent.relationship}
                </span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${statusStyles?.[dependent.status] || "text-amber-700 bg-amber-50 border-amber-200"}`}
                >
                  {statusLabel ? statusLabel(dependent.status) : dependent.status}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0 ml-3"
          >
            <MdClose className="text-xl" />
          </button>
        </div>

        {/* ── Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 custom-scrollbar">
          <div className="space-y-4">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              • {t("dependent.basicInfo", { defaultValue: "Dependent Information" })}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>{t("dependent.fullName", { defaultValue: "Full Name" })}</label>
                <div className={valueCls}>{dependent.full_name || "—"}</div>
              </div>
              <div>
                <label className={labelCls}>{t("dependent.relationship", { defaultValue: "Relationship" })}</label>
                <div className={valueCls}>
                  {relationshipLabel ? relationshipLabel(dependent.relationship) : dependent.relationship || "—"}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>{t("dependent.dob", { defaultValue: "Date of Birth" })}</label>
                <div className={valueCls}>
                  <Ltr>{formatDob(dependent.date_of_birth)}</Ltr>
                </div>
              </div>
              <div>
                <label className={labelCls}>{t("dependent.gender", { defaultValue: "Gender" })}</label>
                <div className={valueCls}>
                  {dependent.gender ? dependent.gender.charAt(0) + dependent.gender.slice(1).toLowerCase() : "—"}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>{t("dependent.nationality", { defaultValue: "Nationality" })}</label>
                <div className={valueCls}>{dependent.nationality || "—"}</div>
              </div>
              <div>
                <label className={labelCls}>{t("dependent.contactNumber", { defaultValue: "Contact Number" })}</label>
                <div className={valueCls}>
                  <Ltr>{dependent.contact || "—"}</Ltr>
                </div>
              </div>
            </div>

            <div>
              <label className={labelCls}>{t("dependent.idDetails", { defaultValue: "ID Details" })}</label>
              <div className={valueCls}>
                <Ltr>{dependent.id_details || "—"}</Ltr>
              </div>
            </div>

            <div>
              <label className={labelCls}>{t("dependent.document", { defaultValue: "Document" })}</label>
              <div className={valueCls}>
                {dependent.document_url ? (
                  <a
                    href={dependent.document_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-cyan-600 font-semibold hover:underline"
                  >
                    <MdOutlineDescription className="text-lg flex-shrink-0" />
                    <span className="truncate">{dependent.document_name || t("dependent.viewDocumentFallback")}</span>
                  </a>
                ) : (
                  <span className="text-gray-400">{t("dependent.noDocument", { defaultValue: "No document attached" })}</span>
                )}
              </div>
            </div>

            {dependent.status === "REJECTED" && dependent.reject_reason && (
              <div>
                <label className="block text-[11px] font-semibold text-red-500 uppercase tracking-wider mb-1.5">
                  {t("dependent.rejectReason", { defaultValue: "Rejection Reason" })}
                </label>
                <div className="text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 min-h-[42px] flex items-center whitespace-pre-wrap">
                  {dependent.reject_reason}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Fixed Footer ── */}
        <div className="flex justify-end gap-3 px-6 py-4 flex-shrink-0 bg-gray-50/50 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 shadow-sm transition-all"
          >
            {t("dependent.close", { defaultValue: "Close" })}
          </button>
        </div>
      </div>
    </div>
  );
}
