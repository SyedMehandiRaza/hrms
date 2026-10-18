import React, { useState } from "react";
import {
  FiSearch,
  FiCalendar,
  FiClock,
  FiCheckCircle,
  FiPlus,
  FiX,
} from "react-icons/fi";
import {
  MdOutlinePeople,
  MdOutlineAccountBalanceWallet,
  MdOutlineRemoveCircleOutline,
  MdOutlineMonetizationOn,
  MdFileDownload,
  MdOutlineChevronRight,
  MdOutlineRemoveRedEye,
  MdOutlineVisibilityOff,
  MdOutlineClear,
  MdOutlineReceiptLong,
} from "react-icons/md";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useTranslation, Trans } from "react-i18next";
import CustomDropdown from "../../components/CustomDropdown";
import ConfirmationModal from "../../components/ConfirmationModal";
import Can from "../../components/Can";
import { MODULES, ACTIONS } from "../../constants/permissions";
import { useCan } from "../../hooks/usePermission";
import useYearLock from "../../hooks/useYearLock";
import { lineChecks } from "../../utils/fyValidation/payroll";
import { STATIC_PERMISSION } from "../../data/session";
import {
  addPayslipLine,
  getPayrollRunDetail,
  removePayslipLine,
  setPayrollRunStatus,
} from "../../data/groupE";


// Run-level status pill (DRAFT → PENDING_APPROVAL → APPROVED → CREDITED / REJECTED).
const RUN_STATUS_STYLES = {
  DRAFT: "bg-gray-100 text-gray-600",
  PENDING_APPROVAL: "bg-[#FFF4E5] text-[#B98900]",
  APPROVED: "bg-blue-50 text-blue-700",
  REJECTED: "bg-red-50 text-red-600",
  CREDITED: "bg-green-100 text-green-700",
  PAID: "bg-green-100 text-green-700",
};

const LIMIT = 10;

const cardFmt = (n) =>
  Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });
