import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { MdAddCircleOutline, MdOutlineCancel, MdOutlinePayments } from "react-icons/md";
import Loader, { TableLoader } from "../../Loader";
import Pagination from "../../Pagination";
import ConfirmationModal from "../../ConfirmationModal";
import Ltr from "../../Ltr";
import { useFormat } from "../../../hooks/useFormat";
import useFiscalYear from "../../../hooks/useFiscalYear";
import { LS_MY_ENCASHMENTS } from "../../../data/groupD";
import { nextId, paginate } from "../../../data/common";
import RequestEncashmentModal from "./RequestEncashmentModal";
import { EncashAmount, EncashMonth, EncashStatusBadge } from "./encashmentUi";

const PAGE_SIZE = 5;

// "My encashment requests" card for the employee's leave page: the list
// (status, payout month, amount), cancel while pending, and the
// "Request encashment" button (hidden while viewing a locked year).
export default function MyEncashmentRequests() {
  const { t } = useTranslation("leaves");
  const { fmtDate } = useFormat();
  const fy = useFiscalYear();
  const [page, setPage] = useState(1);
  const [all, setAll] = useState(LS_MY_ENCASHMENTS);
  const loading = false;
  const { rows, total, totalPages } = paginate(all, page, PAGE_SIZE);
  const meta = { total, total_pages: totalPages };
  const [open, setOpen] = useState(false);
  const [cancelRow, setCancelRow] = useState(null);
  const cancelling = false;

  const confirmCancel = () => {
    if (!cancelRow) return;
    setAll((prev) =>
      prev.map((r) =>
        r.id === cancelRow.id
          ? { ...r, status: "CANCELLED", can_cancel: false, cancelled_at: new Date().toISOString() }
          : r,
      ),
    );
    toast.success(t("encashment.toast.cancelled"));
    setCancelRow(null);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden" data-testid="my-encashments">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-cyan-50 flex items-center justify-center">
            <MdOutlinePayments className="text-cyan-600 text-lg" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">{t("encashment.my.title")}</h2>
            <p className="text-xs text-gray-400">{t("encashment.my.subtitle")}</p>
          </div>
        </div>
        {!fy.isLocked && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm transition-colors"
          >
            <MdAddCircleOutline className="text-lg" /> {t("encashment.my.request")}
          </button>
        )}
      </div>

      {/* Desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              {[
                t("encashment.table.leaveType"),
                t("encashment.table.days"),
                t("encashment.table.payoutMonth"),
                t("encashment.table.amount"),
                t("encashment.table.status"),
                t("encashment.table.requestedOn"),
                t("encashment.table.action"),
              ].map((h) => (
                <th key={h} className="text-start px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <TableLoader colSpan={7} />
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-sm text-gray-400">
                  {t("encashment.my.empty")}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200">
                      {r.leave_type?.name || "—"}
                    </span>
                    {r.reject_reason && <p className="text-xs text-red-500 mt-1">{r.reject_reason}</p>}
                  </td>
                  <td className="px-5 py-3.5 text-sm font-bold text-gray-900">
                    <Ltr>{r.days}</Ltr>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-700">
                    <EncashMonth value={r.payout_month} />
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-900 font-semibold">
                    <EncashAmount value={r.amount} currency={r.currency} />
                  </td>
                  <td className="px-5 py-3.5">
                    <EncashStatusBadge status={r.status} />
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-500">
                    <Ltr>{fmtDate(r.created_at)}</Ltr>
                  </td>
                  <td className="px-5 py-3.5">
                    {r.can_cancel ? (
                      <button
                        type="button"
                        onClick={() => setCancelRow(r)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors"
                      >
                        <MdOutlineCancel className="text-sm" /> {t("encashment.my.cancel")}
                      </button>
                    ) : (
                      <span className="text-gray-300 text-sm">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="md:hidden divide-y divide-gray-100">
        {loading ? (
          <Loader />
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-400">{t("encashment.my.empty")}</div>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="px-4 py-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-gray-900">{r.leave_type?.name || "—"}</span>
                <EncashStatusBadge status={r.status} />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                <span>
                  {t("encashment.table.days")}: <strong className="text-gray-800"><Ltr>{r.days}</Ltr></strong>
                </span>
                <span>
                  {t("encashment.table.payoutMonth")}: <strong className="text-gray-800"><EncashMonth value={r.payout_month} /></strong>
                </span>
                <span>
                  {t("encashment.table.amount")}: <strong className="text-gray-800"><EncashAmount value={r.amount} currency={r.currency} /></strong>
                </span>
              </div>
              {r.can_cancel && (
                <button
                  type="button"
                  onClick={() => setCancelRow(r)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-700 bg-red-50 border border-red-200"
                >
                  <MdOutlineCancel className="text-sm" /> {t("encashment.my.cancel")}
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {meta.total > PAGE_SIZE && (
        <Pagination
          page={page}
          totalPages={meta.total_pages}
          total={meta.total}
          limit={PAGE_SIZE}
          onPage={setPage}
          label={t("encashment.my.label")}
        />
      )}

      <RequestEncashmentModal
        open={open}
        mode="SELF"
        onClose={() => setOpen(false)}
        onDone={(created) => {
          setOpen(false);
          if (created) setAll((prev) => [{ ...created, id: nextId(prev) }, ...prev]);
          if (page !== 1) setPage(1);
        }}
      />
      <ConfirmationModal
        isOpen={!!cancelRow}
        onClose={() => !cancelling && setCancelRow(null)}
        onConfirm={confirmCancel}
        title={t("encashment.my.cancelTitle")}
        message={t("encashment.my.cancelMessage", { days: cancelRow?.days ?? "", type: cancelRow?.leave_type?.name || "" })}
        type="warning"
        confirmText={t("encashment.my.cancelConfirm")}
        cancelText={t("encashment.my.keep")}
        isLoading={cancelling}
      />
    </div>
  );
}
