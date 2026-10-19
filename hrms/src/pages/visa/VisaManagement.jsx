import { Fragment, useCallback, useState } from "react";
import { toast } from "react-toastify";
import { useSearchParams } from "react-router-dom";
import {
  MdOutlineFlightTakeoff,
  MdOutlineRemoveRedEye,
  MdOutlineVisibilityOff,
  MdOutlineAdd,
  MdOutlineClear,
  MdOutlineSearch,
  MdCheck,
  MdClose,
} from "react-icons/md";
import {
  listVisas,
  actVisa as actVisaApi,
  issueVisa as issueVisaApi,
  cancelVisa as cancelVisaApi,
  addTrip as addTripApi,
  returnTrip as returnTripApi,
  cancelTrip as cancelTripApi,
  approveTrip as approveTripApi,
  rejectTrip as rejectTripApi,
  applyVisaForEmployee as applyForEmployeeApi,
} from "../../data/groupG";
import ConfirmationModal from "../../components/ConfirmationModal";
import CustomDropdown from "../../components/CustomDropdown";
import ApplyVisaModal from "../../components/ApplyVisaModal";
import Pagination from "../../components/Pagination";
import useFiscalYear from "../../hooks/useFiscalYear";
import useFyResetState from "../../hooks/useFyResetState";
import { useTranslation } from "react-i18next";

const LIMIT = 10;

// Values of the status filter (the API's exit-visa statuses).
const VISA_STATUSES = ["PENDING_APPROVAL", "APPROVED", "REJECTED", "ACTIVE", "EXHAUSTED", "EXPIRED", "CANCELLED"];

const STATUS_STYLES = {
  PENDING_APPROVAL: "bg-[#FFF4E5] text-[#B98900]",
  APPROVED: "bg-blue-50 text-blue-700",
  REJECTED: "bg-red-50 text-red-600",
  ACTIVE: "bg-green-100 text-green-700",
  EXHAUSTED: "bg-gray-100 text-gray-600",
  EXPIRED: "bg-gray-100 text-gray-500",
  CANCELLED: "bg-gray-100 text-gray-500",
};

const TYPE_LABELS = {
  SINGLE_EXIT: "types.SINGLE_EXIT",
  MULTIPLE_EXIT: "types.MULTIPLE_EXIT",
  FINAL_EXIT: "types.FINAL_EXIT",
};

const dash = (v) => v || "—";

// A final exit is a single date, not a validity window, so the "from → to"
// rendering would show an empty range for every one of them.
const validityLabel = (v) =>
  v.visa_type === "FINAL_EXIT"
    ? v.final_exit_date || v.requested_from || "—"
    : v.valid_from
      ? `${v.valid_from} → ${v.valid_until}`
      : "—";

