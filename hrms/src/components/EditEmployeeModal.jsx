import { useEffect, useRef, useState, useMemo } from "react";
import CustomDropdown from "../components/CustomDropdown";

import { useForm, useWatch } from "react-hook-form";
import { useTranslation, Trans } from "react-i18next";
import {
  MdClose,
  MdOutlineError,
  MdOutlinePerson,
  MdOutlineAttachMoney,
} from "react-icons/md";
import { toast } from "react-toastify";
import ApprovalRoutingSection from "./ApprovalRoutingSection";
import CountrySelect from "./geo/CountrySelect";
import CitySelect from "./geo/CitySelect";
import PhoneCountrySelect from "./geo/PhoneCountrySelect";
import { NAME_PATTERN, NAME_STRIP } from "../utils/nameRules";
import { DEFAULT_PHONE_COUNTRY, phoneForInput, phoneRule } from "../utils/phone";
import { applyFieldErrors } from "../utils/applyFieldErrors";
import { apiErrorCode, apiErrorMessage } from "../utils/apiError";
import useApiQuery from "../hooks/useApiQuery";
import useFiscalYear from "../hooks/useFiscalYear";
import { useCurrentUser } from "../hooks/useSession";
import { assetUrl } from "../api/client";
import { changeMainProject, listRoles, listStaffingCompanies, updateEmployee } from "../api/employees";
import { listProjects } from "../api/projects";
import { listLeaveTypes } from "../api/leaveTypes";
import { listShifts } from "../api/shifts";
import { listDepartments } from "../api/departments";
import { designationDropdown } from "../api/designations";
import { MODULE_ALL } from "../api/approvalGroups";

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

const codeOf = (c) => String(c?.code || "").toUpperCase();

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

const listOrEmpty = (load) => load().catch(() => null);

// Server answers that belong under one input (D46, D48, D51, D55).
const CODE_FIELDS = {
  EMPLOYEE_EMAIL_TAKEN: "email",
  ACCOUNT_EMAIL_IN_OTHER_COMPANY: "email",
  EMPLOYEE_PHONE_TAKEN: "phone",
  EMPLOYEE_ID_NUMBER_TAKEN: "countryEmpId",
  PROJECT_GENERAL_EMPLOYEE_SINGLE: "accessLevel",
  ACCOUNT_ADMIN_EXISTS: "accessLevel",
  PROJECT_NOT_ACTIVE: "mainProjectId",
};
const ROUTING_CODES = ["APPROVAL_GROUP_PROJECT_MISMATCH", "APPROVAL_ROUTING_PER_MODULE_DISABLED"];
const FIELD_MAP = { name: "fullName", country_emp_id: "countryEmpId", roleId: "designatedRole", projectId: "mainProjectId" };
const FORM_FIELDS = [
  "fullName", "email", "phone", "phoneCountry", "countryEmpId", "nationalityCountryId", "residenceCountryId",
  "residenceCityId", "address", "accommodation", "employmentType", "accessLevel", "designatedRole", "departmentId",
  "designationId", "staffingCompanyId", "leavePolicyIds", "shiftId", "mainProjectId", "effectiveFrom",
];

