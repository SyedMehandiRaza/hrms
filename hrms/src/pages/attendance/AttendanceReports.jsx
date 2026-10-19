import { useEffect, useMemo, useState, useRef } from "react";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import { MdDownload, MdChevronLeft, MdChevronRight, MdOutlineClear } from "react-icons/md";
import * as XLSX from "xlsx";
import {
  ATT_REPORT_EMPLOYEES,
  ATT_getEmployeeMonthlyReport,
  ATT_getMonthlyGrid,
} from "../../data/groupD";
import { matches } from "../../data/common";
import CustomMonthPicker from "../../components/CustomMonthPicker";
import CustomDropdown from "../../components/CustomDropdown";

import useFiscalYear from "../../hooks/useFiscalYear";

// Cell styling for the grid codes.
const cellClass = (v) => {
  if (v === "A") return "bg-red-100 text-red-700 font-bold";
  if (v === "W") return "bg-amber-100 text-amber-700 font-bold";
  if (v === "H") return "bg-gray-200 text-gray-600 font-bold";
  if (v === "L") return "bg-blue-100 text-blue-700 font-bold";
  if (v === "" || v == null) return "text-gray-300";
  return "text-gray-800 font-semibold";
};

const GRID_LIMIT = 25;

const GRID_CODES = ["A", "W", "H", "L"];

