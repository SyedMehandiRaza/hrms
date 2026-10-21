import { useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  MdArrowBack,
  MdOutlineLock,
  MdOutlineSearchOff,
  MdOutlineEdit,
  MdOutlineCancel,
  MdOutlinePersonAddAlt,
  MdOutlineHistory,
  MdOutlineEventNote,
  MdOutlineEventRepeat,
  MdOutlineArrowForward,
  MdOutlineTaskAlt,
  MdOutlineUndo,
  MdOutlineChecklist,
  MdOutlineDescription,
  MdOutlinePayments,
  MdOutlineHowToReg,
} from "react-icons/md";

import { getExit } from "../../api/exits";
import useApiQuery from "../../hooks/useApiQuery";
import { useCan } from "../../hooks/usePermission";
import { useCurrentUser } from "../../hooks/useSession";
import { MODULES, ACTIONS } from "../../constants/permissions";
import { apiErrorCode, apiErrorMessage } from "../../utils/apiError";
import { useFormat } from "../../hooks/useFormat";
import useYearLock from "../../hooks/useYearLock";
import useFiscalYear from "../../hooks/useFiscalYear";
import { diffDays } from "../../utils/exitValidation";
import { ExitStatusBadge, EmploymentStatusBadge } from "../../components/exits/ExitBadges";
import EditExitTermsModal from "../../components/exits/EditExitTermsModal";
import CancelExitModal from "../../components/exits/CancelExitModal";
import RehireModal from "../../components/exits/RehireModal";
import ConfirmExitModal from "../../components/exits/ConfirmExitModal";
import { ScreenError } from "../../components/ScreenState";
import Loader from "../../components/Loader";
import Ltr from "../../components/Ltr";

const DATE_FIELDS = new Set(["notice_start_date", "last_working_day", "preferred_last_day"]);
const BOOL_FIELDS = new Set(["allow_leave_during_notice", "encash_leave", "rehire_eligible"]);
const DAY_FIELDS = new Set(["notice_days", "cooling_period_days"]);

const initialsOf = (name = "") =>
  String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "?";

// GET /exits/:id → the shape the panels and modals read (notice / settlement_options / rehire
// groups, events with { from, to } payloads).
const toView = (d) => {
  const lwdEvents = (d.events || []).filter((e) => e.event_type === "LWD_EXTENDED");
  const ended = (d.events || []).find((e) => e.event_type === "CANCELLED" || e.event_type === "WITHDRAWN");
  return {
    ...d,
    employee: {
      id: d.employee?.id,
      full_name: d.employee?.name,
      country_emp_id: d.employee?.employee_code,
      employment_status: d.status === "IN_NOTICE" || d.status === "EXITED" ? d.status : null,
    },
    access: { can_login: d.status !== "EXITED" },
    notice: {
      start_date: d.notice_start_date,
      days: d.notice_days,
      last_working_day: d.last_working_day,
      original_last_working_day: d.original_last_working_day,
      preferred_last_day: d.preferred_last_day,
      allow_leave_during_notice: d.allow_leave_during_notice,
      extended_days: Math.max(diffDays(d.last_working_day, d.original_last_working_day) || 0, 0),
    },
    settlement_options: { encash_leave: d.encash_leave, loan_handling: d.loan_handling },
    rehire: { eligible: d.rehire_eligible, cooling_period_days: d.cooling_period_days, allowed_from: d.rehire_allowed_from },
    exited_at: d.status === "EXITED" ? d.last_working_day : null,
    cancelled_at: ended ? ended.created_at : null,
    events: (d.events || []).map((e) => {
      if (e.event_type === "LWD_EXTENDED") {
        const from = e.payload?.old?.last_working_day;
        const to = e.payload?.new?.last_working_day;
        return { ...e, payload: { from, to, days: Math.abs(diffDays(to, from) || 0) } };
      }
      if (e.event_type === "TERMS_UPDATED") {
        const old = e.payload?.old || {};
        const now = e.payload?.new || {};
        return { ...e, payload: { changes: Object.fromEntries(Object.keys(now).map((k) => [k, { from: old[k], to: now[k] }])) } };
      }
      return e;
    }),
    lwd_events: lwdEvents.length,
  };
};

