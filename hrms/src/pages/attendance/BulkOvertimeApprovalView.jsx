import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MdOutlineCancel, MdCheckCircleOutline } from "react-icons/md";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import RejectOvertimeModal from "../../components/RejectOvertimeModal";
import LevelProgress from "../../components/LevelProgress";
import { OT_REQUESTS, OT_approve, OT_reject, OT_saveRequests } from "../../data/groupD";
import useYearLock from "../../hooks/useYearLock";

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "—");
const initialsOf = (name) =>
  (name || "?")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

export default function BulkOvertimeApprovalView() {
  const { t } = useTranslation("attendance");
  const statusText = (s) => t(`requestStatus.${s}`, { defaultValue: s });
  const [params] = useSearchParams();
  const batchId = params.get("batch");

  const [requests, setRequests] = useState(() =>
    batchId ? OT_REQUESTS.filter((r) => r.batch_id === batchId) : [],
  );
  // Everyone selected by default; approver deselects to exclude (→ reject).
  const [selected, setSelected] = useState(() => new Set(requests.map((r) => r.id))); // entity ids to approve
  const loading = false;
  const busy = false;
  // null = not open; "reject-all" or "reject-deselected" decides scope
  const [rejectMode, setRejectMode] = useState(null);
  // A batch shares one work date: read-only when it's in a closed + locked year.
  const lock = useYearLock(requests[0]?.work_date);

  // Apply decided rows locally (and to the shared static store), then reset
  // the selection like the original reload did.
  const applyRows = (changed) => {
    const byId = new Map(changed.map((r) => [r.id, r]));
    const rows = requests.map((r) => byId.get(r.id) || r);
    setRequests(rows);
    setSelected(new Set(rows.map((r) => r.id)));
    OT_saveRequests(OT_REQUESTS.map((r) => byId.get(r.id) || r));
  };

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected((prev) =>
      prev.size === requests.length ? new Set() : new Set(requests.map((r) => r.id)),
    );

  // Requests the logged-in user may act on right now.
  const actable = requests.filter((r) => r.can_act && r.final_status !== "APPROVED" && r.final_status !== "REJECTED");
  const selectedActable = actable.filter((r) => selected.has(r.id));
  const deselectedActable = actable.filter((r) => !selected.has(r.id));
  const canApprove = selectedActable.length > 0;

  // Run approvals for the selected; rejections (with reason) for the deselected.
  const runDecision = (reason) => {
    applyRows([
      ...selectedActable.map((r) => OT_approve(r)),
      ...(reason ? deselectedActable.map((r) => OT_reject(r, reason)) : []),
    ]);
    toast.success(t("bulk.toast.decisionRecorded"));
  };

  const onApprove = () => {
    if (!canApprove) return;
    if (deselectedActable.length > 0) {
      // Deselected employees get rejected → need a reason.
      setRejectMode("reject-deselected");
    } else {
      runDecision(null);
    }
  };

  // Footer Reject = reject everyone the user can act on.
  const onRejectAll = (reason) => {
    applyRows(actable.map((r) => OT_reject(r, reason)));
    toast.success(t("bulk.toast.requestsRejected"));
  };

  const onRejectConfirm = (reason) => {
    if (rejectMode === "reject-all") onRejectAll(reason);
    else runDecision(reason); // reject-deselected + approve selected
    setRejectMode(null);
  };

  const first = requests[0] || {};
  // Level shown near the action buttons (representative current level of the batch).
  const levelReq = actable[0] || first;

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 bg-[#f8f9fc] min-h-screen rounded-xl border border-gray-200">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm font-bold mb-6">
        <Link to="/admin/attendance/request" className="text-gray-500 hover:text-gray-700">
          {t("bulk.breadcrumbOvertime")}
        </Link>
        <span className="text-gray-400">›</span>
        <span className="text-[#17a2b8]">{t("bulk.breadcrumbBulk")}</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("bulk.title")}</h1>
          <p className="text-gray-500 mt-1 text-sm font-medium">
            {t("bulk.subtitle")}
          </p>
        </div>
      </div>

      {!batchId ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm text-gray-500">
          {t("bulk.noBatch")}
        </div>
      ) : (
        <>
          {/* Card 1: Request Information */}
          <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white">
            <div className="flex items-center justify-between px-6 py-4 bg-[#f8f9fc] border-b border-gray-200">
              <h2 className="text-[15px] font-bold text-gray-800">{t("bulk.requestInfo")}</h2>
              <span className="bg-[#fef3c7] text-[#92400e] text-[10px] font-bold px-3 py-1.5 rounded uppercase tracking-wide flex items-center gap-1.5 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-[#d97706]"></span> {t("bulk.pendingApproval")}
              </span>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-y-6 gap-x-8 mb-6">
                <div>
                  <p className="text-[11px] font-bold text-gray-500 tracking-wider uppercase mb-1">{t("common.overtimeDate")}</p>
                  <p className="text-[13px] font-bold text-gray-900">{fmtDate(first.work_date)}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-gray-500 tracking-wider uppercase mb-1">{t("bulk.time")}</p>
                  <p className="text-[13px] font-bold text-gray-900">{first.start_time} – {first.end_time}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-gray-500 tracking-wider uppercase mb-1">{t("bulk.overtimeHours")}</p>
                  <p className="text-[13px] font-bold text-gray-900">{t("bulk.hoursValue", { hours: first.overtime_hours })}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-gray-500 tracking-wider uppercase mb-1">{t("bulk.employees")}</p>
                  <p className="text-[13px] font-bold text-gray-900">{requests.length}</p>
                </div>
              </div>
              {first.reason && (
                <div>
                  <p className="text-[11px] font-bold text-gray-500 tracking-wider uppercase mb-2">{t("bulk.overtimeReason")}</p>
                  <div className="bg-[#f8f9fc] rounded-lg p-5 border border-gray-100">
                    <p className="text-[13.5px] italic text-gray-700 font-medium leading-relaxed">"{first.reason}"</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Selected Employees */}
          <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <div className="flex items-center justify-between px-6 py-4 bg-[#f8f9fc] border-b border-gray-200">
              <h2 className="text-[15px] font-bold text-gray-800">{t("bulk.selectedEmployees", { selected: selected.size, total: requests.length })}</h2>
            </div>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[640px]">
                <thead>
                  <tr className="bg-[#fcfdff] border-b border-gray-200">
                    <th className="py-4 px-6 w-12">
                      <input
                        type="checkbox"
                        checked={requests.length > 0 && selected.size === requests.length}
                        onChange={toggleAll}
                        className="w-4 h-4 rounded border-gray-300 text-[#10b981] accent-[#10b981] cursor-pointer"
                      />
                    </th>
                    <th className="py-4 px-6 text-[11px] font-bold text-gray-500 tracking-wider uppercase">{t("bulk.columns.employee")}</th>
                    <th className="py-4 px-6 text-[11px] font-bold text-gray-500 tracking-wider uppercase">{t("bulk.columns.status")}</th>
                    <th className="py-4 px-6 text-[11px] font-bold text-gray-500 tracking-wider uppercase">{t("bulk.columns.level")}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={4} className="py-10 text-center text-sm text-gray-400">{t("common.loadingEllipsis")}</td></tr>
                  ) : requests.length === 0 ? (
                    <tr><td colSpan={4} className="py-10 text-center text-sm text-gray-400">{t("bulk.noRequests")}</td></tr>
                  ) : (
                    requests.map((r) => {
                      const decided = r.final_status === "APPROVED" || r.final_status === "REJECTED";
                      return (
                        <tr key={r.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/80 transition-colors">
                          <td className="py-4 px-6">
                            <input
                              type="checkbox"
                              checked={selected.has(r.id)}
                              disabled={decided || !r.can_act}
                              onChange={() => toggle(r.id)}
                              className="w-4 h-4 rounded border-gray-300 text-[#10b981] accent-[#10b981] cursor-pointer disabled:opacity-40"
                              title={decided ? t("bulk.alreadyDecided", { status: statusText(r.final_status) }) : !r.can_act ? t("bulk.notYourLevel") : ""}
                            />
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold bg-cyan-50 text-cyan-700 overflow-hidden flex-shrink-0">
                                {r.profile_url ? (
                                  <img src={r.profile_url} alt={r.employee_name} className="w-full h-full object-cover" />
                                ) : (
                                  initialsOf(r.employee_name)
                                )}
                              </div>
                              <div>
                                <span className="text-[13px] font-bold text-gray-900">{r.employee_name || `#${r.employee_id}`}</span>
                                {r.employee_code && <span className="ml-2 text-[11px] text-gray-400 block">{r.employee_code}</span>}
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              r.final_status === "APPROVED" ? "bg-green-100 text-green-700"
                              : r.final_status === "REJECTED" ? "bg-red-100 text-red-700"
                              : "bg-amber-100 text-amber-700"}`}>
                              {statusText(r.final_status || r.status)}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <LevelProgress levels={r.levels_summary} currentLevel={r.current_level} />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer Actions — with current level shown next to Approve */}
          <div className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm flex flex-col sm:flex-row items-center justify-end gap-4">
            {levelReq?.current_level != null && (
              <div className="flex items-center gap-2 mr-auto">
                <span className="text-[12px] font-bold text-gray-500">
                  {levelReq.total_levels ? t("common.levelOf", { current: levelReq.current_level, total: levelReq.total_levels }) : t("common.level", { current: levelReq.current_level })}
                </span>
                <LevelProgress levels={levelReq.levels_summary} currentLevel={levelReq.current_level} />
              </div>
            )}
            <button
              onClick={() => setRejectMode("reject-all")}
              disabled={busy || actable.length === 0}
              className="flex items-center justify-center gap-2 border border-red-200 text-red-600 hover:bg-red-50 bg-white px-8 py-2.5 rounded-lg text-[13.5px] font-bold transition-colors w-full sm:w-auto disabled:opacity-50"
            >
              <MdOutlineCancel className="text-lg" /> {t("common.reject")}
            </button>
            <button
              onClick={onApprove}
              disabled={busy || !canApprove || lock.locked}
              title={lock.locked ? lock.title : !canApprove ? t("bulk.notCurrentApprover") : ""}
              className="flex items-center justify-center gap-2 bg-[#17a2b8] hover:bg-[#138496] text-white px-8 py-2.5 rounded-lg text-[13.5px] font-bold transition-colors w-full sm:w-auto disabled:opacity-50"
            >
              <MdCheckCircleOutline className="text-lg" /> {t("common.approve")} {selectedActable.length ? `(${selectedActable.length})` : ""}
            </button>
          </div>
        </>
      )}

      <RejectOvertimeModal
        isOpen={!!rejectMode}
        onClose={() => setRejectMode(null)}
        onReject={onRejectConfirm}
      />
    </div>
  );
}