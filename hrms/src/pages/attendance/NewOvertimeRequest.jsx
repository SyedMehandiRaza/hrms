import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MdSearch, MdChevronLeft, MdChevronRight, MdOutlineClear } from "react-icons/md";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import CustomDropdown from "../../components/CustomDropdown";
import {
  OT_EMPLOYEES,
  OT_PROJECTS,
  OT_REQUESTS,
  OT_buildRequest,
  OT_newBatchId,
  OT_nextId,
  OT_saveRequests,
} from "../../data/groupD";
import { matches } from "../../data/common";
import FieldError from "../../components/FieldError";
import useFiscalYear from "../../hooks/useFiscalYear";
import useYearLock from "../../hooks/useYearLock";
import { closedDateRule } from "../../utils/fyValidation/ops-time";

const inputCls = (err, extra = "") =>
  `w-full border text-gray-700 text-sm font-medium rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#17a2b8] ${err ? "border-red-300 bg-red-50" : "border-gray-200"} ${extra}`;

// Employees filtered by project + search (the API did this server-side).
const filterEmployees = (project_id, search) =>
  OT_EMPLOYEES.filter(
    (e) =>
      (!project_id || e.projects.some((p) => String(p.id) === String(project_id))) &&
      matches(e, (search || "").trim(), ["full_name", "employee_code", "email"]),
  );

const PROJECT_OPTIONS = [
  { label: "Select Project", value: "" },
  ...OT_PROJECTS.map((p) => ({ label: p.project_name || p.name, value: p.id })),
];

// The employee's main project name (falls back to any assigned project).
const mainProjectName = (emp) => {
  const list = emp.projects || [];
  const main = list.find((p) => p.id === emp.main_project_id);
  if (main) return main.project_name;
  if (list.length) return list.map((p) => p.project_name).join(", ");
  return "—";
};