export default function ExitDetail() {
  const canRead = useCan()(MODULES.EXIT, ACTIONS.READ);
  if (!canRead) return <StateBlock icon={MdOutlineLock} textKey="common.notAllowed" />;
  return <ExitDetailInner />;
}

function StateBlock({ icon: Icon, textKey, text, back }) {
  const { t } = useTranslation("exits");
  return (
    <div className="flex flex-col items-center justify-center text-center py-24 px-4">
      <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center mb-4">
        <Icon className="text-2xl text-gray-400" />
      </div>
      <p className="text-sm text-gray-600 max-w-md">{text || t(textKey)}</p>
      {back && (
        <Link to="/admin/exits" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-cyan-600 hover:text-cyan-700">
          <MdArrowBack className="rtl:rotate-180" />
          {t("detail.backToList")}
        </Link>
      )}
    </div>
  );
}

function ExitDetailInner() {
  const { id } = useParams();
  const { t } = useTranslation("exits");
  const { data, loading, error, reload, setData } = useApiQuery(() => getExit(id), [id]);
  const exit = data ? toView(data) : null;
  // The actions answer with the fresh detail (rehire with the employee: reload then).
  const setExit = useCallback((detail) => (detail?.approval !== undefined ? setData(detail) : reload()), [setData, reload]);
  const [modal, setModal] = useState(null); // "withdraw" | "terms" | "cancel" | "rehire" | "confirm"
  const user = useCurrentUser();
  const can = useCan();
  const isOwner = user?.accessLevel === "ADMIN";
  const canManage = can(MODULES.EMPLOYEE, ACTIONS.CREATE) && can(MODULES.EMPLOYEE, ACTIONS.UPDATE);
  // Read-only when the selected year is closed + locked; Edit terms also when the LWD's year is.
  const lock = useYearLock();
  const lwdLock = useYearLock(exit?.last_working_day);
  const lockProps = { disabled: lock.locked, title: lock.title };

  if (loading && !exit) return <Loader label={t("common.loading")} className="py-24" />;
  if (error && !exit) {
    // The server text: "The requested record was not found."
    if (apiErrorCode(error) === "NOT_FOUND") return <StateBlock icon={MdOutlineSearchOff} text={apiErrorMessage(error)} back />;
    if (apiErrorCode(error) === "FORBIDDEN") return <StateBlock icon={MdOutlineLock} textKey="common.notAllowed" back />;
    return <ScreenError error={error} onRetry={reload} />;
  }

  const pending = exit.status === "PENDING_APPROVAL";
  const inNotice = exit.status === "IN_NOTICE";
  // Withdraw (D59): the raiser, the owner, or employee:create + update.
  const canWithdraw = pending && (isOwner || canManage || (exit.raised_by?.id && exit.raised_by.id === user?.id));
  // Rehire (D67): an exited employee, employee:create; the server answers eligibility and cooling.
  // Once rehired the exit stays EXITED in its history, so the button goes away.
  const rehired = (exit.events || []).some((e) => e.event_type === "REHIRED");
  const canRehire = exit.status === "EXITED" && !rehired && can(MODULES.EMPLOYEE, ACTIONS.CREATE);

  return (
    <div className="space-y-6 pb-10">
      <Header
        exit={exit}
        actions={
          <>
            {canWithdraw && (
              <button
                type="button"
                onClick={() => setModal("withdraw")}
                {...lockProps}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-red-600 border border-red-200 bg-white hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <MdOutlineUndo className="text-base" />
                {t("detail.actions.withdraw")}
              </button>
            )}
            {inNotice && canManage && (
              <>
                <button
                  type="button"
                  onClick={() => setModal("terms")}
                  disabled={lwdLock.locked}
                  title={lwdLock.title}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <MdOutlineEdit className="text-base" />
                  {t("detail.actions.editTerms")}
                </button>
                <button
                  type="button"
                  onClick={() => setModal("cancel")}
                  {...lockProps}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-red-600 border border-red-200 bg-white hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <MdOutlineCancel className="text-base" />
                  {t("detail.actions.cancelExit")}
                </button>
              </>
            )}
            {/* Confirm → Immediate (D64): the owner only. */}
            {inNotice && isOwner && (
              <button
                type="button"
                onClick={() => setModal("confirm")}
                {...lockProps}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <MdOutlineTaskAlt className="text-base" />
                {t("detail.actions.confirmImmediate")}
              </button>
            )}
            {canRehire && (
              <button
                type="button"
                onClick={() => setModal("rehire")}
                {...lockProps}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <MdOutlinePersonAddAlt className="text-base" />
                {t("detail.actions.rehire")}
              </button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6 min-w-0">
          <SummaryCard exit={exit} />
          <ApprovalPanel approval={exit.approval} />
          {/* Clearance checklist and settlement come later (D62, D64). */}
          <ComingLater icon={MdOutlineChecklist} title={t("settings.template.title")} />
          <ComingLater icon={MdOutlinePayments} title={t("wizard.settlement.previewTitle")} text={t("wizard.settlement.availableAfterPayroll")} />
        </div>
        <div className="space-y-6 min-w-0">
          <ComingLater icon={MdOutlineDescription} title={t("documents.title", { defaultValue: t("confirm.documents") })} />
          <LwdPanel exit={exit} />
          <ActivityTimeline events={exit.events || []} />
        </div>
      </div>

      {modal === "withdraw" && !lock.locked && (
        <CancelExitModal exit={exit} mode="withdraw" onClose={() => setModal(null)} onCancelled={setExit} />
      )}
      {modal === "terms" && !lwdLock.locked && <EditExitTermsModal exit={exit} onClose={() => setModal(null)} onSaved={setExit} />}
      {modal === "cancel" && !lock.locked && <CancelExitModal exit={exit} onClose={() => setModal(null)} onCancelled={setExit} />}
      {modal === "rehire" && !lock.locked && <RehireModal exit={exit} onClose={() => setModal(null)} onRehired={setExit} />}
      {modal === "confirm" && !lock.locked && <ConfirmExitModal exit={exit} onClose={() => setModal(null)} onConfirmed={setExit} />}
    </div>
  );
}

// A panel whose content comes in a later release (checklist, documents, settlement).
function ComingLater({ icon: Icon, title, text }) {
  const { t } = useTranslation("exits");
  return (
    <section className="bg-white border border-gray-200 rounded-xl">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
        <Icon className="text-lg text-cyan-600" />
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
      </div>
      <p className="p-5 text-sm text-gray-400">{text || t("detail.comingLater")}</p>
    </section>
  );
}

// Approval progress by level (the exit's approval request).
const LEVEL_TONE = {
  APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REJECTED: "bg-red-50 text-red-600 border-red-200",
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  SKIPPED: "bg-gray-100 text-gray-600 border-gray-200",
  WAITING: "bg-gray-50 text-gray-500 border-gray-200",
  CANCELLED: "bg-slate-50 text-slate-500 border-slate-200",
};

function ApprovalPanel({ approval }) {
  const { t } = useTranslation("exits");
  const { fmtDate } = useFormat();
  if (!approval) return null;
  const withdrawn = approval.status === "CANCELLED";
  const chip = (status) => (
    <span className={`inline-flex px-2 py-0.5 rounded-md border text-[11px] font-semibold ${LEVEL_TONE[status] || LEVEL_TONE.WAITING}`}>
      {t(`detail.approval.status.${status}`, { defaultValue: status })}
    </span>
  );
  const decisions = (rows) =>
    rows.map((d, i) => (
      <li key={i} className="text-xs text-gray-600">
        <span className="font-semibold text-gray-800">{d.name || "—"}</span>
        {d.is_override ? ` (${t("detail.approval.override")})` : ""} · {t(`detail.approval.status.${d.status}`, { defaultValue: d.status })} ·{" "}
        {fmtDate(d.acted_at)}
        {d.comment && <span className="block text-gray-500 whitespace-pre-line break-words">{d.comment}</span>}
      </li>
    ));
  return (
    <section className="bg-white border border-gray-200 rounded-xl">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
        <MdOutlineHowToReg className="text-lg text-cyan-600" />
        <h2 className="text-sm font-bold text-gray-900">{t("detail.approval.title")}</h2>
        <span className="ms-auto">{chip(withdrawn ? "CANCELLED" : approval.status === "IN_PROGRESS" ? "PENDING" : approval.status)}</span>
      </div>
      <div className="p-5 space-y-4">
        {approval.owner_only ? (
          <>
            <p className="text-sm text-gray-600">{t("detail.approval.ownerOnly")}</p>
            {approval.decisions?.length > 0 && <ul className="space-y-1">{decisions(approval.decisions)}</ul>}
          </>
        ) : (
          <ol className="space-y-4">
            {approval.levels.map((l) => (
              <li key={l.level} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900">{t("detail.approval.level", { n: l.level })}</p>
                  {chip(withdrawn && ["PENDING", "WAITING"].includes(l.status) ? "CANCELLED" : l.status)}
                </div>
                <p className="text-xs text-gray-500">
                  {l.approvers.length ? l.approvers.map((a) => a.name).join(", ") : t("detail.approval.noApprover")}
                </p>
                {l.decisions.length > 0 && <ul className="space-y-1">{decisions(l.decisions)}</ul>}
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

// ── header ───────────────────────────────────────────────────────────────────
function Header({ exit, actions }) {
  const { t } = useTranslation("exits");
  const emp = exit.employee || {};
  const canLogin = !!exit.access?.can_login;
  return (
    <div className="space-y-4">
      <Link to="/admin/exits" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-cyan-600">
        <MdArrowBack className="rtl:rotate-180" />
        {t("detail.backToList")}
      </Link>
      <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <div className="w-12 h-12 rounded-full bg-cyan-100 text-cyan-700 text-sm font-bold flex items-center justify-center shrink-0">
            {initialsOf(emp.full_name)}
          </div>
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {emp.id ? (
                <Link to={`/admin/employees/${emp.id}`} className="text-xl font-bold text-gray-900 hover:text-cyan-600 truncate">
                  {emp.full_name || t("list.unknownEmployee")}
                </Link>
              ) : (
                <span className="text-xl font-bold text-gray-900">{t("list.unknownEmployee")}</span>
              )}
              <ExitStatusBadge status={exit.status} />
              <EmploymentStatusBadge status={emp.employment_status} />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {emp.country_emp_id && (
                <span className="text-gray-500">
                  <Ltr>{emp.country_emp_id}</Ltr>
                </span>
              )}
              <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 font-medium">{t(`type.${exit.exit_type}`)}</span>
              <span className="px-2 py-0.5 rounded-md bg-gray-50 border border-gray-200 text-gray-600">{t(`reason.${exit.reason_category}`)}</span>
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-semibold border ${
                  canLogin ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-100 text-gray-500 border-gray-200"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${canLogin ? "bg-emerald-500" : "bg-gray-400"}`} />
                {canLogin ? t("detail.access.canLogin") : t("detail.access.removed")}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      </div>
    </div>
  );
}

// ── summary ──────────────────────────────────────────────────────────────────
function SummaryCard({ exit }) {
  const { t } = useTranslation("exits");
  const { fmtDate } = useFormat();
  const n = exit.notice || {};
  const so = exit.settlement_options || {};
  const rh = exit.rehire || {};
  const yesNo = (v) => (v ? t("common.yes") : t("common.no"));

  const rows = [
    { k: "noticeStart", v: fmtDate(n.start_date) },
    { k: "noticeDays", v: t("common.days", { count: Number(n.days || 0) }) },
    { k: "preferredLastDay", v: n.preferred_last_day ? fmtDate(n.preferred_last_day) : "—" },
    {
      k: "leaveDuringNotice",
      v: yesNo(n.allow_leave_during_notice),
      hint: n.allow_leave_during_notice ? t("detail.summary.leaveYesHint") : t("detail.summary.leaveNoHint"),
    },
    { k: "encashLeave", v: yesNo(so.encash_leave) },
    { k: "loanHandling", v: so.loan_handling ? t(`loanHandling.${so.loan_handling}`) : "—" },
    {
      k: "rehireEligible",
      v: yesNo(rh.eligible),
      hint: rh.eligible
        ? t("detail.summary.rehireHint", {
            days: t("common.days", { count: Number(rh.cooling_period_days || 0) }),
            date: rh.allowed_from ? fmtDate(rh.allowed_from) : "—",
          })
        : null,
    },
    {
      k: "raisedBy",
      v: exit.raised_by?.name || "—",
      hint: exit.created_at ? fmtDate(exit.created_at) : null,
    },
  ];
  if (exit.exited_at) rows.push({ k: "exitedOn", v: fmtDate(exit.exited_at) });
  if (exit.completed_at) rows.push({ k: "completedOn", v: fmtDate(exit.completed_at) });
  if (exit.cancelled_at) rows.push({ k: "cancelledOn", v: fmtDate(exit.cancelled_at) });

  return (
    <section className="bg-white border border-gray-200 rounded-xl">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
        <MdOutlineEventNote className="text-lg text-cyan-600" />
        <h2 className="text-sm font-bold text-gray-900">{t("detail.summary.title")}</h2>
      </div>
      <div className="p-5 space-y-5">
        {exit.reason && (
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">{t("detail.summary.reason")}</p>
            <p className="text-sm text-gray-800 whitespace-pre-line break-words">{exit.reason}</p>
          </div>
        )}
        <dl className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-4">
          {rows.map((r) => (
            <div key={r.k} className="min-w-0">
              <dt className="text-xs font-semibold text-gray-500">{t(`detail.summary.${r.k}`)}</dt>
              <dd className="text-sm font-medium text-gray-900 mt-0.5 break-words">{r.v}</dd>
              {r.hint && <dd className="text-[11px] text-gray-400 mt-0.5">{r.hint}</dd>}
            </div>
          ))}
        </dl>
        {exit.status === "REJECTED" && exit.reject_reason && (
          <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3">
            <p className="text-xs font-semibold text-red-500 mb-1">{t("detail.summary.rejectReason")}</p>
            <p className="text-sm text-red-700 whitespace-pre-line break-words">{exit.reject_reason}</p>
          </div>
        )}
        {exit.status === "CANCELLED" && exit.cancel_reason && (
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
            <p className="text-xs font-semibold text-slate-500 mb-1">{t("detail.summary.cancelReason")}</p>
            <p className="text-sm text-slate-700 whitespace-pre-line break-words">{exit.cancel_reason}</p>
          </div>
        )}
      </div>
    </section>
  );
}

// ── last working day ─────────────────────────────────────────────────────────
function LwdPanel({ exit }) {
  const { t } = useTranslation("exits");
  const { fmtDate } = useFormat();
  const today = useFiscalYear().today;
  const n = exit.notice || {};
  const ext = Number(n.extended_days || 0);
  const changes = (exit.events || []).filter((e) => e.event_type === "LWD_EXTENDED" || e.event_type === "LWD_REVERTED");
  const left =
    exit.status === "IN_NOTICE"
      ? Math.max(Number(n.days_left ?? diffDays(n.last_working_day, today) ?? 0), 0)
      : null;

  return (
    <section className="bg-white border border-gray-200 rounded-xl">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
        <MdOutlineEventRepeat className="text-lg text-cyan-600" />
        <h2 className="text-sm font-bold text-gray-900">{t("detail.lwd.title")}</h2>
      </div>
      <div className="p-5 space-y-4">
        <div className="rounded-xl bg-cyan-50/60 border border-cyan-100 p-4">
          <p className="text-xs font-semibold text-cyan-700">{t("detail.lwd.current")}</p>
          <p className="text-lg font-bold text-gray-900 mt-0.5">{fmtDate(n.last_working_day)}</p>
          {left !== null && (
            <p className={`text-xs mt-1 ${left <= 7 ? "text-amber-600 font-semibold" : "text-gray-500"}`}>
              {left > 0 ? t("detail.lwd.daysLeft", { days: t("common.days", { count: left }) }) : t("detail.lwd.reached")}
            </p>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-xs font-semibold text-gray-500">{t("detail.lwd.original")}</dt>
            <dd className="text-sm font-medium text-gray-900 mt-0.5">{fmtDate(n.original_last_working_day)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-gray-500">{t("detail.lwd.totalExtension")}</dt>
            <dd className={`text-sm font-medium mt-0.5 ${ext > 0 ? "text-indigo-600" : "text-gray-900"}`}>
              {ext > 0 ? t("detail.lwd.plusDays", { days: t("common.days", { count: ext }) }) : t("detail.lwd.none")}
            </dd>
          </div>
        </dl>

        <div>
          <p className="text-xs font-semibold text-gray-500 mb-2">{t("detail.lwd.history")}</p>
          {changes.length === 0 ? (
            <p className="text-xs text-gray-400">{t("detail.lwd.noHistory")}</p>
          ) : (
            <ol className="space-y-3">
              {changes.map((e) => {
                const p = e.payload || {};
                const extended = e.event_type === "LWD_EXTENDED";
                const days = Number(p.days || 0);
                return (
                  <li key={e.id} className="flex gap-3">
                    <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${extended ? "bg-indigo-500" : "bg-gray-400"}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {extended
                          ? t("detail.lwd.extendedBy", { days: t("common.days", { count: days }) })
                          : t("detail.lwd.revertedBy", { days: t("common.days", { count: days }) })}
                      </p>
                      <p className="text-xs text-gray-500 flex flex-wrap items-center gap-1">
                        {fmtDate(p.from)}
                        <MdOutlineArrowForward className="rtl:rotate-180" />
                        {fmtDate(p.to)}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        {p.leave_request_id ? t("detail.lwd.leaveRef", { id: p.leave_request_id }) : null}
                        {p.leave_request_id ? " · " : null}
                        {fmtDate(e.created_at)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}

// ── activity ─────────────────────────────────────────────────────────────────
function ActivityTimeline({ events }) {
  const { t } = useTranslation("exits");
  const { fmtDate } = useFormat();
  const sorted = [...events].sort((a, b) => new Date(b.created_at) - new Date(a.created_at) || b.id - a.id);
  const dateTime = (v) =>
    fmtDate(v, { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <section className="bg-white border border-gray-200 rounded-xl">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
        <MdOutlineHistory className="text-lg text-cyan-600" />
        <h2 className="text-sm font-bold text-gray-900">{t("detail.activity.title")}</h2>
      </div>
      <div className="p-5">
        {sorted.length === 0 ? (
          <p className="text-xs text-gray-400">{t("detail.activity.empty")}</p>
        ) : (
          <ol className="relative">
            {sorted.map((e, i) => (
              <li key={e.id} className="relative ps-6 pb-5 last:pb-0">
                {i < sorted.length - 1 && <span className="absolute start-[5px] top-3 bottom-0 w-px bg-gray-200" />}
                <span className="absolute start-0 top-1.5 w-[11px] h-[11px] rounded-full border-2 border-cyan-500 bg-white" />
                <p className="text-sm font-semibold text-gray-900">{t(`event.${e.event_type}`, { defaultValue: e.event_type })}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {e.actor_user_id ? null : t("detail.activity.system")}
                  {e.actor_user_id ? null : " · "}
                  {dateTime(e.created_at)}
                </p>
                <EventDetail event={e} />
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function EventDetail({ event }) {
  const { t } = useTranslation("exits");
  const { fmtDate, fmtNumber } = useFormat();
  const p = event.payload || {};
  const box = "mt-2 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 text-xs text-gray-600 space-y-1";

  const fmtTerm = (field, v) => {
    if (v === null || v === undefined || v === "") return "—";
    if (DATE_FIELDS.has(field)) return fmtDate(v);
    if (BOOL_FIELDS.has(field)) return v ? t("common.yes") : t("common.no");
    if (DAY_FIELDS.has(field)) return t("common.days", { count: Number(v) });
    if (field === "loan_handling") return t(`loanHandling.${v}`, { defaultValue: String(v) });
    return String(v);
  };

  switch (event.event_type) {
    case "TERMS_UPDATED": {
      const changes = Object.entries(p.changes || {});
      if (!changes.length) return null;
      return (
        <div className={box}>
          {changes.map(([field, c]) => (
            <p key={field} className="flex flex-wrap items-center gap-1">
              <span className="font-semibold text-gray-700">{t(`detail.fields.${field}`, { defaultValue: field })}:</span>
              <span>{fmtTerm(field, c?.from)}</span>
              <MdOutlineArrowForward className="rtl:rotate-180 text-gray-400" />
              <span className="font-medium text-gray-800">{fmtTerm(field, c?.to)}</span>
            </p>
          ))}
        </div>
      );
    }
    case "CHECKLIST_UPDATED":
      return (
        <div className={box}>
          <p className="font-semibold text-gray-700">{p.label}</p>
          <p className="flex flex-wrap items-center gap-1">
            {p.from ? t(`checklistStatus.${p.from}`, { defaultValue: p.from }) : "—"}
            <MdOutlineArrowForward className="rtl:rotate-180 text-gray-400" />
            <span className="font-medium text-gray-800">{p.to ? t(`checklistStatus.${p.to}`, { defaultValue: p.to }) : "—"}</span>
          </p>
          {p.note && <p className="text-gray-500 break-words">{p.note}</p>}
        </div>
      );
    case "ITEM_ADDED":
      return (
        <div className={box}>
          <p>
            <span className="font-semibold text-gray-700">{p.label}</span>
            {p.category ? ` · ${t(`checklistCategory.${p.category}`, { defaultValue: p.category })}` : ""}
          </p>
        </div>
      );
    case "ADJUSTMENT_ADDED":
      return (
        <div className={box}>
          <p>
            {p.type ? `${t(`adjustmentType.${p.type}`, { defaultValue: p.type })} · ` : ""}
            <span className="font-semibold text-gray-700">{p.label}</span>
            {p.amount !== undefined && (
              <>
                {" · "}
                <Ltr>{fmtNumber(p.amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Ltr>
              </>
            )}
          </p>
        </div>
      );
    case "LWD_EXTENDED":
    case "LWD_REVERTED":
      return (
        <div className={box}>
          <p className="flex flex-wrap items-center gap-1">
            {fmtDate(p.from)}
            <MdOutlineArrowForward className="rtl:rotate-180 text-gray-400" />
            <span className="font-medium text-gray-800">{fmtDate(p.to)}</span>
            {p.days ? <span className="text-gray-400">({t("common.days", { count: Number(p.days) })})</span> : null}
          </p>
        </div>
      );
    case "CANCELLED":
      return p.reason ? (
        <div className={box}>
          <p className="break-words whitespace-pre-line">{p.reason}</p>
        </div>
      ) : null;
    case "CONFIRMED":
    case "CONFIRMED_WITH_OVERRIDE":
      return (
        <div className={box}>
          {p.mode && <p>{t(`detail.activity.confirmMode_${p.mode}`, { defaultValue: p.mode })}</p>}
          {Array.isArray(p.open_items) && p.open_items.length > 0 && (
            <p>{t("detail.activity.openItems", { items: p.open_items.map((i) => i.label).join(", ") })}</p>
          )}
          {p.reason && <p className="break-words whitespace-pre-line text-gray-500">{p.reason}</p>}
        </div>
      );
    case "RELIEVED_EARLY":
      return (
        <div className={box}>
          <p className="flex flex-wrap items-center gap-1">
            {fmtDate(p.from)}
            <MdOutlineArrowForward className="rtl:rotate-180 text-gray-400" />
            <span className="font-medium text-gray-800">{fmtDate(p.to)}</span>
          </p>
        </div>
      );
    case "DOCUMENT_GENERATED":
      return p.doc_type ? (
        <div className={box}>
          <p>
            {t(`documents.type.${p.doc_type}`, { defaultValue: p.doc_type })} · {t("documents.version", { version: p.version })}
          </p>
        </div>
      ) : null;
    case "DOCUMENT_SENT":
      return p.to ? (
        <div className={box}>
          <p>
            {t("detail.activity.sentTo", { email: "" })}
            <Ltr>{p.to}</Ltr>
          </p>
        </div>
      ) : null;
    case "REHIRED":
      return p.rehire_date ? (
        <div className={box}>
          <p>{t("detail.activity.rehiredOn", { date: fmtDate(p.rehire_date) })}</p>
        </div>
      ) : null;
    default:
      return null;
  }
}
