import React, { useEffect, useState } from "react";
import { MdClose, MdLocationOn, MdSmartphone } from "react-icons/md";
import { useTranslation } from "react-i18next";

export default function EmployeeAttendanceDetailsModal({ isOpen, onClose, employee }) {
  const { t } = useTranslation("attendance");
  const [show, setShow] = useState(false);

  useEffect(() => {
    let timeoutId;
    if (isOpen) {
      // Small delay to allow the element to be mounted before triggering the transition
      timeoutId = setTimeout(() => setShow(true), 10);
    } else {
      setShow(false);
    }
    return () => clearTimeout(timeoutId);
  }, [isOpen]);

  // Don't render anything if it's not open and the exit animation has finished
  if (!isOpen && !show) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/30 z-[100] transition-opacity duration-300 ${show ? 'opacity-100' : 'opacity-0'}`} 
        onClick={onClose} 
      />
      
      {/* Right Slide Panel */}
      <div 
        className={`fixed inset-y-0 right-0 z-[110] w-full max-w-sm bg-[#f8f9fc] shadow-xl transform transition-transform duration-300 ease-in-out flex flex-col ${show ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-5 border-b border-gray-200 bg-[#f4f5fa]">
          <h2 className="text-lg font-bold text-gray-800">{t("employeeDetailsModal.title")}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded text-gray-600 transition-colors">
            <MdClose size={22} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 custom-scrollbar">
          {/* Profile */}
          <div className="flex items-center gap-4">
            <img 
              src={employee?.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=Marcus&backgroundColor=e2e8f0"} 
              alt={t("employeeDetailsModal.avatarAlt")} 
              className="w-16 h-16 rounded-xl border border-gray-200 bg-white object-cover" 
            />
            <div>
              <h3 className="text-xl font-semibold text-gray-800">{employee?.name || t("employeeDetailsModal.nameFallback")}</h3>
              <p className="text-sm text-gray-500">{employee?.title || t("employeeDetailsModal.titleFallback")}</p>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#f2f4fb] p-4 rounded-xl border border-[#e8ebf4]">
              <p className="text-[10px] font-bold text-gray-500 tracking-wider mb-1">{t("employeeDetailsModal.totalSessions")}</p>
              <p className="text-xl font-bold text-gray-800">2</p>
            </div>
            <div className="bg-[#f2f4fb] p-4 rounded-xl border border-[#e8ebf4]">
              <p className="text-[10px] font-bold text-gray-500 tracking-wider mb-1">{t("employeeDetailsModal.workHours")}</p>
              <p className="text-xl font-bold text-gray-800">8h 15m</p>
            </div>
            <div className="bg-[#f2f4fb] p-4 rounded-xl border border-[#e8ebf4]">
              <p className="text-[10px] font-bold text-gray-500 tracking-wider mb-1">{t("employeeDetailsModal.breakTime")}</p>
              <p className="text-xl font-bold text-gray-800">45m</p>
            </div>
            <div className="bg-[#f2f4fb] p-4 rounded-xl border border-[#e8ebf4]">
              <p className="text-[10px] font-bold text-gray-500 tracking-wider mb-1">{t("employeeDetailsModal.overtime")}</p>
              <p className="text-xl font-bold text-[#14b8a6]">1h 15m</p>
            </div>
          </div>

          {/* Timeline */}
          <div className="flex flex-col">
            <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-4 shrink-0">{t("employeeDetailsModal.sessionTimeline")}</h4>
            <div className="relative pl-3 space-y-3 overflow-y-auto max-h-[280px] custom-scrollbar pr-2">
              <div className="absolute top-4 bottom-4 left-[17px] w-0.5 bg-gray-200"></div>

              <div className="relative flex items-center gap-4">
                <div className="w-2.5 h-2.5 rounded-full bg-[#14b8a6] z-10 ml-0.5 outline outline-[6px] outline-[#f8f9fc]"></div>
                <div className="flex-1 bg-white border border-gray-200 rounded-lg p-3.5 flex justify-between items-center shadow-sm">
                  <span className="font-bold text-[13px] text-gray-800">{t("employeeDetailsModal.checkInLower")}</span>
                  <span className="text-[11px] font-bold text-gray-600">08:54 AM</span>
                </div>
              </div>

              <div className="relative flex items-center gap-4">
                <div className="w-2.5 h-2.5 rounded-full bg-gray-500 z-10 ml-0.5 outline outline-[6px] outline-[#f8f9fc]"></div>
                <div className="flex-1 bg-[#fbfbfc] border border-gray-200 rounded-lg p-3.5 flex justify-between items-center">
                  <span className="font-bold text-[13px] text-gray-800">{t("employeeDetailsModal.checkOut")}</span>
                  <span className="text-[11px] font-bold text-gray-600">01:10 PM</span>
                </div>
              </div>

              <div className="relative flex items-center gap-4">
                <div className="w-2.5 h-2.5 rounded-full bg-gray-500 z-10 ml-0.5 outline outline-[6px] outline-[#f8f9fc]"></div>
                <div className="flex-1 bg-[#fbfbfc] border border-gray-200 rounded-lg p-3.5 flex justify-between items-center">
                  <span className="font-bold text-[13px] text-gray-800">{t("employeeDetailsModal.checkIn")}</span>
                  <span className="text-[11px] font-bold text-gray-600">01:58 PM</span>
                </div>
              </div>

              <div className="relative flex items-center gap-4">
                <div className="w-2.5 h-2.5 rounded-full bg-gray-500 z-10 ml-0.5 outline outline-[6px] outline-[#f8f9fc]"></div>
                <div className="flex-1 border border-dashed border-gray-300 rounded-lg p-3.5 flex justify-between items-center bg-gray-50/50">
                  <span className="font-bold text-[13px] text-gray-800">{t("employeeDetailsModal.checkOut")}</span>
                  <span className="text-[11px] font-bold text-gray-600">06:00 PM</span>
                </div>
              </div>
               <div className="relative flex items-center gap-4">
                <div className="w-2.5 h-2.5 rounded-full bg-[#14b8a6] z-10 ml-0.5 outline outline-[6px] outline-[#f8f9fc]"></div>
                <div className="flex-1 bg-white border border-gray-200 rounded-lg p-3.5 flex justify-between items-center shadow-sm">
                  <span className="font-bold text-[13px] text-gray-800">{t("employeeDetailsModal.checkInLower")}</span>
                  <span className="text-[11px] font-bold text-gray-600">08:54 AM</span>
                </div>
              </div>

              <div className="relative flex items-center gap-4">
                <div className="w-2.5 h-2.5 rounded-full bg-gray-500 z-10 ml-0.5 outline outline-[6px] outline-[#f8f9fc]"></div>
                <div className="flex-1 bg-[#fbfbfc] border border-gray-200 rounded-lg p-3.5 flex justify-between items-center">
                  <span className="font-bold text-[13px] text-gray-800">{t("employeeDetailsModal.checkOut")}</span>
                  <span className="text-[11px] font-bold text-gray-600">01:10 PM</span>
                </div>
              </div>

              <div className="relative flex items-center gap-4">
                <div className="w-2.5 h-2.5 rounded-full bg-gray-500 z-10 ml-0.5 outline outline-[6px] outline-[#f8f9fc]"></div>
                <div className="flex-1 bg-[#fbfbfc] border border-gray-200 rounded-lg p-3.5 flex justify-between items-center">
                  <span className="font-bold text-[13px] text-gray-800">{t("employeeDetailsModal.checkIn")}</span>
                  <span className="text-[11px] font-bold text-gray-600">01:58 PM</span>
                </div>
              </div>

              <div className="relative flex items-center gap-4">
                <div className="w-2.5 h-2.5 rounded-full bg-gray-500 z-10 ml-0.5 outline outline-[6px] outline-[#f8f9fc]"></div>
                <div className="flex-1 border border-dashed border-gray-300 rounded-lg p-3.5 flex justify-between items-center bg-gray-50/50">
                  <span className="font-bold text-[13px] text-gray-800">{t("employeeDetailsModal.checkOut")}</span>
                  <span className="text-[11px] font-bold text-gray-600">06:00 PM</span>
                </div>
              </div>
            </div>
          </div>

          <hr className="border-gray-200" />

          {/* Meta */}
          <div className="space-y-5">
            <div className="flex items-start gap-3">
              <MdLocationOn className="text-[#14b8a6] text-xl mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-gray-500 tracking-wider">{t("employeeDetailsModal.gpsVerification")}</p>
                <p className="text-[13px] font-medium text-gray-800 mt-0.5">{t("employeeDetailsModal.gpsVerified")}</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <MdSmartphone className="text-gray-500 text-xl mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-gray-500 tracking-wider">{t("employeeDetailsModal.deviceIdentity")}</p>
                <p className="text-[13px] font-medium text-gray-800 mt-0.5">{t("employeeDetailsModal.deviceValue")}</p>
              </div>
            </div>
          </div>

          {/* Note */}
          <div className="bg-[#eef0f5] p-4 rounded-xl italic text-[13px] text-gray-600 border border-[#e2e5f0]">
            {t("employeeDetailsModal.note")}
          </div>
        </div>

      </div>
    </>
  );
}
