import { useEffect, useRef, useState, useMemo } from "react";
import CustomDropdown from "../components/CustomDropdown";

import { useForm } from "react-hook-form";
import { useTranslation, Trans } from "react-i18next";
import {
  MdClose,
  MdOutlineError,
  MdOutlinePerson,
  MdOutlineDelete,
  MdAddCircleOutline,
  MdOutlineAttachMoney,
} from "react-icons/md";
import { toast } from "react-toastify";
import ApprovalRoutingSection from "./ApprovalRoutingSection";
import { NAME_PATTERN, NAME_STRIP } from "../utils/nameRules";
import {
  B_ROLES,
  B_PROJECTS,
  LEAVE_POLICIES,
  STAFFING_COMPANIES,
  SHIFTS,
  SALARY_CATALOG,
  DEPARTMENTS,
  designationsForDepartment,
  searchCountries,
  employeeSalary,
  updateEmployeeRecord,
} from "../data/groupB";
import useFiscalYear from "../hooks/useFiscalYear";
import { joiningDateRule, maxJoiningDate } from "../utils/fyValidation/misc";

const SALARY_CURRENCIES = [
  "AED",
  "SAR",
  "USD",
  "EUR",
  "GBP",
  "INR",
  "AUD",
  "CAD",
  "SGD",
];

const ACCESS_LEVELS = [
  { value: "GENERAL_EMPLOYEE", labelKey: "edit.accessLevels.generalEmployee" },
  { value: "EMPLOYEE", labelKey: "edit.accessLevels.employee" },
  { value: "SUB_ADMIN", labelKey: "edit.accessLevels.subAdmin" },
  { value: "ADMIN", labelKey: "edit.accessLevels.admin" },
];

// Salary calculation modes (must match AddEmployee + the backend model).
const MODE_LABEL_KEYS = {
  MONTHLY_FIXED: "add.salary.modes.monthlyFixed",
  MONTHLY_HOURLY: "add.salary.modes.monthlyHourly",
  HOURLY: "add.salary.modes.hourly",
};

// Overtime multiplier choices (1×–5× in 0.5 steps).
const OVERTIME_RATE_OPTIONS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((n) => ({
  label: `${n}×`,
  value: String(n),
}));

// Which modes an employee may use, from hire type + staffing assignment:
//   staffing employee → HOURLY only
//   Contract          → Monthly (hours) or Hourly
//   Full-time         → Monthly (fixed) or Monthly (hours)
const allowedSalaryModes = ({ employmentType, staffingCompanyId }) => {
  const isStaffing = employmentType === "Contract" && !!staffingCompanyId;
  if (isStaffing) return ["HOURLY"];
  if (employmentType === "Contract") return ["MONTHLY_HOURLY", "HOURLY"];
  return ["MONTHLY_FIXED", "MONTHLY_HOURLY"];
};

const codeOf = (c) => String(c?.code || "").toUpperCase();

// Nationality and Country Codes are now fetched dynamically

const inputBase =
  "w-full px-4 py-2.5 border rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition bg-white";
const inputCls = (err) =>
  `${inputBase} ${err ? "border-red-400 bg-red-50" : "border-gray-200"}`;
const labelCls =
  "block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5";

const FieldErr = ({ error }) =>
  error ? (
    <p className="flex items-center gap-1 text-xs text-red-500 mt-1.5">
      <MdOutlineError className="shrink-0 text-sm" />
      {error.message}
    </p>
  ) : null;

const removeEmojisAndSlashes = (e) => {
  const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
  let val = e.target.value;
  if (emojiRegex.test(val) || /[/\\]/.test(val)) {
    e.target.value = val.replace(emojiRegex, "").replace(/[/\\]/g, "");
  }
};

const fmtShiftTime = (val) => (val ? String(val).slice(0, 5) : "");

// Split a stored phone number (e.g. "+91987…") into { countryCode, phone }.
// We use a list of common country codes to safely split without consuming phone digits,
// because a regex like ^(\+\d{1,4}) is greedy and turns +917828... into code +9178.
const COMMON_COUNTRY_CODES = [
  "+1", "+20", "+27", "+30", "+31", "+32", "+33", "+34", "+36", "+39", "+40",
  "+41", "+43", "+44", "+45", "+46", "+47", "+48", "+49", "+51", "+52", "+53",
  "+54", "+55", "+56", "+57", "+58", "+60", "+61", "+62", "+63", "+64", "+65",
  "+66", "+81", "+82", "+84", "+86", "+90", "+91", "+92", "+93", "+94", "+95",
  "+98", "+212", "+213", "+216", "+218", "+220", "+221", "+222", "+223", "+224",
  "+225", "+226", "+227", "+228", "+229", "+230", "+231", "+232", "+233", "+234",
  "+235", "+236", "+237", "+238", "+239", "+240", "+241", "+242", "+243", "+244",
  "+245", "+246", "+248", "+249", "+250", "+251", "+252", "+253", "+254", "+255",
  "+256", "+257", "+258", "+260", "+261", "+262", "+263", "+264", "+265", "+266",
  "+267", "+268", "+269", "+290", "+291", "+297", "+298", "+299", "+350", "+351",
  "+352", "+353", "+354", "+355", "+356", "+357", "+358", "+359", "+370", "+371",
  "+372", "+373", "+374", "+375", "+376", "+377", "+378", "+380", "+381", "+382",
  "+383", "+385", "+386", "+387", "+389", "+420", "+421", "+423", "+500", "+501",
  "+502", "+503", "+504", "+505", "+506", "+507", "+508", "+509", "+590", "+591",
  "+592", "+593", "+594", "+595", "+596", "+597", "+598", "+599", "+670", "+672",
  "+673", "+674", "+675", "+676", "+677", "+678", "+679", "+680", "+681", "+682",
  "+683", "+685", "+686", "+687", "+688", "+689", "+690", "+691", "+692", "+850",
  "+852", "+853", "+855", "+856", "+880", "+886", "+960", "+961", "+962", "+963",
  "+964", "+965", "+966", "+967", "+968", "+970", "+971", "+972", "+973", "+974",
  "+975", "+976", "+977", "+992", "+993", "+994", "+995", "+996", "+998"
];

