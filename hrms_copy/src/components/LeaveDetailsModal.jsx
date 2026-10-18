import { useEffect } from "react";
import { MdClose } from "react-icons/md";
import { useTranslation } from "react-i18next";
import { useFormat } from "../hooks/useFormat";
import Ltr from "./Ltr";

const labelCls =
  "block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5";
const valueCls = "text-sm font-medium text-gray-900 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5";

export default function LeaveDetailsModal({ onClose, request }) {
  const { t } = useTranslation("leaves");
  const { fmtDate } = useFormat();
  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  if (!request) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col"
        style={{ maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Fixed Header ── */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{t("detailsModal.title")}</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              {t("detailsModal.subtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0"
          >
            <MdClose className="text-xl" />
          </button>
        </div>

        <hr className="border-gray-100 flex-shrink-0" />

        {/* ── Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 custom-scrollbar">
          <div className="space-y-4">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              • {t("detailsModal.basicInformation")}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>{t("detailsModal.leaveType")}</label>
                <div className={valueCls}>{request.type}</div>
              </div>
              <div>
                <label className={labelCls}>{t("detailsModal.status")}</label>
                <div className={`${valueCls} flex items-center`}>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold border ${request.statusColor}`}>
                    {request.status}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>{t("detailsModal.fromDate")}</label>
                <div className={valueCls}>
                  <Ltr>{fmtDate(request.from)}</Ltr>
                </div>
              </div>
              <div>
                <label className={labelCls}>{t("detailsModal.toDate")}</label>
                <div className={valueCls}>
                  <Ltr>{fmtDate(request.to)}</Ltr>
                </div>
              </div>
            </div>

            <div>
              <label className={labelCls}>{t("detailsModal.duration")}</label>
              <div className={valueCls}>{t("detailsModal.days", { count: request.days })}</div>
            </div>

            <div>
              <label className={labelCls}>{t("detailsModal.reason")}</label>
              <div className={`${valueCls} min-h-[60px] whitespace-pre-wrap`}>
                {request.reason || t("detailsModal.noReason")}
              </div>
            </div>
          </div>
        </div>

        {/* ── Fixed Footer ── */}
        <hr className="border-gray-100 flex-shrink-0" />
        <div className="flex justify-end gap-3 px-6 py-4 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {t("detailsModal.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
