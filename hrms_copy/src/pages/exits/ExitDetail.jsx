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
  MdOutlineInfo,
  MdOutlineHourglassEmpty,
} from "react-icons/md";

import { getExit } from "../../data/groupG";
import { STATIC_PERMISSION } from "../../data/session";
import useCanManageExits from "../../hooks/useCanManageExits";
import { useFormat } from "../../hooks/useFormat";
import useYearLock from "../../hooks/useYearLock";
import { diffDays, todayYmd } from "../../utils/exitValidation";
import { ExitStatusBadge, EmploymentStatusBadge } from "../../components/exits/ExitBadges";
import ChecklistPanel from "../../components/exits/ChecklistPanel";
import SettlementPanel from "../../components/exits/SettlementPanel";
import EditExitTermsModal from "../../components/exits/EditExitTermsModal";
import CancelExitModal from "../../components/exits/CancelExitModal";
import RehireModal from "../../components/exits/RehireModal";
import ConfirmExitModal from "../../components/exits/ConfirmExitModal";
import { openRequiredItems } from "../../utils/exitConfirm";
import ExitDocumentsCard from "../../components/exits/ExitDocumentsCard";
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

export default function ExitDetail() {
  const canManage = useCanManageExits();
  if (!canManage) return <StateBlock icon={MdOutlineLock} textKey="common.notAllowed" />;
  return <ExitDetailInner />;
}

