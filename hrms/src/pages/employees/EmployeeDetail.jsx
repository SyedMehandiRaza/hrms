import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  MdOutlineChevronRight,
  MdOutlineDescription,
  MdOutlineLogout,
  MdOutlineEventBusy,
} from "react-icons/md";
import Ltr from "../../components/Ltr";
import PayrollTab from "../../components/PayrollTab";
import DocumentsTab from "../../components/DocumentsTab";
import OverviewTab from "../../components/OverviewTab";
import ProjectsTab from "../../components/ProjectsTab";
import DependentTab from "../../components/DependentTab";
import AttendanceTab from "../../components/AttendanceTab";
import RaiseExitWizard from "../../components/exits/RaiseExitWizard";
import { ExitStatusBadge, EmploymentStatusBadge } from "../../components/exits/ExitBadges";
import useCanManageExits from "../../hooks/useCanManageExits";
import { useFormat } from "../../hooks/useFormat";
import useYearLock from "../../hooks/useYearLock";
import EditEmployeeModal from "../../components/EditEmployeeModal";
import { getEmployeeRecord, openExitFor, employeePayslips } from "../../data/groupB";
import { getStaticUser } from "../../data/session";
import Can from "../../components/Can";
import { MODULES, ACTIONS } from "../../constants/permissions";
import { toast } from "react-toastify";

const TABS = [
  "Overview",
  "Projects",
  "Attendance",
  "Payroll",
  "Documents",
  "Dependent",
];

const PlaceholderTab = ({ name }) => {
  const { t } = useTranslation("employees");
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
      <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center">
        <MdOutlineDescription className="text-gray-300 text-3xl" />
      </div>
      <p className="text-base font-bold text-gray-700">{name}</p>
      <p className="text-sm text-gray-400">{t("detail.comingSoon")}</p>
    </div>
  );
};