const rowFmt = (n) =>
  Number(n || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const initialsOf = (name) =>
  (name || "?")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

const PayrollPreviewMonthly = () => {
  const { t } = useTranslation("payroll");
  const runStatusLabel = (s) => (s ? t(`status.${s}`, { defaultValue: s.replace(/_/g, " ") }) : "—");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const runId = searchParams.get("runId");
  const can = useCan();
  const approvalModules = STATIC_PERMISSION.approvalModules || [];
  const isPayrollApprover = approvalModules.includes("PAYROLL");

  const detailLoading = false;
  const actionLoading = false;
  const [tick, setTick] = useState(0);

  const [page, setPage] = useState(1);
  // The run detail (run + this page of payslips) from the static store.
  const current = runId && tick >= 0 ? getPayrollRunDetail(runId, page, LIMIT) : null;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [expandedRow, setExpandedRow] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  // Run action modals + the per-payslip ad-hoc line form.
  const [confirm, setConfirm] = useState(null); // { title, message, confirmText, type, action }
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [lineFor, setLineFor] = useState(null); // payslip_id currently adding a line
  const [lineForm, setLineForm] = useState({ type: "INCENTIVE", label: "", amount: "" });
  const [lineErrors, setLineErrors] = useState({});

  // Read-only when the run's month is in a closed + locked financial year.
  const runOf = current?.run || null;
  const lock = useYearLock(
    runOf ? `${runOf.period_year}-${String(runOf.period_month).padStart(2, "0")}` : undefined,
  );

  // No PDF in the static build — acknowledge the download.
  const downloadSlip = async (payslipId) => {
    setDownloadingId(payslipId);
    toast.info(t("runDetail.downloadSlip"));
    setDownloadingId(null);
  };

  const refresh = () => setTick((n) => n + 1);

  // Apply a run action to the static store, toast the outcome, then refresh the detail.
  const runAction = async (apply, successMsg) => {
    apply();
    toast.success(successMsg);
    refresh();
  };

  const doConfirm = async () => {
    if (confirm?.action) await confirm.action();
    setConfirm(null);
  };

  const submitRun = () =>
    setConfirm({
      title: t("runActions.submitTitle"),
      message: t("runActions.submitMessage"),
      confirmText: t("runActions.submitConfirm"),
      type: "warning",
      action: () => runAction(() => setPayrollRunStatus(runId, "PENDING_APPROVAL"), t("runActions.submitted")),
    });

  const approveRun = () =>
    setConfirm({
      title: t("runActions.approveTitle"),
      message: t("runActions.approveMessage"),
      confirmText: t("runActions.approveConfirm"),
      type: "success",
      action: () =>
        runAction(() => setPayrollRunStatus(runId, "APPROVED"), t("runActions.approved")),
    });

  const creditRun = () =>
    setConfirm({
      title: t("runActions.creditTitle"),
      message: t("runActions.creditMessage"),
      confirmText: t("runActions.creditConfirm"),
      type: "success",
      action: () => runAction(() => setPayrollRunStatus(runId, "CREDITED"), t("runActions.credited")),
    });

  const submitReject = async () => {
    if (!rejectReason.trim()) {
      toast.error(t("runActions.reasonRequired"));
      return;
    }
    await runAction(
      () => setPayrollRunStatus(runId, "REJECTED"),
      t("runActions.rejected"),
    );
    setRejectOpen(false);
    setRejectReason("");
  };

  const addLine = async (payslipId) => {
    const errs = lineChecks(t, lineForm);
    setLineErrors(errs);
    if (Object.keys(errs).length) return;
    const amt = Number(lineForm.amount);
    addPayslipLine(payslipId, { type: lineForm.type, label: lineForm.label.trim(), amount: amt });
    toast.success(t("runDetail.toast.lineAdded"));
    setLineForm({ type: "INCENTIVE", label: "", amount: "" });
    setLineFor(null);
    setLineErrors({});
    refresh();
  };

  const removeLine = async (payslipId, itemId) => {
    removePayslipLine(payslipId, itemId);
    toast.success(t("runDetail.toast.lineRemoved"));
    refresh();
  };

  const run = current?.run || null;
  const payslips = current?.payslips || null;
  const rows = payslips?.data || [];

  const filteredRows = rows.filter((r) => {
    const q = search.trim().toLowerCase();
    const matchSearch =
      !q ||
      (r.employee?.name || "").toLowerCase().includes(q) ||
      (r.employee?.code || "").toLowerCase().includes(q);
    const matchStatus =
      !statusFilter ||
      String(r.status || "").toUpperCase() === statusFilter.toUpperCase();
    return matchSearch && matchStatus;
  });

  const toggleRow = (id) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  const getStatusPill = (status) => {
    switch (status) {
      case "CREDITED":
        return (
          <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase">
            {t("status.CREDITED")}
          </span>
        );
      case "PENDING":
        return (
          <span className="bg-[#FFF4E5] text-[#B98900] px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase">
            {t("status.PENDING")}
          </span>
        );
      case "HOLD":
        return (
          <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase">
            {t("status.HOLD")}
          </span>
        );
      default:
        return null;
    }
  };

  const title = run
    ? t("runDetail.titleWithPeriod", { month: t(`months.${run.period_month}`, { defaultValue: run.month }), year: run.year })
    : t("runDetail.titleFallback");

  const total = payslips?.total ?? rows.length;
  const totalPages = payslips?.total_pages ?? 1;
  const from = total === 0 ? 0 : (page - 1) * LIMIT + 1;
  const to = Math.min(page * LIMIT, total);
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1,
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          {/* ── Breadcrumb ── */}
          <div className="flex items-center gap-1.5 text-sm flex-wrap">
            <Link
              to="/admin/payroll-overview"
              className="text-gray-400 hover:text-cyan-600 transition-colors"
            >
              {t("runDetail.breadcrumb")}
            </Link>
            <MdOutlineChevronRight className="text-gray-300 rtl:rotate-180" />
            <span className="text-cyan-600 font-semibold">{title}</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
            {title}
          </h1>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
          {run?.status && (
            <span
              className={`px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider uppercase ${
                RUN_STATUS_STYLES[run.status] || "bg-gray-100 text-gray-600"
              }`}
            >
              {runStatusLabel(run.status)}
            </span>
          )}

          {run?.status === "DRAFT" && rows.length > 0 && (
            <Can module={MODULES.PAYROLL} action={ACTIONS.CREATE}>
              <button
                onClick={submitRun}
                disabled={actionLoading || lock.locked}
                title={lock.title}
                className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
              >
                {t("runDetail.submitForApproval")}
              </button>
            </Can>
          )}

          {run?.status === "PENDING_APPROVAL" && run?.can_act && (
            <>
              <button
                onClick={() => setRejectOpen(true)}
                disabled={actionLoading || !run?.can_act || lock.locked}
                title={lock.title || (run?.can_act ? "" : t("runActions.notApprover"))}
                className="flex items-center gap-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t("runDetail.reject")}
              </button>
              <button
                onClick={approveRun}
                disabled={actionLoading || !run?.can_act || lock.locked}
                title={lock.title || (run?.can_act ? "" : t("runActions.notApprover"))}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t("runDetail.approve")}
              </button>
            </>
          )}

          {run?.status === "APPROVED" &&
            (can(MODULES.PAYROLL, ACTIONS.UPDATE) || isPayrollApprover) && (
              <button
                onClick={creditRun}
                disabled={actionLoading || lock.locked}
                title={lock.title}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
              >
                {t("runDetail.creditPayroll")}
              </button>
            )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-3">
            <span className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">
              {t("runDetail.cards.totalEmployees")}
            </span>
            <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-500">
              <MdOutlinePeople className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900 mb-1">
              {cardFmt(run?.employee_count)}
            </div>
            <div className="text-xs font-semibold text-emerald-500 flex items-center gap-1">
              {t("runDetail.cards.processed")}
            </div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-3">
            <span className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">
              {t("runDetail.cards.grossPayroll")}
            </span>
            <div className="w-8 h-8 bg-cyan-50 rounded-lg flex items-center justify-center text-cyan-500">
              <MdOutlineAccountBalanceWallet className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900 mb-1">
              SAR {cardFmt(run?.gross_total)}
            </div>
            <div className="text-xs text-gray-500">{t("runDetail.cards.totalEarnings")}</div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-3">
            <span className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">
              {t("runDetail.cards.totalDeductions")}
            </span>
            <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center text-red-500">
              <MdOutlineRemoveCircleOutline className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900 mb-1">
              SAR {cardFmt(run?.deductions_total)}
            </div>
            <div className="text-xs text-gray-500">
              {t("runDetail.cards.deductionsHint")}
            </div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-3">
            <span className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">
              {t("runDetail.cards.netPayroll")}
            </span>
            <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-500">
              <MdOutlineMonetizationOn className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900 mb-1">
              SAR {cardFmt(run?.total_net)}
            </div>
            <div className="text-xs text-gray-500">{t("runDetail.cards.netPayable")}</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[240px]">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
              {t("runDetail.searchLabel")}
            </label>
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("runDetail.searchPlaceholder")}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500 h-[42px]"
              />
            </div>
          </div>
          <div className="w-full sm:w-60">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
              {t("runDetail.status")}
            </label>
            <div className="relative">
              <CustomDropdown
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                options={[
                  { label: t("runDetail.allStatuses"), value: "" },
                  { label: t("status.DRAFT"), value: "DRAFT" },
                  { label: t("status.PENDING"), value: "PENDING" },
                  { label: t("status.APPROVED"), value: "APPROVED" },
                  { label: t("status.CREDITED"), value: "CREDITED" },
                  { label: t("status.PAID"), value: "PAID" },
                  { label: t("status.HOLD"), value: "HOLD" },
                  { label: t("status.REJECTED"), value: "REJECTED" },
                ]}
                className="h-[42px]"
              />
            </div>
          </div>
          <div className="flex-shrink-0 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setStatusFilter("");
              }}
              className="w-full sm:w-auto flex justify-center items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-2 rounded-lg font-medium text-sm transition-colors h-[42px]"
            >
              <MdOutlineClear className="text-lg" />
              {t("runDetail.clearFilters")}
            </button>
          </div>
        </div>
      </div>

      {/* Employee Payroll Records Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-base font-bold text-gray-900">
            {t("runDetail.recordsTitle")}
          </h2>
          <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
            {t("runDetail.showingRecords", { shown: filteredRows.length, total: rows.length })}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-[#F8F9FE]">
                <th className="text-start px-5 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  {t("runDetail.table.sn")}
                </th>
                <th className="text-start px-5 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  {t("runDetail.table.employeeName")}
                </th>
                <th className="text-start px-5 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  {t("runDetail.table.department")}
                </th>
                <th className="text-start px-5 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  {t("runDetail.table.basicSalary")}
                </th>
                <th className="text-start px-5 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  {t("runDetail.table.allowances")}
                </th>
                <th className="text-start px-5 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  {t("runDetail.table.deductions")}
                </th>
                <th className="text-start px-5 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  {t("runDetail.table.netPay")}
                </th>
                <th className="text-start px-5 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  {t("ytd.net")}
                </th>
                <th className="text-start px-5 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  {t("runDetail.table.status")}
                </th>
                <th className="text-start px-5 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  {t("runDetail.table.actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {detailLoading ? (
                <tr>
                  <td colSpan="10" className="px-5 py-12 text-center text-sm text-gray-400">
                    {t("runDetail.loading")}
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan="10" className="px-5 py-12 text-center text-sm text-gray-400">
                    {t("runDetail.empty")}
                  </td>
                </tr>
              ) : (
                filteredRows.map((emp, idx) => (
                  <React.Fragment key={emp.payslip_id}>
                    <tr className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4 text-sm font-medium text-gray-500">
                        {(page - 1) * LIMIT + idx + 1}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-cyan-200 text-[13px] font-bold shadow-sm overflow-hidden flex-shrink-0">
                            {emp.employee?.profile_url ? (
                              <img src={emp.employee.profile_url} alt={emp.employee?.name} className="w-full h-full object-cover" />
                            ) : (
                              initialsOf(emp.employee?.name)
                            )}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-gray-900 leading-tight">
                              {emp.employee?.name || "—"}
                            </div>
                            <div className="text-[11px] text-gray-500 mt-0.5">
                              {emp.employee?.code || "—"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-700">
                        {emp.employee?.department || "—"}
                      </td>
                      <td className="px-5 py-4 text-sm font-medium text-gray-900">
                        {rowFmt(emp.basic_salary)}
                      </td>
                      <td className="px-5 py-4 text-sm font-medium text-emerald-500">
                        +{rowFmt(emp.allowances)}
                      </td>
                      <td className="px-5 py-4 text-sm font-medium text-red-500">
                        -{rowFmt(emp.total_deductions)}
                      </td>
                      <td className="px-5 py-4 text-sm font-bold text-gray-900">
                        {rowFmt(emp.net_salary)}
                      </td>
                      {/* Year to date (FY start → this month, credited payslips) */}
                      <td
                        className="px-5 py-4 text-sm font-medium text-cyan-700 whitespace-nowrap"
                        title={
                          emp.ytd
                            ? `${t("ytd.gross")}: ${rowFmt(emp.ytd.gross)} · ${t("ytd.deductions")}: ${rowFmt(emp.ytd.deductions)} · ${t("ytd.months", { count: Number(emp.ytd.months) || 0 })}`
                            : undefined
                        }
                      >
                        {emp.ytd ? rowFmt(emp.ytd.net) : "—"}
                      </td>
                      <td className="px-5 py-4">{getStatusPill(emp.status)}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-4 text-gray-400">
                          <button
                            onClick={() => toggleRow(emp.payslip_id)}
                            className="p-1.5 text-gray-400 hover:text-[#14a0b3] hover:bg-cyan-50 rounded transition-colors"
                          >
                            {expandedRow === emp.payslip_id ? (
                              <MdOutlineVisibilityOff className="text-xl" />
                            ) : (
                              <MdOutlineRemoveRedEye className="text-xl" />
                            )}
                          </button>
                          <button
                            onClick={() =>
                              navigate(
                                `/admin/payroll-overview/payroll-preview-monthly/employee-payroll-review?runId=${runId}&payslipId=${emp.payslip_id}`,
                              )
                            }
                            title={t("runDetail.openPayslip")}
                            className="p-1.5 text-gray-400 hover:text-[#14a0b3] hover:bg-cyan-50 rounded transition-colors"
                          >
                            <MdOutlineReceiptLong className="text-xl" />
                          </button>
                          <button
                            onClick={() => downloadSlip(emp.payslip_id)}
                            disabled={downloadingId === emp.payslip_id}
                            title={t("runDetail.downloadSlip")}
                            className="hover:text-cyan-600 transition-colors disabled:opacity-40"
                          >
                            {downloadingId === emp.payslip_id ? (
                              <span className="inline-block w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <MdFileDownload className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>

                    <tr>
                      <td colSpan="10" className="p-0 border-none bg-white">
                        <div
                          className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${expandedRow === emp.payslip_id ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                        >
                          <div className="overflow-hidden">
                            <div className="px-5 pb-6 pt-2 border-b border-gray-100">
                              <div className="space-y-4">
                                {/* 4 Mini cards */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                  <div className="border border-gray-200 rounded-xl p-4 flex flex-col justify-center">
                                    <div className="flex items-center gap-2 mb-1">
                                      <FiCalendar className="text-cyan-600 w-4 h-4" />
                                      <span className="text-xs text-gray-600 font-semibold">
                                        {t("runDetail.workingDays")}
                                      </span>
                                    </div>
                                    <div className="text-lg font-bold text-gray-900 pl-6">
                                      {emp.attendance?.working_days ?? 0}
                                    </div>
                                  </div>
                                  <div className="border border-gray-200 rounded-xl p-4 flex flex-col justify-center">
                                    <div className="flex items-center gap-2 mb-1">
                                      <FiCheckCircle className="text-emerald-500 w-4 h-4" />
                                      <span className="text-xs text-gray-600 font-semibold">
                                        {t("runDetail.presentDays")}
                                      </span>
                                    </div>
                                    <div className="text-lg font-bold text-gray-900 pl-6">
                                      {emp.attendance?.present_days ?? 0}
                                    </div>
                                  </div>
                                  <div className="border border-gray-200 rounded-xl p-4 flex flex-col justify-center">
                                    <div className="flex items-center gap-2 mb-1">
                                      <FiCalendar className="text-red-500 w-4 h-4" />
                                      <span className="text-xs text-gray-600 font-semibold">
                                        {t("runDetail.leaveDays")}
                                      </span>
                                    </div>
                                    <div className="text-lg font-bold text-gray-900 pl-6">
                                      {emp.attendance?.leave_days ?? 0}
                                    </div>
                                  </div>
                                  <div className="border border-gray-200 rounded-xl p-4 flex flex-col justify-center">
                                    <div className="flex items-center gap-2 mb-1">
                                      <FiClock className="text-gray-500 w-4 h-4" />
                                      <span className="text-xs text-gray-600 font-semibold">
                                        {t("runDetail.overtime")}
                                      </span>
                                    </div>
                                    <div className="text-lg font-bold text-gray-900 pl-6">
                                      {t("runDetail.hours", { count: emp.attendance?.overtime_hours ?? 0 })}
                                    </div>
                                  </div>
                                </div>

                                {/* 2 Big columns */}
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="flex flex-col h-full border-l-4 border-l-emerald-500 border border-gray-200 rounded-xl p-5">
                                    <div className="flex items-center gap-2 mb-5">
                                      <MdOutlineMonetizationOn className="text-cyan-600 w-5 h-5" />
                                      <h3 className="font-bold text-gray-800 uppercase tracking-widest text-[13px]">
                                        {t("runDetail.earnings")}
                                      </h3>
                                    </div>
                                    <div className="space-y-3.5 mb-6">
                                      {[...(emp.earnings || []), ...(emp.incentives || [])].map(
                                        (detail) => (
                                          <div
                                            key={detail.id}
                                            className="flex justify-between items-center text-sm"
                                          >
                                            <span className="text-gray-500 font-medium">
                                              {detail.label}
                                              {!detail.is_auto && (
                                                <span className="ml-1.5 text-[9px] font-bold uppercase text-emerald-500">
                                                  {t("runDetail.added")}
                                                </span>
                                              )}
                                            </span>
                                            <span className="flex items-center gap-2">
                                              <span className="font-bold text-gray-900">
                                                SAR {rowFmt(detail.amount)}
                                              </span>
                                              {run?.status === "DRAFT" && !detail.is_auto && can(MODULES.PAYROLL, ACTIONS.UPDATE) && (
                                                <button
                                                  onClick={() =>
                                                    removeLine(emp.payslip_id, detail.id)
                                                  }
                                                  disabled={actionLoading || lock.locked}
                                                  title={lock.title || t("runDetail.removeLine")}
                                                  className="text-gray-300 hover:text-red-500 transition-colors disabled:opacity-40"
                                                >
                                                  <FiX className="w-4 h-4" />
                                                </button>
                                              )}
                                            </span>
                                          </div>
                                        ),
                                      )}
                                    </div>
                                    <div className="mt-auto pt-4 border-t border-gray-100 flex justify-between items-center">
                                      <span className="font-bold text-cyan-600 text-[15px]">
                                        {t("runDetail.totalEarnings")}
                                      </span>
                                      <span className="font-bold text-cyan-600 text-[15px]">
                                        SAR {rowFmt(emp.gross_salary)}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex flex-col h-full border-l-4 border-l-red-500 border border-gray-200 rounded-xl p-5">
                                    <div className="flex items-center gap-2 mb-5">
                                      <MdOutlineRemoveCircleOutline className="text-red-500 w-5 h-5" />
                                      <h3 className="font-bold text-gray-800 uppercase tracking-widest text-[13px]">
                                        {t("runDetail.deductions")}
                                      </h3>
                                    </div>
                                    <div className="space-y-3.5 mb-6">
                                      {(emp.deductions || []).map((detail) => (
                                        <div
                                          key={detail.id}
                                          className="flex justify-between items-center text-sm"
                                        >
                                          <span className="text-gray-500 font-medium">
                                            {detail.label}
                                            {!detail.is_auto && (
                                              <span className="ml-1.5 text-[9px] font-bold uppercase text-red-400">
                                                {t("runDetail.added")}
                                              </span>
                                            )}
                                          </span>
                                          <span className="flex items-center gap-2">
                                            <span className="font-bold text-gray-900">
                                              SAR {rowFmt(detail.amount)}
                                            </span>
                                            {run?.status === "DRAFT" && !detail.is_auto && can(MODULES.PAYROLL, ACTIONS.UPDATE) && (
                                              <button
                                                onClick={() =>
                                                  removeLine(emp.payslip_id, detail.id)
                                                }
                                                disabled={actionLoading || lock.locked}
                                                title={lock.title || t("runDetail.removeLine")}
                                                className="text-gray-300 hover:text-red-500 transition-colors disabled:opacity-40"
                                              >
                                                <FiX className="w-4 h-4" />
                                              </button>
                                            )}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                    <div className="mt-auto pt-4 border-t border-gray-100 flex justify-between items-center">
                                      <span className="font-bold text-red-600 text-[15px]">
                                        {t("runDetail.totalDeductions")}
                                      </span>
                                      <span className="font-bold text-red-600 text-[15px]">
                                        SAR {rowFmt(emp.total_deductions)}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Add ad-hoc incentive / deduction — DRAFT only */}
                                {run?.status === "DRAFT" && !lock.locked && (
                                  <div className="border border-dashed border-gray-200 rounded-xl p-4">
                                    {lineFor === emp.payslip_id ? (
                                      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-start">
                                        <div className="w-full sm:w-44">
                                          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                                            {t("runDetail.line.type")}
                                          </label>
                                          <CustomDropdown
                                            value={lineForm.type}
                                            placement="top"
                                            onChange={(e) =>
                                              setLineForm((f) => ({ ...f, type: e.target.value }))
                                            }
                                            options={[
                                              { label: t("runDetail.line.incentive"), value: "INCENTIVE" },
                                              { label: t("runDetail.line.deduction"), value: "DEDUCTION" },
                                            ]}
                                          />
                                          {lineErrors.type && <p className="text-red-500 text-xs mt-1">{lineErrors.type}</p>}
                                        </div>
                                        <div className="flex-1">
                                          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                                            {t("runDetail.line.label")}
                                          </label>
                                          <input
                                            type="text"
                                            value={lineForm.label}
                                            onChange={(e) =>
                                              setLineForm((f) => ({ ...f, label: e.target.value }))
                                            }
                                            placeholder={t("runDetail.line.labelPlaceholder")}
                                            className={`w-full px-3 py-2.5 border ${lineErrors.label ? "border-red-500" : "border-gray-200"} rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500`}
                                          />
                                          {lineErrors.label && <p className="text-red-500 text-xs mt-1">{lineErrors.label}</p>}
                                        </div>
                                        <div className="w-full sm:w-36">
                                          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                                            {t("runDetail.line.amount")}
                                          </label>
                                          <input
                                            type="number"
                                            min="0"
                                            value={lineForm.amount}
                                            onKeyDown={(e) => {
                                              if (e.key === "-" || e.key === "e") e.preventDefault();
                                            }}
                                            onChange={(e) =>
                                              setLineForm((f) => ({
                                                ...f,
                                                amount: e.target.value.replace("-", ""),
                                              }))
                                            }
                                            placeholder="0.00"
                                            className={`w-full px-3 py-2.5 border ${lineErrors.amount ? "border-red-500" : "border-gray-200"} rounded-lg text-sm text-end focus:outline-none focus:ring-1 focus:ring-cyan-500`}
                                          />
                                          {lineErrors.amount && <p className="text-red-500 text-xs mt-1">{lineErrors.amount}</p>}
                                        </div>
                                        <div className="flex gap-2 sm:pt-5">
                                          <button
                                            onClick={() => {
                                              setLineErrors({});
                                              setLineFor(null);
                                              setLineForm({ type: "INCENTIVE", label: "", amount: "" });
                                            }}
                                            className="px-3 py-2.5 rounded-lg border border-gray-200 text-gray-500 text-sm hover:bg-gray-50"
                                          >
                                            {t("runDetail.line.cancel")}
                                          </button>
                                          <button
                                            onClick={() => addLine(emp.payslip_id)}
                                            disabled={actionLoading}
                                            className="px-4 py-2.5 rounded-lg bg-cyan-600 text-white text-sm font-medium hover:bg-cyan-700 disabled:opacity-50"
                                          >
                                            {t("runDetail.line.add")}
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <Can module={MODULES.PAYROLL} action={ACTIONS.UPDATE}>
                                        <button
                                          onClick={() => {
                                            setLineFor(emp.payslip_id);
                                            setLineErrors({});
                                            setLineForm({ type: "INCENTIVE", label: "", amount: "" });
                                          }}
                                          className="flex items-center gap-2 text-cyan-600 font-semibold text-sm hover:text-cyan-700"
                                        >
                                          <FiPlus className="w-4 h-4" /> {t("runDetail.line.addButton")}
                                        </button>
                                      </Can>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-4 border-t border-gray-100">
          <span className="text-sm text-gray-400 order-2 sm:order-1">
            <Trans
              t={t}
              i18nKey="runDetail.pagination"
              values={{ from, to, total }}
              components={{ b: <span className="font-semibold text-gray-600" /> }}
            />
          </span>

          <div className="flex items-center gap-1 order-1 sm:order-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="w-8 h-8 flex items-center justify-center rounded-md border border-gray-200 text-gray-400 hover:bg-gray-50 transition-colors disabled:opacity-40"
            >
              &lt;
            </button>
            {pageNumbers.map((p, i) => {
              const prev = pageNumbers[i - 1];
              const gap = prev && p - prev > 1;
              return (
                <span key={p} className="flex items-center">
                  {gap && <span className="px-1 text-gray-400 text-sm">...</span>}
                  <button
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 flex items-center justify-center rounded-md text-sm font-medium transition-colors ${
                      p === page
                        ? "bg-cyan-600 text-white"
                        : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {p}
                  </button>
                </span>
              );
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="w-8 h-8 flex items-center justify-center rounded-md border border-gray-200 text-gray-400 hover:bg-gray-50 transition-colors disabled:opacity-40"
            >
              &gt;
            </button>
          </div>
        </div>
      </div>

      {/* Submit / Approve / Credit confirmation */}
      <ConfirmationModal
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={doConfirm}
        title={confirm?.title}
        message={confirm?.message}
        type={confirm?.type || "warning"}
        confirmText={confirm?.confirmText || t("runActions.confirm")}
        cancelText={t("runActions.cancel")}
        isLoading={actionLoading}
      />

      {/* Reject with reason */}
      {rejectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">{t("runActions.rejectTitle")}</h3>
            <p className="text-sm text-gray-500 mt-1">
              {t("runActions.rejectBody")}
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              placeholder={t("runActions.rejectPlaceholder")}
              className="mt-4 w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-red-400"
            />
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => {
                  setRejectOpen(false);
                  setRejectReason("");
                }}
                className="px-4 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50"
              >
                {t("runActions.cancel")}
              </button>
              <button
                onClick={submitReject}
                disabled={actionLoading}
                className="px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {t("runActions.rejectRun")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayrollPreviewMonthly;