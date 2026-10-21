import { useState } from "react";
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
import { ScreenError } from "../../../components/ScreenState";
import { useFormat } from "../../../hooks/useFormat";
import useApiQuery from "../../../hooks/useApiQuery";
import { getInbox } from "../../../api/approvals";
import ApprovalDecisionModal from "../../../components/ApprovalDecisionModal";

const PAGE_SIZE = 10;

// Levels 1..total: the ones before the current level are done.
const levelsOf = (item) =>
  Array.from({ length: item.total_levels || 0 }, (_, i) => ({
    level_no: i + 1,
    pending: i + 1 < item.current_level ? 0 : 1,
    approved: i + 1 < item.current_level ? 1 : 0,
    total: 1,
  }));

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
  const { fmtDate } = useFormat();
  const { data, loading, error, reload } = useApiQuery(() => getInbox(), []);
  const allItems = data?.items || [];

  const [page, setPage] = useState(1);
  // { request, action: "APPROVE"|"REJECT" }
  const [modal, setModal] = useState(null);

  const total = allItems.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const items = allItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openAction = (item, action) => setModal({ request: item, action });

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
              ) : error ? (
                <tr>
                  <td colSpan={8} className="px-5 py-6">
                    <ScreenError error={error} onRetry={reload} />
                  </td>
                </tr>
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
                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-5 py-4 text-sm text-gray-700">
                        {(page - 1) * PAGE_SIZE + index + 1}
                      </td>
                      <td className="px-5 py-4 text-sm font-bold text-gray-900">
                        {item.employee?.name || "—"}
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-700">
                        {item.type}
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-700">
                        {item.requested_at ? fmtDate(String(item.requested_at).slice(0, 10)) : "—"}
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-700">—</td>
                      <td className="px-5 py-4 text-sm text-gray-700">—</td>
                      <td className="px-5 py-4">
                        <LevelProgress
                          levels={levelsOf(item)}
                          currentLevel={item.current_level}
                        />
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openAction(item, "APPROVE")}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-green-700 bg-green-50 border border-green-200 hover:bg-green-100 disabled:opacity-50 transition-colors"
                          >
                            <MdCheck className="text-sm" /> {t("inbox.approve")}
                          </button>
                          <button
                            onClick={() => openAction(item, "REJECT")}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 disabled:opacity-50 transition-colors"
                          >
                            <MdClose className="text-sm" /> {t("inbox.reject")}
                          </button>
                        </div>
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

      {/* Approve / Reject */}
      {modal && (
        <ApprovalDecisionModal
          request={modal.request}
          action={modal.action}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            reload();
          }}
        />
      )}
    </div>
  );
}