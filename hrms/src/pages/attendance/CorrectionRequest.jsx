import { useState } from "react";
import { MdAdd } from "react-icons/md";
import { useTranslation } from "react-i18next";
import CorrectionRequestModal from "../../components/CorrectionRequestModal";
import ApprovalRequestsPanel from "../../components/attendance/ApprovalRequestsPanel";
import useYearLock from "../../hooks/useYearLock";

export default function CorrectionRequest() {
  const { t } = useTranslation("attendance");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const lock = useYearLock();

  // The page only shows the approver inbox; a new request needs no refresh.
  const refresh = () => {};

  return (
    <div className="space-y-6 w-full p-4 sm:p-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("correctionPage.title")}
          </h1>
          <p className="text-gray-500 mt-1 text-sm font-medium">
            {t("correctionPage.subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
          {!lock.locked && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-[#17a2b8] hover:bg-[#138496] text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-colors"
          >
            <MdAdd className="text-lg" /> {t("correctionPage.newRequest")}
          </button>
          )}
        </div>
      </div>

      {/* ── Approver Panel (level-wise) ── */}
      <ApprovalRequestsPanel module="correction" />


      {/* ── Modal ── */}
      <CorrectionRequestModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={refresh}
      />
    </div>
  );
}
