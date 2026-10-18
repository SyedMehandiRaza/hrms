import React from "react";
import { Link } from "react-router-dom";
import { MdOutlineWorkOff, MdClose } from "react-icons/md";
import { useTranslation } from "react-i18next";
import CarriedLeaveNote from "./leave/CarriedLeaveNote";

const LeaveBalanceModal = ({ isOpen, onClose, loading, myLeavesBalances, applyLeavePath }) => {
  const { t } = useTranslation("leaves");
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <MdOutlineWorkOff className="text-orange-500 text-xl" />
            {t("apply.leaveBalances")}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors bg-white rounded-full p-1 border border-gray-200 hover:bg-gray-100 shadow-sm"
          >
            <MdClose className="text-xl" />
          </button>
        </div>
        
        {/* Modal Body */}
        <div className="p-6 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                {(myLeavesBalances?.data?.leave_balances || []).map((leave, idx) => {
                  const colors = ["blue", "orange", "green", "purple"];
                  const color = colors[idx % colors.length];
                  return (
                    <div key={leave.id || leave.name} className="border border-gray-100 rounded-xl p-4 shadow-sm bg-white">
                      <h4 className="font-semibold text-gray-800 mb-1">{leave.name}</h4>
                      <CarriedLeaveNote
                        balance={{ ...leave, balance_year: myLeavesBalances?.data?.balance_year }}
                        className="mb-2"
                      />
                      <div className="mb-2" />
                      
                      <div className="flex justify-between items-center mb-1 text-sm">
                        <span className="text-gray-500">{t("balanceModal.totalAssigned")}</span>
                        <span className="font-medium">{leave.allocated}</span>
                      </div>
                      <div className="flex justify-between items-center mb-1 text-sm">
                        <span className="text-gray-500">{t("balanceModal.used")}</span>
                        <span className="font-medium text-red-500">{leave.used}</span>
                      </div>
                      
                      <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
                        <span className="text-sm font-semibold text-gray-700">{t("balanceModal.remaining")}</span>
                        <span className={`text-lg font-bold text-${color}-600 bg-${color}-50 px-2 py-0.5 rounded-md`}>
                          {leave.balance}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {(!myLeavesBalances?.data?.leave_balances || myLeavesBalances.data.leave_balances.length === 0) && (
                  <div className="col-span-full text-center py-6 text-gray-500 bg-gray-50 rounded-xl border border-gray-100">
                    {t("balanceModal.noLeaves")}
                  </div>
                )}
              </div>
              
              <div className="bg-orange-50 text-orange-800 p-4 rounded-xl text-sm border border-orange-100">
                <p className="font-semibold mb-1">{t("balanceModal.note")}</p>
                <p>{t("balanceModal.noteBody")}</p>
              </div>
            </>
          )}
        </div>
        
        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end">
           <Link 
             to={applyLeavePath}
             onClick={onClose}
             className="px-5 py-2.5 bg-cyan-600 text-white text-sm font-medium rounded-lg hover:bg-cyan-700 transition-colors shadow-sm"
           >
             {t("common.applyLeave")}
           </Link>
        </div>
      </div>
    </div>
  );
};

export default LeaveBalanceModal;
