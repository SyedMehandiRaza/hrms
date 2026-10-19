import { useState } from "react";
import {
  MdOutlineChevronRight,
  MdOutlineCheckCircle,
  MdOutlineClose,
  MdInfoOutline,
  MdOutlineBeachAccess,
  MdOutlineBarChart,
  MdOutlineEventBusy,
} from "react-icons/md";

import { Link, useSearchParams } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";
import { toast } from "react-toastify";
import Ltr from "../../components/Ltr";
import LevelProgress from "../../components/LevelProgress";
import { useFormat } from "../../hooks/useFormat";
import useYearLock from "../../hooks/useYearLock";
import Can from "../../components/Can";
import { MODULES, ACTIONS } from "../../constants/permissions";
import CancelApprovedLeaveModal from "../../components/leave/CancelApprovedLeaveModal";
import { LR_REQUESTS, LR_detailOf, LR_applyAction, LR_save } from "../../data/groupD";

// Per-member approval log status → badge styling.
const LOG_STATUS_COLORS = {
  APPROVED: "bg-green-50 border border-green-200 text-green-600",
  PENDING: "bg-amber-50 border border-amber-200 text-amber-600",
  REJECTED: "bg-red-50 border border-red-200 text-red-600",
  SKIPPED: "bg-gray-50 border border-gray-200 text-gray-400",
};

// ── Mini Calendar Data ────────────────────────────────────────────────────────
const WEEK1 = [
  { d: 21, active: false },
  { d: 22, active: false },
  { d: 23, active: false },
  { d: 24, active: true },
  { d: 25, active: true },
  { d: 26, weekend: true },
  { d: 27, weekend: true },
];
const WEEK2 = [
  { d: 28, active: true },
  { d: 29, active: true },
  { d: 30, active: true },
  { d: 31, active: false },
  { d: 1, next: true },
  { d: 2, next: true },
  { d: 3, next: true },
];

