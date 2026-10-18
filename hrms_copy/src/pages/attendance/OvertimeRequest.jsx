import { useState, useMemo } from "react";
import Pagination from "../../components/Pagination";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  MdAdd,
  MdCheckCircle,
  MdTrendingUp,
  MdAccessTime,
  MdAssignment,
  MdOutlineCalendarToday,
  MdOutlineShowChart,
  MdVisibility,
  MdOutlineClear
} from "react-icons/md";
import NewOvertimeRequestModal from "../../components/NewOvertimeRequestModal";
import OvertimeDetailModal from "../../components/OvertimeDetailModal";
import CustomDropdown from "../../components/CustomDropdown";
import { OT_REQUESTS, OT_PROJECTS, OT_saveRequests, OT_summary } from "../../data/groupD";
import { TableLoader } from "../../components/Loader";
import useFiscalYear from "../../hooks/useFiscalYear";
import useYearLock from "../../hooks/useYearLock";
import { clampDate } from "../../utils/fiscalYear";

const STATUS_STYLE = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  Pending: "bg-amber-100 text-amber-700",
  Approved: "bg-green-100 text-green-700",
  Rejected: "bg-red-100 text-red-700",
};

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "—");
const initialsOf = (name) =>
  (name || "?")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

export default function OvertimeRequest() {
  const { t } = useTranslation("attendance");
  const statusText = (s) => t(`requestStatus.${s}`, { defaultValue: s });
  const navigate = useNavigate();
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("employee");
  const [selectedEmployeeForModal, setSelectedEmployeeForModal] = useState(null);
  const [projectFilter, setProjectFilter] = useState("");
  // ?status=PENDING (e.g. a year-end readiness "Fix" link) preselects the filter.
  const [searchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState(() => {
    const s = String(searchParams.get("status") || "").toUpperCase();
    return ["PENDING", "APPROVED", "REJECTED"].includes(s) ? s : "";
  });
  const [dateRangeFilter, setDateRangeFilter] = useState({ start: "", end: "" });
  const fy = useFiscalYear();
  const lock = useYearLock();

  const projects = OT_PROJECTS;

  const [allRows, setAllRows] = useState(() => [...OT_REQUESTS]);
  const loading = false;

  const [employeePage, setEmployeePage] = useState(1);
  const [bulkPage, setBulkPage] = useState(1);
  const limit = 10;

  // A new financial year in the header → clear the date filters (they belonged
  // to the old year) and go back to page 1.
  const [fyVersion, setFyVersion] = useState(fy.version);
  if (fyVersion !== fy.version) {
    setFyVersion(fy.version);
    setDateRangeFilter({ start: "", end: "" });
    setEmployeePage(1);
    setBulkPage(1);
  }
  const pickDate = (key, value) =>
    setDateRangeFilter((prev) => ({
      ...prev,
      [key]: value && fy.range ? clampDate(value, fy.range) : value,
    }));
  const fyFrom = fy.range?.from;
  const fyTo = fy.range?.to;

  // Year + filters applied client-side (the API did this server-side).
  const rows = useMemo(
    () =>
      allRows
        .filter((r) => (!fyFrom || r.work_date >= fyFrom) && (!fyTo || r.work_date <= fyTo))
        .filter((r) => !projectFilter || String(r.project_id) === String(projectFilter))
        .filter((r) => !statusFilter || r.status === statusFilter)
        .filter((r) => !dateRangeFilter.start || r.work_date >= dateRangeFilter.start)
        .filter((r) => !dateRangeFilter.end || r.work_date <= dateRangeFilter.end)
        .sort((a, b) => b.work_date.localeCompare(a.work_date) || b.id - a.id),
    [allRows, fyFrom, fyTo, projectFilter, statusFilter, dateRangeFilter],
  );
  const summary = useMemo(() => OT_summary(rows), [rows]);

  // Created / approved / rejected rows replace their local copy.
  const upsert = (updated) => {
    if (!updated) return;
    const list = Array.isArray(updated) ? updated : [updated];
    setAllRows((prev) => {
      const map = new Map(prev.map((r) => [r.id, r]));
      list.forEach((r) => map.set(r.id, r));
      const next = [...map.values()];
      OT_saveRequests(next);
      return next;
    });
  };

  // Employee tab = individual (non-batch) requests; Bulk tab = grouped by batch.
  const employeeData = useMemo(() => rows.filter((r) => !r.batch_id), [rows]);
  const bulkData = useMemo(() => {
    const groups = new Map();
    rows
      .filter((r) => r.batch_id)
      .forEach((r) => {
        if (!groups.has(r.batch_id)) {
          groups.set(r.batch_id, {
            batch_id: r.batch_id,
            employees: 0,
            date: r.work_date,
            hours: r.overtime_hours,
            status: r.final_status || r.status,
          });
        }
        groups.get(r.batch_id).employees += 1;
      });
    return [...groups.values()];
  }, [rows]);

  const paginatedEmployeeData = useMemo(() => {
    return employeeData.slice((employeePage - 1) * limit, employeePage * limit);
  }, [employeeData, employeePage, limit]);

  const paginatedBulkData = useMemo(() => {
    return bulkData.slice((bulkPage - 1) * limit, bulkPage * limit);
  }, [bulkData, bulkPage, limit]);

  return (
    <div className="space-y-6 w-full p-4 sm:p-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("overtime.title")}</h1>
          <p className="text-gray-500 mt-1 text-sm font-medium">
            {t("overtime.subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
          {!lock.locked && (
            <button
              onClick={() => navigate('/admin/attendance/request/new')}
              className="flex items-center gap-2 bg-[#17a2b8] hover:bg-[#138496] text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-colors"
            >
              <MdAdd className="text-lg" /> {t("overtime.newRequest")}
            </button>
          )}
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-[#f4f7fe] rounded-xl p-6 border border-[#e8effd]">
          <div className="flex justify-between items-start mb-4">
            <p className="text-[11px] font-bold text-blue-700 uppercase tracking-widest">
              {t("overtime.stats.totalRequests")}
            </p>
            <div className="bg-white/50 p-1.5 rounded-lg">
              <MdAssignment className="text-blue-500 text-xl" />
            </div>
          </div>
          <p className="text-4xl font-black text-blue-900">{summary.total}</p>
          <div className="mt-4 flex items-center gap-1 text-[12px] font-medium text-[#17a2b8]">
            <MdTrendingUp className="text-sm" /> {t("overtime.stats.totalRequestsHint")}
          </div>
        </div>

        <div className="bg-[#effbf3] rounded-xl p-6 border border-[#e1f5e8]">
          <div className="flex justify-between items-start mb-4">
            <p className="text-[11px] font-bold text-green-700 uppercase tracking-widest">
              {t("overtime.stats.approvedHours")}
            </p>
            <div className="bg-white/50 p-1.5 rounded-lg">
              <MdAccessTime className="text-green-500 text-xl" />
            </div>
          </div>
          <p className="text-4xl font-black text-green-800">{summary.approved}</p>
          <div className="mt-4 flex items-center gap-1 text-[12px] font-medium text-green-600">
            <MdCheckCircle className="text-sm" /> {t("overtime.stats.approvedHoursHint")}
          </div>
        </div>

        <div className="bg-[#f3f0ff] rounded-xl p-6 border border-[#ece8ff]">
          <div className="flex justify-between items-start mb-4">
            <p className="text-[11px] font-bold text-gray-600 uppercase tracking-widest">
              {t("overtime.stats.approvalRate")}
            </p>
            <div className="bg-white/50 p-1.5 rounded-lg">
              <MdOutlineShowChart className="text-indigo-500 text-xl" />
            </div>
          </div>
          <p className="text-4xl font-black text-gray-800">{summary.rejected}</p>
          <div className="mt-4 flex items-center gap-1 text-[12px] font-medium text-gray-500">
            {t("overtime.stats.approvalRateHint")}
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex bg-gray-100 p-1 rounded-lg w-full sm:w-max mt-2 overflow-x-auto custom-scrollbar">
        <button
          onClick={() => setActiveTab("employee")}
          className={`flex-1 sm:flex-none px-5 py-2 rounded-md text-sm font-bold transition-colors whitespace-nowrap ${activeTab === "employee" ? "bg-[#17a2b8] text-white" : "text-gray-600 hover:text-gray-900"
            }`}
        >
          {t("overtimeList.tabs.employee")}
        </button>
        <button
          onClick={() => setActiveTab("bulk")}
          className={`flex-1 sm:flex-none px-5 py-2 rounded-md text-sm font-bold transition-colors whitespace-nowrap ${activeTab === "bulk" ? "bg-[#17a2b8] text-white" : "text-gray-600 hover:text-gray-900"
            }`}
        >
          {t("overtimeList.tabs.bulk")}
        </button>
      </div>

      {/* ── Filters ── */}
      <div className="p-4 border border-gray-200 rounded-xl bg-white">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-[11px] font-bold text-gray-500 tracking-wider uppercase mb-2">{t("overtime.filters.project")}</label>
            <CustomDropdown
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              isSearchable
              options={[
                { label: t("overtime.projects.all"), value: "" },
                ...projects.map((p) => ({
                  label: p.project_name,
                  value: p.id
                }))
              ]}
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-[11px] font-bold text-gray-500 tracking-wider uppercase mb-2">{t("overtime.filters.status")}</label>
            <CustomDropdown
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { label: t("overtime.statusOptions.all"), value: "" },
                { label: t("overtime.statusOptions.pending"), value: "PENDING" },
                { label: t("overtime.statusOptions.approved"), value: "APPROVED" },
                { label: t("overtime.statusOptions.rejected"), value: "REJECTED" },
              ]}
            />
          </div>
          <div className="flex-1 min-w-[160px] relative">
            <label className="block text-[11px] font-bold text-gray-500 tracking-wider uppercase mb-2">{t("overtimeList.startDate")}</label>
            <div className="relative">
              <MdOutlineCalendarToday className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="date" 
                value={dateRangeFilter.start}
                min={fy.range?.from}
                max={dateRangeFilter.end || fy.range?.to}
                onChange={(e) => pickDate("start", e.target.value)}
                className="w-full border border-gray-200 text-gray-700 text-sm font-medium rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#17a2b8] h-[42px]" 
              />
            </div>
          </div>
          <div className="flex-1 min-w-[160px] relative">
            <label className="block text-[11px] font-bold text-gray-500 tracking-wider uppercase mb-2">{t("overtimeList.endDate")}</label>
            <div className="relative">
              <MdOutlineCalendarToday className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="date" 
                value={dateRangeFilter.end}
                min={dateRangeFilter.start || fy.range?.from}
                max={fy.range?.to}
                onChange={(e) => pickDate("end", e.target.value)}
                className="w-full border border-gray-200 text-gray-700 text-sm font-medium rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#17a2b8] h-[42px]" 
              />
            </div>
          </div>
          <div className="flex-shrink-0 w-full sm:w-auto">
            <button 
              onClick={() => {
                setProjectFilter("");
                setStatusFilter("");
                setDateRangeFilter({ start: "", end: "" });
              }}
              className="w-full sm:w-auto flex justify-center items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-2 rounded-lg font-medium text-sm transition-colors h-[42px]"
            >
              <MdOutlineClear className="text-lg" />
              {t("overtime.filters.clear")}
            </button>
          </div>
        </div>
      </div>

      {/* ── Tab Content ── */}
      {activeTab === "employee" ? (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden w-full">
          <div className="overflow-x-auto custom-scrollbar w-full">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b border-gray-200">
                  {[t("overtimeList.columns.sno"), t("overtimeList.columns.employeeName"), t("overtimeList.columns.project"), t("overtimeList.columns.date"), t("overtimeList.columns.hours"), t("overtimeList.columns.rate"), t("overtimeList.columns.status"), t("overtimeList.columns.action")].map((h) => (
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
                {loading ? (
                  <TableLoader colSpan={8} label={t("myOvertime.loading")} />
                ) : paginatedEmployeeData.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-sm text-gray-400">
                      {t("myOvertime.empty")}
                    </td>
                  </tr>
                ) : paginatedEmployeeData.map((r, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50/80 transition-colors"
                  >
                    <td className="py-4 px-6 text-[13px] font-bold text-gray-600">
                      {String((employeePage - 1) * limit + idx + 1).padStart(2, '0')}
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
                        <span className="text-[13px] font-bold text-gray-900">{r.employee_name || `#${r.employee_id}`}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-[13px] font-bold text-gray-500">
                      {r.employee_code || "—"}
                    </td>
                    <td className="py-4 px-6 text-[13px] font-bold text-gray-600">
                      {fmtDate(r.work_date)}
                    </td>
                    <td className="py-4 px-6 text-[13px] text-gray-900 font-black">
                      {r.overtime_hours}
                    </td>
                    <td className="py-4 px-6 text-[13px] text-gray-600 font-medium">
                      {r.current_level ? t("overtimeList.levelShort", { current: r.current_level, total: r.total_levels }) : "—"}
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold ${STATUS_STYLE[r.status] || "bg-gray-100 text-gray-600"
                          }`}
                      >
                        {statusText(r.status)}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <button 
                        onClick={() => setSelectedEmployeeForModal(r)}
                        className="text-gray-400 hover:text-[#17a2b8] p-1.5 rounded-full hover:bg-gray-50 transition-colors"
                      >
                        <MdVisibility className="text-lg" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={employeePage}
            totalPages={Math.ceil(employeeData.length / limit) || 1}
            total={employeeData.length}
            limit={limit}
            onPage={setEmployeePage}
            label={t("common.requestsLabel")}
            activeClass="bg-[#17a2b8] text-white"
            containerClass="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-gray-100 bg-gray-50/50 mt-auto"
          />
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden w-full">
          <div className="overflow-x-auto custom-scrollbar w-full">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b border-gray-200">
                  {[t("overtimeList.columns.sno"), t("overtimeList.columns.requestId"), t("overtimeList.columns.project"), t("overtimeList.columns.employees"), t("overtimeList.columns.overtimeDate"), t("overtimeList.columns.hours"), t("overtimeList.columns.status"), t("overtimeList.columns.actions")].map((h) => (
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
                {loading ? (
                  <TableLoader colSpan={8} label={t("myOvertime.loading")} />
                ) : paginatedBulkData.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-sm text-gray-400">
                      {t("myOvertime.empty")}
                    </td>
                  </tr>
                ) : paginatedBulkData.map((r, idx) => (
                  <tr
                    key={r.batch_id}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50/80 transition-colors"
                  >
                    <td className="py-4 px-6 text-[13px] font-bold text-gray-600">
                      {String((bulkPage - 1) * limit + idx + 1).padStart(2, '0')}
                    </td>
                    <td className="py-4 px-6 text-[13px] font-bold text-gray-500">
                      {`BATCH-${String(r.batch_id).slice(0, 8)}`}
                    </td>
                    <td className="py-4 px-6 text-[13px] text-gray-600 font-bold">
                      —
                    </td>
                    <td className="py-4 px-6 text-[13px] font-bold text-gray-900">
                      {r.employees}
                    </td>
                    <td className="py-4 px-6 text-[13px] font-bold text-gray-600">
                      {fmtDate(r.date)}
                    </td>
                    <td className="py-4 px-6 text-[13px] text-gray-900 font-black">
                      {r.hours}
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold ${STATUS_STYLE[r.status] || "bg-gray-100 text-gray-600"
                          }`}
                      >
                        {statusText(r.status)}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <button
                        onClick={() => navigate(`/admin/attendance/request/bulk-approval?batch=${r.batch_id}`)}
                        className="text-[13px] font-bold text-[#17a2b8] hover:text-[#138496] transition-colors"
                      >
                        {t("common.view")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={bulkPage}
            totalPages={Math.ceil(bulkData.length / limit) || 1}
            total={bulkData.length}
            limit={limit}
            onPage={setBulkPage}
            label={t("common.requestsLabel")}
            activeClass="bg-[#17a2b8] text-white"
            containerClass="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-gray-100 bg-gray-50/50 mt-auto"
          />
        </div>
      )}

      {/* ── New Overtime Request Modal ── */}
      <NewOvertimeRequestModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSuccess={upsert}
      />

      <OvertimeDetailModal
        isOpen={!!selectedEmployeeForModal}
        onClose={() => setSelectedEmployeeForModal(null)}
        employee={selectedEmployeeForModal}
        onActed={upsert}
      />
    </div>
  );
}