const VisaManagement = () => {
  const { t } = useTranslation("visa");
  const typeLabel = (type) => t(TYPE_LABELS[type] || "types.SINGLE_EXIT");
  const [version, setVersion] = useState(0);
  // FY-scoped list (?fy): reload on a year change, back to page 1
  const fy = useFiscalYear();
  const [page, setPage] = useFyResetState(1, fy.version);
  const loading = false;
  const [busyId, setBusyId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  // Approve/Reject are approval decisions, so they are shown ONLY to users who
  // are members of an active EXIT_VISA approval group (same gating payroll uses
  // via approvalModules). Non-approvers still see view / issue / cancel, and the
  // backend approval engine enforces membership regardless.
  // Static build: the viewer is a member of the EXIT_VISA approval group.
  const isVisaApprover = true;

  // Row actions live in a kebab (3-dot) menu instead of inline buttons.
  const [menu, setMenu] = useState(null); // { v, top, left }

  // Filters
  // ?status=PENDING_APPROVAL (e.g. a year-end readiness "Fix" link) preselects the filter.
  const [searchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState(() => {
    const s = String(searchParams.get("status") || "").toUpperCase();
    return VISA_STATUSES.includes(s) ? s : "All Status";
  });
  const [visaTypeFilter, setVisaTypeFilter] = useState("All Types");
  const [search, setSearch] = useState("");

  const [confirm, setConfirm] = useState(null); // { title, message, confirmText, type, action }
  const [rejectFor, setRejectFor] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [issueFor, setIssueFor] = useState(null); // visa object
  const [issueForm, setIssueForm] = useState({ visa_number: "", valid_from: "", valid_until: "", final_exit_date: "", max_exits: "", reason: "" });
  const [tripFor, setTripFor] = useState(null); // visa object — the modal needs its type
  const [tripForm, setTripForm] = useState({ departure_date: "", expected_return_date: "", notes: "" });

  // Apply on behalf of an employee.
  const [showApply, setShowApply] = useState(false);

  // Client-side filtering / paging of the static visas (`version` bumps after an action).
  const q = { page, limit: LIMIT };
  if (statusFilter !== "All Status") q.status = statusFilter;
  if (visaTypeFilter !== "All Types") q.visa_type = visaTypeFilter;
  if (search) q.search = search;
  const inner = listVisas(q);
  const rows = version >= 0 ? inner.data : [];
  const pagination = { total: inner.total, total_pages: inner.total_pages };

  const load = useCallback(() => setVersion((v) => v + 1), []);

  const onFilter = (setter) => (e) => {
    setter(e.target.value);
    setPage(1);
    setExpandedId(null);
  };

  const clearFilters = () => {
    setStatusFilter("All Status");
    setVisaTypeFilter("All Types");
    setSearch("");
    setPage(1);
    setExpandedId(null);
  };

  const run = async (id, fn, msg) => {
    setBusyId(id);
    try {
      await fn();
      toast.success(msg);
      setConfirm(null);
      setRejectFor(null);
      setRejectReason("");
      setIssueFor(null);
      setTripFor(null);
      setShowApply(false);
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
      confirmText: t("actions.approve"),
      type: "success",
      action: () => run(id, () => actVisaApi(id, "APPROVE", ""), t("toast.visaApproved")),
    });

  const cancelVisa = (id) =>
    setConfirm({
      title: t("confirm.cancelVisaTitle"),
      message: t("confirm.cancelVisaMessage"),
      confirmText: t("actions.cancelVisa"),
      type: "warning",
      action: () => run(id, () => cancelVisaApi(id), t("toast.visaCancelled")),
    });

  const submitIssue = () => {
    const isFinal = issueFor.visa_type === "FINAL_EXIT";

    if (!issueForm.visa_number.trim()) {
      toast.error(t("validation.visaNumberRequired"));
      return;
    }
    if (isFinal && !issueForm.final_exit_date) {
      toast.error(t("validation.finalExitDateRequired"));
      return;
    }
    if (!isFinal && (!issueForm.valid_from || !issueForm.valid_until)) {
      toast.error(t("validation.validDatesRequired"));
      return;
    }

    const payload = {
      visa_number: issueForm.visa_number.trim(),
      // One date for a one-way exit; a validity window for everything else.
      ...(isFinal
        ? { final_exit_date: issueForm.final_exit_date }
        : { valid_from: issueForm.valid_from, valid_until: issueForm.valid_until }),
      ...(issueFor.visa_type === "MULTIPLE_EXIT" && issueForm.max_exits
        ? { max_exits: Number(issueForm.max_exits) }
        : {}),
      // Sent every time: prefilled with what was applied for, so leaving it
      // untouched keeps the stated reason and clearing it clears the reason.
      reason: (issueForm.reason || "").trim(),
    };
    run(issueFor.id, () => issueVisaApi(issueFor.id, payload), t("toast.visaIssued"));
  };

  const submitReject = () => {
    if (!rejectReason.trim()) {
      toast.error(t("validation.rejectionReasonRequired"));
      return;
    }
    run(rejectFor, () => actVisaApi(rejectFor, "REJECT", rejectReason.trim()), t("toast.visaRejected"));
  };

  const submitTrip = () => {
    if (!tripForm.departure_date) {
      toast.error(t("validation.departureRequired"));
      return;
    }
    const payload = {
      departure_date: tripForm.departure_date,
      // A final exit is one-way — never send a return date for one.
      ...(tripFor.visa_type !== "FINAL_EXIT" && tripForm.expected_return_date
        ? { expected_return_date: tripForm.expected_return_date }
        : {}),
      ...(tripForm.notes ? { notes: tripForm.notes } : {}),
    };
    run(tripFor.id, () => addTripApi(tripFor.id, payload), t("toast.tripRecorded"));
  };

  const totalPages = pagination?.total_pages ?? 1;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-cyan-600">
            <MdOutlineFlightTakeoff className="text-2xl" />
            <span className="text-sm font-semibold">{t("eyebrow")}</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">{t("management.title")}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {t("management.subtitle")}
          </p>
        </div>
        <button onClick={() => setShowApply(true)} className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm shrink-0">
          <MdOutlineAdd className="text-lg" /> {t("actions.applyForEmployee")}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 border border-gray-200 rounded-xl mb-5">
        <div className="flex flex-col sm:flex-row items-end gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px] w-full">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
              {t("filters.search")}
            </label>
            <div className="relative">
              <MdOutlineSearch className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
              <input
                type="text"
                value={search}
                onChange={onFilter(setSearch)}
                placeholder={t("filters.searchPlaceholder")}
                className="w-full ps-9 pe-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition h-[42px]"
              />
            </div>
          </div>
          {/* Status */}
          <div className="flex-1 min-w-[200px] w-full">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
              {t("filters.status")}
            </label>
            <CustomDropdown
              value={statusFilter}
              onChange={onFilter(setStatusFilter)}
              options={[
                { label: t("filters.allStatus"), value: "All Status" },
                { label: t("statusOptions.PENDING_APPROVAL"), value: "PENDING_APPROVAL" },
                { label: t("statusOptions.APPROVED"), value: "APPROVED" },
                { label: t("statusOptions.REJECTED"), value: "REJECTED" },
                { label: t("statusOptions.ACTIVE"), value: "ACTIVE" },
                { label: t("statusOptions.EXHAUSTED"), value: "EXHAUSTED" },
                { label: t("statusOptions.EXPIRED"), value: "EXPIRED" },
                { label: t("statusOptions.CANCELLED"), value: "CANCELLED" },
              ]}
            />
          </div>
          {/* Type */}
          <div className="flex-1 min-w-[200px] w-full">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
              {t("filters.type")}
            </label>
            <CustomDropdown
              value={visaTypeFilter}
              onChange={onFilter(setVisaTypeFilter)}
              options={[
                { label: t("filters.allTypes"), value: "All Types" },
                { label: t("types.SINGLE_EXIT"), value: "SINGLE_EXIT" },
                { label: t("types.MULTIPLE_EXIT"), value: "MULTIPLE_EXIT" },
                { label: t("types.FINAL_EXIT"), value: "FINAL_EXIT" }
              ]}
            />
          </div>
          {/* Clear filter */}
          <div className="flex-shrink-0 w-full sm:w-auto">
            <button 
              onClick={clearFilters}
              className="w-full sm:w-auto flex justify-center items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-2 rounded-lg font-medium text-sm transition-colors h-[42px]">
              <MdOutlineClear className="text-lg" /> {t("actions.clearFilter")}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-[#F8F9FE]">
                {["sno", "employee", "type", "validity", "exits", "status", "actions"].map((h) => (
                  <th key={h} className="text-start px-5 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    {t(`table.${h}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan="7" className="px-5 py-12 text-center text-sm text-gray-400">{t("loading")}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan="7" className="px-5 py-12 text-center text-sm text-gray-400">{t("management.empty")}</td></tr>
              ) : (
                rows.map((v, index) => (
                  <Fragment key={v.id}>
                    <tr className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4 text-sm text-gray-600">
                        {(page - 1) * LIMIT + index + 1}
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-sm font-bold text-gray-900">{dash(v.employee?.name)}</div>
                        <div className="text-[11px] text-gray-500">{dash(v.employee?.code)}</div>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-700">{typeLabel(v.visa_type)}</td>
                      <td className="px-5 py-4 text-sm text-gray-600">
                        {validityLabel(v)}
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-700">
                        {v.exits_used}/{v.max_exits}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLES[v.status] || "bg-gray-100 text-gray-600"}`}>
                          {t(`status.${v.status}`, { defaultValue: String(v.status).replace(/_/g, " ") })}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button onClick={() => setExpandedId(expandedId === v.id ? null : v.id)} title={t("actions.view")} className="p-1.5 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded transition-colors">
                            {expandedId === v.id ? <MdOutlineVisibilityOff className="text-lg" /> : <MdOutlineRemoveRedEye className="text-lg" />}
                          </button>
                          {v.status === "PENDING_APPROVAL" && (
                            <>
                              <button onClick={() => setRejectFor(v.id)} disabled={busyId === v.id} className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 disabled:opacity-50">{t("actions.reject")}</button>
                              <button onClick={() => approve(v.id)} disabled={busyId === v.id} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50">{t("actions.approve")}</button>
                            </>
                          )}
                          {v.status === "APPROVED" && (
                            <button
                              onClick={() => {
                                setIssueFor(v);
                                // Prefilled from the request so the approver confirms
                                // or corrects dates rather than retyping them.
                                setIssueForm({
                                  visa_number: v.visa_number || "",
                                  valid_from: v.valid_from || v.requested_from || "",
                                  valid_until: v.valid_until || v.requested_to || "",
                                  final_exit_date: v.final_exit_date || "",
                                  max_exits: v.max_exits,
                                  reason: v.reason || "",
                                });
                              }}
                              disabled={busyId === v.id}
                              className="px-3 py-1.5 rounded-lg bg-cyan-600 text-white text-xs font-semibold hover:bg-cyan-700 disabled:opacity-50"
                            >
                              {t("actions.issueVisa")}
                            </button>
                          )}
                          {v.status === "ACTIVE" && (
                            <button onClick={() => { setTripFor(v); setTripForm({ departure_date: "", expected_return_date: "", notes: "" }); }} disabled={busyId === v.id} className="px-3 py-1.5 rounded-lg bg-cyan-600 text-white text-xs font-semibold hover:bg-cyan-700 disabled:opacity-50">{t("actions.recordTrip")}</button>
                          )}
                          {["PENDING_APPROVAL", "APPROVED", "ACTIVE"].includes(v.status) && (
                            <button onClick={() => cancelVisa(v.id)} disabled={busyId === v.id} className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 text-xs font-semibold hover:bg-gray-50 disabled:opacity-50">{t("actions.cancel")}</button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedId === v.id && (
                      <tr>
                        <td colSpan="7" className="px-5 py-4 bg-gray-50/60">
                          {v.reason && <p className="text-sm text-gray-600 mb-3"><span className="font-semibold">{t("management.reasonLabel")}</span> {v.reason}</p>}
                          {v.rejection_reason && <p className="text-sm text-red-600 mb-3"><span className="font-semibold">{t("management.rejectionLabel")}</span> {v.rejection_reason}</p>}
                          <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
                            <table className="w-full text-left text-sm">
                              <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
                                <tr>
                                  <th className="px-4 py-2.5">{t("table.departure")}</th>
                                  <th className="px-4 py-2.5">{t("table.expectedReturn")}</th>
                                  <th className="px-4 py-2.5">{t("table.actualReturn")}</th>
                                  <th className="px-4 py-2.5">{t("table.status")}</th>
                                  <th className="px-4 py-2.5">{t("table.actions")}</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-50">
                                {(v.trips || []).length === 0 ? (
                                  <tr><td colSpan="5" className="px-4 py-4 text-center text-gray-400">{t("management.noTrips")}</td></tr>
                                ) : (
                                  v.trips.map((tr) => (
                                    <tr key={tr.id}>
                                      <td className="px-4 py-2.5 text-gray-800">{dash(tr.departure_date)}</td>
                                      <td className="px-4 py-2.5 text-gray-600">{dash(tr.expected_return_date)}</td>
                                      <td className="px-4 py-2.5 text-gray-600">{dash(tr.actual_return_date)}</td>
                                      <td className="px-4 py-2.5">{t(`tripStatus.${tr.status}`, { defaultValue: String(tr.status).replace(/_/g, " ") })}</td>
                                      <td className="px-4 py-2.5">
                                        {tr.status === "PENDING_APPROVAL" && isVisaApprover && (
                                          <div className="flex gap-2">
                                            <button onClick={() => run(v.id, () => approveTripApi(v.id, tr.id), t("toast.tripApproved"))} className="text-emerald-600 text-xs font-semibold hover:underline">{t("actions.approve")}</button>
                                            <button onClick={() => run(v.id, () => rejectTripApi(v.id, tr.id, ""), t("toast.tripRejected"))} className="text-red-500 text-xs font-semibold hover:underline">{t("actions.reject")}</button>
                                          </div>
                                        )}
                                        {(tr.status === "PLANNED" || tr.status === "DEPARTED") && (
                                          <div className="flex gap-2">
                                            <button onClick={() => run(v.id, () => returnTripApi(v.id, tr.id, { actual_return_date: new Date().toISOString().slice(0, 10) }), t("toast.markedReturned"))} className="text-emerald-600 text-xs font-semibold hover:underline">{t("actions.markReturned")}</button>
                                            <button onClick={() => run(v.id, () => cancelTripApi(v.id, tr.id), t("toast.tripCancelled"))} className="text-red-500 text-xs font-semibold hover:underline">{t("actions.cancel")}</button>
                                          </div>
                                        )}
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          page={page}
          totalPages={totalPages}
          total={pagination?.total ?? rows.length}
          limit={LIMIT}
          onPage={setPage}
          label={t("pagination.label")}
          activeClass="bg-cyan-600 text-white"
          containerClass="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-gray-100"
        />
      </div>

      {/* Row actions menu (kebab) */}
      {menu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} />
          <div
            className="fixed z-50 w-44 bg-white border border-gray-200 rounded-lg shadow-lg py-1"
            style={{ top: menu.top, left: menu.left }}
          >
            <button
              onClick={() => { setExpandedId(expandedId === menu.v.id ? null : menu.v.id); setMenu(null); }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              {expandedId === menu.v.id ? <MdOutlineVisibilityOff className="text-base" /> : <MdOutlineRemoveRedEye className="text-base" />}
              {expandedId === menu.v.id ? t("actions.hideDetails") : t("actions.view")}
            </button>

            {menu.v.status === "PENDING_APPROVAL" && isVisaApprover && (
              <>
                <button
                  disabled={busyId === menu.v.id}
                  onClick={() => { approve(menu.v.id); setMenu(null); }}
                  className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                >
                  <MdCheck className="text-base" /> {t("actions.approve")}
                </button>
                <button
                  disabled={busyId === menu.v.id}
                  onClick={() => { setRejectFor(menu.v.id); setMenu(null); }}
                  className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  <MdClose className="text-base" /> {t("actions.reject")}
                </button>
              </>
            )}

            {menu.v.status === "APPROVED" && (
              <button
                disabled={busyId === menu.v.id}
                onClick={() => { setIssueFor(menu.v); setIssueForm({ visa_number: "", valid_from: "", valid_until: "", max_exits: menu.v.max_exits }); setMenu(null); }}
                className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-cyan-700 hover:bg-cyan-50 disabled:opacity-50"
              >
                <MdOutlineFlightTakeoff className="text-base" /> {t("actions.issueVisa")}
              </button>
            )}

            {menu.v.status === "ACTIVE" && (
              <button
                disabled={busyId === menu.v.id}
                onClick={() => { setTripFor(menu.v.id); setTripForm({ departure_date: "", expected_return_date: "", notes: "" }); setMenu(null); }}
                className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-cyan-700 hover:bg-cyan-50 disabled:opacity-50"
              >
                <MdOutlineAdd className="text-base" /> {t("actions.recordTrip")}
              </button>
            )}

            {["PENDING_APPROVAL", "APPROVED", "ACTIVE"].includes(menu.v.status) && (
              <button
                disabled={busyId === menu.v.id}
                onClick={() => { cancelVisa(menu.v.id); setMenu(null); }}
                className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                <MdOutlineClear className="text-base" /> {t("actions.cancel")}
              </button>
            )}
          </div>
        </>
      )}

      <ConfirmationModal
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm?.action?.()}
        title={confirm?.title}
        message={confirm?.message}
        type={confirm?.type || "warning"}
        confirmText={confirm?.confirmText || t("actions.confirm")}
        cancelText={t("actions.cancel")}
        isLoading={busyId != null}
      />

      {/* Apply on behalf of an employee */}
      <ApplyVisaModal
        isOpen={showApply}
        onClose={() => setShowApply(false)}
        onSubmit={(payload) => run("apply", () => applyForEmployeeApi(payload), t("toast.applicationSubmitted"))}
        isSubmitting={busyId !== null}
      />

      {/* Reject */}
      {rejectFor != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">{t("reject.visaTitle")}</h3>
            <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={4} placeholder={t("reject.placeholder")} className="mt-4 w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-red-400" />
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => { setRejectFor(null); setRejectReason(""); }} className="px-4 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50">{t("actions.cancel")}</button>
              <button onClick={submitReject} disabled={busyId != null} className="px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50">{t("actions.reject")}</button>
            </div>
          </div>
        </div>
      )}

      {/* Issue */}
      {issueFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">{t("issue.title")}</h3>
            <p className="text-sm text-gray-500 mt-1">{t("issue.subtitle", { type: typeLabel(issueFor.visa_type) })}</p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">{t("issue.visaNumber")}</label>
                <input value={issueForm.visa_number} onChange={(e) => setIssueForm((f) => ({ ...f, visa_number: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500" />
              </div>
              {issueFor.visa_type === "FINAL_EXIT" ? (
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">{t("issue.finalExitDate")}</label>
                  <input type="date" value={issueForm.final_exit_date} onChange={(e) => setIssueForm((f) => ({ ...f, final_exit_date: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500" />
                  <p className="text-[11px] text-gray-400 mt-1">{t("issue.finalExitHint")}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">{t("issue.validFrom")}</label>
                    <input type="date" value={issueForm.valid_from} onChange={(e) => setIssueForm((f) => ({ ...f, valid_from: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">{t("issue.validUntil")}</label>
                    <input type="date" value={issueForm.valid_until} onChange={(e) => setIssueForm((f) => ({ ...f, valid_until: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500" />
                  </div>
                </div>
              )}
              {issueFor.visa_type === "MULTIPLE_EXIT" && (
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">{t("issue.maxExits")}</label>
                  <input type="number" min="2" value={issueForm.max_exits} onChange={(e) => setIssueForm((f) => ({ ...f, max_exits: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500" />
                </div>
              )}
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">{t("issue.reason")}</label>
                <textarea rows={3} value={issueForm.reason} onChange={(e) => setIssueForm((f) => ({ ...f, reason: e.target.value }))} placeholder={t("issue.reasonPlaceholder")} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500" />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setIssueFor(null)} className="px-4 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50">{t("actions.cancel")}</button>
              <button onClick={submitIssue} disabled={busyId != null} className="px-4 py-2.5 rounded-lg bg-cyan-600 text-white text-sm font-medium hover:bg-cyan-700 disabled:opacity-50">{t("actions.issue")}</button>
            </div>
          </div>
        </div>
      )}

      {/* Record trip */}
      {tripFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">{t("trip.title")}</h3>
            <div className="mt-4 space-y-3">
              <div className={tripFor.visa_type === "FINAL_EXIT" ? "" : "grid grid-cols-2 gap-3"}>
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">{t("trip.departure")}</label>
                  <input type="date" value={tripForm.departure_date} onChange={(e) => setTripForm((f) => ({ ...f, departure_date: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500" />
                </div>
                {/* No return on a final exit — the employee is leaving for good. */}
                {tripFor.visa_type !== "FINAL_EXIT" && (
                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">{t("trip.expectedReturn")}</label>
                    <input type="date" value={tripForm.expected_return_date} onChange={(e) => setTripForm((f) => ({ ...f, expected_return_date: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500" />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">{t("trip.notes")}</label>
                <input value={tripForm.notes} onChange={(e) => setTripForm((f) => ({ ...f, notes: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500" />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setTripFor(null)} className="px-4 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50">{t("actions.cancel")}</button>
              <button onClick={submitTrip} disabled={busyId != null} className="px-4 py-2.5 rounded-lg bg-cyan-600 text-white text-sm font-medium hover:bg-cyan-700 disabled:opacity-50">{t("actions.record")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VisaManagement;
