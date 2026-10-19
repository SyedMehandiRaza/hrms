import { useState, Fragment } from "react";
import { toast } from "react-toastify";
import {
  MdOutlineFlightTakeoff,
  MdOutlineAdd,
  MdOutlineRemoveRedEye,
  MdOutlineVisibilityOff,
  MdOutlineClear,
} from "react-icons/md";
import { MY_VISAS } from "../../../data/groupH";
import { nextId, paginate } from "../../../data/common";
import CustomDropdown from "../../../components/CustomDropdown";
import Pagination from "../../../components/Pagination";
import useFiscalYear from "../../../hooks/useFiscalYear";
import useFyResetState from "../../../hooks/useFyResetState";
import MyVisaApplyModal from "../../../components/MyVisaApplyModal";
import { useTranslation } from "react-i18next";

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

// A final exit is one date, not a window — rendering it as a range would leave
// the column empty for every final-exit visa.
const validityLabel = (v) =>
  v.visa_type === "FINAL_EXIT"
    ? v.final_exit_date || v.requested_from || "—"
    : v.valid_from
      ? `${v.valid_from} → ${v.valid_until}`
      : "—";
const dash = (v) => v || "—";

const LIMIT = 10;

const MyVisa = () => {
  const { t } = useTranslation("visa");
  const typeLabel = (type) => t(TYPE_LABELS[type] || "types.SINGLE_EXIT");
  const [allVisas, setAllVisas] = useState(MY_VISAS);
  const loading = false;
  const busy = false;
  const [showApply, setShowApply] = useState(false);
  const [tripFor, setTripFor] = useState(null); // visa object — the modal needs its type
  const [tripForm, setTripForm] = useState({ departure_date: "", expected_return_date: "", notes: "" });
  const [expandedId, setExpandedId] = useState(null);
  // FY-scoped list (?fy): reload on a year change, back to page 1
  const fy = useFiscalYear();
  const [page, setPage] = useFyResetState(1, fy.version);

  // Filters
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [visaTypeFilter, setVisaTypeFilter] = useState("All Types");

  // Client-side filter + paging over the static list.
  const filteredVisas = allVisas.filter(
    (v) =>
      (statusFilter === "All Status" || v.status === statusFilter) &&
      (visaTypeFilter === "All Types" || v.visa_type === visaTypeFilter),
  );
  const { rows: visas, total, totalPages } = paginate(filteredVisas, page, LIMIT);
  const pagination = { total, total_pages: totalPages };

  const updateVisa = (id, fn) =>
    setAllVisas((prev) => prev.map((v) => (v.id === id ? fn(v) : v)));

  const onFilter = (setter) => (e) => {
    setter(e.target.value);
    setPage(1);
  };

  const clearFilters = () => {
    setStatusFilter("All Status");
    setVisaTypeFilter("All Types");
    setPage(1);
  };

  const submitApply = (payload) => {
    setAllVisas((prev) => [
      {
        id: nextId(prev),
        visa_number: null,
        valid_from: null,
        valid_until: null,
        exits_used: 0,
        max_exits: payload.max_exits || 1,
        exits_remaining: payload.max_exits || 1,
        status: "PENDING_APPROVAL",
        trips: [],
        ...payload,
      },
      ...prev,
    ]);
    toast.success(t("toast.applied"));
    setShowApply(false);
  };

  const submitTrip = () => {
    if (!tripForm.departure_date) {
      toast.error(t("validation.departureRequired"));
      return;
    }
    const trip = {
      departure_date: tripForm.departure_date,
      // A final exit is one-way — never record a return date for one.
      expected_return_date:
        tripFor.visa_type !== "FINAL_EXIT" && tripForm.expected_return_date
          ? tripForm.expected_return_date
          : null,
      actual_return_date: null,
      status: "PLANNED",
      notes: tripForm.notes || null,
    };
    updateVisa(tripFor.id, (v) => {
      const trips = v.trips || [];
      return {
        ...v,
        trips: [...trips, { id: nextId(trips), ...trip }],
        exits_used: v.exits_used + 1,
        exits_remaining: Math.max(0, v.exits_remaining - 1),
      };
    });
    toast.success(t("toast.tripRecorded"));
    setTripFor(null);
    setTripForm({ departure_date: "", expected_return_date: "", notes: "" });
  };

  const markReturned = (visaId, tripId) => {
    const today = new Date().toISOString().slice(0, 10);
    updateVisa(visaId, (v) => ({
      ...v,
      trips: (v.trips || []).map((tr) =>
        tr.id === tripId ? { ...tr, actual_return_date: today, status: "RETURNED" } : tr,
      ),
    }));
    toast.success(t("toast.markedReturned"));
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-cyan-600">
            <MdOutlineFlightTakeoff className="text-2xl" />
            <span className="text-sm font-semibold">{t("eyebrow")}</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">{t("myVisa.title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{t("myVisa.subtitle")}</p>
        </div>
        <button onClick={() => setShowApply(true)} className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm">
          <MdOutlineAdd className="text-lg" /> {t("actions.applyForVisa")}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 border border-gray-200 rounded-xl mb-5">
        <div className="flex flex-col sm:flex-row items-end gap-4">
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
          <table className="w-full min-w-[700px] text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-[#F8F9FE]">
                {["sno", "type", "validity", "exits", "status", "actions"].map((h) => (
                  <th key={h} className="text-start px-5 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    {t(`table.${h}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan="6" className="px-5 py-12 text-center text-sm text-gray-400">{t("loading")}</td></tr>
              ) : visas.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-5 py-12 text-center">
                    <MdOutlineFlightTakeoff className="text-4xl text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">{t("myVisa.empty")}</p>
                  </td>
                </tr>
              ) : (
                visas.map((v, index) => (
                  <Fragment key={v.id}>
                    <tr className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4 text-sm text-gray-600">
                        {(page - 1) * LIMIT + index + 1}
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-700">
                        <div className="font-bold text-gray-900">{typeLabel(v.visa_type)}</div>
                        <div className="text-[11px] text-gray-500">{v.visa_number ? `#${v.visa_number}` : ""}</div>
                      </td>
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
                        {v.rejection_reason && <div className="text-[10px] text-red-600 mt-1 max-w-[150px] truncate" title={v.rejection_reason}>{t("myVisa.rejectedReason", { reason: v.rejection_reason })}</div>}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button onClick={() => setExpandedId(expandedId === v.id ? null : v.id)} title={t("actions.viewTrips")} className="p-1.5 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded transition-colors">
                            {expandedId === v.id ? <MdOutlineVisibilityOff className="text-lg" /> : <MdOutlineRemoveRedEye className="text-lg" />}
                          </button>
                          {v.status === "ACTIVE" && v.exits_remaining > 0 && (
                            <button onClick={() => { setTripFor(v); setTripForm({ departure_date: "", expected_return_date: "", notes: "" }); }} className="bg-cyan-600 hover:bg-cyan-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium shrink-0">
                              {t("actions.recordTrip")}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedId === v.id && (v.trips || []).length > 0 && (
                      <tr className="bg-[#F8F9FE]">
                        <td colSpan="6" className="px-5 py-4">
                          <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
                            <table className="w-full text-left text-sm">
                              <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
                                <tr>
                                  <th className="px-4 py-2.5">{t("table.departure")}</th>
                                  <th className="px-4 py-2.5">{t("table.expectedReturn")}</th>
                                  <th className="px-4 py-2.5">{t("table.actualReturn")}</th>
                                  <th className="px-4 py-2.5">{t("table.status")}</th>
                                  <th className="px-4 py-2.5"></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-50">
                                {v.trips.map((tr) => (
                                  <tr key={tr.id}>
                                    <td className="px-4 py-2.5 text-gray-800">{dash(tr.departure_date)}</td>
                                    <td className="px-4 py-2.5 text-gray-600">{dash(tr.expected_return_date)}</td>
                                    <td className="px-4 py-2.5 text-gray-600">{dash(tr.actual_return_date)}</td>
                                    <td className="px-4 py-2.5">
                                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-700">
                                        {t(`tripStatus.${tr.status}`, { defaultValue: String(tr.status) })}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2.5 text-right">
                                      {(tr.status === "PLANNED" || tr.status === "DEPARTED") && (
                                        <button onClick={() => markReturned(v.id, tr.id)} className="text-emerald-600 text-xs font-semibold hover:underline">{t("actions.markReturned")}</button>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                    {expandedId === v.id && (v.trips || []).length === 0 && (
                      <tr className="bg-[#F8F9FE]">
                        <td colSpan="6" className="px-5 py-4 text-center text-sm text-gray-500">
                          {t("myVisa.noTrips")}
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
          totalPages={pagination?.total_pages ?? 1}
          total={pagination?.total ?? visas.length}
          limit={LIMIT}
          onPage={setPage}
          label={t("pagination.label")}
          activeClass="bg-cyan-600 text-white"
          containerClass="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-gray-100"
        />
      </div>

      <MyVisaApplyModal
        isOpen={showApply}
        onClose={() => setShowApply(false)}
        onSubmit={submitApply}
        isSubmitting={busy}
      />

      {/* Record trip modal */}
      {tripFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">{t("trip.title")}</h3>
            <div className={tripFor.visa_type === "FINAL_EXIT" ? "mt-4" : "mt-4 grid grid-cols-2 gap-3"}>
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
            <div className="mt-3">
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">{t("trip.notes")}</label>
              <input value={tripForm.notes} onChange={(e) => setTripForm((f) => ({ ...f, notes: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500" />
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setTripFor(null)} className="px-4 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50">{t("actions.cancel")}</button>
              <button onClick={submitTrip} disabled={busy} className="px-4 py-2.5 rounded-lg bg-cyan-600 text-white text-sm font-medium hover:bg-cyan-700 disabled:opacity-50">{t("actions.record")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyVisa;
