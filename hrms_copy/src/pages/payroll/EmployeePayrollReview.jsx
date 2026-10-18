import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  MdChevronRight,
  MdAccessTime,
  MdClose,
  MdAttachMoney,
  MdStar,
  MdFileDownload,
  MdOutlineErrorOutline,
  MdOutlineReceiptLong,
  MdRefresh,
} from "react-icons/md";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";

import Ltr from "../../components/Ltr";
import Loader, { Spinner } from "../../components/Loader";
import PayslipYtd from "../../components/payroll/PayslipYtd";
import { getPayslipDetail } from "../../data/groupE";

// One employee's payslip of a payroll run (HR view): GET /payroll/:payrollId —
// earnings / incentives / deductions lines, totals, attendance and the
// year-to-date block. Opened from the run detail (PayrollPreviewMonthly) as
//   …/employee-payroll-review?runId=<run>&payslipId=<payslip>

const CURRENCY = "SAR";
const money = (n) =>
  Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS_PILL = {
  CREDITED: "bg-green-100 text-green-700",
  PENDING: "bg-[#FFF4E5] text-[#B98900]",
};

const initialsOf = (name) =>
  (name || "?")
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

function Avatar({ src, name }) {
  const [broken, setBroken] = useState(false);
  if (src && !broken) {
    return (
      <img
        src={src}
        alt={name || ""}
        onError={() => setBroken(true)}
        className="w-16 h-16 rounded-xl object-cover shrink-0 border-2 border-gray-200"
      />
    );
  }
  return (
    <div className="w-16 h-16 rounded-xl shrink-0 bg-slate-800 text-cyan-200 flex items-center justify-center text-lg font-bold">
      {initialsOf(name)}
    </div>
  );
}

