import { useEffect, useState } from "react";
import { MdClose, MdCheckCircleOutline, MdOutlineCancel } from "react-icons/md";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import LevelProgress from "./LevelProgress";
import RejectOvertimeModal from "./RejectOvertimeModal";
import { OT_approve, OT_reject } from "../data/groupD";
import useYearLock from "../hooks/useYearLock";

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "—");

export default function OvertimeDetailModal({ isOpen, onClose, employee, onActed }) {
  const { t } = useTranslation("attendance");
  const [show, setShow] = useState(false);
  const busy = false;
  const [rejectOpen, setRejectOpen] = useState(false);

  // Read-only when the request's own date is in a closed + locked year.
  const lock = useYearLock(employee?.work_date);
  const canAct = !!employee?.can_act;
  const decided =
    employee?.final_status === "APPROVED" || employee?.final_status === "REJECTED";

  const doApprove = () => {
    toast.success(t("overtimeDetail.toast.approved"));
    onActed?.(OT_approve(employee));
    onClose();
  };

  const doReject = (reason) => {
    toast.success(t("overtimeDetail.toast.rejected"));
    onActed?.(OT_reject(employee, reason));
    onClose();
  };

  useEffect(() => {
    let timeoutId;
    if (isOpen) {
      // Small delay to allow the element to be mounted before triggering the transition
      timeoutId = setTimeout(() => setShow(true), 10);
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
        className={`fixed inset-y-0 right-0 z-[110] w-full max-w-md bg-white shadow-xl transform transition-transform duration-300 ease-in-out flex flex-col ${show ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-5 border-b border-gray-200 bg-[#f8f9fc]">
          <h2 className="text-xl font-bold text-gray-800">{t("overtimeDetail.title")}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-200 rounded-full text-gray-900 transition-colors">
            <MdClose size={22} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-white">
          
          {/* Top Badges */}
          <div className="flex gap-2">
            <span className="bg-[#eef2f9] text-[#5e77b4] text-[11px] font-bold px-2.5 py-1 rounded">{t("overtimeDetail.idBadge")}</span>
            <span className="bg-[#eef2f9] text-[#5e77b4] text-[11px] font-bold px-2.5 py-1 rounded">{t("detail.type.fullTime")}</span>
          </div>

          {/* Profile */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img 
                src="https://api.dicebear.com/7.x/avataaars/svg?seed=Marcus&backgroundColor=e2e8f0" 
                alt={t("employeeDetailsModal.avatarAlt")} 
                className="w-16 h-16 rounded-xl border-2 border-[#17a2b8] object-cover shadow-sm bg-gray-100" 
              />
              <div>
                <h3 className="text-xl font-bold text-gray-800">{employee?.employee_name || "—"}</h3>
                <p className="text-sm text-gray-500 font-medium">{employee?.employee_code || "—"}</p>
              </div>
            </div>
            <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-[11px] font-bold ${
              employee?.final_status === "APPROVED" ? "bg-green-100 text-green-700"
              : employee?.final_status === "REJECTED" ? "bg-red-100 text-red-700"
              : "bg-[#fef3c7] text-[#92400e]"}`}>
              {t(`requestStatus.${employee?.final_status || employee?.status || "PENDING"}`, { defaultValue: employee?.final_status || employee?.status || "PENDING" })}
            </span>
          </div>

          {/* Approval Level */}
          <div className="bg-[#f8f9fc] rounded-xl p-4 border border-gray-100">
             <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{t("overtimeDetail.approvalLevel")}</p>
             <div className="flex items-center gap-3">
               <span className="text-[15px] font-bold text-gray-800">
                 {employee?.current_level ? t("common.levelOf", { current: employee.current_level, total: employee.total_levels }) : "—"}
               </span>
               <LevelProgress levels={employee?.levels_summary} currentLevel={employee?.current_level} />
             </div>
          </div>

          {/* Grid Info */}
          <div className="grid grid-cols-2 gap-4">
             <div className="bg-[#f8f9fc] rounded-xl p-4 border border-gray-100">
               <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{t("common.overtimeDate")}</p>
               <p className="text-[15px] font-bold text-gray-800">{fmtDate(employee?.work_date)}</p>
             </div>
             <div className="bg-[#f8f9fc] rounded-xl p-4 border border-gray-100">
               <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{t("common.startTime")}</p>
               <p className="text-[15px] font-bold text-gray-800">{employee?.start_time || "—"}</p>
             </div>
             <div className="bg-[#f8f9fc] rounded-xl p-4 border border-gray-100">
               <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{t("common.endTime")}</p>
               <p className="text-[15px] font-bold text-gray-800">{employee?.end_time || "—"}</p>
             </div>
             <div className="bg-[#f8f9fc] rounded-xl p-4 border border-gray-100">
               <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{t("common.overtime")}</p>
               <p className="text-[15px] font-bold text-[#17a2b8]">{employee?.overtime_hours != null ? t("common.hoursValue", { value: employee.overtime_hours }) : "—"}</p>
             </div>
          </div>

          {/* Reason */}
          <div className="bg-[#f8f9fc] rounded-xl p-4 border border-gray-100">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">{t("common.reason")}</p>
            <p className="text-[13.5px] italic text-gray-700 font-medium leading-relaxed">
              {employee?.reason ? `"${employee.reason}"` : "—"}
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-5 border-t border-gray-200 bg-[#f8f9fc] flex gap-4">
          <button
            onClick={() => setRejectOpen(true)}
            disabled={busy || decided || !canAct}
            title={!canAct ? t("overtimeDetail.notCurrentApprover") : ""}
            className="flex-1 flex justify-center items-center gap-2 border border-red-200 bg-[#fcf5f5] hover:bg-red-50 text-red-700 font-bold py-3 rounded-lg transition-colors text-[13.5px] shadow-sm disabled:opacity-50"
          >
            <MdOutlineCancel className="text-xl" /> {t("common.rejectRequest")}
          </button>
          <button
            onClick={doApprove}
            disabled={busy || decided || !canAct || lock.locked}
            title={lock.locked ? lock.title : !canAct ? t("overtimeDetail.notCurrentApprover") : ""}
            className="flex-1 flex justify-center items-center gap-2 bg-[#17a2b8] hover:bg-[#138496] text-white font-bold py-3 rounded-lg transition-colors text-[13.5px] shadow-sm disabled:opacity-50"
          >
            <MdCheckCircleOutline className="text-xl" /> {t("common.approveRequest")}
          </button>
        </div>
      </div>

      <RejectOvertimeModal
        isOpen={rejectOpen}
        onClose={() => setRejectOpen(false)}
        onReject={doReject}
      />
    </>
  );
}
