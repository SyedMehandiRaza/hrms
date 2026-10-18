import React, { useState } from 'react';
import { MdClose } from 'react-icons/md';
import { useTranslation } from 'react-i18next';

export default function RejectReasonModal({ isOpen, onClose, onReject, title, subtitle }) {
  const { t } = useTranslation("approvals");
  const [reason, setReason] = useState("");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-gray-200 flex justify-between items-start">
          <div>
            <h2 className="text-[17px] font-bold text-gray-900">{title === undefined ? t("rejectModal.title") : title}</h2>
            <p className="text-[13px] text-gray-500 mt-1 font-medium">
              {subtitle === undefined ? t("rejectModal.subtitle") : subtitle}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
          >
            <MdClose size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          <label className="block text-[13px] font-bold text-gray-600 mb-2">
            {t("rejectModal.reasonLabel")} <span className="text-red-500">*</span>
          </label>
          <textarea
            rows="4"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full border border-gray-200 rounded-lg p-3 text-[13px] text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-red-300 focus:border-red-300 resize-none"
            placeholder={t("rejectModal.reasonPlaceholder")}
          ></textarea>
        </div>

        {/* Footer */}
        <div className="bg-[#fef7f7] p-4 border-t border-red-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 border border-gray-300 bg-white text-gray-700 font-bold text-[13px] rounded-lg hover:bg-gray-50 transition-colors"
          >
            {t("rejectModal.cancel")}
          </button>
          <button
            disabled={!reason.trim()}
            className="px-5 py-2.5 bg-[#b91c1c] hover:bg-[#991b1b] text-white font-bold text-[13px] rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => {
              if (onReject) onReject(reason);
              setReason("");
              onClose();
            }}
          >
            <MdClose size={16} /> {t("rejectModal.submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
