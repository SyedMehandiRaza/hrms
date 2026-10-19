import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import {
  MdCheck,
  MdClose,
  MdCheckCircle,
  MdRadioButtonChecked,
  MdRadioButtonUnchecked,
  MdOutlineSearch,
  MdOutlineClear,
} from "react-icons/md";
import Pagination from "../Pagination";
import FieldError from "../FieldError";
import useFiscalYear from "../../hooks/useFiscalYear";
import { lockedYearOf } from "../../hooks/useYearLock";

import { ATT_CORRECTION_INBOX, ATT_OVERTIME_INBOX } from "../../data/groupD";
import { matches, paginate } from "../../data/common";

// Per-module wiring so this one panel serves both overtime and correction.
const MODULES = {
  overtime: {
    rows: ATT_OVERTIME_INBOX,
    detailLabelKey: "approvalPanel.columns.hours",
    detail: (it) => (it.overtime_hours != null ? `${it.overtime_hours}h` : "—"),
  },
  correction: {
    rows: ATT_CORRECTION_INBOX,
    detailLabelKey: "approvalPanel.columns.reason",
    detail: (it) => it.reason || "—",
  },
};

// Level progress badges from levels_summary + current_level (mirrors leave inbox).
function LevelProgress({ levels = [], currentLevel }) {
  const { t } = useTranslation("attendance");
  if (!levels.length) return <span className="text-gray-400 text-xs">—</span>;
  return (
    <div className="flex items-center gap-1">
      {levels.map((lvl) => {
        const done = lvl.level_no < currentLevel || lvl.pending === 0;
        const current = lvl.level_no === currentLevel && lvl.pending > 0;
        const Icon = done
          ? MdCheckCircle
          : current
            ? MdRadioButtonChecked
            : MdRadioButtonUnchecked;
        const color = done
          ? "text-green-500"
          : current
            ? "text-cyan-500"
            : "text-gray-300";
        return (
          <span
            key={lvl.level_no}
            className="flex items-center gap-0.5"
            title={t("approvalPanel.levelTooltip", { level: lvl.level_no, approved: lvl.approved, total: lvl.total })}
          >
            <Icon className={`text-base ${color}`} />
            <span className="text-[10px] text-gray-400">{t("approvalPanel.levelShort", { level: lvl.level_no })}</span>
          </span>
        );
      })}
    </div>
  );
}

const fmt = (d) => (d ? new Date(d).toLocaleDateString() : "—");

// Same limits as the backend approveSchema / rejectSchema (1000 chars; a
// reject needs a reason).
const NOTE_MAX = 1000;

