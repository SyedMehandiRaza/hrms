import { useCallback, useState } from "react";
import { toast } from "react-toastify";
import { MdOutlineFactCheck } from "react-icons/md";
import {
  visaInbox,
  actVisa as actVisaApi,
  tripInbox,
  approveTrip as approveTripApi,
  rejectTrip as rejectTripApi,
} from "../../data/groupG";
import ConfirmationModal from "../../components/ConfirmationModal";
import { useTranslation } from "react-i18next";

const TYPE_LABELS = {
  SINGLE_EXIT: "types.SINGLE_EXIT",
  MULTIPLE_EXIT: "types.MULTIPLE_EXIT",
  FINAL_EXIT: "types.FINAL_EXIT",
};

// The approver's list shows what was REQUESTED (nothing is issued yet), which
// for a final exit is a single departure date rather than a range.
const requestedLabel = (v) =>
  v.visa_type === "FINAL_EXIT"
    ? v.final_exit_date || "—"
    : v.requested_from
      ? `${v.requested_from} → ${v.requested_to || "—"}`
      : "—";
const dash = (v) => v || "—";

const VisaApprovals = () => {
  const { t } = useTranslation("visa");
  const typeLabel = (type) => t(TYPE_LABELS[type] || "types.SINGLE_EXIT");
  const [rows, setRows] = useState(() => visaInbox());
  const [trips, setTrips] = useState(() => tripInbox());
  const loading = false;
  const [busyId, setBusyId] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [rejectFor, setRejectFor] = useState(null); // { kind: 'visa'|'trip', id, tripId }
  const [rejectReason, setRejectReason] = useState("");
  const load = useCallback(() => {
    setRows(visaInbox());
    setTrips(tripInbox());
  }, []);

  const run = async (id, fn, msg) => {
    setBusyId(id);
    try {
      await fn();
      toast.success(msg);
      setConfirm(null);
      setRejectFor(null);
      setRejectReason("");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || t("toast.actionFailed"));
    } finally {
      setBusyId(null);
    }
  };

  const approve = (id) =>
    setConfirm({
      title: t("confirm.approveVisaTitle"),
      message: t("confirm.approveVisaMessage"),
      action: () => run(id, () => actVisaApi(id, "APPROVE", ""), t("toast.visaApproved")),
    });

  const approveTrip = (trip) =>
    setConfirm({
      title: t("confirm.approveTripTitle"),
      message: t("confirm.approveTripMessage"),
      action: () => run(`t${trip.id}`, () => approveTripApi(trip.visa_id, trip.id), t("toast.tripApproved")),
    });

  const submitReject = () => {
    if (!rejectReason.trim()) {
      toast.error(t("validation.rejectionReasonRequired"));
      return;
    }
    if (rejectFor?.kind === "trip") {
      run(`t${rejectFor.tripId}`, () => rejectTripApi(rejectFor.id, rejectFor.tripId, rejectReason.trim()), t("toast.tripRejected"));
    } else {
      run(rejectFor.id, () => actVisaApi(rejectFor.id, "REJECT", rejectReason.trim()), t("toast.visaRejected"));
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 text-cyan-600">
          <MdOutlineFactCheck className="text-2xl" />
          <span className="text-sm font-semibold">{t("eyebrow")}</span>
        </div>
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">{t("approvals.title")}</h1>
        <p className="text-sm text-gray-500 mt-1">{t("approvals.subtitle")}</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-[#F8F9FE]">
                {["employee", "type", "requestedPeriod", "maxExits", "level", "actions"].map((h) => (
                  <th key={h} className="text-start px-5 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    {t(`table.${h}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan="6" className="px-5 py-12 text-center text-sm text-gray-400">{t("loading")}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan="6" className="px-5 py-12 text-center text-sm text-gray-400">{t("approvals.empty")}</td></tr>
              ) : (
                rows.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="text-sm font-bold text-gray-900">{dash(v.employee?.name)}</div>
                      <div className="text-[11px] text-gray-500">{dash(v.employee?.code)}</div>
                      {v.reason && <div className="text-[11px] text-gray-400 mt-0.5 max-w-[220px] truncate" title={v.reason}>{v.reason}</div>}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-700">{typeLabel(v.visa_type)}</td>
                    <td className="px-5 py-4 text-sm text-gray-600">{requestedLabel(v)}</td>
                    <td className="px-5 py-4 text-sm text-gray-700">{v.max_exits}</td>
                    <td className="px-5 py-4 text-sm text-gray-600">{v.approval ? `${v.approval.current_level}/${v.approval.total_levels}` : "—"}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setRejectFor({ kind: "visa", id: v.id })} disabled={busyId === v.id} className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 disabled:opacity-50">{t("actions.reject")}</button>
                        <button onClick={() => approve(v.id)} disabled={busyId === v.id} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50">{t("actions.approve")}</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending Trips (exits) awaiting approval */}
      <div>
        <h2 className="text-base font-bold text-gray-900 mb-2">{t("approvals.pendingTrips")}</h2>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left">
              <thead>
                <tr className="border-b border-gray-100 bg-[#F8F9FE]">
                  {["employee", "visaType", "departure", "expectedReturn", "actions"].map((h) => (
                    <th key={h} className="text-start px-5 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                      {t(`table.${h}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan="5" className="px-5 py-10 text-center text-sm text-gray-400">{t("loading")}</td></tr>
                ) : trips.length === 0 ? (
                  <tr><td colSpan="5" className="px-5 py-10 text-center text-sm text-gray-400">{t("approvals.tripsEmpty")}</td></tr>
                ) : (
                  trips.map((trip) => (
                    <tr key={trip.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="text-sm font-bold text-gray-900">{dash(trip.employee?.name)}</div>
                        <div className="text-[11px] text-gray-500">{dash(trip.employee?.code)}</div>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-700">{typeLabel(trip.visa_type)}</td>
                      <td className="px-5 py-4 text-sm text-gray-700">{dash(trip.departure_date)}</td>
                      <td className="px-5 py-4 text-sm text-gray-600">{dash(trip.expected_return_date)}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button onClick={() => setRejectFor({ kind: "trip", id: trip.visa_id, tripId: trip.id })} disabled={busyId === `t${trip.id}`} className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 disabled:opacity-50">{t("actions.reject")}</button>
                          <button onClick={() => approveTrip(trip)} disabled={busyId === `t${trip.id}`} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50">{t("actions.approve")}</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm?.action?.()}
        title={confirm?.title}
        message={confirm?.message}
        type="success"
        confirmText={t("actions.approve")}
        cancelText={t("actions.cancel")}
        isLoading={busyId != null}
      />

      {rejectFor != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">{rejectFor?.kind === "trip" ? t("reject.tripTitle") : t("reject.visaTitle")}</h3>
            <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={4} placeholder={t("reject.placeholder")} className="mt-4 w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-red-400" />
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => { setRejectFor(null); setRejectReason(""); }} className="px-4 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50">{t("actions.cancel")}</button>
              <button onClick={submitReject} disabled={busyId != null} className="px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50">{t("actions.reject")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VisaApprovals;
