import { useState } from "react";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import {
  MdChevronLeft,
  MdChevronRight,
  MdCheck,
  MdClose,
  MdCheckCircle,
  MdRadioButtonChecked,
  MdRadioButtonUnchecked,
} from "react-icons/md";
import { TableLoader } from "../../../components/Loader";
import Ltr from "../../../components/Ltr";
import { useFormat } from "../../../hooks/useFormat";
import { encashMonthLabel } from "../../../utils/fyValidation/encashment";
import { APPROVAL_INBOX } from "../../../data/groupH";
import { paginate } from "../../../data/common";

const PAGE_SIZE = 10;

// Level progress from levels_summary + current_level.
function LevelProgress({ levels = [], currentLevel }) {
  const { t } = useTranslation("approvals");
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
            title={t("inbox.levelTooltip", {
              level: lvl.level_no,
              approved: lvl.approved,
              total: lvl.total,
            })}
          >
            <Icon className={`text-base ${color}`} />
            <span className="text-[10px] text-gray-400">L{lvl.level_no}</span>
          </span>
        );
      })}
    </div>
  );
}

export default function ApprovalInbox() {
  const { t } = useTranslation("approvals");
  const { fmtDate, fmtNumber } = useFormat();
  const [allItems, setAllItems] = useState(APPROVAL_INBOX);
  const loading = false;
  const actionLoadingId = null;

  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null); // { id, action: "APPROVE"|"REJECT" }
  const [comment, setComment] = useState("");

  const { rows: items, total, totalPages } = paginate(allItems, page, PAGE_SIZE);

  const openAction = (id, action) => {
    setComment("");
    setModal({ id, action });
  };

  const closeAction = () => {
    if (actionLoadingId) return; // don't close mid-submit
    setModal(null);
    setComment("");
  };

  const submitAction = () => {
    if (!modal) return;
    if (modal.action === "REJECT" && !comment.trim()) {
      toast.error(t("inbox.toast.reasonRequiredToReject"));
      return;
    }
    // An acted-on request leaves the pending inbox.
    setAllItems((prev) =>
      prev.filter((i) => i.approval_request_id !== modal.id),
    );
    toast.success(t("inbox.toast.done"));
    setModal(null);
    setComment("");
  };

  const visiblePages = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (page <= 3) {
        pages.push(1, 2, 3, 4, "...", totalPages);
      } else if (page >= totalPages - 2) {
        pages.push(1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, "...", page - 1, page, page + 1, "...", totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
          {t("inbox.title")}
        </h1>
        <p className="text-gray-400 mt-1 text-sm">
          {t("inbox.subtitle")}
        </p>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {[
                  t("inbox.table.sn"),
                  t("inbox.table.employee"),
                  t("inbox.table.requestType"),
                  t("inbox.table.dateFrom"),
                  t("inbox.table.toTime"),
                  t("inbox.table.duration"),
                  t("inbox.table.level"),
                  t("inbox.table.action"),
                ].map((h) => (
                  <th
                    key={h}
                    className="text-start px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <TableLoader colSpan={8} label={t("inbox.loading")} />
              ) : items.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="py-12 text-center text-sm text-gray-400"
                  >
                    {t("inbox.noPending")}
                  </td>
                </tr>
              ) : (
                items.map((item, index) => {
                  const rowBusy = actionLoadingId === item.approval_request_id;
                  return (
                    <tr
                      key={item.approval_request_id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-5 py-4 text-sm text-gray-700">
                        {(page - 1) * PAGE_SIZE + index + 1}
                      </td>
                      <td className="px-5 py-4 text-sm font-bold text-gray-900">
                        {item.employee_name || "—"}
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-700">
                        {item.entity_type === "LEAVE_REQUEST"
                          ? item.leave_type || t("inbox.types.leave")
                          : item.entity_type === "LEAVE_ENCASHMENT"
                            ? t("inbox.types.leaveEncashment", { type: item.leave_type || "" })
                          : item.entity_type === "OVERTIME_REQUEST"
                            ? t("inbox.types.overtime")
                            : item.entity_type === "ATTENDANCE_CORRECTION"
                              ? t("inbox.types.attendanceCorrection")
                              : item.entity_type}
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-700">
                        {item.entity_type === "LEAVE_REQUEST"
                          ? fmtDate(item.from_date)
                          : item.entity_type === "LEAVE_ENCASHMENT"
                            ? <Ltr>{t("inbox.payoutMonth", { month: encashMonthLabel(item.payout_month) })}</Ltr>
                          : fmtDate(item.work_date)}
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-700">
                        {item.entity_type === "LEAVE_REQUEST"
                          ? fmtDate(item.to_date)
                          : item.entity_type === "LEAVE_ENCASHMENT"
                            ? <Ltr>{item.amount !== null && item.amount !== undefined ? `${item.currency ? `${item.currency} ` : ""}${fmtNumber(item.amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}</Ltr>
                          : item.entity_type === "OVERTIME_REQUEST"
                            ? `${item.start_time || "—"} - ${item.end_time || "—"}`
                            : item.entity_type === "ATTENDANCE_CORRECTION"
                              ? `${item.check_in_time || "—"} - ${item.check_out_time || "—"}`
                              : "—"}
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-700">
                        {item.entity_type === "LEAVE_REQUEST" || item.entity_type === "LEAVE_ENCASHMENT"
                          ? t("inbox.durationDays", { days: item.total_days ?? "—" })
                          : item.entity_type === "OVERTIME_REQUEST"
                            ? t("inbox.durationHours", { hours: item.overtime_hours ?? "—" })
                            : "—"}
                      </td>
                      <td className="px-5 py-4">
                        <LevelProgress
                          levels={item.levels_summary}
                          currentLevel={item.current_level}
                        />
                      </td>
                      <td className="px-5 py-4">
                        {item.can_act || item.can_reject ? (
                          <div className="flex items-center gap-2">
                            {/* A request in a closed period (locked FY/month)
                                can't be approved, only rejected. */}
                            {item.can_act ? (
                              <button
                                onClick={() =>
                                  openAction(item.approval_request_id, "APPROVE")
                                }
                                disabled={rowBusy}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-green-700 bg-green-50 border border-green-200 hover:bg-green-100 disabled:opacity-50 transition-colors"
                              >
                                <MdCheck className="text-sm" /> {t("inbox.approve")}
                              </button>
                            ) : (
                              <span
                                title={t("inbox.periodClosedRejectOnly")}
                                className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold text-gray-600 bg-gray-50 border border-gray-200"
                              >
                                {t("inbox.periodClosedRejectOnly")}
                              </span>
                            )}
                            <button
                              onClick={() =>
                                openAction(item.approval_request_id, "REJECT")
                              }
                              disabled={rowBusy}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 disabled:opacity-50 transition-colors"
                            >
                              <MdClose className="text-sm" /> {t("inbox.reject")}
                            </button>
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200">
                            {t("inbox.waitingForLevel", {
                              level: item.current_level,
                            })}
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

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-gray-100">
          <p className="text-sm text-gray-400 order-2 sm:order-1">
            {t("inbox.showing")}{" "}
            <span className="font-semibold text-gray-600">
              {total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, total)}
            </span>{" "}
            {t("inbox.of")}{" "}
            <span className="font-semibold text-gray-600">{total}</span>
          </p>
          <div className="flex items-center gap-1 order-1 sm:order-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-8 h-8 flex items-center justify-center rounded-md border border-gray-200 text-gray-400 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <MdChevronLeft className="rtl:rotate-180" />
            </button>
            {visiblePages().map((n, i) =>
              n === "..." ? (
                <span
                  key={`ellipsis-${i}`}
                  className="px-1 text-gray-400 text-sm"
                >
                  ...
                </span>
              ) : (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`w-8 h-8 flex items-center justify-center rounded-md text-sm font-medium transition-colors ${
                    page === n
                      ? "bg-cyan-600 text-white"
                      : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {n}
                </button>
              ),
            )}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="w-8 h-8 flex items-center justify-center rounded-md border border-gray-200 text-gray-400 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <MdChevronRight className="rtl:rotate-180" />
            </button>
          </div>
        </div>
      </div>

      {/* Approve / Reject modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <p className="text-base font-bold text-gray-900">
                {modal.action === "APPROVE"
                  ? t("inbox.approveRequest")
                  : t("inbox.rejectRequest")}
              </p>
              <button
                onClick={closeAction}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-40"
                disabled={!!actionLoadingId}
              >
                <MdClose className="text-xl" />
              </button>
            </div>

            <div className="px-5 py-5 space-y-3">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                {modal.action === "REJECT"
                  ? t("inbox.reasonRequired")
                  : t("inbox.commentOptional")}
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder={
                  modal.action === "REJECT"
                    ? t("inbox.rejectPlaceholder")
                    : t("inbox.commentPlaceholder")
                }
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <button
                onClick={closeAction}
                disabled={!!actionLoadingId}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
              >
                {t("inbox.cancel")}
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
                {actionLoadingId ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : modal.action === "APPROVE" ? (
                  t("inbox.approve")
                ) : (
                  t("inbox.reject")
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}