// Approver panel: pending requests for the logged-in approval-group member, with
// level-wise gating — approve/reject only enabled when it's this level's turn.
export default function ApprovalRequestsPanel({ module }) {
  const { t } = useTranslation("attendance");
  const cfg = MODULES[module];
  const [items, setItems] = useState(cfg.rows);
  const actionLoadingId = null;
  const [modal, setModal] = useState(null); // { id, action }
  const [comment, setComment] = useState("");
  const [commentError, setCommentError] = useState("");
  const [page, setPage] = useState(1);
  const fy = useFiscalYear();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const limit = 10;

  useEffect(() => {
    const id = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(id);
  }, [searchInput]);

  // Search + paging, client-side on the static inbox.
  const list = useMemo(
    () => paginate(items.filter((it) => matches(it, search, ["employee_name", "reason"])), page, limit),
    [items, search, page],
  );
  const pending = list.rows;
  const pendingLoading = false;
  const pendingTotal = list.total;
  const pendingTotalPages = list.totalPages;

  // Apply this approver's decision to the local inbox row.
  const applyDecision = (entityId, action) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.entity_id !== entityId) return it;
        const approved = action === "APPROVE";
        const lastLevel = Math.max(...(it.levels_summary || []).map((l) => l.level_no), it.current_level);
        const levels_summary = (it.levels_summary || []).map((l) =>
          l.level_no === it.current_level
            ? { ...l, pending: 0, approved: approved ? l.approved + 1 : l.approved }
            : l,
        );
        return {
          ...it,
          levels_summary,
          can_act: false,
          can_reject: false,
          my_action_status: approved ? "APPROVED" : "REJECTED",
          current_level: approved && it.current_level < lastLevel ? it.current_level + 1 : it.current_level,
          final_status: !approved ? "REJECTED" : it.current_level >= lastLevel ? "APPROVED" : "PENDING",
        };
      }),
    );
  };

  const openAction = (id, action) => {
    setComment("");
    setCommentError("");
    setModal({ id, action });
  };

  const closeAction = () => {
    if (actionLoadingId) return;
    setModal(null);
    setComment("");
    setCommentError("");
  };

  const submitAction = () => {
    if (!modal) return;
    if (modal.action === "REJECT" && !comment.trim()) {
      setCommentError(t("approvalPanel.toast.reasonRequiredToReject"));
      return;
    }
    if (comment.trim().length > NOTE_MAX) {
      setCommentError(t("fiscalYear:time.validation.noteMax", { max: NOTE_MAX }));
      return;
    }
    setCommentError("");
    applyDecision(modal.id, modal.action);
    toast.success(t("approvalPanel.toast.done"));
    setModal(null);
    setComment("");
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="p-4 border border-gray-200 rounded-xl bg-white flex flex-wrap items-end gap-4 justify-between">
        <div className="flex-1 min-w-[200px] max-w-sm">
          <label className="block text-[11px] font-bold text-gray-500 tracking-wider uppercase mb-2">
            {t("common.search")}
          </label>
          <div className="relative">
            <MdOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t("approvalPanel.searchPlaceholder")}
              className="w-full border border-gray-200 text-gray-700 text-sm font-medium rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#17a2b8] h-[42px]"
            />
          </div>
        </div>
        <div>
          <button 
            onClick={() => {
              setSearchInput("");
              setPage(1);
            }}
            className="w-full sm:w-auto flex justify-center items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-2 rounded-lg font-medium text-sm transition-colors h-[42px]"
          >
            <MdOutlineClear className="text-lg" />
            {t("common.clearFilters")}
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">{t("approvalPanel.title")}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {t("approvalPanel.subtitle")}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="border-b border-gray-200">
              {[t("approvalPanel.columns.sno"), t("approvalPanel.columns.employee"), t("approvalPanel.columns.date"), t(cfg.detailLabelKey), t("approvalPanel.columns.level"), t("approvalPanel.columns.action")].map((h) => (
                <th
                  key={h}
                  className="py-4 px-6 text-[11px] font-bold text-gray-500 tracking-wider uppercase"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pendingLoading && pending.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-sm text-gray-400">
                  {t("common.loadingEllipsis")}
                </td>
              </tr>
            ) : pending.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-sm text-gray-400">
                  {t("approvalPanel.empty")}
                </td>
              </tr>
            ) : (
              pending.map((it, index) => {
                const rowBusy = actionLoadingId === it.entity_id;
                // Read-only when the request's date is in a closed + locked year.
                const lockedYear = lockedYearOf(fy.years, it.work_date);
                // can_act = may approve now; can_reject = may reject now (a
                // closed period still allows REJECT on the backend).
                const canReject = it.can_reject ?? it.can_act;
                const approveBlocked = !it.can_act || !!lockedYear;
                const lockTitle = lockedYear
                  ? t("fiscalYear:locked.tooltip", { label: lockedYear.label })
                  : approveBlocked
                    ? t("approvals:inbox.periodClosedRejectOnly")
                    : undefined;
                return (
                  <tr
                    key={it.approval_request_id}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50/80 transition-colors"
                  >
                    <td className="py-4 px-6 text-[13px] font-medium text-gray-600">
                      {String((page - 1) * limit + index + 1).padStart(2, '0')}
                    </td>
                    <td className="py-4 px-6 text-[13px] font-bold text-gray-900">
                      {it.employee_name || "—"}
                    </td>
                    <td className="py-4 px-6 text-[13px] text-gray-700">
                      {fmt(it.work_date)}
                    </td>
                    <td className="py-4 px-6 text-[13px] text-gray-700">
                      {cfg.detail(it)}
                    </td>
                    <td className="py-4 px-6">
                      <LevelProgress
                        levels={it.levels_summary}
                        currentLevel={it.current_level}
                      />
                    </td>
                    <td className="py-4 px-6">
                      {canReject ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openAction(it.entity_id, "APPROVE")}
                            disabled={rowBusy || approveBlocked}
                            title={lockTitle}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-green-700 bg-green-50 border border-green-200 hover:bg-green-100 disabled:opacity-50 transition-colors"
                          >
                            <MdCheck className="text-sm" /> {t("common.approve")}
                          </button>
                          <button
                            onClick={() => openAction(it.entity_id, "REJECT")}
                            disabled={rowBusy}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 disabled:opacity-50 transition-colors"
                          >
                            <MdClose className="text-sm" /> {t("common.reject")}
                          </button>
                        </div>
                      ) : it.my_action_status === "APPROVED" ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold text-green-700 bg-green-50 border border-green-200">
                          {t("approvalPanel.approvedByYou")}
                        </span>
                      ) : it.my_action_status === "REJECTED" ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200">
                          {t("approvalPanel.rejectedByYou")}
                        </span>
                      ) : it.final_status === "APPROVED" ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold text-green-700 bg-green-50 border border-green-200">
                          {t("approvalPanel.approved")}
                        </span>
                      ) : it.final_status === "REJECTED" ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200">
                          {t("approvalPanel.rejected")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200">
                          {t("approvalPanel.waitingForLevel", { level: it.current_level })}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      
      <Pagination
        page={page}
        totalPages={pendingTotalPages || 1}
        total={pendingTotal || 0}
        limit={limit}
        onPage={setPage}
        label={t("common.requestsLabel")}
      />
      </div>

      {/* Approve / Reject modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <p className="text-base font-bold text-gray-900">
                {modal.action === "APPROVE" ? t("common.approveRequest") : t("common.rejectRequest")}
              </p>
              <button
                onClick={closeAction}
                disabled={!!actionLoadingId}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-40"
              >
                <MdClose className="text-xl" />
              </button>
            </div>

            <div className="px-5 py-5 space-y-3">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                {modal.action === "REJECT" ? t("approvalPanel.reasonRequiredLabel") : t("approvalPanel.commentOptional")}
              </label>
              <textarea
                value={comment}
                onChange={(e) => {
                  setComment(e.target.value);
                  if (commentError) setCommentError("");
                }}
                rows={3}
                placeholder={
                  modal.action === "REJECT"
                    ? t("approvalPanel.rejectPlaceholder")
                    : t("approvalPanel.commentPlaceholder")
                }
                className={`w-full border rounded-lg px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 ${commentError ? "border-red-300 bg-red-50" : "border-gray-200"}`}
              />
              <FieldError message={commentError} />
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <button
                onClick={closeAction}
                disabled={!!actionLoadingId}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={submitAction}
                disabled={
                  !!actionLoadingId ||
                  (modal.action === "REJECT" && !comment.trim())
                }
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-colors ${
                  modal.action === "APPROVE"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {actionLoadingId
                  ? t("approvalPanel.working")
                  : modal.action === "APPROVE"
                    ? t("common.approve")
                    : t("common.reject")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
