import React from "react";
import { MdClose } from "react-icons/md";
import { useTranslation } from "react-i18next";

const fmtDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export default function ViewLeaveRequestModal({ data, onClose }) {
  const { t } = useTranslation("leaves");

  if (!data) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-gray-900/40 backdrop-blur-sm transition-opacity">
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-full animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-xl font-semibold text-gray-800">
            {t("viewModal.title", { defaultValue: "Leave Request Details" })}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <MdClose className="text-xl" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
                {t("viewModal.leaveType", { defaultValue: "Leave Type" })}
              </span>
              <span className="text-sm font-semibold text-gray-800">
                {data.leave_type?.name || data.LeaveType?.name || data.leave_type || "—"}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
                {t("viewModal.status", { defaultValue: "Status" })}
              </span>
              <span className="text-sm font-semibold text-gray-800">
                {data.status || "—"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
                {t("viewModal.fromDate", { defaultValue: "From Date" })}
              </span>
              <span className="text-sm font-medium text-gray-700">
                {fmtDate(data.start_date || data.from_date)}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
                {t("viewModal.toDate", { defaultValue: "To Date" })}
              </span>
              <span className="text-sm font-medium text-gray-700">
                {fmtDate(data.end_date || data.to_date)}
              </span>
            </div>
          </div>

          <div className="flex flex-col">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
              {t("viewModal.totalDays", { defaultValue: "Total Days" })}
            </span>
            <span className="text-sm font-medium text-gray-700">
              {data.total_days || data.leave_days || "—"}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
              {t("viewModal.reason", { defaultValue: "Reason" })}
            </span>
            <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700 border border-gray-100 whitespace-pre-wrap">
              {data.reason || "—"}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-gray-200"
          >
            {t("common.close", { defaultValue: "Close" })}
          </button>
        </div>
      </div>
    </div>
  );
}