// Checkbox dropdown for selecting multiple options.
function MultiSelect({
  options = [],
  value = [],
  onChange,
  error,
  loading,
  disabled = false,
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
        disabled={loading || disabled}
        onClick={() => setOpen((o) => !o)}
        className={`${inputBase} appearance-none pe-9 cursor-pointer text-start flex items-center gap-2 flex-wrap min-h-[42px] disabled:cursor-default disabled:bg-gray-50 ${error ? "border-red-400 bg-red-50" : "border-gray-200"
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

      {open && !loading && !disabled && (
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

// The detail (GET /employees/:id) → form values.
const toFormValues = (detail) => {
  const ov = detail.overview;
  const main = detail.projects.current.find((p) => p.is_main);
  return {
    fullName: ov.name || "",
    nationalityCountryId: ov.nationality?.id || "",
    phoneCountry: ov.phoneCountry || DEFAULT_PHONE_COUNTRY,
    phone: phoneForInput(ov.phone),
    email: ov.email || "",
    countryEmpId: ov.country_emp_id || "",
    residenceCountryId: ov.residence_country?.id || "",
    residenceCityId: ov.residence_city?.id || "",
    accommodation: ov.accommodation || "",
    address: ov.address || "",
    employmentType: ov.employment_type === "CONTRACT" ? "Contract" : "Full-time",
    departmentId: ov.department?.id || "",
    designationId: ov.designation?.id || "",
    designatedRole: ov.role?.id || "",
    mainProjectId: main?.id || "",
    effectiveFrom: "",
    shiftId: detail.shift?.id || "",
    leavePolicyIds: detail.leave_policies.filter((p) => p.is_active).map((p) => p.id),
    accessLevel: ov.access_level || "",
    staffingCompanyId: ov.staffing_company?.id || "",
  };
};

// The routing picker's value → { approvalGroupId, moduleKey } (only "ALL" is taken for now, D51).
const toRoutingBody = (routing) => {
  const all = routing.find((r) => r.module_key === MODULE_ALL);
  if (all) return { approvalGroupId: all.approval_group_id, moduleKey: MODULE_ALL };
  const first = routing[0];
  return first ? { approvalGroupId: first.approval_group_id, moduleKey: first.module_key } : { approvalGroupId: null, moduleKey: MODULE_ALL };
};

// `employee` is the detail from GET /employees/:id ({ overview, projects, shift, leave_policies,
// salary, approval_group }). Saves job and personal fields with PUT /employees/:id (D54); a new
// main project goes first through PUT /employees/:id/main-project with its "Effective from" (D55).
// Salary is shown but not editable (D52). onSaved gets the saved detail.
export default function EditEmployeeModal({ employee, onClose, onSaved }) {
  const { t } = useTranslation("employees");
  const { t: ta } = useTranslation("approvals");
  const ov = employee.overview;
  const companyToday = useFiscalYear().today;
  const isOwner = useCurrentUser()?.accessLevel === "ADMIN";
  const [saving, setSaving] = useState(false);

  const originalMain = employee.projects.current.find((p) => p.is_main) || null;
  const [approvalRouting, setApprovalRouting] = useState(() =>
    employee.approval_group ? [{ module_key: MODULE_ALL, approval_group_id: String(employee.approval_group.id) }] : [],
  );
  const [routingError, setRoutingError] = useState("");

  // Lookups (each one is empty when the caller can't read it).
  const projectsQ = useApiQuery(() => listOrEmpty(() => listProjects({ limit: 100, status: "ACTIVE" })), []);
  const rolesQ = useApiQuery(() => listOrEmpty(() => listRoles()), []);
  const policiesQ = useApiQuery(() => listOrEmpty(() => listLeaveTypes({ limit: 100, status: "ACTIVE" })), []);
  const staffingQ = useApiQuery(() => listOrEmpty(() => listStaffingCompanies("ACTIVE")), []);
  const shiftsQ = useApiQuery(() => listOrEmpty(() => listShifts({ limit: 100 })), []);
  const departmentsQ = useApiQuery(() => listOrEmpty(() => listDepartments({ limit: 100, status: "ACTIVE" })), []);
  const roles = rolesQ.data || [];
  const loadingRoles = rolesQ.loading;
  const staffing = staffingQ.data || [];
  const loadingStaffing = staffingQ.loading;
  const loadingPolicies = policiesQ.loading;
  const departments = departmentsQ.data?.items || [];
  const loadingDepartments = departmentsQ.loading;
  const shifts = shiftsQ.data?.items || [];
  const loadingShifts = shiftsQ.loading;

  const {
    register,
    handleSubmit,
    control,
    getValues,
    setValue,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm({ defaultValues: toFormValues(employee) });

  const [employmentType, accessLevel, designatedRole, staffingCompanyId, departmentId, designationId, shiftId, mainProjectId, residenceCountryId, residenceCityId] =
    useWatch({
      control,
      name: ["employmentType", "accessLevel", "designatedRole", "staffingCompanyId", "departmentId", "designationId", "shiftId", "mainProjectId", "residenceCountryId", "residenceCityId"],
    });
  const selectedPolicies = useWatch({ control, name: "leavePolicyIds" }) || [];
  const isContract = employmentType === "Contract";
  const mainChanged = !!mainProjectId && String(mainProjectId) !== String(originalMain?.id || "");

  // The designation list depends on the selected department (active ones only).
  const { data: designationData, loading: loadingDesignations } = useApiQuery(
    () => (departmentId ? listOrEmpty(() => designationDropdown(departmentId)) : Promise.resolve(null)),
    [departmentId],
  );
  const designations = designationData?.items || [];

  register("designatedRole", {
    validate: (v, fv) => fv.accessLevel !== "SUB_ADMIN" || !!v || t("add.validation.roleRequired"),
  });
  register("mainProjectId", {
    validate: (v) => !!v || !originalMain || t("edit.validation.mainProjectRequired"),
  });
  register("leavePolicyIds", {
    validate: (v) => (Array.isArray(v) && v.length > 0) || t("add.validation.leavePolicyRequired"),
  });

  // Current projects (assignments are managed on the project page, D13); the main project can be
  // any active project (added if not assigned, D55).
  const currentProjects = employee.projects.current;
  const projectOptions = currentProjects.map((p) => ({ value: p.id, label: p.name }));
  const mainProjectOptions = useMemo(() => {
    const list = (projectsQ.data?.items || []).map((p) => ({ value: p.id, label: p.name }));
    if (originalMain && !list.some((o) => o.value === originalMain.id)) list.unshift({ value: originalMain.id, label: originalMain.name });
    return list;
  }, [projectsQ.data, originalMain]);

  // One policy per leave type (D30): the option is the type's policy. The employee's current
  // policies stay listed even if their type was deactivated since.
  const policyOptions = useMemo(() => {
    const list = (policiesQ.data?.items || []).filter((lt) => lt.policy_id).map((lt) => ({ value: lt.policy_id, label: lt.name }));
    employee.leave_policies
      .filter((p) => p.is_active && !list.some((o) => o.value === p.id))
      .forEach((p) => list.push({ value: p.id, label: p.leave_type?.name || p.name }));
    return list;
  }, [policiesQ.data, employee.leave_policies]);

  const accessLevelOptions = ACCESS_LEVELS.filter(
    (a) => a.value === ov.access_level || (a.value !== "ADMIN" && (a.value !== "SUB_ADMIN" || isOwner)),
  );

  // Lock scroll while open.
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const placeError = (err) => {
    const code = apiErrorCode(err);
    if (CODE_FIELDS[code]) {
      setError(CODE_FIELDS[code], { type: "server", message: apiErrorMessage(err) }, { shouldFocus: true });
      return;
    }
    if (ROUTING_CODES.includes(code)) {
      setRoutingError(apiErrorMessage(err));
      return;
    }
    const { mapped, unmapped } = applyFieldErrors(err, setError, { fieldMap: FIELD_MAP, knownFields: FORM_FIELDS });
    const routing = err?.response?.data?.errors?.approvalGroupId;
    if (routing) setRoutingError(routing);
    if (!mapped.length && !routing) toast.error(unmapped[0] || apiErrorMessage(err));
  };

  const onSubmit = async (data) => {
    if (saving) return;
    setSaving(true);
    setRoutingError("");
    clearErrors();
    let saved = null;
    try {
      if (mainChanged) {
        saved = await changeMainProject(employee.overview.id, {
          projectId: data.mainProjectId,
          effectiveFrom: data.effectiveFrom || companyToday,
        });
      }
      const contract = data.employmentType === "Contract";
      saved = await updateEmployee(employee.overview.id, {
        name: data.fullName.trim(),
        country_emp_id: data.countryEmpId.trim(),
        email: data.email.trim(),
        phone: data.phone.trim(),
        phoneCountry: data.phoneCountry,
        nationalityCountryId: data.nationalityCountryId,
        residenceCountryId: data.residenceCountryId || null,
        residenceCityId: data.residenceCityId || null,
        // Not on this form: kept as they are.
        dob: ov.dob,
        gender: ov.gender,
        address: (data.address || "").trim() || null,
        accommodation: (data.accommodation || "").trim() || null,
        employmentType: contract ? "CONTRACT" : "FULL_TIME",
        accessLevel: data.accessLevel,
        roleId: data.designatedRole || null,
        departmentId: data.departmentId || null,
        designationId: data.designationId || null,
        // staffing company only applies to contract employees; clear it otherwise
        staffingCompanyId: contract && data.staffingCompanyId ? data.staffingCompanyId : null,
        shiftId: data.shiftId || null,
        leavePolicyIds: data.leavePolicyIds,
        ...toRoutingBody(approvalRouting),
      });
    } catch (err) {
      // A main project change that went through stays saved.
      if (saved) onSaved?.(saved);
      placeError(err);
      setSaving(false);
      return;
    }
    onSaved?.(saved);
    setSaving(false);
    toast.success(t("edit.success", "Employee updated successfully"));
    onClose();
  };

  // Salary (read-only): the saved structure.
  const salary = employee.salary;
  const salaryCurrency = salary?.currency || "SAR";
  const salaryMode = salary?.mode || "MONTHLY_FIXED";
  const isHourlyMode = salaryMode === "HOURLY";
  const salaryRows = salary?.components || [];
  const basicBase = salaryRows.reduce(
    (sum, r) => (codeOf(r.component) === "BASIC" && r.calculation_type === "FIXED" ? sum + (Number(r.amount) || 0) : sum),
    0,
  );
  const estNet = salaryRows.reduce((net, r) => {
    const amt = Number(r.amount) || 0;
    const resolved = r.calculation_type === "PERCENTAGE" ? (amt / 100) * basicBase : amt;
    return r.component.type === "DEDUCTION" ? net - resolved : net + resolved;
  }, 0);
  const hourlyRow = salaryRows.find((r) => codeOf(r.component) === "HOURLY");

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

        {/* noValidate: the rules show inline, not as a browser popup */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col flex-1 min-h-0"
        >
          <div
            className="flex-1 overflow-y-auto px-6 py-6 space-y-6 custom-scrollbar"
          >
            {/* Photo (uploads come with the Documents step, D44) */}
            <div className="flex items-center gap-5 pb-5 border-b border-gray-100">
              <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center shrink-0 overflow-hidden">
                {ov.profile_url ? (
                  <img
                    src={assetUrl(ov.profile_url)}
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
                    disabled
                    className="px-3 py-1.5 bg-cyan-600 text-white text-xs font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t("edit.changePhoto")}
                  </button>
                </div>
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
                <label className={labelCls}>
                  {t("edit.nationality")} <span className="text-red-500">*</span>
                </label>
                {/* Nationality doesn't change the phone code (countries-cities-phones D14). */}
                <CountrySelect
                  {...register("nationalityCountryId", { required: t("add.validation.nationalityRequired") })}
                  error={!!errors.nationalityCountryId}
                  placeholder={t("edit.selectNationality")}
                />
                <FieldErr error={errors.nationalityCountryId} />
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
                <label className={labelCls}>
                  {t("edit.phoneNumber")} <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <div className="shrink-0 min-w-[100px]">
                    <PhoneCountrySelect
                      {...register("phoneCountry", { required: t("common:geo.phoneCountryRequired") })}
                      error={!!errors.phoneCountry}
                    />
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={20}
                    placeholder={t("add.basic.phonePlaceholder")}
                    {...register("phone", {
                      validate: phoneRule(() => getValues("phoneCountry"), t, {
                        required: true,
                        requiredMessage: t("add.validation.phoneRequired"),
                      }),
                    })}
                    className={inputCls(errors.phone)}
                  />
                </div>
                <FieldErr error={errors.phone || errors.phoneCountry} />
              </div>

              <div>
                <label className={labelCls}>
                  {t("edit.countryEmpId")} <span className="text-red-500">*</span>
                </label>
                <input
                  {...register("countryEmpId", {
                    required: t("add.validation.countryEmpIdRequired"),
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

              {/* Residence country → city (countries D12). */}
              <div>
                <label className={labelCls}>
                  {t("add.basic.residenceCountry")} <span className="text-red-500">*</span>
                </label>
                <CountrySelect
                  {...register("residenceCountryId", {
                    required: t("common:geo.countryRequired"),
                    onChange: () => setValue("residenceCityId", ""),
                  })}
                  error={!!errors.residenceCountryId}
                />
                <FieldErr error={errors.residenceCountryId} />
              </div>
              <div>
                <label className={labelCls}>{t("add.basic.residenceCity")}</label>
                <CitySelect
                  {...register("residenceCityId")}
                  countryId={residenceCountryId}
                  selected={residenceCityId && residenceCityId === ov.residence_city?.id ? ov.residence_city : null}
                  error={!!errors.residenceCityId}
                />
                <FieldErr error={errors.residenceCityId} />
              </div>

              <div>
                {/* Optional, as in the API (an employee may have none); checked when filled. */}
                <label className={labelCls}>{t("edit.address")}</label>
                <input
                  {...register("address", {
                    validate: {
                      minLength: (v) =>
                        !v.trim() || v.trim().length >= 5 || t("add.validation.min5Chars"),
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
                  {/* Set when the employee is created (D49). */}
                  <label className={labelCls}>{t("edit.dateOfJoining")}</label>
                  <input
                    type="date"
                    value={ov.joining_date ? String(ov.joining_date).slice(0, 10) : ""}
                    disabled
                    readOnly
                    className={`${inputCls(false)} disabled:bg-gray-50 disabled:text-gray-500`}
                  />
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
                    {t("edit.designatedRole", "Role")}
                    {accessLevel === "SUB_ADMIN" && <span className="text-red-500"> *</span>}
                  </label>
                  <CustomDropdown value={designatedRole || ""} onChange={(e) => setValue("designatedRole", e.target.value, { shouldValidate: true })} disabled={loadingRoles} error={!!errors.designatedRole} options={[{ label: loadingRoles ? t("edit.loadingRoles", "Loading...") : t("edit.selectRole", "Select Role"), value: "" }, ...roles.map(r => ({ label: r.name, value: String(r.id) }))]} />
                  <FieldErr error={errors.designatedRole} />
                </div>

                <div>
                  <label className={labelCls}>{t("edit.department", "Department")}</label>
                  <CustomDropdown value={departmentId || ""} error={!!errors.departmentId} disabled={loadingDepartments} onChange={(e) => { setValue("departmentId", e.target.value); setValue("designationId", ""); }} options={[{ label: loadingDepartments ? t("edit.loading", "Loading...") : t("edit.selectDepartment", "Select Department"), value: "" }, ...(ov.department && !departments.some((d) => d.id === ov.department.id) ? [{ label: ov.department.name, value: ov.department.id }] : []), ...departments.map(d => ({ label: d.name, value: d.id }))]} />
                  <FieldErr error={errors.departmentId} />
                </div>

                <div>
                  <label className={labelCls}>{t("edit.designation", "Designation")}</label>
                  <CustomDropdown value={designationId || ""} onChange={(e) => setValue("designationId", e.target.value)} error={!!errors.designationId} disabled={!departmentId || loadingDesignations} options={[{ label: !departmentId ? t("edit.selectDepartmentFirst", "Select Department First") : loadingDesignations ? t("edit.loading", "Loading...") : t("edit.selectDesignation", "Select Designation"), value: "" }, ...(ov.designation && designationId === ov.designation.id && !designations.some((d) => d.id === ov.designation.id) ? [{ label: ov.designation.name, value: ov.designation.id }] : []), ...designations.map(d => ({ label: d.name, value: d.id }))]} />
                  <FieldErr error={errors.designationId} />
                </div>

                <div>
                  <label className={labelCls}>{t("edit.shift", "Shift")}</label>
                  <CustomDropdown
                    value={shiftId || ""}
                    onChange={(e) => setValue("shiftId", e.target.value)}
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
                  {/* Assignments are made on the project page (D13). */}
                  <label className={labelCls}>{t("edit.projectAssignment", "Projects")}</label>
                  <MultiSelect
                    options={projectOptions}
                    value={currentProjects.map((p) => p.id)}
                    disabled
                    placeholder={t("edit.selectProjects", "Select Projects")}
                    onChange={() => {}}
                  />
                  {accessLevel === "GENERAL_EMPLOYEE" && (
                    <p className="text-xs text-gray-400 mt-1">
                      {t("edit.projectHintGeneral", "A general employee can only have one project")}
                    </p>
                  )}
                </div>

                <div>
                  <label className={labelCls}>{t("edit.mainProject", "Main Project")} <span className="text-red-500">*</span></label>
                  <CustomDropdown
                    value={mainProjectId || ""}
                    onChange={(e) => {
                      setValue("mainProjectId", e.target.value, { shouldValidate: true });
                      setValue("effectiveFrom", companyToday);
                    }}
                    error={!!errors.mainProjectId}
                    disabled={projectsQ.loading}
                    placeholder={t("edit.selectMainProject", "Select Main Project")}
                    options={mainProjectOptions}
                  />
                  <FieldErr error={errors.mainProjectId} />
                </div>

                {/* A new main project starts on this date (D55, approved UI addition). */}
                {mainChanged && (
                  <div>
                    <label className={labelCls}>
                      {t("edit.effectiveFrom")} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      max={companyToday}
                      aria-invalid={!!errors.effectiveFrom}
                      {...register("effectiveFrom", { required: t("edit.validation.effectiveFromRequired") })}
                      className={inputCls(errors.effectiveFrom)}
                    />
                    <FieldErr error={errors.effectiveFrom} />
                  </div>
                )}

                <div>
                  <label className={labelCls}>
                    {t("edit.accessLevel")} <span className="text-red-500">*</span>
                  </label>
                  <CustomDropdown {...register("accessLevel", { required: t("add.validation.accessLevelRequired") })} error={!!errors.accessLevel} options={[{ label: t("edit.selectAccessLevel"), value: "" }, ...accessLevelOptions.map(a => ({ label: t(a.labelKey), value: a.value }))]} />
                  <FieldErr error={errors.accessLevel} />
                </div>

                {isContract && (
                  <div>
                    <label className={labelCls}>
                      {t("edit.staffingCompany")}
                    </label>
                    <CustomDropdown value={staffingCompanyId || ""} onChange={(e) => setValue("staffingCompanyId", e.target.value)} disabled={loadingStaffing} error={!!errors.staffingCompanyId} options={[{ label: loadingStaffing ? t("edit.loadingCompanies") : t("edit.selectStaffingCompany"), value: "" }, ...staffing.map(c => ({ label: c.code ? `${c.name} (${c.code})` : c.name, value: c.id }))]} />
                    <FieldErr error={errors.staffingCompanyId} />
                  </div>
                )}
              </div>

              <div className="mt-4">
                <label className={labelCls}>{t("edit.leavePolicies")} <span className="text-red-500">*</span></label>
                <MultiSelect
                  options={policyOptions}
                  value={selectedPolicies}
                  loading={loadingPolicies}
                  loadingText={t("edit.loadingLeavePolicies")}
                  placeholder={t("edit.selectLeavePolicies")}
                  error={errors.leavePolicyIds}
                  onChange={(next) =>
                    setValue("leavePolicyIds", next, { shouldValidate: true })
                  }
                />
                <FieldErr error={errors.leavePolicyIds} />
                <p className="text-xs text-gray-400 mt-1">
                  {t("edit.leavePoliciesHint")}
                </p>
              </div>
            </div>

            {/* Salary: shown, not editable after creation (D52) */}
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
                  <CustomDropdown value={salaryCurrency} disabled onChange={() => {}} options={[{ label: salaryCurrency, value: salaryCurrency }]} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className={labelCls}>{t("add.salary.calcMode")}</label>
                  <CustomDropdown
                    value={salaryMode}
                    disabled
                    onChange={() => {}}
                    options={[{ label: t(MODE_LABEL_KEYS[salaryMode]), value: salaryMode }]}
                  />
                </div>

                <div>
                  <label className={labelCls}>{t("add.salary.overtimeRate")}</label>
                  <CustomDropdown
                    value={String(ov.overtime_rate ?? "")}
                    disabled
                    onChange={() => {}}
                    options={[{ label: ov.overtime_rate != null ? `${ov.overtime_rate}×` : "—", value: String(ov.overtime_rate ?? "") }]}
                  />
                </div>

                {salaryMode === "MONTHLY_HOURLY" && (
                  <div>
                    <label className={labelCls}>{t("add.salary.workingHours")}</label>
                    <input type="number" value={salary?.working_hours ?? ""} disabled readOnly className={`${inputCls(false)} disabled:bg-gray-50`} />
                  </div>
                )}

                {isHourlyMode && (
                  <>
                    <div>
                      <label className={labelCls}>{t("add.salary.hourlyRate", { currency: salaryCurrency })}</label>
                      <input type="number" value={hourlyRow?.amount ?? ""} disabled readOnly className={`${inputCls(false)} disabled:bg-gray-50`} />
                    </div>
                    <div>
                      <label className={labelCls}>{t("add.salary.minHours")}</label>
                      <input type="number" value={salary?.min_hours ?? ""} disabled readOnly className={`${inputCls(false)} disabled:bg-gray-50`} />
                    </div>
                  </>
                )}
              </div>

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
                  {salaryRows.map((row) => (
                    <div key={row.component.id} className="flex gap-3 items-center flex-wrap sm:flex-nowrap">
                      <div className="flex-1 min-w-[180px]">
                        <CustomDropdown
                          value={row.component.id}
                          disabled
                          onChange={() => {}}
                          options={[
                            {
                              label: t("add.salary.componentOption", {
                                name: row.component.name,
                                type: row.component.type === "DEDUCTION" ? t("add.salary.deduction") : t("add.salary.earning"),
                              }),
                              value: row.component.id,
                            },
                          ]}
                        />
                      </div>
                      <div className="w-32">
                        <CustomDropdown
                          value={row.calculation_type}
                          disabled
                          onChange={() => {}}
                          options={[
                            { label: t("add.salary.fixed"), value: "FIXED" },
                            { label: t("add.salary.percent"), value: "PERCENTAGE" }
                          ]}
                        />
                      </div>
                      <div className="w-40 relative">
                        <span className="absolute start-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">
                          {row.calculation_type === "PERCENTAGE" ? "%" : salaryCurrency}
                        </span>
                        <input
                          type="number"
                          value={row.amount ?? ""}
                          disabled
                          readOnly
                          className="w-full pl-12 pr-3 py-3 border border-gray-200 rounded-lg text-sm text-gray-800 bg-gray-50 focus:outline-none transition text-right"
                        />
                      </div>
                    </div>
                  ))}
                </div>
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

            {/* Approval routing — last section, inside the scroll area so its group dropdowns
                aren't clipped by the footer. */}
            <div className="border-t border-gray-100 pt-5 pb-2">
              <ApprovalRoutingSection
                value={approvalRouting}
                projectId={mainProjectId}
                error={routingError}
                warning={
                  employee.approval_group?.project_mismatch &&
                  approvalRouting.some((r) => String(r.approval_group_id) === String(employee.approval_group.id))
                    ? ta("routing.projectMismatch")
                    : ""
                }
                onChange={(next) => {
                  setApprovalRouting(next);
                  setRoutingError("");
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
                  {t("edit.saving")}
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
