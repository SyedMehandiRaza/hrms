import React, { useState } from "react";
import Pagination from "../../components/Pagination";
import RunPayrollModal from "../../components/RunPayrollModal";
import {
  FiPlay,
} from "react-icons/fi";
import { MdOutlineRemoveRedEye, MdOutlineDelete, MdOutlineClear } from "react-icons/md";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import useFiscalYear from "../../hooks/useFiscalYear";
import useYearLock from "../../hooks/useYearLock";
import useFyResetState from "../../hooks/useFyResetState";
import { paginate } from "../../data/common";
import { PAYROLL_PROJECTS, deletePayrollRun, listPayrollRuns } from "../../data/groupE";
import CustomDropdown from "../../components/CustomDropdown";
import ConfirmationModal from "../../components/ConfirmationModal";
import Can from "../../components/Can";
import { MODULES, ACTIONS } from "../../constants/permissions";

// Only runs that aren't financially in-flight/committed can be deleted.
const DELETABLE_STATUSES = ["DRAFT", "REJECTED"];

const STATUS_OPTIONS = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "CREDITED",
  "PAID",
];

const statusStyle = (s) => {
  switch (s) {
    case "DRAFT":
      return "bg-gray-100 text-gray-700";
    case "PENDING_APPROVAL":
      return "bg-yellow-100 text-yellow-700";
    case "APPROVED":
      return "bg-green-100 text-green-700";
    case "REJECTED":
      return "bg-red-100 text-red-700";
    case "CREDITED":
    case "PAID":
      return "bg-indigo-100 text-indigo-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
};

const formatNum = (n) =>
  Number(n || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatPeriod = (month, year, t) => {
  if (!month || !year) return "—";
  const lastDay = new Date(year, month, 0).getDate();
  const abbr = t(`monthsShort.${month}`);
  return t("overview.periodRange", { month: abbr, lastDay });
};

// The selected FY's 12 months (FY order) as { value: "YYYY-MM", label: "Month YYYY" }.
const buildMonthOptions = (t, months) =>
  months.map((m) => ({ value: m.value, label: `${t(`months.${m.month}`)} ${m.year}` }));

const runPeriod = (r) => `${r.period_year}-${String(r.period_month).padStart(2, "0")}`;

const LIMIT = 10;
const EMPTY_FILTERS = { projectId: "", status: "" };

const PayrollOverview = () => {
  const navigate = useNavigate();
  const { t } = useTranslation("payroll");

  const listLoading = false;
  const [tick, setTick] = useState(0);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const projects = PAYROLL_PROJECTS;
  const fy = useFiscalYear();
  const lock = useYearLock();
  // ?status=DRAFT / ?month=YYYY-MM (e.g. a year-end readiness "Fix" link)
  // preselect the filters; a month outside the selected FY is ignored.
  const [searchParams] = useSearchParams();
  const [applied, setApplied] = useState(() => {
    const s = String(searchParams.get("status") || "").toUpperCase();
    return { ...EMPTY_FILTERS, status: STATUS_OPTIONS.includes(s) ? s : "" };
  });
  const urlMonth = searchParams.get("month") || "";
  const initialMonth = fy.months.some((m) => m.value === urlMonth) ? urlMonth : "";
  // Month filter + page start over when the financial year changes.
  const [month, setMonth] = useFyResetState(initialMonth, fy.version);
  const [page, setPage] = useFyResetState(1, fy.version);

  // Delete-run confirmation.
  const [runToDelete, setRunToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const monthOptions = buildMonthOptions(t, fy.months);
  const statusLabel = (s) => t(`status.${s}`, { defaultValue: s });

  // Month / project / status filters + paging on the static runs (FY-scoped).
  const [selYear, selMonth] = month ? month.split("-").map(Number) : [];
  const runs = tick >= 0
    ? listPayrollRuns({
      period_year: selYear,
      period_month: selMonth,
      project_id: applied.projectId ? Number(applied.projectId) : undefined,
      status: applied.status || undefined,
    }).filter((r) => fy.inFy(runPeriod(r)))
    : [];
  const pg = paginate(runs, page, LIMIT);
  const list = pg.rows;
  const pagination = { total: pg.total, total_pages: pg.totalPages };
  const loadRuns = () => setTick((n) => n + 1);

  const confirmDelete = async () => {
    if (!runToDelete) return;
    setDeleting(true);
    try {
      deletePayrollRun(runToDelete.id);
      toast.success(t("overview.toast.deleted"));
      setRunToDelete(null);
      loadRuns();
    } finally {
      setDeleting(false);
    }
  };

  const lockTitle = (row) =>
    t("fiscalYear:locked.tooltip", {
      label: fy.years.find((y) => runPeriod(row) >= y.start_date.slice(0, 7) && runPeriod(row) <= y.end_date.slice(0, 7))?.label || fy.label,
    });

  const projectName = (id) =>
    id == null
      ? t("overview.filters.all")
      : projects.find((p) => String(p.id) === String(id))?.project_name ||
      t("projectFallback", { id });

  const clearFilters = () => {
    setApplied(EMPTY_FILTERS);
    setMonth("");
    setPage(1);
  };

  const total = pagination?.total ?? list.length;
  const totalPages = pagination?.total_pages ?? 1;
  const from = total === 0 ? 0 : (page - 1) * LIMIT + 1;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
            {t("overview.title")}
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            {t("overview.pageSubtitle")}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
          {!lock.locked && (
          <Can module={MODULES.PAYROLL} action={ACTIONS.CREATE}>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm transition-colors"
            >
              <FiPlay className="w-4 h-4 fill-current" />
              {t("overview.runPayroll")}
            </button>
          </Can>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl px-4 py-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
              {t("overview.filters.month")}
            </label>
            <div className="relative">
              <CustomDropdown
                value={month}
                onChange={(e) => {
                  setMonth(e.target.value);
                  setPage(1);
                }}
                options={[
                  { label: t("overview.filters.all"), value: "" },
                  ...monthOptions
                ]}
              />
            </div>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
              {t("overview.filters.project")}
            </label>
            <div className="relative">
              <CustomDropdown
                value={applied.projectId}
                onChange={(e) => {
                  setApplied((f) => ({ ...f, projectId: e.target.value }));
                  setPage(1);
                }}
                options={[
                  { label: t("overview.filters.all"), value: "" },
                  ...projects.map((p) => ({
                    label: p.project_name || p.name || t("projectFallback", { id: p.id }),
                    value: p.id
                  }))
                ]}
              />
            </div>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
              {t("overview.filters.status")}
            </label>
            <div className="relative">
              <CustomDropdown
                value={applied.status}
                onChange={(e) => {
                  setApplied((f) => ({ ...f, status: e.target.value }));
                  setPage(1);
                }}
                options={[
                  { label: t("overview.filters.allStatuses"), value: "" },
                  ...STATUS_OPTIONS.map((s) => ({
                    label: statusLabel(s),
                    value: s
                  }))
                ]}
              />
            </div>
          </div>
          <div className="flex-shrink-0 w-full sm:w-auto h-[42px]">
            <button
              onClick={clearFilters}
              className="w-full sm:w-auto flex justify-center items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-2 rounded-lg font-medium text-sm transition-colors h-[42px]"
            >
              <MdOutlineClear className="text-lg" />
              {t("overview.filters.clearFilters")}
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead>
              <tr className="border-b border-gray-100">
                {[t("overview.table.sn"), t("overview.table.ref"), t("overview.table.month"), t("overview.table.period"), t("overview.table.project"), t("overview.table.staff"), t("overview.table.netTotal"), t("overview.table.status"), t("overview.table.actions")].map(
                  (h) => (
                    <th
                      key={h}
                      className="text-start px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {listLoading ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-sm text-gray-400">
                    {t("overview.loading")}
                  </td>
                </tr>
              ) : list.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-sm text-gray-400">
                    {t("overview.empty")}
                  </td>
                </tr>
              ) : (
                list.map((row, idx) => {
                  const ref = `PR-${row.period_year}-${String(row.period_month).padStart(2, "0")}`;

                  return (
                    <React.Fragment key={row.id}>
                      <tr className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-4 text-sm text-gray-700">
                          {from + idx}
                        </td>
                        <td
                          className="px-5 py-4 text-sm font-bold text-cyan-600 hover:underline cursor-pointer"
                          onClick={() =>
                            navigate(
                              `/admin/payroll-overview/payroll-preview-monthly?runId=${row.id}`,
                            )
                          }
                        >
                          {ref}
                        </td>
                        <td className="px-5 py-4 text-sm font-bold text-gray-900 leading-tight">
                          {t(`months.${row.period_month}`, { defaultValue: row.month })}
                          <br />
                          <span className="text-gray-500 font-normal">
                            {row.year || row.period_year}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-700 whitespace-nowrap">
                          {formatPeriod(row.period_month, row.period_year, t)}
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-700">
                          {projectName(row.project_id)}
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-700">
                          {row.employee_count ?? 0}
                        </td>
                        <td className="px-5 py-4 text-sm font-bold text-gray-900">
                          {formatNum(row.total_net)}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase ${statusStyle(row.status)}`}
                          >
                            {statusLabel(row.status)}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() =>
                                navigate(
                                  `/admin/payroll-overview/payroll-preview-monthly?runId=${row.id}`
                                )
                              }
                              className="p-1.5 text-gray-400 hover:text-[#14a0b3] hover:bg-cyan-50 rounded transition-colors"
                              title={t("overview.viewDetails")}
                            >
                              <MdOutlineRemoveRedEye className="text-xl" />
                            </button>
                            {DELETABLE_STATUSES.includes(row.status) && (
                              <Can module={MODULES.PAYROLL} action={ACTIONS.DELETE}>
                                <button
                                  onClick={() => setRunToDelete(row)}
                                  disabled={lock.isLockedDate(runPeriod(row))}
                                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-400"
                                  title={lock.isLockedDate(runPeriod(row)) ? lockTitle(row) : t("overview.deleteRun")}
                                >
                                  <MdOutlineDelete className="text-xl" />
                                </button>
                              </Can>
                            )}
                          </div>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          limit={LIMIT}
          onPage={setPage}
          label={t("overview.paginationLabel")}
        />
      </div>

      <RunPayrollModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          loadRuns();
        }}
      />

      <ConfirmationModal
        isOpen={!!runToDelete}
        onClose={() => (deleting ? null : setRunToDelete(null))}
        onConfirm={confirmDelete}
        type="delete"
        title={t("overview.deleteConfirm.title")}
        message={
          runToDelete
            ? t("overview.deleteConfirm.message", {
              ref: `PR-${runToDelete.period_year}-${String(
                runToDelete.period_month,
              ).padStart(2, "0")}`,
              count: runToDelete.employee_count ?? 0,
            })
            : ""
        }
        confirmText={t("overview.deleteConfirm.confirm")}
        cancelText={t("overview.deleteConfirm.cancel")}
        isLoading={deleting}
      />
    </div>
  );
};

export default PayrollOverview;