// A card listing payslip lines of one kind (incentives / deductions).
function LineCard({ icon: Icon, iconCls, title, lines, tone, emptyText }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-5">
        <Icon className={`${iconCls} text-xl`} />
        <h3 className="text-base font-bold text-gray-900">{title}</h3>
      </div>
      {lines.length === 0 ? (
        <p className="text-sm text-gray-400">{emptyText}</p>
      ) : (
        <div className="space-y-3">
          {lines.map((l) => (
            <div key={l.id} className="flex items-start justify-between gap-3 pb-3 border-b border-gray-50 last:border-0 last:pb-0">
              <p className="text-xs font-bold text-gray-700 uppercase tracking-wider break-words min-w-0">{l.label}</p>
              <p className={`text-sm font-bold shrink-0 ${tone}`}>
                <Ltr>{money(l.amount)}</Ltr>
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EmployeePayrollReview() {
  const { t } = useTranslation("payroll");
  const [params] = useSearchParams();
  const payslipId = params.get("payslipId");
  const runId = params.get("runId");
  const runLink = runId
    ? `/admin/payroll-overview/payroll-preview-monthly?runId=${runId}`
    : "/admin/payroll-overview";

  const [reloadKey, setReloadKey] = useState(0);
  const [downloading, setDownloading] = useState(false);
  // The payslip from the static store (never loading; error = not found).
  const state = { loading: false, error: false, data: payslipId && reloadKey >= 0 ? getPayslipDetail(payslipId) : null };

  const retry = () => {
    setReloadKey((k) => k + 1);
  };

  // No PDF in the static build — acknowledge the download.
  const download = async () => {
    setDownloading(true);
    toast.info(t("runDetail.downloadSlip"));
    setDownloading(false);
  };

  const p = state.data;
  const emp = p?.employee || {};
  const periodText = p?.period ? `${t(`months.${p.period.month}`)} ${p.period.year}` : "";
  const earnings = p?.earnings || [];
  const basic = earnings.filter((e) => String(e.label).toUpperCase() === "BASIC");
  const otherEarnings = earnings.filter((e) => String(e.label).toUpperCase() !== "BASIC");

  // ── Breadcrumb (always shown) ──
  const breadcrumb = (
    <div className="flex items-center gap-1.5 text-sm flex-wrap">
      <Link to="/admin/payroll-overview" className="text-gray-400 hover:text-cyan-600 transition-colors">
        {t("review.breadcrumb.payroll")}
      </Link>
      <MdChevronRight className="text-gray-300 rtl:rotate-180" />
      <Link to={runLink} className="text-gray-400 hover:text-cyan-600 transition-colors">
        {t("review.breadcrumb.review")}
      </Link>
      {emp.name && (
        <>
          <MdChevronRight className="text-gray-300 rtl:rotate-180" />
          <span className="text-cyan-600 font-medium">{emp.name}</span>
        </>
      )}
    </div>
  );

  if (!payslipId || state.error || (!state.loading && !p)) {
    return (
      <div className="space-y-5">
        {breadcrumb}
        <div className="bg-white border border-gray-200 rounded-xl px-6 py-14 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center mx-auto mb-4">
            {state.error ? (
              <MdOutlineErrorOutline className="text-3xl text-red-400" />
            ) : (
              <MdOutlineReceiptLong className="text-3xl text-gray-300" />
            )}
          </div>
          <p className="text-sm text-gray-500 max-w-sm mx-auto mb-5">
            {state.error ? t("review.loadFailed") : t("review.notSelected")}
          </p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {state.error && (
              <button
                type="button"
                onClick={retry}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors"
              >
                <MdRefresh className="text-base" /> {t("review.retry")}
              </button>
            )}
            <Link
              to={runLink}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-gray-700 border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors"
            >
              {t("review.backToRun")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (state.loading) {
    return (
      <div className="space-y-5">
        {breadcrumb}
        <div className="bg-white border border-gray-200 rounded-xl">
          <Loader label={t("review.loading")} />
        </div>
      </div>
    );
  }

  const totals = p.totals || {};
  const att = p.attendance || {};
  const ot = p.overtime || {};
  const status = p.payslip_status;

  return (
    <div className="space-y-5">
      {/* ── Breadcrumb + Header ── */}
      <div className="flex flex-col gap-4">
        {breadcrumb}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <Avatar src={emp.profile_url} name={emp.name} />
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 break-words">{emp.name || "—"}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {emp.department && (
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-full uppercase">
                    {emp.department}
                  </span>
                )}
                {emp.code && (
                  <span className="text-sm text-gray-400">
                    {t("review.employeeId")} <Ltr>{emp.code}</Ltr>
                  </span>
                )}
                {periodText && <span className="text-sm text-gray-500">· {periodText}</span>}
                {status && (
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${
                      STATUS_PILL[status] || "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {t(`status.${status}`, { defaultValue: status })}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={download}
            disabled={downloading}
            className="flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 shrink-0 self-start sm:self-auto"
          >
            {downloading ? (
              <Spinner size="sm" className="border-white border-t-transparent" />
            ) : (
              <MdFileDownload className="text-base" />
            )}
            {t("runDetail.downloadSlip")}
          </button>
        </div>
      </div>

      {/* ── Main Content: Salary + Net Pay Summary ── */}
      <div className="flex flex-col lg:flex-row gap-5 items-start">
        <div className="flex-1 min-w-0 w-full space-y-5">
          {/* Salary Structure (earnings lines) */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 lg:p-6">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
              <div className="w-9 h-9 bg-cyan-50 rounded-lg flex items-center justify-center">
                <MdAttachMoney className="text-cyan-500 text-xl" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">{t("review.salaryStructure")}</h3>
            </div>

            {earnings.length === 0 ? (
              <p className="text-sm text-gray-400">{t("review.noLines")}</p>
            ) : (
              <div className="space-y-4">
                {[...basic, ...otherEarnings].map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between gap-4 pb-4 border-b border-gray-50 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                        <MdAttachMoney className="text-gray-500 text-lg" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                          {String(e.label).toUpperCase() === "BASIC" ? t("review.baseSalary") : t("review.allowances")}
                        </p>
                        <p className="text-sm font-semibold text-gray-900 mt-0.5 break-words">{e.label}</p>
                      </div>
                    </div>
                    <p className="text-xl font-bold text-gray-900 shrink-0">
                      <Ltr>{money(e.amount)}</Ltr>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Time Tracking + Incentives + Deductions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-5">
                <MdAccessTime className="text-cyan-500 text-xl" />
                <h3 className="text-base font-bold text-gray-900">{t("review.timeTracking")}</h3>
              </div>
              <div className="space-y-3">
                <div className="pb-3 border-b border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                    {t("review.workingDays")}
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    <Ltr>
                      {att.total_present_days ?? 0}
                      <span className="text-sm text-gray-400 ms-1">/ {att.total_working_days ?? 0}</span>
                    </Ltr>
                  </p>
                </div>
                <div className="pb-3 border-b border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                    {t("runDetail.leaveDays")}
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    <Ltr>{att.leave_days ?? 0}</Ltr>
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                    {t("review.otHours")}
                  </p>
                  <p className="text-2xl font-bold text-cyan-600">
                    <Ltr>{ot.overtime_hours ?? 0}</Ltr>
                  </p>
                </div>
              </div>
            </div>

            <LineCard
              icon={MdStar}
              iconCls="text-green-500"
              title={t("review.incentives")}
              lines={p.incentives || []}
              tone="text-green-600"
              emptyText={t("review.noLines")}
            />
            <LineCard
              icon={MdClose}
              iconCls="text-red-500"
              title={t("review.deductions")}
              lines={p.deductions || []}
              tone="text-red-500"
              emptyText={t("review.noLines")}
            />
          </div>

          {/* Year to date (FY start → this month, credited payslips) */}
          <PayslipYtd ytd={p.ytd} period={p.period} currency={CURRENCY} />
        </div>

        {/* Net Pay Summary */}
        <div className="w-full lg:w-80 shrink-0">
          <div className="bg-cyan-600 rounded-xl p-6 relative overflow-hidden">
            <div className="absolute top-0 end-0 w-32 h-32 opacity-10">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                <circle cx="50" cy="50" r="40" fill="none" stroke="white" strokeWidth="8" opacity="0.3" />
              </svg>
            </div>
            <div className="relative z-10">
              <p className="text-xs font-bold text-cyan-200 uppercase tracking-widest mb-1">
                {t("review.finalCalculation")}
              </p>
              <h3 className="text-2xl font-bold text-white mb-6">{t("review.netPaySummary")}</h3>

              <div className="space-y-4 mb-6 pb-6 border-b border-cyan-500/30">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-cyan-100">{t("review.grossEarnings")}</span>
                  <span className="text-lg font-bold text-white">
                    <Ltr>{money(totals.gross_salary)}</Ltr>
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-cyan-100">{t("review.totalDeductions")}</span>
                  <span className="text-lg font-bold text-cyan-200">
                    <Ltr>({money(totals.total_deductions)})</Ltr>
                  </span>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-cyan-200 uppercase tracking-widest mb-2">
                  {t("review.takeHomeSalary")}
                </p>
                <p className="text-4xl font-bold text-white break-all">
                  <Ltr>{`${CURRENCY} ${money(totals.net_salary)}`}</Ltr>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
