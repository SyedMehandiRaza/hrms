import React, { useEffect } from "react";
import { FiX, FiCheckCircle } from "react-icons/fi";
import { useTranslation } from "react-i18next";

/**
 * A globally reusable Success Modal component.
 * 
 * @param {boolean} isOpen - Controls modal visibility
 * @param {function} onClose - Function to call when modal closes
 * @param {string} title - The title of the modal (e.g., "Success!")
 * @param {string} message - The main success message (e.g., "Item was created successfully.")
 * @param {string} buttonText - Text for the primary action button (default: "Close")
 */
export default function SuccessModal({
  isOpen,
  onClose,
  title,
  message,
  buttonText,
}) {
  const { t } = useTranslation("common");
  title = title ?? t("success.title");
  message = message ?? t("success.message");
  buttonText = buttonText ?? t("success.continue");
  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 font-sans">
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      ></div>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col transform transition-all animate-in zoom-in-95 duration-200">
        
        {/* Close Button Top Right */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors p-1"
        >
          <FiX className="text-xl" />
        </button>

        {/* Modal Body */}
        <div className="p-8 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
            <FiCheckCircle className="text-4xl text-green-500" />
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
          <p className="text-gray-500 text-sm leading-relaxed mb-8">
            {message}
          </p>

          <button
            onClick={onClose}
            className="w-full py-3 px-4 bg-[#14a0b3] text-white rounded-xl hover:bg-[#118898] transition-colors font-semibold text-sm shadow-sm"
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
}
