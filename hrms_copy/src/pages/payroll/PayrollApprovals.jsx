import { useState } from "react";
import Pagination from "../../components/Pagination";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import {
  MdOutlineApproval,
  MdOutlineRemoveRedEye,
  MdMoreVert,
  MdCheck,
  MdClose,
  MdOutlinePayments,
} from "react-icons/md";
import ConfirmationModal from "../../components/ConfirmationModal";
import { Fragment } from "react";
import { useCan } from "../../hooks/usePermission";
import { MODULES, ACTIONS } from "../../constants/permissions";
import useFiscalYear from "../../hooks/useFiscalYear";
import useYearLock from "../../hooks/useYearLock";
import useFyResetState from "../../hooks/useFyResetState";
import { paginate } from "../../data/common";
import { STATIC_PERMISSION } from "../../data/session";
import { getPayrollRunDetail, listPayrollRuns, setPayrollRunStatus } from "../../data/groupE";

const runPeriod = (r) => `${r.period_year}-${String(r.period_month).padStart(2, "0")}`;

const LIMIT = 10;

const fmt = (n) =>
  Number(n || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// Work queues + history, so a run you approved stays visible after it moves on.
const TABS = [
  { key: "PENDING_APPROVAL", labelKey: "approvals.tabs.pending" },
  { key: "APPROVED", labelKey: "approvals.tabs.awaitingCredit" },
  { key: "CREDITED", labelKey: "approvals.tabs.credited" },
  { key: "ALL", labelKey: "approvals.tabs.all" },
];

const STATUS_STYLES = {
  DRAFT: "bg-gray-100 text-gray-600",
  PENDING_APPROVAL: "bg-[#FFF4E5] text-[#B98900]",
  APPROVED: "bg-blue-50 text-blue-700",
  REJECTED: "bg-red-50 text-red-700",
  CREDITED: "bg-green-50 text-green-700",
  PAID: "bg-indigo-50 text-indigo-700",
};

const PayrollApprovals = () => {
  const { t } = useTranslation("payroll");
  const can = useCan();
  const approvalModules = STATIC_PERMISSION.approvalModules || [];
  const isPayrollApprover = approvalModules.includes("PAYROLL");
  const [tab, setTab] = useState("PENDING_APPROVAL");
  const [tick, setTick] = useState(0);
  const fy = useFiscalYear();
  const lock = useYearLock();
  // FY-scoped list: page 1 again on a year change.
  const [page, setPage] = useFyResetState(1, fy.version);
  const loading = false;
  const [busyId, setBusyId] = useState(null);

  const [confirm, setConfirm] = useState(null); // { title, message, confirmText, type, action }
  const [rejectFor, setRejectFor] = useState(null); // runId
  const [rejectReason, setRejectReason] = useState("");

  const [expandedId, setExpandedId] = useState(null);
  const [expandedRows, setExpandedRows] = useState([]);
  const expandLoading = false;
  const [menu, setMenu] = useState(null); // { r, top, left } — open kebab menu

  const openMenu = (e, r) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMenu({ r, top: rect.bottom + 4, left: Math.max(8, rect.right - 180) });
  };

  // "ALL" tab → no status filter (full history); others filter by status (FY-scoped).
  const all = tick >= 0
    ? listPayrollRuns(tab !== "ALL" ? { status: tab } : {}).filter((r) => fy.inFy(runPeriod(r)))
    : [];
  const pg = paginate(all, page, LIMIT);
  const rows = pg.rows;
  const pagination = { total: pg.total, total_pages: pg.totalPages };
  const load = () => setTick((n) => n + 1);

  const runAction = async (runId, fn, successMsg) => {
    setBusyId(runId);
    try {
      fn();
      toast.success(successMsg);
      setConfirm(null);
      setRejectFor(null);
      setRejectReason("");
      load();
    } finally {
      setBusyId(null);
    }
  };

  const approve = (runId) =>
    setConfirm({
      title: t("runActions.approveTitle"),
      message: t("runActions.approveMessage"),
      confirmText: t("runActions.approveConfirm"),
      type: "success",
      action: () =>
        runAction(runId, () => setPayrollRunStatus(runId, "APPROVED"), t("runActions.approved")),
    });

  const credit = (runId) =>
    setConfirm({
      title: t("runActions.creditTitle"),
      message: t("runActions.creditMessage"),
      confirmText: t("runActions.creditConfirm"),
      type: "success",
      action: () =>
        runAction(runId, () => setPayrollRunStatus(runId, "CREDITED"), t("runActions.credited")),
    });

  const doReject = () => {
    if (!rejectReason.trim()) {
      toast.error(t("runActions.reasonRequired"));
      return;
    }
    runAction(
      rejectFor,
      () => setPayrollRunStatus(rejectFor, "REJECTED"),
      t("runActions.rejected"),
    );
  };

  const toggleExpand = async (runId) => {
    if (expandedId === runId) {
      setExpandedId(null);
      setExpandedRows([]);
      return;
    }
    setExpandedId(runId);
    setExpandedRows(getPayrollRunDetail(runId, 1, 100)?.payslips?.data || []);
  };

  const totalPages = pagination?.total_pages ?? 1;

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 text-cyan-600">
          <MdOutlineApproval className="text-2xl" />
          <span className="text-sm font-semibold">{t("approvals.eyebrow")}</span>
        </div>
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
          {t("approvals.title")}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {t("approvals.subtitle")}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {TABS.map((tabItem) => (
          <button
            key={tabItem.key}
            onClick={() => {
              setTab(tabItem.key);
              setPage(1);
              setExpandedId(null);
            }}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              tab === tabItem.key
                ? "border-cyan-600 text-cyan-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t(tabItem.labelKey)}
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-[#F8F9FE]">
                {[t("approvals.table.sn"), t("approvals.table.period"), t("approvals.table.project"), t("approvals.table.employees"), t("approvals.table.netPayroll"), t("approvals.table.status"), t("approvals.table.actions")].map(
                  (h) => (
                    <th
                      key={h}
                      className="text-start px-5 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-5 py-12 text-center text-sm text-gray-400">
                    {t("approvals.loading")}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-5 py-12 text-center text-sm text-gray-400">
                    {t("approvals.empty")}
                  </td>
                </tr>
              ) : (
                rows.map((r, index) => (
                  <Fragment key={r.id}>
                    <tr className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4 text-sm font-medium text-gray-600">
                        {String((page - 1) * LIMIT + index + 1).padStart(2, '0')}
                      </td>
                      <td className="px-5 py-4 text-sm font-bold text-gray-900">
                        {t(`months.${r.period_month}`, { defaultValue: r.month })} {r.year}
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-600">
                        {r.project_id ? t("projectFallback", { id: r.project_id }) : t("approvals.allEmployees")}
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-700">
                        {r.employee_count ?? 0}
                      </td>
                      <td className="px-5 py-4 text-sm font-bold text-gray-900">
                        SAR {fmt(r.total_net)}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            STATUS_STYLES[r.status] || "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {t(`status.${r.status}`, { defaultValue: String(r.status || "").replace(/_/g, " ") })}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <button
                          onClick={(e) => openMenu(e, r)}
                          title={t("approvals.actions")}
                          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                        >
                          <MdMoreVert className="text-lg" />
                        </button>
                      </td>
                    </tr>
                    {expandedId === r.id && (
                      <tr>
                        <td colSpan="7" className="px-5 py-4 bg-gray-50/60">
                          {expandLoading ? (
                            <div className="text-sm text-gray-400 py-4 text-center">
                              {t("approvals.loadingPayslips")}
                            </div>
                          ) : expandedRows.length === 0 ? (
                            <div className="text-sm text-gray-400 py-4 text-center">
                              {t("approvals.noPayslips")}
                            </div>
                          ) : (
                            <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
                              <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
                                  <tr>
                                    <th className="px-4 py-2.5">{t("approvals.payslipTable.employee")}</th>
                                    <th className="px-4 py-2.5">{t("approvals.payslipTable.gross")}</th>
                                    <th className="px-4 py-2.5">{t("approvals.payslipTable.deductions")}</th>
                                    <th className="px-4 py-2.5">{t("approvals.payslipTable.net")}</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                  {expandedRows.map((p) => (
                                    <tr key={p.payslip_id}>
                                      <td className="px-4 py-2.5 font-medium text-gray-800">
                                        {p.employee?.name || "—"}
                                        <span className="text-gray-400 ml-1 text-xs">
                                          {p.employee?.code || ""}
                                        </span>
                                      </td>
                                      <td className="px-4 py-2.5 text-gray-700">
                                        {fmt(p.gross_salary)}
                                      </td>
                                      <td className="px-4 py-2.5 text-red-500">
                                        -{fmt(p.total_deductions)}
                                      </td>
                                      <td className="px-4 py-2.5 font-bold text-gray-900">
                                        {fmt(p.net_salary)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <Pagination
          page={page}
          totalPages={totalPages}
          total={pagination?.total ?? rows.length}
          limit={LIMIT}
          onPage={setPage}
          label={t("approvals.paginationLabel")}
        />
      </div>

      {/* Row actions menu (kebab) */}
      {menu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} />
          <div
            className="fixed z-50 w-44 bg-white border border-gray-200 rounded-lg shadow-lg py-1"
            style={{ top: menu.top, left: menu.left }}
          >
            <button
              onClick={() => { toggleExpand(menu.r.id); setMenu(null); }}
              className="w-full text-start px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <MdOutlineRemoveRedEye className="text-base" />
              {expandedId === menu.r.id ? t("approvals.menu.hidePayslips") : t("approvals.menu.viewPayslips")}
            </button>

            {menu.r.status === "PENDING_APPROVAL" && menu.r.can_act && (
              <>
                <button
                  disabled={!menu.r.can_act || busyId === menu.r.id || lock.isLockedDate(runPeriod(menu.r))}
                  title={lock.isLockedDate(runPeriod(menu.r)) ? lock.titleFor(runPeriod(menu.r)) : menu.r.can_act ? "" : t("runActions.notApprover")}
                  onClick={() => { approve(menu.r.id); setMenu(null); }}
                  className="w-full text-start px-4 py-2 text-sm flex items-center gap-2 text-emerald-700 hover:bg-emerald-50 disabled:text-gray-300 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                >
                  <MdCheck className="text-base" /> {t("approvals.menu.approve")}
                </button>
                <button
                  disabled={!menu.r.can_act || busyId === menu.r.id || lock.isLockedDate(runPeriod(menu.r))}
                  title={lock.isLockedDate(runPeriod(menu.r)) ? lock.titleFor(runPeriod(menu.r)) : menu.r.can_act ? "" : t("runActions.notApprover")}
                  onClick={() => { setRejectFor(menu.r.id); setMenu(null); }}
                  className="w-full text-start px-4 py-2 text-sm flex items-center gap-2 text-red-600 hover:bg-red-50 disabled:text-gray-300 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                >
                  <MdClose className="text-base" /> {t("approvals.menu.reject")}
                </button>
              </>
            )}

            {menu.r.status === "APPROVED" &&
              (can(MODULES.PAYROLL, ACTIONS.UPDATE) || isPayrollApprover) && (
              <button
                disabled={busyId === menu.r.id || lock.isLockedDate(runPeriod(menu.r))}
                title={lock.isLockedDate(runPeriod(menu.r)) ? lock.titleFor(runPeriod(menu.r)) : undefined}
                onClick={() => { credit(menu.r.id); setMenu(null); }}
                className="w-full text-start px-4 py-2 text-sm flex items-center gap-2 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
              >
                <MdOutlinePayments className="text-base" /> {t("approvals.menu.credit")}
              </button>
            )}
          </div>
        </>
      )}

      {/* Approve / Credit confirm */}
      <ConfirmationModal
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm?.action?.()}
        title={confirm?.title}
        message={confirm?.message}
        type={confirm?.type || "warning"}
        confirmText={confirm?.confirmText || t("runActions.confirm")}
        cancelText={t("runActions.cancel")}
        isLoading={busyId != null}
      />

      {/* Reject with reason */}
      {rejectFor != null && (
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
                  setRejectFor(null);
                  setRejectReason("");
                }}
                className="px-4 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50"
              >
                {t("runActions.cancel")}
              </button>
              <button
                onClick={doReject}
                disabled={busyId != null}
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

export default PayrollApprovals;