function StateBlock({ icon: Icon, textKey, back }) {
  const { t } = useTranslation("exits");
  return (
    <div className="flex flex-col items-center justify-center text-center py-24 px-4">
      <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center mb-4">
        <Icon className="text-2xl text-gray-400" />
      </div>
      <p className="text-sm text-gray-600 max-w-md">{t(textKey)}</p>
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
  const [loaded, setLoaded] = useState(() => ({ id, exit: getExit(id) }));
  const exit = loaded.exit;
  const setExit = useCallback((d) => setLoaded((s) => ({ ...s, exit: d })), []);
  if (loaded.id !== id) setLoaded({ id, exit: getExit(id) });
  const loading = false;
  const failure = exit ? null : { code: 404 }; // { code, message }
  const [modal, setModal] = useState(null); // "terms" | "cancel" | "rehire" | "confirm"
  const isOwner = !!STATIC_PERMISSION.isSuper;
  // Read-only when the selected year is closed + locked. Only the writes the
  // backend guards by the last working day's period (Edit terms, settlement
  // adjustments) also lock when that day's year is closed; rehire / cancel /
  // checklist / confirm (non-immediate) are not dated in a period.
  const lock = useYearLock();
  const lwdLock = useYearLock(exit?.notice?.last_working_day);
  const lockProps = { disabled: lock.locked, title: lock.title };

  // Cancel / rehire change the employee's access and approver duties on the
  // server — refresh the cached permission gates alongside the detail.
  const onAccessChanged = useCallback(
    (detail) => {
      setExit(detail);
    },
    [setExit],
  );

  const load = useCallback(() => setExit(getExit(id)), [id, setExit]);

  const reload = useCallback(() => load(), [load]);

  if (loading) return <Loader label={t("common.loading")} className="py-24" />;
  if (failure?.code === 404) return <StateBlock icon={MdOutlineSearchOff} textKey="detail.notFound" back />;
  if (failure?.code === 403) return <StateBlock icon={MdOutlineLock} textKey="common.notAllowed" back />;
  if (failure || !exit) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-24 px-4 gap-4">
        <p className="text-sm text-gray-600">{failure?.message || t("common.genericError")}</p>
        <button
          type="button"
          onClick={() => load()}
          className="px-4 py-2 text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg"
        >
          {t("detail.retry")}
        </button>
      </div>
    );
  }

  const inNotice = exit.status === "IN_NOTICE";
  const confirmation = exit.confirmation || {};
  // Confirm Termination / Resignation: open exits not yet confirmed. Locked
  // while required items are open — except for the owner (override in modal).
  const canConfirm = ["IN_NOTICE", "EXITED"].includes(exit.status) && !confirmation.confirmed;
  const openItems = openRequiredItems(exit);
  const confirmLocked = openItems.length > 0 && !isOwner;
  const lockedHint = confirmLocked ? t("detail.actions.lockedHint", { items: openItems.map((i) => i.label).join(", ") }) : null;
  const canRehire =
    ["EXITED", "COMPLETED"].includes(exit.status) &&
    !!exit.rehire?.eligible &&
    exit.employee?.employment_status !== "ACTIVE";

  return (
    <div className="space-y-6 pb-10">
      <Header
        exit={exit}
        actions={
          <>
            {inNotice && (
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
            {canConfirm && (
              <button
                type="button"
                onClick={() => setModal("confirm")}
                disabled={confirmLocked || lock.locked}
                title={lock.title || lockedHint || undefined}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <MdOutlineTaskAlt className="text-base" />
                {exit.exit_type === "TERMINATION" ? t("detail.actions.confirmTermination") : t("detail.actions.confirmResignation")}
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

      {canConfirm && confirmLocked && !lock.locked && <Banner tone="amber" icon={MdOutlineInfo} text={lockedHint} />}
      <ConfirmationBanner exit={exit} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6 min-w-0">
          <SummaryCard exit={exit} />
          <ChecklistPanel exit={exit} onUpdated={setExit} locked={lock.locked} lockTitle={lock.title} />
          <SettlementPanel exit={exit} onChanged={reload} locked={lwdLock.locked} lockTitle={lwdLock.title} />
        </div>
        <div className="space-y-6 min-w-0">
          <ExitDocumentsCard exit={exit} onChanged={reload} />
          <LwdPanel exit={exit} />
          <ActivityTimeline events={exit.events || []} />
        </div>
      </div>

      {modal === "terms" && !lwdLock.locked && <EditExitTermsModal exit={exit} onClose={() => setModal(null)} onSaved={setExit} />}
      {modal === "cancel" && !lock.locked && <CancelExitModal exit={exit} onClose={() => setModal(null)} onCancelled={onAccessChanged} />}
      {modal === "rehire" && !lock.locked && <RehireModal exit={exit} onClose={() => setModal(null)} onRehired={onAccessChanged} />}
      {modal === "confirm" && !lock.locked && <ConfirmExitModal exit={exit} onClose={() => setModal(null)} onConfirmed={onAccessChanged} />}
    </div>
  );
}

// ── banners ──────────────────────────────────────────────────────────────────
const TONES = {
  amber: "bg-amber-50 border-amber-200 text-amber-800",
  cyan: "bg-cyan-50 border-cyan-200 text-cyan-800",
  emerald: "bg-emerald-50 border-emerald-200 text-emerald-800",
};

function Banner({ tone, icon: Icon, text }) {
  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${TONES[tone]}`}>
      <Icon className="text-lg shrink-0 mt-0.5" />
      <p className="text-sm">{text}</p>
    </div>
  );
}

// Awaiting confirmation / waiting for the final payroll / ends on the LWD.
function ConfirmationBanner({ exit }) {
  const { t } = useTranslation("exits");
  const { fmtDate } = useFormat();
  const c = exit.confirmation || {};
  if (c.awaiting) return <Banner tone="amber" icon={MdOutlineHourglassEmpty} text={t("detail.banners.awaiting")} />;
  if (c.waiting_for_payroll) {
    const p = exit.settlement?.payroll;
    const month = p ? `${String(p.month).padStart(2, "0")}/${p.year}` : "—";
    return <Banner tone="cyan" icon={MdOutlineHourglassEmpty} text={t("detail.banners.waitingPayroll", { month })} />;
  }
  if (c.confirmed && exit.status === "IN_NOTICE") {
    return <Banner tone="emerald" icon={MdOutlineTaskAlt} text={t("detail.banners.confirmedOnLwd", { date: fmtDate(exit.notice?.last_working_day) })} />;
  }
  return null;
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
      v: exit.raised_by?.email ? <Ltr>{exit.raised_by.email}</Ltr> : "—",
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
  const n = exit.notice || {};
  const ext = Number(n.extended_days || 0);
  const changes = (exit.events || []).filter((e) => e.event_type === "LWD_EXTENDED" || e.event_type === "LWD_REVERTED");
  const left =
    exit.status === "IN_NOTICE"
      ? Math.max(Number(n.days_left ?? diffDays(n.last_working_day, todayYmd()) ?? 0), 0)
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
                  {e.actor?.email ? <Ltr>{e.actor.email}</Ltr> : t("detail.activity.system")}
                  {" · "}
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
