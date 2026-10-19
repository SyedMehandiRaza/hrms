import React from "react";
import { MdClose, MdWarning, MdError, MdCheckCircle } from "react-icons/md";
import { useTranslation } from "react-i18next";

/**
 * Reusable Confirmation Modal Component
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether modal is visible
 * @param {function} props.onClose - Callback when modal closes
 * @param {function} props.onConfirm - Callback when user confirms action
 * @param {string} props.title - Modal title
 * @param {string} props.message - Modal message/description
 * @param {string} props.type - Modal type: 'delete' | 'status' | 'warning' | 'success' (affects icon and colors)
 * @param {string} props.confirmText - Text for confirm button (default: "Confirm")
 * @param {string} props.cancelText - Text for cancel button (default: "Cancel")
 * @param {boolean} props.isLoading - Show loading state on confirm button
 */
export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type = "warning", // 'delete' | 'status' | 'warning' | 'success'
  confirmText,
  cancelText,
  isLoading = false,
}) {
  const { t } = useTranslation("shared");

  const resolvedTitle = title ?? t("confirmModal.title");
  const resolvedMessage = message ?? t("confirmModal.message");
  const resolvedConfirmText = confirmText ?? t("confirmModal.confirm");
  const resolvedCancelText = cancelText ?? t("confirmModal.cancel");

  if (!isOpen) return null;

  // Determine icon and colors based on type
  const getIconConfig = () => {
    switch (type) {
      case "delete":
        return {
          icon: MdError,
          iconBg: "bg-red-50",
          iconColor: "text-red-500",
          buttonColor: "bg-red-600 hover:bg-red-700",
        };
      case "status":
        return {
          icon: MdWarning,
          iconBg: "bg-amber-50",
          iconColor: "text-amber-500",
          buttonColor: "bg-amber-600 hover:bg-amber-700",
        };
      case "success":
        return {
          icon: MdCheckCircle,
          iconBg: "bg-green-50",
          iconColor: "text-green-500",
          buttonColor: "bg-green-600 hover:bg-green-700",
        };
      default: // 'warning'
        return {
          icon: MdWarning,
          iconBg: "bg-blue-50",
          iconColor: "text-blue-500",
          buttonColor: "bg-blue-600 hover:bg-blue-700",
        };
    }
  };

  const config = getIconConfig();
  const IconComponent = config.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop with blur */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 end-4 p-2 rounded-lg hover:bg-gray-100 transition-colors z-10"
        >
          <MdClose className="text-xl text-gray-400 hover:text-gray-600" />
        </button>

        {/* Icon Section */}
        <div className="flex justify-center pt-8">
          <div
            className={`w-16 h-16 ${config.iconBg} rounded-full flex items-center justify-center`}
          >
            <IconComponent className={`${config.iconColor} text-4xl`} />
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6 text-center space-y-3">
          <h2 className="text-xl font-bold text-gray-900">{resolvedTitle}</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            {resolvedMessage}
          </p>
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-center gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="w-full sm:flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {resolvedCancelText}
          </button>

          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`w-full sm:flex-1 px-4 py-2.5 rounded-lg ${config.buttonColor} text-white font-semibold text-sm  cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
          >
            {isLoading && (
              <svg
                className="w-4 h-4 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            )}
            {resolvedConfirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