export default function AttendanceReports() {
  const { t } = useTranslation("attendance");
  const [tab, setTab] = useState("employee");
  const fy = useFiscalYear();
  const [month, setMonth] = useState(fy.defaultMonth);
  // A new financial year in the header → its default month.
  const [fyVersion, setFyVersion] = useState(fy.version);
  if (fyVersion !== fy.version) {
    setFyVersion(fy.version);
    setMonth(fy.defaultMonth);
  }

  // ── Employees (for Report 1 picker) ──
  const [employeeId, setEmployeeId] = useState("");
  const empListLoading = false;
  const [empSearch, setEmpSearch] = useState("");
  // Client-side search over the static employee list.
  const employees = useMemo(() => {
    const q = empSearch.trim();
    return ATT_REPORT_EMPLOYEES.filter((e) => matches(e, q, ["full_name", "country_emp_id", "email"]));
  }, [empSearch]);

  const filteredEmployees = employees;
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedEmployee = employees.find(e => e.id === employeeId);
  const selectedEmployeeText = selectedEmployee ? `${selectedEmployee.full_name} ${selectedEmployee.country_emp_id ? `(${selectedEmployee.country_emp_id})` : ""}` : "";
  const inputValue = dropdownOpen ? empSearch : (selectedEmployeeText || empSearch);

  // ── Report 1 ──
  const emp = useMemo(
    () => (employeeId ? ATT_getEmployeeMonthlyReport(employeeId, month) : null),
    [employeeId, month],
  );
  const empLoading = false;

  // ── Report 2 ──
  const [gridType, setGridType] = useState("ALL");
  const [gridPage, setGridPage] = useState(1);
  const gridLoading = false;
  const grid = useMemo(
    () => (tab === "grid" ? ATT_getMonthlyGrid({ month, type: gridType, page: gridPage, limit: GRID_LIMIT }) : null),
    [tab, month, gridType, gridPage],
  );
  // A new month / group starts from page 1.
  const [gridKey, setGridKey] = useState(`${month}|${gridType}`);
  if (gridKey !== `${month}|${gridType}`) {
    setGridKey(`${month}|${gridType}`);
    setGridPage(1);
  }

  const dayNums = useMemo(
    () => (grid ? Array.from({ length: grid.days_in_month }, (_, i) => i + 1) : []),
    [grid],
  );

  // ── Exports ──
  const exportEmployee = () => {
    if (!emp) return;
    const head = [
      "Date", "Day", "Status",
      "Morning In", "Morning Out", "Afternoon In", "Afternoon Out",
      "OT In", "OT Out", "OT Hrs", "Daily Hours", "Approved By", "Remarks",
    ];
    const rows = emp.days.map((d) => [
      d.date, d.weekday, d.status,
      d.morning_in || "", d.morning_out || "", d.afternoon_in || "", d.afternoon_out || "",
      d.ot_in || "", d.ot_out || "", d.ot_hours || 0, d.day_hours, d.approved_by || "", d.remark || "",
    ]);
    const tot = emp.totals;
    const aoa = [
      [`${emp.employee.full_name} (${emp.employee.country_emp_id}) — ${emp.month}`],
      [`Designation: ${emp.employee.designation || "—"}   Supplier: ${emp.employee.supplier || "—"}   Type: ${emp.employee.employment_type || "—"}`],
      [],
      head, ...rows, [],
      ["TOTALS", "", "", "", "", "", "", "", "", tot.overtime_hours, tot.worked_hours, "", ""],
      [`Working days: ${tot.working_days}  Present: ${tot.present_days}  Absent: ${tot.absent_days}  Weekly off: ${tot.weekly_off}  Holiday: ${tot.holiday}  Leave: ${tot.leave_days}  Allotted hrs: ${tot.allotted_hours}`],
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "Attendance");
    XLSX.writeFile(wb, `attendance_${emp.employee.country_emp_id}_${emp.month}.xlsx`);
  };

  const buildGridSheet = (rows, days) => {
    const head = ["S.No", "Name", "Code", "Designation", "Supplier", ...days, "Total", "Allotted", "Approved OT", "Status"];
    const body = rows.map((r, i) => [
      i + 1, r.name, r.code, r.designation || "—", r.supplier || "—",
      ...days.map((d) => r.days[d] ?? ""),
      r.total_worked_hours, r.total_allotted_hours, r.approved_overtime_hours, r.status,
    ]);
    return XLSX.utils.aoa_to_sheet([head, ...body]);
  };

  // Every row of a group, no paging, so the export never drops employees.
  const fetchAllGrid = (type) => ATT_getMonthlyGrid({ month, type, page: 1, limit: 100000 });

  const exportGrid = () => {
    try {
      // Own + Staffing as separate tabs, ALL rows across all pages.
      const own = fetchAllGrid("OWN");
      const staff = fetchAllGrid("STAFFING");
      const days = Array.from({ length: (own || staff)?.days_in_month || 31 }, (_, i) => i + 1);
      const wb = XLSX.utils.book_new();
      if (own?.data?.length) XLSX.utils.book_append_sheet(wb, buildGridSheet(own.data, days), "Own Employees");
      if (staff?.data?.length) XLSX.utils.book_append_sheet(wb, buildGridSheet(staff.data, days), "Staffing");
      if (!wb.SheetNames.length) return toast.info(t("reports.toast.noDataToExport"));
      XLSX.writeFile(wb, `attendance_grid_${month}.xlsx`);
    } catch (e) {
      toast.error(e?.message || t("reports.toast.exportFailed"));
    }
  };

  return (
    <div className="space-y-6 max-w-full mx-auto p-4 sm:p-6 bg-white min-h-screen rounded-xl border border-gray-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("reports.title")}</h1>
          <p className="text-gray-500 mt-1 text-sm font-medium">
            {t("reports.subtitle")}
          </p>
        </div>
        <CustomMonthPicker
          value={month}
          onChange={setMonth}
        />
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 p-1 rounded-lg w-max">
        {[
          { k: "employee", label: t("reports.tabs.employee") },
          { k: "grid", label: t("reports.tabs.grid") },
        ].map((tb) => (
          <button
            key={tb.k}
            onClick={() => setTab(tb.k)}
            className={`px-5 py-2 rounded-md text-sm font-bold transition-colors ${tab === tb.k ? "bg-[#17a2b8] text-white" : "text-gray-600 hover:text-gray-900"
              }`}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {/* ── Report 1 ── */}
      {tab === "employee" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="relative" ref={dropdownRef}>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                {t("reports.employee")} {empListLoading ? t("reports.loadingParen") : `(${filteredEmployees.length})`}
              </label>
              <div
                className="border border-gray-200 rounded-lg bg-white flex items-center min-w-[400px] focus-within:ring-2 focus-within:ring-cyan-500 cursor-text"
                onClick={() => setDropdownOpen(true)}
              >
                <input
                   type="text"
                   value={inputValue}
                   onChange={(e) => {
                     setEmpSearch(e.target.value);
                     setEmployeeId(""); // clear selection when typing
                     if (!dropdownOpen) setDropdownOpen(true);
                   }}
                   onFocus={() => {
                     setEmpSearch(""); // Clear search to show full list
                     setDropdownOpen(true);
                   }}
                   placeholder={t("reports.searchEmployee")}
                   className="w-full px-4 py-2.5 text-sm text-gray-700 focus:outline-none bg-transparent"
                />
                <button
                   type="button"
                   className="px-3 text-gray-400 focus:outline-none"
                   onClick={(e) => {
                     e.stopPropagation();
                     setDropdownOpen(!dropdownOpen);
                   }}
                >
                   <svg className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
              </div>
              
              {dropdownOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto custom-scrollbar">
                  {empListLoading ? (
                    <div className="px-4 py-3 text-sm text-gray-500">{t("reports.loadingEmployees")}</div>
                  ) : filteredEmployees.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-gray-500">{t("reports.noEmployeesFound")}</div>
                  ) : (
                    <ul>
                      {filteredEmployees.map((e) => (
                        <li
                          key={e.id}
                          className={`px-4 py-2 text-sm cursor-pointer hover:bg-cyan-50 hover:text-cyan-700 ${e.id === employeeId ? 'bg-cyan-100 text-cyan-800 font-medium' : 'text-gray-700'}`}
                          onClick={() => {
                            setEmployeeId(e.id);
                            setEmpSearch(""); 
                            setDropdownOpen(false);
                          }}
                        >
                          {e.full_name} {e.country_emp_id ? `(${e.country_emp_id})` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex-shrink-0 flex items-end">
              <button
                onClick={() => {
                  setEmployeeId("");
                  setEmpSearch("");
                  setDropdownOpen(false);
                }}
                className="w-full sm:w-auto flex justify-center items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-2 rounded-lg font-medium text-sm transition-colors h-[42px]"
              >
                <MdOutlineClear className="text-lg" />
                {t("reports.clearFilter")}
              </button>
            </div>

            <button
              onClick={exportEmployee}
              disabled={!emp}
              className="flex items-center gap-2 bg-[#17a2b8] hover:bg-[#138496] text-white px-4 py-2.5 rounded-lg text-sm font-bold disabled:opacity-50"
            >
              <MdDownload className="text-lg" /> {t("reports.downloadExcel")}
            </button>
          </div>

          {empLoading ? (
            <div className="py-12 text-center text-sm text-gray-400">{t("common.loadingEllipsis")}</div>
          ) : !emp ? (
            <div className="py-12 text-center text-sm text-gray-400">{t("reports.selectEmployee")}</div>
          ) : (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-[#f8f9fc] flex flex-wrap gap-x-6 gap-y-1 text-sm">
                <span className="font-bold text-gray-900">{emp.employee.full_name}</span>
                <span className="text-gray-500">{emp.employee.country_emp_id}</span>
                <span className="text-gray-500">{t("reports.designation")} <b className="text-gray-700">{emp.employee.designation || "—"}</b></span>
                <span className="text-gray-500">{t("reports.supplier")} <b className="text-gray-700">{emp.employee.supplier || "—"}</b></span>
                <span className="text-gray-500">{t("reports.allotted")} <b className="text-gray-700">{t("common.hoursValue", { value: emp.totals.allotted_hours })}</b></span>
                <span className="text-gray-500">{t("reports.worked")} <b className="text-gray-700">{t("common.hoursValue", { value: emp.totals.worked_hours })}</b></span>
                <span className="text-gray-500">{t("reports.ot")} <b className="text-gray-700">{t("common.hoursValue", { value: emp.totals.overtime_hours })}</b></span>
              </div>
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-[900px] text-[13px]">
                  <thead>
                    <tr className="bg-[#f2f4f8] border-b border-gray-200">
                      {[t("reports.columns.date"), t("reports.columns.day"), t("reports.columns.morningIn"), t("reports.columns.morningOut"), t("reports.columns.afternoonIn"), t("reports.columns.afternoonOut"), t("reports.columns.otIn"), t("reports.columns.otOut"), t("reports.columns.dailyHrs"), t("reports.columns.approvedBy"), t("reports.columns.remarks")].map((h) => (
                        <th key={h} className="py-3 px-4 text-[11px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {emp.days.map((d) => (
                      <tr key={d.date} className={`border-b border-gray-100 ${d.status === "WEEKLY_OFF" ? "bg-amber-50" : d.status === "HOLIDAY" ? "bg-gray-50" : ""}`}>
                        <td className="py-2.5 px-4 font-semibold text-gray-800 whitespace-nowrap">{d.date.slice(8)}-{d.date.slice(5, 7)}</td>
                        <td className="py-2.5 px-4 text-gray-500">{d.weekday}</td>
                        <td className="py-2.5 px-4">{d.morning_in || "—"}</td>
                        <td className="py-2.5 px-4">{d.morning_out || "—"}</td>
                        <td className="py-2.5 px-4">{d.afternoon_in || "—"}</td>
                        <td className="py-2.5 px-4">{d.afternoon_out || "—"}</td>
                        <td className="py-2.5 px-4">{d.ot_in ? new Date(d.ot_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : (d.ot_in || "—")}</td>
                        <td className="py-2.5 px-4">{d.ot_out ? new Date(d.ot_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : (d.ot_out || "—")}</td>
                        <td className="py-2.5 px-4 font-bold text-gray-900">{d.day_hours || "—"}</td>
                        <td className="py-2.5 px-4 text-gray-500">{d.approved_by || "—"}</td>
                        <td className="py-2.5 px-4 text-gray-500">{d.remark || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#f8f9fc] font-bold text-gray-900">
                      <td className="py-3 px-4" colSpan={8}>{t("reports.monthTotal")}</td>
                      <td className="py-3 px-4">{t("common.hoursValue", { value: emp.totals.worked_hours })}</td>
                      <td className="py-3 px-4" colSpan={2}>{t("reports.otTotal", { hours: emp.totals.overtime_hours })}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Report 2 ── */}
      {tab === "grid" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-end gap-3">
              <div className="w-48">
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">{t("reports.group")}</label>
                <CustomDropdown
                  value={gridType}
                  onChange={(e) => setGridType(e.target.value)}
                  options={[
                    { label: t("reports.groupOptions.all"), value: "ALL" },
                    { label: t("reports.groupOptions.own"), value: "OWN" },
                    { label: t("reports.groupOptions.staffing"), value: "STAFFING" }
                  ]}
                />
              </div>
              <div className="flex items-center gap-3 text-[11px] text-gray-500 pb-2">
                <span><b className="text-red-600">{t("reports.gridCode.A")}</b> {t("reports.legend.absent")}</span>
                <span><b className="text-amber-600">{t("reports.gridCode.W")}</b> {t("reports.legend.weeklyOff")}</span>
                <span><b className="text-gray-600">{t("reports.gridCode.H")}</b> {t("reports.legend.holiday")}</span>
                <span><b className="text-blue-600">{t("reports.gridCode.L")}</b> {t("reports.legend.leave")}</span>
              </div>
            </div>
            <button
              onClick={exportGrid}
              className="flex items-center gap-2 bg-[#17a2b8] hover:bg-[#138496] text-white px-4 py-2.5 rounded-lg text-sm font-bold"
            >
              <MdDownload className="text-lg" /> {t("reports.downloadExcel")}
            </button>
          </div>

          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse text-[12px]">
                <thead>
                  <tr className="bg-[#f2f4f8] border-b border-gray-200">
                    <th className="sticky left-0 bg-[#f2f4f8] py-3 px-3 text-[10px] font-bold text-gray-600 uppercase">{t("reports.gridColumns.sno")}</th>
                    <th className="sticky left-[46px] bg-[#f2f4f8] py-3 px-3 text-[10px] font-bold text-gray-600 uppercase min-w-[150px]">{t("reports.gridColumns.name")}</th>
                    <th className="py-3 px-3 text-[10px] font-bold text-gray-600 uppercase">{t("reports.gridColumns.designation")}</th>
                    <th className="py-3 px-3 text-[10px] font-bold text-gray-600 uppercase">{t("reports.gridColumns.supplier")}</th>
                    {dayNums.map((d) => (
                      <th key={d} className="py-3 px-1.5 text-[10px] font-bold text-gray-500 text-center w-8">{d}</th>
                    ))}
                    <th className="py-3 px-3 text-[10px] font-bold text-gray-700 uppercase text-center">{t("reports.gridColumns.total")}</th>
                    <th className="py-3 px-3 text-[10px] font-bold text-gray-700 uppercase text-center">{t("reports.gridColumns.allotted")}</th>
                    <th className="py-3 px-3 text-[10px] font-bold text-gray-700 uppercase text-center">{t("reports.gridColumns.ot")}</th>
                  </tr>
                </thead>
                <tbody>
                  {gridLoading && !grid ? (
                    <tr><td colSpan={dayNums.length + 7} className="py-10 text-center text-sm text-gray-400">{t("common.loadingEllipsis")}</td></tr>
                  ) : !grid?.data?.length ? (
                    <tr><td colSpan={dayNums.length + 7} className="py-10 text-center text-sm text-gray-400">{t("reports.noEmployees")}</td></tr>
                  ) : (
                    grid.data.map((r, i) => (
                      <tr key={r.employee_id} className="border-b border-gray-100 hover:bg-gray-50/60">
                        <td className="sticky left-0 bg-white py-2 px-3 text-gray-500">{(grid.page - 1) * grid.limit + i + 1}</td>
                        <td className="sticky left-[46px] bg-white py-2 px-3 font-bold text-gray-900 whitespace-nowrap">{r.name}</td>
                        <td className="py-2 px-3 text-gray-500">{r.designation || "—"}</td>
                        <td className="py-2 px-3 text-gray-500">{r.supplier || "—"}</td>
                        {dayNums.map((d) => (
                          <td key={d} className={`py-2 px-1.5 text-center ${cellClass(r.days[d])}`}>{GRID_CODES.includes(r.days[d]) ? t(`reports.gridCode.${r.days[d]}`) : (r.days[d] ?? "")}</td>
                        ))}
                        <td className="py-2 px-3 text-center font-bold text-gray-900">{r.total_worked_hours}</td>
                        <td className="py-2 px-3 text-center text-gray-600">{r.total_allotted_hours}</td>
                        <td className="py-2 px-3 text-center text-cyan-700 font-semibold">{r.approved_overtime_hours}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {grid && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                <span className="text-sm text-gray-500">
                  {t("reports.pageInfo", { page: grid.page, pages: grid.total_pages || 1, total: grid.total })}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setGridPage((p) => Math.max(1, p - 1))}
                    disabled={gridPage === 1}
                    className="w-8 h-8 flex items-center justify-center rounded border border-gray-200 text-gray-500 disabled:opacity-40"
                  >
                    <MdChevronLeft />
                  </button>
                  <button
                    onClick={() => setGridPage((p) => Math.min(grid.total_pages || 1, p + 1))}
                    disabled={gridPage >= (grid.total_pages || 1)}
                    className="w-8 h-8 flex items-center justify-center rounded border border-gray-200 text-gray-500 disabled:opacity-40"
                  >
                    <MdChevronRight />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}