const OVERLAPPING = [
  {
    name: "Clara Vance",
    sub: "Sick Leave (Oct 24-25)",
    dot: "bg-red-500",
    avatar:
      "https://ui-avatars.com/api/?name=Clara+Vance&background=be185d&color=fff&size=40",
  },
  {
    name: "David Chen",
    sub: "Public Holiday (Oct 28)",
    dot: "bg-gray-300",
    avatar:
      "https://ui-avatars.com/api/?name=David+Chen&background=374151&color=fff&size=40",
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ReviewLeaveRequest({ onBack }) {
  const { t } = useTranslation("leaves");
  const { fmtDate } = useFormat();
  const [sp] = useSearchParams();
  const id = sp.get("id");

  const [notes, setNotes] = useState("");
  const [decision, setDecision] = useState(null); // null | "approved" | "rejected"
  // Static lookup by ?id= (falls back to the first sample request). Actions
  // update the shared sample list; the tick re-renders with the new state.
  const row = LR_REQUESTS.find((r) => String(r.id) === String(id)) || LR_REQUESTS[0];
  const detail = LR_detailOf(row);
  const loading = false;
  const submitting = false;
  const [cancelOpen, setCancelOpen] = useState(false);
  const [, setReloadTick] = useState(0);
  // The leave's own date decides read-only (closed + locked year).
  const lock = useYearLock(detail?.from_date);

  const takeAction = (action, decisionValue) => {
    // A closed period blocks APPROVE only — REJECT stays allowed.
    if (!detail?.approval_request_id || submitting || (action === "APPROVE" && lock.locked)) return;
    LR_save(LR_applyAction(row, action));
    setDecision(decisionValue);
    toast.success(t("toast.actionSubmitted"));
  };

  const handleApprove = () => takeAction("APPROVE", "approved");
  const handleReject = () => takeAction("REJECT", "rejected");

  if (decision) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center ${decision === "approved" ? "bg-green-100" : "bg-red-100"}`}
        >
          {decision === "approved" ? (
            <MdOutlineCheckCircle className="text-green-500 text-4xl" />
          ) : (
            <MdOutlineClose className="text-red-500 text-4xl" />
          )}
        </div>
        <h2 className="text-xl font-bold text-gray-900">
          {decision === "approved"
            ? t("review.decision.approvedTitle")
            : t("review.decision.rejectedTitle")}
        </h2>
        <p className="text-sm text-gray-400 max-w-xs">
          {decision === "approved"
            ? t("review.decision.approvedBody")
            : t("review.decision.rejectedBody")}
        </p>
        <button
          onClick={() => {
            setDecision(null);
            onBack?.();
          }}
          className="mt-2 px-6 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-semibold transition-colors"
        >
          {t("review.decision.backToRequests")}
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <p className="text-sm text-gray-400">{t("common.loading", { defaultValue: "Loading..." })}</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <p className="text-sm text-gray-400 max-w-xs">
          {t("review.selectRequest", { defaultValue: "Select a request to review." })}
        </p>
      </div>
    );
  }

  // ── Derived display values (additive; fall back to static placeholders) ──
  const balance = detail.current_balance;
  const balancePct =
    balance && Number(balance.total_allocated) > 0
      ? (Number(balance.available_balance) / Number(balance.total_allocated)) * 100
      : null;

  return (

      <div className="space-y-5">
        {/* ── Breadcrumb ── */}
        <div className="flex items-center gap-1.5 text-sm flex-wrap">
          <Link
            to='/admin/leave-management'
            className="text-gray-400 hover:text-cyan-600 transition-colors"
          >
            {t("common.leaveManagement")}
          </Link>
          <MdOutlineChevronRight className="text-gray-300 rtl:rotate-180" />
          <button

            className="text-gray-400 hover:text-cyan-600 transition-colors"
          >
            {t("review.breadcrumbRequests")}
          </button>
          <MdOutlineChevronRight className="text-gray-300 rtl:rotate-180" />
          <span className="text-cyan-600 font-semibold">
            <Trans
              i18nKey="review.breadcrumbDetails"
              ns="leaves"
              values={{ code: detail.request_code }}
              components={[<Ltr />]}
            />
          </span>
        </div>

        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
              {t("review.title")}
            </h1>
            <p className="text-gray-400 mt-1 text-sm">
              {t("review.subtitle")}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-600 text-xs font-bold rounded-full self-start flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            {detail.status || t("status.pendingApproval")}
          </span>
        </div>

        {/* ── Two-column Layout ── */}
        <div className="flex flex-col lg:flex-row gap-5 items-start">
          {/* ── Left: Employee + Request + Notes ── */}
          <div className="flex-1 space-y-5">
            {/* Employee Card */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex flex-col sm:flex-row gap-5">
                <img
                  src="https://ui-avatars.com/api/?name=Marcus+Thorne&background=1e3a5f&color=fff&size=80"
                  alt="Marcus Thorne"
                  className="w-20 h-20 rounded-xl object-cover flex-shrink-0 self-start"
                />
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold text-gray-900 mb-0.5">
                    {detail.employee_name}
                  </h2>
                  <p className="text-sm font-semibold text-cyan-600 mb-3">
                    Senior Product Designer{" "}
                    <span className="text-gray-400 font-normal">•</span>{" "}
                    Creative Team
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { labelKey: "review.employee.employeeId", value: <Ltr>{detail.country_emp_id}</Ltr> },
                      { labelKey: "review.employee.reportingManager", value: "Elena Rodriguez" },
                      { labelKey: "review.employee.location", value: "London, UK (Remote)" },
                    ].map(({ labelKey, value }) => (
                      <div key={labelKey}>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">
                          {t(labelKey)}
                        </p>
                        <p className="text-sm font-semibold text-gray-800">
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Request Particulars */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-base font-bold text-gray-900 mb-4">
                {t("review.requestParticulars")}
              </h3>

              {/* Leave meta grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5 pb-5 border-b border-gray-100">
                {[
                  { labelKey: "review.meta.leaveType", value: detail.leave_type?.leave_name ?? "Annual Leave", isLeave: true },
                  { labelKey: "review.meta.duration", value: `${detail.total_days} Working Days` },
                  { labelKey: "review.meta.startDate", value: fmtDate(detail.from_date) },
                  { labelKey: "review.meta.endDate", value: fmtDate(detail.to_date) },
                ].map(({ labelKey, value, isLeave }) => (
                  <div key={labelKey}>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                      {t(labelKey)}
                    </p>
                    {isLeave ? (
                      <div className="flex items-center gap-2">
                        <MdOutlineBeachAccess className="text-cyan-500 text-base flex-shrink-0" />
                        <p className="text-sm font-bold text-gray-900">
                          {value}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm font-bold text-gray-900">{value}</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Reason */}
              <div className="mb-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">
                  {t("review.reasonForRequest")}
                </p>
                <blockquote className="border-s-4 border-cyan-500 ps-4 py-1">
                  <p className="text-sm text-gray-700 leading-relaxed italic">
                    {detail.reason || t("review.reasonQuote")}
                  </p>
                </blockquote>
              </div>

              {/* Policy Compliance */}
              <div className="flex items-start gap-2.5 bg-cyan-50 border border-cyan-100 rounded-xl px-4 py-3">
                <MdInfoOutline className="text-cyan-500 text-lg flex-shrink-0 mt-0.5" />
                <p className="text-sm font-semibold text-cyan-700 leading-relaxed">
                  {t("review.policyCompliance")}
                </p>
              </div>
            </div>

            {/* Approval Notes + Actions */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                {t("review.notesLabel")}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder={t("review.notesPlaceholder")}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition resize-none bg-white mb-5"
              />
              {lock.locked && (
                <p className="mb-3 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  {lock.title}
                </p>
              )}
              <div className="flex flex-col sm:flex-row items-center justify-end gap-3">
                {detail.status === "APPROVED" && (
                  <Can module={MODULES.LEAVE} action={ACTIONS.UPDATE}>
                    <button
                      type="button"
                      onClick={() => setCancelOpen(true)}
                      disabled={lock.locked}
                      title={lock.locked ? lock.title : undefined}
                      className="w-full sm:w-auto sm:me-auto flex items-center justify-center gap-2 border border-red-200 text-red-600 hover:bg-red-50 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <MdOutlineEventBusy className="text-lg" /> {t("fy.cancelLeave.button")}
                    </button>
                  </Can>
                )}
                {!detail.can_act && detail.status !== "APPROVED" && (
                  <p className="text-xs font-semibold text-amber-600 sm:me-auto text-center sm:text-start">
                    {detail.is_approver
                      ? t("review.waitingForLevel", {
                          level: detail.approval?.current_level,
                          defaultValue: `Waiting for level ${detail.approval?.current_level} approval`,
                        })
                      : t("review.notApprover", {
                          defaultValue: "You are not an approver for this request",
                        })}
                  </p>
                )}
                <button
                  onClick={handleReject}
                  disabled={submitting || !detail.can_act}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 border border-gray-200 hover:border-red-300 hover:bg-red-50 text-gray-700 hover:text-red-600 px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <MdOutlineClose className="text-lg" /> {t("review.rejectRequest")}
                </button>
                <button
                  onClick={handleApprove}
                  disabled={submitting || !detail.can_act || lock.locked}
                  title={lock.locked ? lock.title : undefined}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <MdOutlineCheckCircle className="text-lg" /> {t("review.approveRequest")}
                </button>
              </div>
            </div>
          </div>

          {/* ── Right Sidebar ── */}
          <div className="w-full lg:w-72 xl:w-80 flex-shrink-0 space-y-4">
            {/* Leave Balance Status */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                {t("review.leaveBalanceStatus")}
              </p>
              <div className="flex items-end justify-between mb-2">
                <div>
                  <p className="text-4xl font-bold text-gray-900"><Ltr>{balance ? Number(balance.available_balance) : 0}</Ltr></p>
                  <p className="text-xs text-gray-400 font-medium">
                    {t("review.daysRemaining")}
                  </p>
                </div>
                <div className="text-end">
                  <p className="text-xl font-bold text-gray-600"><Ltr>{balance ? Number(balance.total_allocated) : 0}</Ltr></p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    {t("review.totalEntitlement")}
                  </p>
                </div>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                <div
                  className="h-full bg-cyan-600 rounded-full"
                  style={{ width: balancePct != null ? `${Math.min(100, Math.max(0, balancePct))}%` : "0%" }}
                />
              </div>
              <p className="text-[11px] text-gray-400">
                {balance ? t("review.carryOverNote") : t("fy.noBalance")}
              </p>
            </div>

            {/* Approval Progress — which level / member has to approve */}
            {Array.isArray(detail.levels_summary) &&
              detail.levels_summary.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                    {t("review.approvalProgress", { defaultValue: "Approval Progress" })}
                  </p>
                  <div className="mb-4">
                    <LevelProgress
                      levels={detail.levels_summary}
                      currentLevel={detail.approval?.current_level}
                    />
                  </div>
                  <div className="space-y-3">
                    {(detail.approval?.logs || []).map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-900 truncate">
                            {log.approver_name || "—"}
                          </p>
                          <p className="text-[11px] text-gray-400">
                            {t("review.levelLabel", {
                              level: log.level_no,
                              defaultValue: `Level ${log.level_no}`,
                            })}
                          </p>
                        </div>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide flex-shrink-0 ${
                            LOG_STATUS_COLORS[log.status] ||
                            "bg-gray-50 border border-gray-200 text-gray-500"
                          }`}
                        >
                          {log.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Team Availability Mini Calendar */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-gray-900">
                  {t("review.teamAvailability")}
                </h3>
                <span className="text-xs font-semibold text-cyan-600">
                  {t("months.october")} <Ltr>2023</Ltr>
                </span>
              </div>

              {/* Calendar */}
              <div className="mb-4">
                {/* Day headers */}
                <div className="grid grid-cols-7 mb-1">
                  {[
                    "review.miniWeekdays.m",
                    "review.miniWeekdays.t",
                    "review.miniWeekdays.w",
                    "review.miniWeekdays.t",
                    "review.miniWeekdays.f",
                    "review.miniWeekdays.s",
                    "review.miniWeekdays.s",
                  ].map((d, i) => (
                    <div
                      key={i}
                      className="text-center text-[10px] font-bold text-gray-400 py-1"
                    >
                      {t(d)}
                    </div>
                  ))}
                </div>
                {/* Week 1 */}
                <div className="grid grid-cols-7 gap-0.5">
                  {WEEK1.map(({ d, active, weekend }) => (
                    <div
                      key={d}
                      className={`flex items-center justify-center w-8 h-8 mx-auto rounded-lg text-sm font-semibold transition-colors ${
                        active
                          ? "bg-cyan-600 text-white"
                          : weekend
                            ? "text-gray-300"
                            : "text-gray-600"
                      }`}
                    >
                      <Ltr>{d}</Ltr>
                    </div>
                  ))}
                </div>
                {/* Week 2 */}
                <div className="grid grid-cols-7 gap-0.5 mt-0.5">
                  {WEEK2.map(({ d, active, next }) => (
                    <div
                      key={`w2-${d}`}
                      className={`flex items-center justify-center w-8 h-8 mx-auto rounded-lg text-sm font-semibold transition-colors ${
                        active
                          ? "bg-cyan-600 text-white"
                          : next
                            ? "text-gray-300"
                            : "text-gray-600"
                      }`}
                    >
                      <Ltr>{d}</Ltr>
                    </div>
                  ))}
                </div>
              </div>

              {/* Overlapping Leaves */}
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                {t("review.overlappingLeaves")}
              </p>
              <div className="space-y-3">
                {OVERLAPPING.map((person) => (
                  <div
                    key={person.name}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5">
                      <img
                        src={person.avatar}
                        alt={person.name}
                        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                      />
                      <div>
                        <p className="text-xs font-semibold text-gray-900">
                          {person.name}
                        </p>
                        <p className="text-[11px] text-gray-400">
                          {person.sub}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${person.dot}`}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Operational Impact */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-cyan-50 rounded-lg flex items-center justify-center">
                  <MdOutlineBarChart className="text-cyan-600 text-lg" />
                </div>
                <h3 className="text-sm font-bold text-gray-900">
                  {t("review.operationalImpact")}
                </h3>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed mb-3">
                <Trans
                  i18nKey="review.operationalImpactBody"
                  ns="leaves"
                  components={[<strong className="text-gray-800" />]}
                />
              </p>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-600 rounded-full"
                  style={{ width: "82%" }}
                />
              </div>
            </div>
          </div>
        </div>

        <CancelApprovedLeaveModal
          open={cancelOpen}
          leave={{
            id: detail.id,
            from_date: detail.from_date,
            to_date: detail.to_date,
            total_days: detail.total_days,
            employee_name: detail.employee_name,
            leave_type: detail.leave_type,
          }}
          scope="ADMIN"
          onClose={() => setCancelOpen(false)}
          onDone={() => {
            setCancelOpen(false);
            setReloadTick((n) => n + 1);
          }}
        />
      </div>

  );
}