export default function NewOvertimeRequest() {
  const { t } = useTranslation("attendance");
  const navigate = useNavigate();
  const [employees, setEmployees] = useState(() => filterEmployees("", ""));
  const projects = PROJECT_OPTIONS;
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [visibleCount, setVisibleCount] = useState(4);
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);

  // Step 1 filters.
  const [filterProjectId, setFilterProjectId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Debounced search → re-filter the employee list.
  useEffect(() => {
    const id = setTimeout(() => {
      setEmployees(filterEmployees(filterProjectId, searchTerm));
      setVisibleCount(4);
    }, 400);
    return () => clearTimeout(id);
  }, [searchTerm, filterProjectId]);

  // Step 2 — one shared overtime detail applied to every selected employee.
  const [form, setForm] = useState({ work_date: "", start_time: "", end_time: "", reason: "", project_id: "" });
  const submitting = false;
  // Errors shown under each Step-2 input (client rules + server field errors).
  const [fieldErrs, setFieldErrs] = useState({});
  const fy = useFiscalYear();
  const lock = useYearLock();

  // Load employees, filtered by project + search (both handled server-side).
  const loadEmployees = (opts = {}) => {
    const project_id = opts.project_id !== undefined ? opts.project_id : filterProjectId;
    const search = opts.search !== undefined ? opts.search : searchTerm;
    setEmployees(filterEmployees(project_id, search));
    setVisibleCount(4);
  };

  // A new header year → its projects (/project is year-scoped); the selection
  // and project filters of the old year no longer apply.
  const [fySel, setFySel] = useState(fy.selected);
  if (fySel !== fy.selected) {
    setFySel(fy.selected);
    setSelectedEmployees([]);
    setFilterProjectId("");
    setForm((f) => ({ ...f, project_id: "" }));
    setEmployees(filterEmployees("", searchTerm));
    setVisibleCount(4);
  }

  const displayedEmployees = employees.slice(0, visibleCount);

  const toggleEmployee = (id) => {
    setSelectedEmployees((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleAll = () => {
    setSelectedEmployees((prev) =>
      prev.length === displayedEmployees.length ? [] : displayedEmployees.map((e) => e.id),
    );
  };

  const onField = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setFieldErrs((prev) => (prev[k] ? { ...prev, [k]: undefined } : prev));
  };

  // Same checks as the modal form / backend: required date + times, the end
  // after the start on the same day, and the date not in a closed financial year.
  const validateForm = () => {
    const errs = {};
    if (!form.work_date) errs.work_date = t("overtimeModal.workDateRequired");
    else {
      const closed = closedDateRule(t, lock, fy.years)(form.work_date);
      if (closed !== true) errs.work_date = closed;
    }
    if (!form.start_time) errs.start_time = t("overtimeModal.startTimeRequired");
    if (!form.end_time) errs.end_time = t("overtimeModal.endTimeRequired");
    else if (form.start_time && form.end_time <= form.start_time) errs.end_time = t("common.endAfterStart");
    return errs;
  };

  const handleSubmit = async () => {
    if (!selectedEmployees.length) {
      toast.error(t("newOvertime.toast.selectAtLeastOne"));
      return;
    }
    const errs = validateForm();
    setFieldErrs(errs);
    if (Object.keys(errs).length) return;
    // One request per selected employee, sharing a batch id (as the API does).
    const batch_id = OT_newBatchId();
    let id = OT_nextId();
    const created = selectedEmployees.map((employee_id) =>
      OT_buildRequest(id++, {
        employee_id,
        project_id: form.project_id || null,
        work_date: form.work_date,
        start_time: form.start_time,
        end_time: form.end_time,
        reason: form.reason,
        batch_id,
      }),
    );
    OT_saveRequests([...created, ...OT_REQUESTS]);
    toast.success(t("newOvertime.toast.submitted"));
    navigate("/admin/attendance/request");
  };

  return (
    <div className="space-y-6 w-full p-4 sm:p-6 bg-white min-h-screen rounded-xl border border-gray-200">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm font-bold mb-6">
        <Link to="/admin/attendance/request" className="text-gray-500 hover:text-gray-700">
          {t("newOvertime.breadcrumbOvertime")}
        </Link>
        <span className="text-gray-400">›</span>
        <span className="text-[#17a2b8]">{t("newOvertime.newRequest")}</span>
      </div>

      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{t("newOvertime.title")}</h1>
        <p className="text-gray-500 mt-1 text-sm font-medium">
          {t("newOvertime.subtitle")}
        </p>
      </div>

      {/* Step 1: Select Employees */}
      <div className="border border-gray-200 rounded-xl mb-8 overflow-hidden transition-all duration-300">
        {showSelectedOnly ? (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-[#f8f9fc] px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-200 gap-4">
              <h2 className="text-lg font-bold text-gray-800">{t("newOvertime.selectedEmployees", { value: selectedEmployees.length })}</h2>
              <button
                onClick={() => setShowSelectedOnly(false)}
                className="flex items-center gap-2 text-[13px] font-bold text-gray-700 bg-white border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors w-fit"
              >
                {t("newOvertime.backToAll")}
              </button>
            </div>
            <div className="p-6">
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse min-w-[600px] relative">
                    <thead className="sticky top-0 z-10 shadow-sm">
                      <tr className="bg-[#f8f9fc] border-b border-gray-200">
                        <th className="py-4 px-6 w-16 bg-[#f8f9fc]">
                          <input
                            type="checkbox"
                            checked={selectedEmployees.length > 0}
                            onChange={toggleAll}
                            className="appearance-none flex items-center justify-center w-4 h-4 rounded border border-gray-300 bg-white checked:bg-[#10b981] checked:border-[#10b981] focus:ring-1 focus:ring-[#10b981] transition-colors relative after:absolute after:content-[''] after:w-[5px] after:h-[9px] after:border-r-2 after:border-b-2 after:border-white after:rotate-45 after:-translate-y-[1px] after:hidden checked:after:block cursor-pointer"
                          />
                        </th>
                        <th className="py-4 px-6 text-[13px] font-bold text-gray-600 whitespace-nowrap bg-[#f8f9fc]">{t("newOvertime.columns.employeeName")}</th>
                        <th className="py-4 px-6 text-[13px] font-bold text-gray-600 whitespace-nowrap bg-[#f8f9fc]">{t("newOvertime.columns.role")}</th>
                        <th className="py-4 px-6 text-[13px] font-bold text-gray-600 whitespace-nowrap bg-[#f8f9fc]">{t("newOvertime.columns.project")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees.filter(emp => selectedEmployees.includes(emp.id)).map((emp) => (
                        <tr key={emp.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                          <td className="py-4 px-6">
                            <input
                              type="checkbox"
                              checked={true}
                              onChange={() => toggleEmployee(emp.id)}
                              className="appearance-none flex items-center justify-center w-4 h-4 rounded border border-gray-300 bg-white checked:bg-[#10b981] checked:border-[#10b981] focus:ring-1 focus:ring-[#10b981] transition-colors relative after:absolute after:content-[''] after:w-[5px] after:h-[9px] after:border-r-2 after:border-b-2 after:border-white after:rotate-45 after:-translate-y-[1px] after:hidden checked:after:block cursor-pointer"
                            />
                          </td>
                          <td className="py-4 px-6 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <img src={emp.profile_url || `https://i.pravatar.cc/150?u=`} alt={emp.full_name} className="w-8 h-8 rounded-full" />
                              <span className="text-[14px] font-bold text-gray-900">{emp.full_name}</span>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-[14px] font-medium text-gray-500 whitespace-nowrap">{emp.employment_type || "—"}</td>
                          <td className="py-4 px-6 text-[14px] font-medium text-gray-500 whitespace-nowrap">{mainProjectName(emp)}</td>
                        </tr>
                      ))}
                      {selectedEmployees.length === 0 && (
                        <tr>
                          <td colSpan="4" className="py-8 text-center text-sm text-gray-500 font-medium">
                            {t("newOvertime.noSelected")}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {/* Pagination footer */}
                <div className="py-4 px-6 flex flex-col sm:flex-row items-center justify-between border-t border-gray-100 bg-[#f8f9fc] gap-4">
                  <span className="text-[13px] text-gray-500 font-medium">
                    {t("newOvertime.showingSelected", { value: selectedEmployees.length })}
                  </span>
                  <div className="flex items-center gap-1">
                    <button className="w-8 h-8 flex items-center justify-center rounded border border-gray-200 text-gray-400 hover:bg-gray-50 transition-colors">
                      <MdChevronLeft className="text-lg" />
                    </button>
                    <button className="w-8 h-8 flex items-center justify-center rounded border border-[#17a2b8] text-[#17a2b8] font-bold text-sm bg-white">
                      1
                    </button>
                    <button className="w-8 h-8 flex items-center justify-center rounded text-gray-600 font-medium text-sm hover:bg-gray-50 transition-colors">
                      2
                    </button>
                    <button className="w-8 h-8 flex items-center justify-center rounded text-gray-600 font-medium text-sm hover:bg-gray-50 transition-colors">
                      3
                    </button>
                    <button className="w-8 h-8 flex items-center justify-center rounded border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                      <MdChevronRight className="text-lg" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="bg-[#f8f9fc] px-6 py-4 flex items-center justify-between border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-800">{t("newOvertime.step1")}</h2>
              <button
                onClick={() => setShowSelectedOnly(true)}
                className="text-[#17a2b8] bg-white border border-[#17a2b8]/20 px-3 py-1 rounded-md text-[13px] font-bold hover:bg-[#17a2b8]/10 transition-colors shadow-sm cursor-pointer"
              >
                {t("newOvertime.selectedCount", { value: selectedEmployees.length })}
              </button>
            </div>

            <div className="p-6">
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="w-full sm:w-64 shrink-0 relative z-20">
                  <CustomDropdown
                    isSearchable
                    value={filterProjectId}
                    onChange={(e) => {
                      setFilterProjectId(e.target.value);
                      loadEmployees({ project_id: e.target.value });
                    }}
                    options={[
                      { label: t("common.allProjects"), value: "" },
                      ...projects.filter(p => p.value !== "")
                    ]}
                  />
                </div>
                <div className="relative flex-grow">
                  <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
                  <input
                    type="text"
                    placeholder={t("newOvertime.searchEmployees")}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full border border-gray-200 text-gray-700 text-sm font-medium rounded-lg pl-11 pr-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#17a2b8]"
                  />
                </div>
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setFilterProjectId("");
                    loadEmployees({ project_id: "", search: "" });
                  }}
                  className="w-full sm:w-auto flex justify-center items-center gap-2 bg-[#17a2b8] hover:bg-[#138496] text-white px-5 py-2.5 rounded-lg font-bold text-sm transition-colors h-[42px]"
                >
                  <MdOutlineClear className="text-lg" />
                  {t("common.clearFilters")}
                </button>
              </div>

              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-[350px] overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse min-w-[600px] relative">
                    <thead className="sticky top-0 z-10 shadow-sm">
                      <tr className="bg-[#f8f9fc] border-b border-gray-200">
                        <th className="py-4 px-6 w-16 bg-[#f8f9fc]">
                          <input
                            type="checkbox"
                            checked={selectedEmployees.length > 0 && selectedEmployees.length === displayedEmployees.length}
                            onChange={toggleAll}
                            className="appearance-none flex items-center justify-center w-4 h-4 rounded border border-gray-300 bg-white checked:bg-[#10b981] checked:border-[#10b981] focus:ring-1 focus:ring-[#10b981] transition-colors relative after:absolute after:content-[''] after:w-[5px] after:h-[9px] after:border-r-2 after:border-b-2 after:border-white after:rotate-45 after:-translate-y-[1px] after:hidden checked:after:block cursor-pointer"
                          />
                        </th>
                        <th className="py-4 px-6 text-[13px] font-bold text-gray-600 whitespace-nowrap bg-[#f8f9fc]">{t("newOvertime.columns.employeeName")}</th>
                        <th className="py-4 px-6 text-[13px] font-bold text-gray-600 whitespace-nowrap bg-[#f8f9fc]">{t("newOvertime.columns.role")}</th>
                        <th className="py-4 px-6 text-[13px] font-bold text-gray-600 whitespace-nowrap bg-[#f8f9fc]">{t("newOvertime.columns.project")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedEmployees.map((emp) => (
                        <tr key={emp.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                          <td className="py-4 px-6">
                            <input
                              type="checkbox"
                              checked={selectedEmployees.includes(emp.id)}
                              onChange={() => toggleEmployee(emp.id)}
                              className="appearance-none flex items-center justify-center w-4 h-4 rounded border border-gray-300 bg-white checked:bg-[#10b981] checked:border-[#10b981] focus:ring-1 focus:ring-[#10b981] transition-colors relative after:absolute after:content-[''] after:w-[5px] after:h-[9px] after:border-r-2 after:border-b-2 after:border-white after:rotate-45 after:-translate-y-[1px] after:hidden checked:after:block cursor-pointer"
                            />
                          </td>
                          <td className="py-4 px-6 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <img src={emp.profile_url || `https://i.pravatar.cc/150?u=`} alt={emp.full_name} className="w-8 h-8 rounded-full" />
                              <span className="text-[14px] font-bold text-gray-900">{emp.full_name}</span>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-[14px] font-medium text-gray-500 whitespace-nowrap">{emp.employment_type || "—"}</td>
                          <td className="py-4 px-6 text-[14px] font-medium text-gray-500 whitespace-nowrap">{mainProjectName(emp)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {visibleCount < employees.length && (
                  <div className="py-4 text-center border-t border-gray-100">
                    <button
                      onClick={() => setVisibleCount((prev) => prev + 4)}
                      className="text-[#17a2b8] hover:text-[#138496] font-bold text-[13px] transition-colors"
                    >
                      {t("newOvertime.loadMore")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Step 2: Overtime Detail */}
      <div className="border border-gray-200 rounded-xl mb-8 overflow-visible relative z-10">
        <div className="bg-[#f8f9fc] px-6 py-4 border-b border-gray-200 rounded-t-xl">
          <h2 className="text-lg font-bold text-gray-800">{t("newOvertime.step2")}</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-[11px] font-bold text-gray-600 tracking-wider uppercase mb-2">
                {t("common.overtimeDate")}
              </label>
              <input
                type="date"
                value={form.work_date}
                min={fy.range?.from}
                max={fy.range?.to}
                onChange={onField("work_date")}
                className={inputCls(fieldErrs.work_date)}
              />
              <FieldError message={fieldErrs.work_date} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-600 tracking-wider uppercase mb-2">
                  {t("common.startTime")}
                </label>
                <input
                  type="time"
                  value={form.start_time}
                  onChange={onField("start_time")}
                  className={inputCls(fieldErrs.start_time)}
                />
                <FieldError message={fieldErrs.start_time} />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-600 tracking-wider uppercase mb-2">
                  {t("common.endTime")}
                </label>
                <input
                  type="time"
                  value={form.end_time}
                  onChange={onField("end_time")}
                  className={inputCls(fieldErrs.end_time)}
                />
                <FieldError message={fieldErrs.end_time} />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-600 tracking-wider uppercase mb-2">
                {t("newOvertime.project")}
              </label>
              <CustomDropdown
                isSearchable
                options={projects.map((p) => (p.value === "" ? { ...p, label: t("newOvertime.selectProject") } : p))}
                value={form.project_id}
                onChange={onField("project_id")}
                name="project_id"
              />
              <FieldError message={fieldErrs.project_id} />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-600 tracking-wider uppercase mb-2">
                {t("newOvertime.reasonForOvertime")}
              </label>
              <textarea
                placeholder={t("newOvertime.reasonPlaceholder")}
                rows="3"
                value={form.reason}
                onChange={onField("reason")}
                className={inputCls(fieldErrs.reason, "resize-none")}
              ></textarea>
              <FieldError message={fieldErrs.reason} />
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="border border-gray-200 rounded-xl p-6 flex items-center justify-end gap-4">
        <button
          onClick={() => navigate(-1)}
          className="px-6 py-2.5 border border-gray-200 text-gray-700 font-bold text-sm rounded-lg hover:bg-gray-50 transition-colors"
        >
          {t("common.cancel")}
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting || lock.locked}
          title={lock.title}
          className="px-6 py-2.5 bg-[#17a2b8] hover:bg-[#138496] text-white font-bold text-sm rounded-lg transition-colors disabled:opacity-60"
        >
          {submitting ? t("common.submitting") : t("common.submitRequest")}
        </button>
      </div>
    </div>
  );
}