const splitPhone = (full) => {
  if (!full) return { countryCode: "+1", phone: "" };
  const s = String(full).trim().replace(/\s+/g, "");

  const code = [...COMMON_COUNTRY_CODES]
    .sort((a, b) => b.length - a.length)
    .find((c) => s.startsWith(c));

  if (code) return { countryCode: code, phone: s.slice(code.length) };

  // Best-effort fallback if not in the massive list above
  const match = s.match(/^(\+\d{1,3})(\d*)$/);
  if (match) return { countryCode: match[1], phone: match[2] };

  return { countryCode: "+1", phone: s.replace(/^\+/, "") };
};


// Checkbox dropdown for selecting multiple options.
const getProjectId = (p) => p?.id ?? p?._id ?? p?.project_id;

function MultiSelect({
  options = [],
  value = [],
  onChange,
  error,
  loading,
  placeholder,
  loadingText,
}) {
  const { t } = useTranslation("employees");
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = Array.isArray(value) ? value : [];

  const toggle = (val) => {
    if (selected.some((v) => String(v) === String(val))) {
      onChange(selected.filter((v) => String(v) !== String(val)));
    } else {
      onChange([...selected, val]);
    }
  };

  const selectedLabels = options
    .filter((o) => selected.some((v) => String(v) === String(o.value)))
    .map((o) => o.label);

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        disabled={loading}
        onClick={() => setOpen((o) => !o)}
        className={`${inputBase} appearance-none pe-9 cursor-pointer text-start flex items-center gap-2 flex-wrap min-h-[42px] ${error ? "border-red-400 bg-red-50" : "border-gray-200"
          }`}
      >
        {loading ? (
          <span className="text-gray-400">{loadingText || t("edit.loading")}</span>
        ) : selectedLabels.length === 0 ? (
          <span className="text-gray-300">{placeholder || t("edit.select")}</span>
        ) : (
          selectedLabels.map((l) => (
            <span
              key={l}
              className="inline-flex items-center bg-cyan-50 text-cyan-700 text-xs font-medium px-2 py-0.5 rounded"
            >
              {l}
            </span>
          ))
        )}
        <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">
          ▾
        </span>
      </button>

      {open && !loading && (
        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg py-1">
          {options.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-400">{t("edit.noOptions")}</p>
          ) : (
            options.map((o) => {
              const checked = selected.some((v) => String(v) === String(o.value));
              return (
                <label
                  key={o.value}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(o.value)}
                    className="w-4 h-4 accent-cyan-600 cursor-pointer"
                  />
                  {o.label}
                </label>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// employee: the raw employee object (from current.employee)
export default function EditEmployeeModal({ employee, onClose, onSaved }) {
  const { t } = useTranslation("employees");
  const updateLoading = false;
  const projects = B_PROJECTS;
  const loadingProjects = false;
  // Joining date: at most 1 year ahead of today (company time); once set it
  // can be changed but not cleared (the API needs a date when it is sent).
  const companyToday = useFiscalYear().today;
  const originalJoining = employee?.date_of_joining ? String(employee.date_of_joining).slice(0, 10) : "";

  const fileRef = useRef();
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(employee?.profile_url || null);
  const [uploading] = useState(false);
  const [approvalRouting, setApprovalRouting] = useState([]);
  // "loading" | "loaded" | "failed". Routing is only sent on save once it has
  // loaded AND the user changed it — the backend replaces the whole set, so
  // sending [] after a failed/pending load used to wipe the routing.
  const [routingState, setRoutingState] = useState("loading");
  const [routingDirty, setRoutingDirty] = useState(false);

  const roles = B_ROLES;
  const [countries, setCountries] = useState(() => searchCountries("", 100));

  const loadCountries = (search = "") => {
    setCountries(searchCountries(search, 100));
  };

  let searchTimeout = useRef(null);
  const handleCountrySearch = (val) => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      loadCountries(val);
    }, 300);
  };

  // Static lookups (src/data/groupB.js).
  const loadingRoles = false;
  const staffing = STAFFING_COMPANIES;
  const loadingStaffing = false;
  const leavePolicies = LEAVE_POLICIES;
  const loadingPolicies = false;

  const departments = DEPARTMENTS;
  const loadingDepartments = false;
  const [designations, setDesignations] = useState([]);
  const loadingDesignations = false;
  const shifts = SHIFTS;
  const loadingShifts = false;
  const salaryCatalog = SALARY_CATALOG;
  const loadingComponents = false;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      fullName: "",
      nationality: "",
      countryCode: "+1",
      phone: "",
      email: "",
      countryEmpId: "",
      accommodation: "",
      address: "",
      employmentType: "Full-time",
      dateOfJoining: "",
      departmentId: "",
      designationId: "",
      designatedRole: "",
      projectIds: [],
      mainProjectId: "",
      shiftId: "",
      leavePolicyIds: [],
      accessLevel: "",
      staffingCompanyId: "",
      salaryCurrency: "INR",
      salaryCalcMode: "MONTHLY_FIXED",
      salaryWorkingHours: "",
      salaryHourlyRate: "",
      salaryMinHours: "",
      overtimeRate: "1.5",
      salaryComponents: [],
    },
  });

  const employmentType = watch("employmentType");
  const isContract = employmentType === "Contract";
  const accessLevel = watch("accessLevel");
  const selectedProjects = watch("projectIds") || [];
  const selectedNationality = watch("nationality");

  const prevNationalityRef = useRef(selectedNationality);

  useEffect(() => {
    if (selectedNationality && selectedNationality !== prevNationalityRef.current) {
      prevNationalityRef.current = selectedNationality;
      const selected = countries.find(c => c.name === selectedNationality);
      if (selected && selected.calling_code) {
        setValue("countryCode", selected.calling_code);
      }
    }
  }, [selectedNationality, countries, setValue]);

  const selectedCountryCode = watch("countryCode");

  const uniqueCallingCodes = useMemo(() => {
    const codes = countries.map(c => c.calling_code).filter(Boolean);
    return [...new Set(codes)].sort();
  }, [countries]);

  const nationalityOptions = useMemo(() => {
    const opts = [
      { label: t("edit.selectNationality", { defaultValue: "Select" }), value: "" },
      ...countries.map(c => ({ label: c.name, value: c.name }))
    ];
    if (selectedNationality && !opts.some(o => o.value === selectedNationality)) {
      opts.push({ label: selectedNationality, value: selectedNationality });
    }
    return opts;
  }, [countries, selectedNationality, t]);

  const countryCodeOptions = useMemo(() => {
    const opts = uniqueCallingCodes.map(c => ({ label: c, value: c }));
    if (selectedCountryCode && !opts.some(o => o.value === selectedCountryCode)) {
      opts.unshift({ label: selectedCountryCode, value: selectedCountryCode });
    }
    return opts;
  }, [uniqueCallingCodes, selectedCountryCode]);

  const designatedRole = watch("designatedRole");
  const staffingCompanyId = watch("staffingCompanyId");
  const departmentId = watch("departmentId");
  const designationId = watch("designationId");
  const shiftId = watch("shiftId");
  const mainProjectId = watch("mainProjectId");

  // Salary calculation mode (matrix-driven, same rules as Add Employee).
  const allowedModes = allowedSalaryModes({ employmentType, staffingCompanyId });
  const salaryMode = watch("salaryCalcMode") || allowedModes[0];
  const isHourlyMode = salaryMode === "HOURLY";
  const basicComp = salaryCatalog.find((c) => codeOf(c) === "BASIC");

  // Keep the chosen mode within the allowed set as hire type / staffing changes.
  useEffect(() => {
    if (!allowedModes.includes(salaryMode)) {
      setValue("salaryCalcMode", allowedModes[0], { shouldValidate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedModes.join(","), salaryMode]);

  register("projectIds", {
    validate: (v, fv) => {
      if (fv.accessLevel === "GENERAL_EMPLOYEE" && (v || []).length > 1)
        return t("add.validation.generalOneProject");
      return true;
    },
  });

  register("leavePolicyIds");
  const selectedPolicies = watch("leavePolicyIds") || [];

  // Validate the salary component rows on save — mirrors Add Employee so a
  // monthly-mode salary can't be saved without the required Basic component.
  // Salary edits are optional: an untouched (empty) grid is left as-is.
  register("salaryComponents", {
    validate: (v) => {
      if (isHourlyMode) return true;
      if (!Array.isArray(v) || v.length === 0) return true;
      const ids = [];
      for (const row of v) {
        if (!row.salary_component_id) return t("add.validation.componentEveryRow");
        const amt = Number(row.amount);
        if (
          row.amount === "" ||
          row.amount === null ||
          Number.isNaN(amt) ||
          amt < 0
        )
          return t("add.validation.amountEveryRow");
        if (row.calculation_type === "PERCENTAGE" && amt > 100)
          return t("add.validation.percentMax");
        ids.push(String(row.salary_component_id));
      }
      if (new Set(ids).size !== ids.length)
        return t("add.validation.duplicateComponent");
      if (basicComp && !ids.includes(String(basicComp.id)))
        return t("add.validation.basicRequired");
      return true;
    },
  });

  // Register the custom-controlled dropdowns as validation-only virtual fields.
  // Their value is driven by watch + setValue (below) rather than by spreading
  // register onto CustomDropdown — the spread pattern reads validation off the
  // hidden <select> DOM value, which is empty on prefill when options load
  // asynchronously (role) or the field mounts after reset() (main project).
  register("designatedRole", {
    validate: (v) => (v !== "" && v != null) || t("add.validation.roleRequired"),
  });
  register("mainProjectId", {
    validate: (v, fv) => {
      const ids = fv.projectIds || [];
      if (!ids.length) return true; // no projects → no main project needed
      if (v === "" || v === null || v === undefined)
        return t("edit.validation.mainProjectRequired");
      return (
        ids.map(String).includes(String(v)) ||
        t("add.validation.mainProjectInSelection")
      );
    },
  });

  const projectOptions = projects.map((p) => ({
    value: getProjectId(p),
    label: p.project_name,
  }));

  const policyOptions = leavePolicies.map((p) => ({
    value: p.id,
    label: p.leave_type?.leave_name
      ? `${p.policy_name} (${p.leave_type.leave_name})`
      : p.policy_name,
  }));

  // Preload the employee's existing approval routing.
  useEffect(() => {
    setRoutingDirty(false);
    if (!employee?.id) {
      setApprovalRouting([]);
      setRoutingState("loading");
      return;
    }
    // Static build: no per-employee routing overrides are stored.
    setApprovalRouting([]);
    setRoutingState("loaded");
  }, [employee?.id]);

  // Prefill from the employee record.
  useEffect(() => {
    if (!employee) return;
    const { countryCode, phone } = splitPhone(
      employee.phone_number ?? employee.User?.phone_number,
    );
    // Shift comes back as an object (shift: { id, ... }); fall back to a flat id.
    const shiftId = employee.shift?.id ?? employee.shift_id ?? "";
    reset({
      fullName: employee.full_name || "",
      nationality: employee.nationality || "",
      countryCode,
      phone,
      email: employee.email ?? employee.User?.email ?? "",
      countryEmpId: employee.country_emp_id || "",
      accommodation: employee.accommodation || "",
      address: employee.address || "",
      employmentType:
        employee.employment_type === "CONTRACT" ? "Contract" : "Full-time",
      dateOfJoining: employee.date_of_joining ? String(employee.date_of_joining).slice(0, 10) : "",
      overtimeRate:
        employee.overtime_rate != null ? String(Number(employee.overtime_rate)) : "1.5",
      departmentId: employee.department_id ? String(employee.department_id) : "",
      designationId: employee.designation_id ? String(employee.designation_id) : "",
      shiftId: shiftId ? String(shiftId) : "",
      mainProjectId: employee.main_project_id ? String(employee.main_project_id) : "",
      designatedRole: employee.role_id ? String(employee.role_id) : (employee.roles?.[0]?.id ? String(employee.roles[0].id) : ""),
      projectIds: (employee.projects || []).map((p) => p.id),
      accessLevel: employee.access_level || "",
      staffingCompanyId:
        employee.staffingCompany?.id ?? employee.staffing_company_id ?? "",
    });
    setPhotoPreview(employee.profile_url || null);

    // Prefill salary configuration
    (() => {
      if (!employee?.id) return;
      {
        const s = employeeSalary(employee.id).current;
        if (s) {
          setValue("salaryCurrency", s.currency || "INR");
          const mode = s.salary_calc_mode || "MONTHLY_FIXED";
          setValue("salaryCalcMode", mode);
          setValue(
            "salaryWorkingHours",
            s.working_hours != null ? String(s.working_hours) : "",
          );
          setValue(
            "salaryMinHours",
            s.min_hours != null ? String(s.min_hours) : "",
          );
          const comps = [...(s.earnings || []), ...(s.deductions || [])].map((c) => ({
            salary_component_id: c.component_id,
            calculation_type: c.calculation_type,
            amount: c.amount,
          }));
          setValue("salaryComponents", comps);
          // For HOURLY, surface the Hourly component's amount as the rate field.
          if (mode === "HOURLY") {
            const hourlyLine = (s.earnings || []).find(
              (e) => String(e.name || "").toUpperCase() === "HOURLY",
            );
            setValue(
              "salaryHourlyRate",
              hourlyLine ? String(hourlyLine.amount) : "",
            );
          }
        }
      }
    })();
  }, [employee, reset, setValue]);

  // Lock scroll + prefill the employee's assigned leave policies.
  useEffect(() => {
    document.body.style.overflow = "hidden";
    if (employee?.leave_policy_ids) setValue("leavePolicyIds", employee.leave_policy_ids);
    return () => {
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Designations of the selected Department
  useEffect(() => {
    setDesignations(departmentId ? designationsForDepartment(departmentId) : []);
  }, [departmentId]);

  const handlePhoto = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setPhotoFile(f);
    setPhotoPreview(URL.createObjectURL(f));
  };

  const onSubmit = async (data) => {
    // Static build: the photo stays in the browser (object URL).
    const profileUrl = photoFile ? URL.createObjectURL(photoFile) : null;

    const contract = data.employmentType === "Contract";

    const payload = {
      full_name: data.fullName.trim(),
      email: data.email.trim(),
      address: (data.address || "").trim(),
      country_emp_id: data.countryEmpId.trim(),
      accommodation: (data.accommodation || "").trim() || null,
      role_id: Number(data.designatedRole),
      nationality: data.nationality || null,
      employment_type: contract ? "CONTRACT" : "FULL_TIME",
      overtime_rate: Number(data.overtimeRate) || 1.5,
      department_id: data.departmentId ? Number(data.departmentId) : null,
      designation_id: data.designationId ? Number(data.designationId) : null,
      shift_id: data.shiftId ? Number(data.shiftId) : null,
      main_project_id: data.mainProjectId ? Number(data.mainProjectId) : null,
      access_level: data.accessLevel,
      // staffing company only applies to contract employees; clear it otherwise
      staffing_company_id:
        contract && data.staffingCompanyId
          ? Number(data.staffingCompanyId)
          : null,
      // only send phone if the user typed one (API doesn't return it to prefill)
      ...(data.phone
        ? { phone_number: `${data.countryCode}${data.phone}` }
        : {}),
      project_ids: (data.projectIds || []).map(Number),
      // only when changed (the API refuses an empty value)
      ...(data.dateOfJoining && data.dateOfJoining !== originalJoining
        ? { date_of_joining: data.dateOfJoining }
        : {}),
      ...(routingState === "loaded" && routingDirty
        ? { approval_routing: approvalRouting }
        : {}),
      ...(profileUrl ? { profile_url: profileUrl } : {}),
    };

    // Static build: the change is applied to the in-memory employee record.
    const selectedRole = roles.find((r) => String(r.id) === String(payload.role_id));
    const dept = departments.find((d) => String(d.id) === String(payload.department_id));
    const desig = designationsForDepartment(payload.department_id).find(
      (d) => String(d.id) === String(payload.designation_id),
    );
    const saved = updateEmployeeRecord(employee.id, {
      ...payload,
      name: payload.full_name,
      roles: selectedRole ? [{ id: selectedRole.id, name: selectedRole.name }] : employee.roles,
      projects: projects.filter((p) => payload.project_ids.includes(p.id)),
      staffingCompany: payload.staffing_company_id
        ? staffing.find((s) => s.id === payload.staffing_company_id) || null
        : null,
      shift: shifts.find((s) => s.id === payload.shift_id) || null,
      department_name: dept?.name,
      designation_name: desig?.name,
      leave_policy_ids: (data.leavePolicyIds || []).map(Number),
    });

    // Refresh the caller — the employee record itself was saved.
    if (onSaved) onSaved(saved);
    setRoutingDirty(false);

    toast.success(t("edit.success", "Employee updated successfully"));
    onClose();
  };

  const saving = updateLoading || uploading;
  const salaryRows = watch("salaryComponents") || [];
  const salaryCurrency = watch("salaryCurrency") || "INR";

  const componentById = (id) =>
    salaryCatalog.find((c) => String(c.id) === String(id));

  const updateSalaryRows = (next) =>
    setValue("salaryComponents", next, { shouldValidate: true });

  const handleUpdateComponent = (idx, field, value) => {
    updateSalaryRows(salaryRows.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };

  const handleRemoveComponent = (idx) => {
    updateSalaryRows(salaryRows.filter((_, i) => i !== idx));
  };

  const handleAddComponent = () => {
    updateSalaryRows([
      ...salaryRows,
      { salary_component_id: "", calculation_type: "FIXED", amount: "" },
    ]);
  };

  const basicBase = salaryRows.reduce((sum, r) => {
    const c = componentById(r.salary_component_id);
    if (c && c.type === "EARNING" && r.calculation_type === "FIXED" && codeOf(c) === "BASIC")
      return sum + (Number(r.amount) || 0);
    return sum;
  }, 0);

  const estNet = salaryRows.reduce((net, r) => {
    const c = componentById(r.salary_component_id);
    if (!c) return net;
    const amt = Number(r.amount) || 0;
    const resolved =
      r.calculation_type === "PERCENTAGE" ? (amt / 100) * basicBase : amt;
    return c.type === "DEDUCTION" ? net - resolved : net + resolved;
  }, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col"
        style={{ maxHeight: "92vh" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{t("edit.title")}</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              {t("edit.subtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
          >
            <MdClose className="text-xl" />
          </button>
        </div>

        <hr className="border-gray-100 shrink-0" />

        {/* noValidate: the rules (e.g. the joining date's max) show inline, not as a browser popup */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col flex-1 min-h-0"
        >
          <div
            className="flex-1 overflow-y-auto px-6 py-6 space-y-6 custom-scrollbar"
          >
            {/* Photo */}
            <div className="flex items-center gap-5 pb-5 border-b border-gray-100">
              <div
                onClick={() => fileRef.current.click()}
                className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center shrink-0 cursor-pointer hover:border-cyan-400 overflow-hidden"
              >
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt={t("add.basic.photoPreviewAlt")}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <MdOutlinePerson className="text-4xl text-gray-300" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-1">
                  {t("edit.profilePhoto")}
                </p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileRef.current.click()}
                    className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-medium rounded-lg"
                  >
                    {t("edit.changePhoto")}
                  </button>
                  {photoPreview && (
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoFile(null);
                        setPhotoPreview(null);
                        if (fileRef.current) fileRef.current.value = "";
                      }}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      {t("edit.remove")}
                    </button>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handlePhoto}
                />
              </div>
            </div>

            {/* Basic info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>
                  {t("edit.fullName")} <span className="text-red-500">*</span>
                </label>
                <input
                  {...register("fullName", {
                    required: t("add.validation.fullNameRequired"),
                    validate: {
                      noOnlySpaces: (v) =>
                        v.trim() !== "" || t("add.validation.nameEmptySpaces"),
                      noDoubleSpaces: (v) =>
                        !/\s{2,}/.test(v) || t("add.validation.multipleSpaces"),
                      // Same rule as Add Employee: letters in any language,
                      // single space / hyphen / apostrophe / dot between words.
                      validName: (v) =>
                        NAME_PATTERN.test(v.trim()) ||
                        t("add.validation.lettersSingleSpaces"),
                      minLength: (v) =>
                        v.trim().length >= 2 || t("add.validation.min2Chars"),
                    },
                  })}
                  className={inputCls(errors.fullName)}
                  onInput={(e) => {
                    let val = e.target.value.replace(/^\s+/, "");
                    val = val.replace(NAME_STRIP, "");
                    val = val.replace(/\s{2,}/g, " ");
                    e.target.value = val;
                  }}
                />
                <FieldErr error={errors.fullName} />
              </div>

              <div>
                <label className={labelCls}>{t("edit.nationality")}</label>
                <CustomDropdown
                  {...register("nationality")}
                  error={!!errors.nationality}
                  isSearchable={true}
                  onSearchChange={handleCountrySearch}
                  options={nationalityOptions}
                />
              </div>

              <div>
                <label className={labelCls}>
                  {t("edit.email")} <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  {...register("email", {
                    required: t("edit.validation.emailRequired"),
                    pattern: {
                      value: /^[a-zA-Z0-9._+-]+@[a-zA-Z0-9-]+(\.[a-zA-Z]{2,})+$/,
                      message: t("edit.validation.emailInvalid"),
                    },
                  })}
                  className={inputCls(errors.email)}
                  onInput={removeEmojisAndSlashes}
                />
                <FieldErr error={errors.email} />
              </div>

              <div>
                <label className={labelCls}>{t("edit.phoneNumber")}</label>
                <div className="flex gap-2">
                  <div className="shrink-0 min-w-[100px]">
                    <CustomDropdown
                      {...register("countryCode")}
                      isSearchable={true}
                      onSearchChange={handleCountrySearch}
                      options={countryCodeOptions}
                    />
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={15}
                    placeholder={t("edit.phoneEnterPlaceholder")}
                    {...register("phone", {
                      pattern: {
                        value: /^[0-9]{6,15}$/,
                        message: t("add.validation.phoneInvalid"),
                      },
                    })}
                    className={inputCls(errors.phone)}
                    onInput={(e) => {
                      e.target.value = e.target.value.replace(/\D/g, "");
                    }}
                  />
                </div>
                <FieldErr error={errors.phone} />
              </div>

              <div>
                <label className={labelCls}>{t("edit.countryEmpId")}</label>
                <input
                  {...register("countryEmpId", {
                    maxLength: { value: 10, message: t("edit.validation.max10Chars") },
                  })}
                  className={inputCls(errors.countryEmpId)}
                  onInput={removeEmojisAndSlashes}
                />
                <FieldErr error={errors.countryEmpId} />
              </div>

              {/* Optional. Company-provided housing, not the employee's own address. */}
              <div>
                <label className={labelCls}>{t("edit.accommodation")}</label>
                <input
                  {...register("accommodation", {
                    maxLength: { value: 255, message: t("edit.validation.max255Chars") },
                  })}
                  maxLength={255}
                  placeholder={t("edit.accommodationPlaceholder")}
                  className={inputCls(errors.accommodation)}
                  onInput={(e) => {
                    e.target.value = e.target.value.trimStart();
                  }}
                />
                <FieldErr error={errors.accommodation} />
              </div>

              <div>
                <label className={labelCls}>
                  {t("edit.address")} <span className="text-red-500">*</span>
                </label>
                <input
                  {...register("address", {
                    required: t("add.validation.addressRequired"),
                    validate: {
                      noOnlySpaces: (v) =>
                        v.trim() !== "" || t("add.validation.addressEmpty"),
                      minLength: (v) =>
                        v.trim().length >= 5 || t("add.validation.min5Chars"),
                      maxLength: (v) =>
                        v.trim().length <= 255 ||
                        t("add.validation.addressMax255"),
                      noEmojis: (v) =>
                        !/(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu.test(
                          v,
                        ) || t("add.validation.noEmojis"),
                    },
                  })}
                  className={inputCls(errors.address)}
                  onInput={(e) => {
                    let val = e.target.value.replace(/^\s+/, "");
                    val = val.replace(
                      /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu,
                      "",
                    );
                    e.target.value = val;
                  }}
                />
                <FieldErr error={errors.address} />
              </div>
            </div>

            {/* Job details */}
            <div className="border-t border-gray-100 pt-5">
              <h3 className="text-sm font-bold text-gray-900 mb-4">
                {t("edit.jobDetails")}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className={labelCls}>
                    {t("edit.dateOfJoining")}
                    {originalJoining && <span className="text-red-500"> *</span>}
                  </label>
                  <input
                    type="date"
                    max={maxJoiningDate(companyToday)}
                    aria-invalid={!!errors.dateOfJoining}
                    className={inputCls(errors.dateOfJoining)}
                    {...register("dateOfJoining", joiningDateRule(t, companyToday, { required: !!originalJoining }))}
                  />
                  <FieldErr error={errors.dateOfJoining} />
                </div>
              </div>

              <div className="mb-4">
                <label className={labelCls}>{t("edit.employmentType")}</label>
                <div className="flex gap-0 border border-gray-200 rounded-lg p-1 w-fit">
                  {[
                    { value: "Full-time", label: t("edit.fullTime") },
                    { value: "Contract", label: t("edit.contract") },
                  ].map((opt) => (
                    <label
                      key={opt.value}
                      className={`px-5 py-1.5 rounded-md text-sm font-medium cursor-pointer transition-all select-none ${employmentType === opt.value
                        ? "bg-white shadow text-cyan-600 border border-gray-200"
                        : "text-gray-500 hover:text-gray-700"
                        }`}
                    >
                      <input
                        {...register("employmentType")}
                        type="radio"
                        value={opt.value}
                        className="hidden"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>
                    {t("edit.designatedRole", "Role")} <span className="text-red-500">*</span>
                  </label>
                  <CustomDropdown value={designatedRole || ""} onChange={(e) => setValue("designatedRole", e.target.value, { shouldValidate: true })} disabled={loadingRoles} error={!!errors.designatedRole} options={[{ label: loadingRoles ? t("edit.loadingRoles", "Loading...") : t("edit.selectRole", "Select Role"), value: "" }, ...roles.map(r => ({ label: r.name, value: String(r.id) }))]} />
                  <FieldErr error={errors.designatedRole} />
                </div>

                <div>
                  <label className={labelCls}>{t("edit.department", "Department")}</label>
                  <CustomDropdown {...register("departmentId")} value={departmentId || ""} error={!!errors.departmentId} disabled={loadingDepartments} onChange={(e) => { setValue("departmentId", e.target.value); setValue("designationId", ""); }} options={[{ label: loadingDepartments ? t("edit.loading", "Loading...") : t("edit.selectDepartment", "Select Department"), value: "" }, ...departments.map(d => ({ label: d.name || d.department_name, value: d.id }))]} />
                  <FieldErr error={errors.departmentId} />
                </div>

                <div>
                  <label className={labelCls}>{t("edit.designation", "Designation")}</label>
                  <CustomDropdown {...register("designationId")} value={designationId || ""} error={!!errors.designationId} disabled={!departmentId || loadingDesignations} options={[{ label: !departmentId ? t("edit.selectDepartmentFirst", "Select Department First") : loadingDesignations ? t("edit.loading", "Loading...") : t("edit.selectDesignation", "Select Designation"), value: "" }, ...designations.map(d => ({ label: d.name, value: d.id }))]} />
                  <FieldErr error={errors.designationId} />
                </div>

                <div>
                  <label className={labelCls}>{t("edit.shift", "Shift")}</label>
                  <CustomDropdown
                    {...register("shiftId")}
                    value={shiftId || ""}
                    error={!!errors.shiftId}
                    disabled={loadingShifts}
                    options={[
                      { label: loadingShifts ? t("edit.loading", "Loading...") : t("edit.selectShift", "Select Shift"), value: "" },
                      ...shifts.map((s) => ({
                        label: `${s.name} (${fmtShiftTime(s.start_time)}–${fmtShiftTime(s.end_time)})`,
                        value: s.id
                      }))
                    ]}
                  />
                  <FieldErr error={errors.shiftId} />
                </div>

                <div>
                  <label className={labelCls}>{t("edit.projectAssignment", "Projects")}</label>
                  <MultiSelect
                    options={projectOptions}
                    value={selectedProjects}
                    loading={loadingProjects}
                    loadingText={t("edit.loadingProjects", "Loading...")}
                    placeholder={t("edit.selectProjects", "Select Projects")}
                    error={errors.projectIds}
                    onChange={(next) => {
                      setValue("projectIds", next, { shouldValidate: true });
                      // If main project is no longer selected, clear it.
                      // Compare as strings — projectIds are numbers while
                      // mainProjectId comes back from the select as a string.
                      if (
                        mainProjectId &&
                        !next.map(String).includes(String(mainProjectId))
                      ) {
                        setValue("mainProjectId", "");
                      }
                    }}
                  />
                  {accessLevel === "GENERAL_EMPLOYEE" && (
                    <p className="text-xs text-gray-400 mt-1">
                      {t("edit.projectHintGeneral", "A general employee can only have one project")}
                    </p>
                  )}
                  {errors.projectIds && (
                    <FieldErr error={errors.projectIds} />
                  )}
                </div>

                {selectedProjects.length > 0 && (
                  <div>
                    <label className={labelCls}>{t("edit.mainProject", "Main Project")} <span className="text-red-500">*</span></label>
                    <CustomDropdown
                      value={mainProjectId || ""}
                      onChange={(e) =>
                        setValue("mainProjectId", e.target.value, {
                          shouldValidate: true,
                        })
                      }
                      error={!!errors.mainProjectId}
                      placeholder={t("edit.selectMainProject", "Select Main Project")}
                      options={selectedProjects.map((pid) => {
                        const proj = projects.find(
                          (p) => String(getProjectId(p)) === String(pid),
                        );
                        return {
                          label: proj?.project_name || t("add.job.projectFallback", { id: pid }),
                          value: String(pid)
                        };
                      })}
                    />
                    <FieldErr error={errors.mainProjectId} />
                  </div>
                )}

                <div>
                  <label className={labelCls}>
                    {t("edit.accessLevel")} <span className="text-red-500">*</span>
                  </label>
                  <CustomDropdown {...register("accessLevel", { required: t("add.validation.accessLevelRequired") })} error={!!errors.accessLevel} options={[{ label: t("edit.selectAccessLevel"), value: "" }, ...ACCESS_LEVELS.map(a => ({ label: t(a.labelKey), value: a.value }))]} />
                  <FieldErr error={errors.accessLevel} />
                </div>

                {isContract && (
                  <div>
                    <label className={labelCls}>
                      {t("edit.staffingCompany")}
                    </label>
                    <CustomDropdown {...register("staffingCompanyId")} value={staffingCompanyId || ""} disabled={loadingStaffing} error={!!errors.staffingCompanyId} options={[{ label: loadingStaffing ? t("edit.loadingCompanies") : t("edit.selectStaffingCompany"), value: "" }, ...staffing.map(c => ({ label: c.code ? `${c.name} (${c.code})` : c.name, value: c.id }))]} />
                    <FieldErr error={errors.staffingCompanyId} />
                  </div>
                )}
              </div>

              <div className="mt-4">
                <label className={labelCls}>{t("edit.leavePolicies")}</label>
                <MultiSelect
                  options={policyOptions}
                  value={selectedPolicies}
                  loading={loadingPolicies}
                  loadingText={t("edit.loadingLeavePolicies")}
                  placeholder={t("edit.selectLeavePolicies")}
                  onChange={(next) =>
                    setValue("leavePolicyIds", next, { shouldValidate: true })
                  }
                />
                <p className="text-xs text-gray-400 mt-1">
                  {t("edit.leavePoliciesHint")}
                </p>
              </div>
            </div>

            {/* Salary */}
            <div className="border-t border-gray-100 pt-5">
              <div className="flex items-end justify-between gap-4 flex-wrap mb-4">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-1">
                    {t("edit.salaryStructure", "Salary Structure")}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {t("add.salary.buildSubtitle")}
                  </p>
                </div>
                <div className="w-32">
                  <label className={labelCls}>{t("add.salary.currency")}</label>
                  <CustomDropdown {...register("salaryCurrency")} defaultValue={salaryCurrency} options={SALARY_CURRENCIES.map(c => ({ label: c, value: c }))} />
                </div>
              </div>

              {/* Salary calculation mode + mode-specific fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className={labelCls}>{t("add.salary.calcMode")}</label>
                  <CustomDropdown
                    value={salaryMode}
                    onChange={(e) =>
                      setValue("salaryCalcMode", e.target.value, { shouldValidate: true })
                    }
                    options={allowedModes.map((m) => ({ label: t(MODE_LABEL_KEYS[m]), value: m }))}
                  />
                </div>

                <div>
                  <label className={labelCls}>{t("add.salary.overtimeRate")}</label>
                  <CustomDropdown
                    value={watch("overtimeRate") || "1.5"}
                    onChange={(e) => setValue("overtimeRate", e.target.value)}
                    options={OVERTIME_RATE_OPTIONS}
                  />
                </div>

                {salaryMode === "MONTHLY_HOURLY" && (
                  <div>
                    <label className={labelCls}>{t("add.salary.workingHours")}</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      onKeyDown={(e) => {
                        if (e.key === "-" || e.key === "e") e.preventDefault();
                      }}
                      {...register("salaryWorkingHours", {
                        validate: (val) =>
                          salaryMode !== "MONTHLY_HOURLY" ||
                          (Number(val) > 0 && Number(val) <= 24) ||
                          t("add.validation.workingHours"),
                      })}
                      className={inputCls(errors.salaryWorkingHours)}
                      placeholder={t("add.salary.workingHoursPlaceholder")}
                    />
                    <FieldErr error={errors.salaryWorkingHours} />
                  </div>
                )}

                {isHourlyMode && (
                  <>
                    <div>
                      <label className={labelCls}>{t("add.salary.hourlyRate", { currency: salaryCurrency })}</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        onKeyDown={(e) => {
                          if (e.key === "-" || e.key === "e") e.preventDefault();
                        }}
                        {...register("salaryHourlyRate", {
                          validate: (val) =>
                            !isHourlyMode ||
                            Number(val) > 0 ||
                            t("add.validation.hourlyRate"),
                        })}
                        className={inputCls(errors.salaryHourlyRate)}
                        placeholder={t("add.salary.hourlyRatePlaceholder")}
                      />
                      <FieldErr error={errors.salaryHourlyRate} />
                    </div>
                    <div>
                      <label className={labelCls}>{t("add.salary.minHours")}</label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        onKeyDown={(e) => {
                          if (e.key === "-" || e.key === "e") e.preventDefault();
                        }}
                        {...register("salaryMinHours")}
                        className={inputCls(errors.salaryMinHours)}
                        placeholder={t("add.salary.minHoursPlaceholder")}
                      />
                      <p className="mt-1 text-[11px] text-amber-600">
                        {t("edit.minHoursAdvisory")}
                      </p>
                    </div>
                  </>
                )}
              </div>

              {errors.salaryComponents && (
                <p className="flex items-center gap-1 text-xs text-red-500 mb-2">
                  <MdOutlineError className="flex-shrink-0 text-sm" />
                  {errors.salaryComponents.message}
                </p>
              )}

              <div
                className={`bg-gray-50/50 border border-gray-100 p-5 rounded-2xl ${
                  isHourlyMode ? "hidden" : ""
                }`}
              >
                <div className="space-y-3">
                  {salaryRows.length === 0 && (
                    <p className="text-sm text-gray-400 italic">
                      {t("add.salary.noComponents")}
                    </p>
                  )}
                  {salaryRows.map((row, idx) => {
                    return (
                      <div key={idx} className="flex gap-3 items-center flex-wrap sm:flex-nowrap">
                        {/* Component */}
                        <div className="flex-1 min-w-[180px]">
                          <CustomDropdown
                            value={row.salary_component_id || ""}
                            onChange={(e) =>
                              handleUpdateComponent(
                                idx,
                                "salary_component_id",
                                e.target.value ? Number(e.target.value) : "",
                              )
                            }
                            disabled={loadingComponents}
                            options={[
                              { label: loadingComponents ? t("add.salary.loadingComponents") : t("add.salary.selectComponent"), value: "" },
                              ...salaryCatalog.map((c) => ({
                                label: t("add.salary.componentOption", {
                                  name: c.name,
                                  type:
                                    c.type === "DEDUCTION"
                                      ? t("add.salary.deduction")
                                      : t("add.salary.earning"),
                                }),
                                value: c.id
                              }))
                            ]}
                          />
                        </div>

                        {/* Calc type */}
                        <div className="w-32">
                          <CustomDropdown
                            value={row.calculation_type || "FIXED"}
                            onChange={(e) =>
                              handleUpdateComponent(idx, "calculation_type", e.target.value)
                            }
                            options={[
                              { label: t("add.salary.fixed"), value: "FIXED" },
                              { label: t("add.salary.percent"), value: "PERCENTAGE" }
                            ]}
                          />
                        </div>

                        {/* Amount */}
                        <div className="w-40 relative">
                          <span className="absolute start-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">
                            {row.calculation_type === "PERCENTAGE" ? "%" : salaryCurrency}
                          </span>
                          <input
                            type="number"
                            min="0"
                            value={row.amount}
                            onKeyDown={(e) => {
                              if (e.key === "-" || e.key === "e") e.preventDefault();
                            }}
                            onChange={(e) =>
                              handleUpdateComponent(idx, "amount", e.target.value.replace("-", ""))
                            }
                            className="w-full pl-12 pr-3 py-3 border border-gray-200 rounded-lg text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition text-right"
                            placeholder="0.00"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveComponent(idx)}
                          className="w-[46px] h-[46px] flex-shrink-0 flex items-center justify-center bg-white border border-gray-200 rounded-lg text-red-500 hover:bg-red-50 hover:border-red-200 transition"
                        >
                          <MdOutlineDelete className="text-xl" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={handleAddComponent}
                  className="mt-5 flex items-center gap-2 text-[#0b5c91] font-semibold text-sm hover:text-cyan-800 transition"
                >
                  <MdAddCircleOutline className="text-xl" /> {t("add.salary.addComponent")}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-5">
                <div className="md:col-span-2 border border-gray-200 rounded-xl p-5 flex items-start gap-4 bg-gray-50/50">
                  <div className="w-12 h-12 bg-[#e8f1f8] rounded-xl flex items-center justify-center flex-shrink-0">
                    <MdOutlineAttachMoney className="text-[#0b5c91] text-2xl" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 mb-1">
                      {t("add.salary.estNetTitle")}
                    </p>
                    <p className="text-xs text-gray-500 leading-relaxed pr-4">
                      <Trans
                        t={t}
                        i18nKey="add.salary.estNetDesc"
                        components={{ strong: <strong /> }}
                      />
                    </p>
                  </div>
                </div>
                <div className="md:col-span-1 bg-[#1eb2b8] rounded-xl p-5 flex flex-col justify-center text-white">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-cyan-100 mb-1 opacity-90">
                    {t("add.salary.estNet")}
                  </p>
                  <p className="text-2xl font-bold">
                    {salaryCurrency}{" "}
                    {estNet.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
              </div>
            </div>

            {/* Approval routing (optional, per-employee) — last section, inside the
                scroll area so its group dropdowns aren't clipped by the footer. */}
            <div className="border-t border-gray-100 pt-5 pb-2">
              {routingState === "failed" && (
                <p className="text-xs text-amber-600 mb-2">{t("edit.routingLoadFailed")}</p>
              )}
              <ApprovalRoutingSection
                value={approvalRouting}
                onChange={(next) => {
                  setApprovalRouting(next);
                  setRoutingDirty(true);
                }}
              />
            </div>
          </div>

          {/* Footer */}
          <hr className="border-gray-100 shrink-0" />
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 px-6 py-4 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="w-full sm:w-auto px-6 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-60 transition-colors"
            >
              {t("edit.cancel")}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-700 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {saving ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {uploading ? t("edit.uploading") : t("edit.saving")}
                </>
              ) : (
                t("edit.saveChanges")
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