export default function EmployeeDetail() {
  const { t } = useTranslation("employees");
  const { t: tx } = useTranslation("exits");
  const { fmtDate } = useFormat();
  const { id } = useParams();
  const navigate = useNavigate();

  const TAB_LABELS = {
    Overview: t("detail.tabs.overview"),
    Projects: t("detail.tabs.projects"),
    Attendance: t("detail.tabs.attendance"),
    Payroll: t("detail.tabs.payroll"),
    Documents: t("detail.tabs.documents"),
    Dependent: t("detail.tabs.dependent"),
  };

  const detailLoading = false;
  // Re-read the static record after an edit (the modal updates the store).
  const [, setRefresh] = useState(0);
  const employee = getEmployeeRecord(id);

  const [tab, setTab] = useState("Overview");
  const [openExitWizard, setOpenExitWizard] = useState(false);
  const [openEditModal, setOpenEditModal] = useState(false);
  const [downloadingPayslip] = useState(false);

  // Employee Exit: who may raise one, and whether this employee already has an
  // open exit (IN_NOTICE / EXITED) — that drives the banner and hides the button.
  const canManageExits = useCanManageExits();
  const myEmployeeId = getStaticUser()?.employeeId;
  const isSelf = !!myEmployeeId && String(myEmployeeId) === String(id);
  // Any open exit, whatever year the header shows.
  const openExit = canManageExits ? openExitFor(id) : null;
  const exitChecked = true;

  // A closed + locked year in the header → read-only (no new exits).
  const lock = useYearLock();
  const showExitButton =
    !lock.locked &&
    canManageExits &&
    !isSelf &&
    exitChecked &&
    !openExit &&
    !!employee &&
    (employee.employment_status || "ACTIVE") === "ACTIVE";

  const handleExitRaised = (exit) => {
    setOpenExitWizard(false);
    if (exit?.id) navigate(`/admin/exits/${exit.id}`);
  };

  // Download this employee's latest CREDITED payslip: the current month if it
  // has been credited, otherwise the most recent (previous) credited month.
  // The backend only returns credited payslips, so "latest credited" is exactly
  // that fallback.
  const handleGeneratePayslip = () => {
    if (!id) return;
    const list = employeePayslips(id);
    if (!list.length) {
      toast.info(t("detail.toast.noPayslip"));
      return;
    }
    // Static build: no PDF is generated — the download is only acknowledged.
    toast.info(t("detail.toast.payslipPreview", { defaultValue: "Payslip PDFs are not available in this preview." }));
  };

  const renderTab = () => {
    if (tab === "Overview") return <OverviewTab />;
    if (tab === "Projects") return <ProjectsTab />;
    if (tab === "Attendance") return <AttendanceTab employeeId={id} />;
    if (tab === "Payroll") return <PayrollTab employeeId={id} />;
    if (tab === "Documents") return <DocumentsTab />;
    if (tab === "Dependent") return <DependentTab onSwitchTab={setTab} />;
    return <PlaceholderTab name={TAB_LABELS[tab] || tab} />;
  };

  const empCode = id ? `EMP-${id}` : "—";
  const displayName =
    employee?.full_name || (detailLoading ? t("detail.loading") : "—");
  const roleName = employee?.roles?.[0]?.name || "—";
  const iqamaNumber = employee?.iqama_number || "—";
  const activeProjects = employee?.projects || [];
  const projectName =
    activeProjects.length === 0
      ? "—"
      : activeProjects.length === 1
        ? activeProjects[0].project_name
        : t("detail.moreProjects", {
            name: activeProjects[0].project_name,
            count: activeProjects.length - 1,
          });
  const status = employee?.user_status || "—";
  const statusText =
    status === "ACTIVE"
      ? t("status.active")
      : status === "INACTIVE"
        ? t("status.inactive")
        : status;
  const avatarUrl =
    employee?.profile_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      employee?.full_name || "Employee"
    )}&background=1e3a5f&color=fff&size=80`;

  const statusPill =
    status === "ACTIVE"
      ? "text-green-700 bg-green-50 border-green-200 [&_.dot]:bg-green-500"
      : "text-gray-600 bg-gray-50 border-gray-200 [&_.dot]:bg-gray-400";

  return (
    <>
      <div className="space-y-5">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-sm flex-wrap">
          <Link
            to="/admin/employees"
            className="text-gray-400 hover:text-cyan-600 transition-colors"
          >
            {t("detail.breadcrumb")}
          </Link>
          <MdOutlineChevronRight className="text-gray-300 rtl:rotate-180" />
          <span className="text-cyan-600 font-semibold">
            <Ltr>{empCode}</Ltr>
          </span>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-16 h-16 rounded-xl object-cover shrink-0 border-2 border-gray-200"
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="text-xl lg:text-2xl font-bold text-gray-900">
                  {displayName}
                </h1>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusPill}`}
                >
                  <span className="dot w-1.5 h-1.5 rounded-full" /> {statusText}
                </span>
                <EmploymentStatusBadge status={employee?.employment_status} />
              </div>
              <p className="text-sm text-gray-500">
                {roleName} • {projectName}
              </p>
              <p className="text-sm text-gray-500 mt-0.5">
                {t("detail.iqamaNumber")}:{" "}
                <span className="font-mono font-semibold text-gray-700">
                  <Ltr>{iqamaNumber}</Ltr>
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <Can module={MODULES.PAYROLL} action={ACTIONS.READ}>
              <button
                onClick={handleGeneratePayslip}
                disabled={downloadingPayslip || !employee}
                className="flex items-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {downloadingPayslip && (
                  <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                )}
                {t("detail.generatePayslip")}
              </button>
            </Can>
            <Can module={MODULES.EMPLOYEE} action={ACTIONS.UPDATE}>
              <button
                onClick={() => setOpenEditModal(true)}
                // An exited employee is frozen until the exit completes
                // (changes go through Rehire) — the API refuses edits too.
                disabled={!employee || employee.employment_status === "EXITED"}
                title={employee?.employment_status === "EXITED" ? t("detail.exitedNoEdit") : undefined}
                className="bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
              >
                {t("detail.editInfo")}
              </button>
            </Can>
            {showExitButton && (
              <button
                type="button"
                onClick={() => setOpenExitWizard(true)}
                className="flex items-center gap-2 border border-red-200 bg-white hover:bg-red-50 text-red-600 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
              >
                <MdOutlineLogout className="text-base rtl:-scale-x-100" />
                {tx("employeeDetail.raiseButton")}
              </button>
            )}
          </div>
        </div>

        {/* Open exit banner */}
        {openExit && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 bg-amber-50/70 border border-amber-200 rounded-xl px-4 py-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <span className="w-9 h-9 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                <MdOutlineEventBusy className="text-lg" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-gray-900">
                    {tx(`type.${openExit.exit_type}`)}
                  </p>
                  <ExitStatusBadge status={openExit.status} />
                </div>
                <p className="text-xs text-gray-600 mt-0.5">
                  {tx("employeeDetail.lastWorkingDay", {
                    date: fmtDate(openExit.notice?.last_working_day),
                  })}
                  {openExit.status === "IN_NOTICE" &&
                    Number.isFinite(Number(openExit.notice?.days_left)) && (
                      <>
                        {" · "}
                        {tx("employeeDetail.daysLeft", {
                          count: Math.max(Number(openExit.notice.days_left), 0),
                        })}
                      </>
                    )}
                  {openExit.checklist_progress?.total > 0 && (
                    <>
                      {" · "}
                      {tx("employeeDetail.checklistProgress", {
                        closed: openExit.checklist_progress.closed,
                        total: openExit.checklist_progress.total,
                      })}
                    </>
                  )}
                </p>
              </div>
            </div>
            <Link
              to={`/admin/exits/${openExit.id}`}
              className="inline-flex items-center justify-center gap-1 text-sm font-semibold text-cyan-700 hover:text-cyan-800 border border-cyan-200 bg-white hover:bg-cyan-50 rounded-lg px-4 py-2 shrink-0"
            >
              {tx("employeeDetail.viewExit")}
              <MdOutlineChevronRight className="rtl:rotate-180" />
            </Link>
          </div>
        )}

        {/* Tab Bar */}
        <div className="border-b border-gray-200">
          <div className="flex overflow-x-auto scrollbar-hide -mb-px gap-0">
            {TABS.map((tabKey) => (
              <button
                key={tabKey}
                onClick={() => setTab(tabKey)}
                className={`whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors shrink-0 ${
                  tab === tabKey
                    ? "border-cyan-600 text-cyan-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {TAB_LABELS[tabKey] || tabKey}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {renderTab()}
      </div>

      {openExitWizard && (
        <RaiseExitWizard
          isOpen={openExitWizard}
          onClose={() => setOpenExitWizard(false)}
          employeeId={id}
          employeeName={employee?.full_name || ""}
          onRaised={handleExitRaised}
        />
      )}

      {openEditModal && employee && (
        <EditEmployeeModal
          employee={employee}
          onClose={() => setOpenEditModal(false)}
          onSaved={() => setRefresh((n) => n + 1)}
        />
      )}
    </>
  );
}
