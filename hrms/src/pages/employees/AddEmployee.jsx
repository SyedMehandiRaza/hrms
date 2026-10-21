import { useEffect, useMemo, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import {
  MdOutlinePerson,
  MdOutlineArrowForward,
  MdOutlineArrowBack,
  MdInfoOutline,
  MdOutlineSecurity,
  MdOutlineBolt,
  MdOutlineSyncAlt,
  MdOutlineCheckCircle,
  MdOutlineEdit,
  MdOutlineAttachMoney,
  MdOutlineDescription,
  MdOutlineError,
  MdOutlineDelete,
  MdOutlineLock,
  MdOutlineUpload,
  MdAddCircleOutline,
  MdOutlineHistory,
  MdOutlineAccountBalance,
  MdOutlineShield,
  MdOutlinePersonAdd,
  MdOutlineChevronRight,
} from "react-icons/md";

import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import CustomDropdown from "../../components/CustomDropdown";
import { useTranslation, Trans } from "react-i18next";
import { NAME_PATTERN, NAME_STRIP } from "../../utils/nameRules";
import CountrySelect from "../../components/geo/CountrySelect";
import CitySelect from "../../components/geo/CitySelect";
import PhoneCountrySelect from "../../components/geo/PhoneCountrySelect";
import useApiQuery from "../../hooks/useApiQuery";
import { useCurrentUser } from "../../hooks/useSession";
import { DEFAULT_PHONE_COUNTRY, phoneRule } from "../../utils/phone";
import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import { getCities, getCountries } from "../../api/geo";
import { apiErrorCode, apiErrorMessage } from "../../utils/apiError";
import { serverErrors } from "../../utils/applyFieldErrors";
import {
  checkEmployeeUnique,
  createEmployee,
  createEmployeeDraft,
  getEmployeeDraft,
  listRoles,
  listStaffingCompanies,
  updateEmployeeDraft,
} from "../../api/employees";
import { listProjects } from "../../api/projects";
import { listLeaveTypes } from "../../api/leaveTypes";
import { listShifts } from "../../api/shifts";
import { listSalaryComponents } from "../../api/salaryComponents";
import { listDepartments } from "../../api/departments";
import { designationDropdown } from "../../api/designations";
import Ltr from "../../components/Ltr";
import ApprovalRoutingSection from "../../components/ApprovalRoutingSection";
import useFiscalYear from "../../hooks/useFiscalYear";
import { useFormat } from "../../hooks/useFormat";
import { maxJoiningDate } from "../../utils/fyValidation/misc";

const getProjectId = (p) => p?.id;

// A lookup the caller may not be allowed to read (403) is just empty in the wizard.
const listOrEmpty = (load) => load().catch(() => null);

// The Iqama is mandatory for every new employee (file + document number).
const IQAMA_DOC_TYPE = "Iqama (Residency Permit)";
const IQAMA_NUMBER_RE = /^\d{10}$/;
const isValidIqamaNumber = (n) => IQAMA_NUMBER_RE.test((n || "").trim());

// YYYY-MM-DD in the user's local timezone (toISOString would give UTC, which
// is a day off for users east/west of UTC around midnight).
const localISODate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDaysISO = (iso, days) => {
  const [y, m, d] = iso.split("-").map(Number);
  return localISODate(new Date(y, m - 1, d + days));
};

// Field → i18n error key for an Iqama document; empty object when valid.
// Number: exactly 10 digits. Issue date: required, not in the future.
// Expiry date: required, after the issue date and not already expired.
const getIqamaErrors = (doc) => {
  const errors = {};
  const today = localISODate();
  if (!doc.docNumber?.trim()) errors.docNumber = "add.toast.iqamaNumberRequired";
  else if (!isValidIqamaNumber(doc.docNumber))
    errors.docNumber = "add.toast.iqamaNumberInvalid";
  if (!doc.issueDate) errors.issueDate = "add.toast.iqamaIssueDateRequired";
  else if (doc.issueDate > today) errors.issueDate = "add.toast.issueDateFuture";
  if (!doc.expiryDate) errors.expiryDate = "add.toast.iqamaExpiryDateRequired";
  else if (doc.issueDate && doc.expiryDate <= doc.issueDate)
    errors.expiryDate = "add.toast.expiryAfterIssue";
  else if (doc.expiryDate <= today)
    errors.expiryDate = "add.toast.iqamaExpired";
  return errors;
};

// ── Constants ─────────────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, labelKey: "add.steps.basic" },
  { id: 2, labelKey: "add.steps.job" },
  { id: 3, labelKey: "add.steps.salary" },
  { id: 4, labelKey: "add.steps.documents" },
  { id: 5, labelKey: "add.steps.review" },
];

const DOC_TYPES = [
  { value: "Passport", labelKey: "add.documents.types.passport" },
  { value: "National ID", labelKey: "add.documents.types.nationalId" },
  { value: IQAMA_DOC_TYPE, labelKey: "add.documents.types.iqama" },
  { value: "Driver's License", labelKey: "add.documents.types.driverLicense" },
  { value: "Work Permit", labelKey: "add.documents.types.workPermit" },
  { value: "Tax Form", labelKey: "add.documents.types.taxForm" },
];

// Access level options → API enum
const ACCESS_LEVELS = [
  { value: "GENERAL_EMPLOYEE", labelKey: "add.accessLevels.generalEmployee" },
  { value: "EMPLOYEE", labelKey: "add.accessLevels.employee" },
  { value: "SUB_ADMIN", labelKey: "add.accessLevels.subAdmin" },
  { value: "ADMIN", labelKey: "add.accessLevels.admin" },
];

const STEP_FIELDS = {
  1: [
    "fullName",
    "nationalityCountryId",
    "phoneCountry",
    "phone",
    "email",
    "countryEmpId",
    "accommodation",
    "address",
    "residenceCountryId",
    "residenceCityId",
  ],
  2: [
    "employmentType",
    "dateOfJoining",
    "designatedRole",
    "projectIds",
    "mainProjectId",
    "accessLevel",
    "leavePolicyIds",
  ],
  3: ["salaryComponents", "salaryWorkingHours", "salaryHourlyRate", "salaryMinHours", "overtimeRate"],
  4: [],
};


// ── Shared Styles ─────────────────────────────────────────────────────────────
const inputBase =
  "w-full px-4 py-3 border rounded-lg text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition bg-white";
const inputCls = (err) =>
  `${inputBase} ${err ? "border-red-400 bg-red-50" : "border-gray-200"}`;
const labelCls =
  "block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2";

const Field = ({ label, required, error, hint, children }) => (
  <div>
    <label className={labelCls}>
      {label}
      {required && <span className="text-red-500 ms-0.5">*</span>}
    </label>
    {children}
    {hint && !error && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    {error && (
      <p className="flex items-center gap-1 text-xs text-red-500 mt-1.5">
        <MdOutlineError className="flex-shrink-0 text-sm" />
        {error.message}
      </p>
    )}
  </div>
);

// Checkbox dropdown for selecting multiple options.
// options: [{ value, label }], value: array of selected values, onChange: (nextArray) => void
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
        className={`${inputBase} appearance-none pr-9 cursor-pointer text-left flex items-center gap-2 flex-wrap min-h-[46px] ${error ? "border-red-400 bg-red-50" : "border-gray-200"
          }`}
      >
        {loading ? (
          <span className="text-gray-400">
            {loadingText || t("add.loading")}
          </span>
        ) : selectedLabels.length === 0 ? (
          <span className="text-gray-300">
            {placeholder || t("add.select")}
          </span>
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
        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg py-1 custom-scrollbar">
          {options.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-400">
              {t("add.noOptions")}
            </p>
          ) : (
            options.map((o) => {
              const checked = selected.some(
                (v) => String(v) === String(o.value),
              );
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

// ── Step 1 — Basic Information ────────────────────────────────────────────────
function StepBasic({
  register,
  errors,
  setPhotoFile,
  photoPreview,
  setPhotoPreview,
  watch,
  getValues,
}) {
  const { t } = useTranslation("employees");
  const fileRef = useRef();
  const residenceCountryId = watch("residenceCountryId");

  const handlePhoto = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      toast.error(t("add.toast.photoTooLarge"));
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setPhotoFile(f);
    setPhotoPreview(URL.createObjectURL(f));
  };

  const clearPhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="space-y-6">
      {/* Photo Upload */}
      <div className="flex flex-col sm:flex-row items-start sm:items-start gap-5 pb-6 border-b border-gray-100">
        <div
          onClick={() => fileRef.current.click()}
          className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center flex-shrink-0 cursor-pointer hover:border-cyan-400 transition-colors overflow-hidden"
        >
          {photoPreview ? (
            <img
              src={photoPreview}
              alt={t("add.basic.photoPreviewAlt")}
              className="w-full h-full object-cover rounded-xl"
            />
          ) : (
            <MdOutlinePerson className="text-5xl text-gray-300" />
          )}
        </div>
        <div className="flex-1">
          <p className="text-base font-semibold text-gray-900 mb-1">
            {t("add.basic.profilePhoto")}
          </p>
          <p className="text-sm text-gray-400 mb-4">
            {t("add.basic.profilePhotoHint")}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileRef.current.click()}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {t("add.basic.uploadPhoto")}
            </button>
            <button
              type="button"
              onClick={clearPhoto}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              {t("add.basic.remove")}
            </button>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Field label={t("add.basic.fullName")} required error={errors.fullName}>
          <input
            {...register("fullName", {
              required: t("add.validation.fullNameRequired"),

              validate: {
                noOnlySpaces: (value) =>
                  value.trim() !== "" || t("add.validation.nameEmptySpaces"),

                noDoubleSpaces: (value) =>
                  !/\s{2,}/.test(value) || t("add.validation.multipleSpaces"),

                // Letters in any language (Arabic, accented…) with single
                // spaces, hyphens, apostrophes or dots between words —
                // "Abdul-Rahman Al-Harbi", "O'Brien", "محمد العتيبي".
                validName: (value) =>
                  NAME_PATTERN.test(value.trim()) ||
                  t("add.validation.lettersSingleSpaces"),

                minLength: (value) =>
                  value.trim().length >= 2 || t("add.validation.min2Chars"),
              },
            })}
            placeholder={t("add.basic.fullNamePlaceholder")}
            className={inputCls(errors.fullName)}
            onInput={(e) => {
              let val = e.target.value;
              // Remove leading spaces
              val = val.replace(/^\s+/, "");
              // Keep letters (any language), spaces and ' - . (strips emojis, numbers, other symbols)
              val = val.replace(NAME_STRIP, "");
              // Prevent multiple consecutive spaces
              val = val.replace(/\s{2,}/g, " ");
              e.target.value = val;
            }}
          />
        </Field>

        <Field
          label={t("add.basic.nationality")}
          required
          error={errors.nationalityCountryId}
        >
          {/* Nationality doesn't change the phone code (countries-cities-phones D14). */}
          <CountrySelect
            {...register("nationalityCountryId", {
              required: t("add.validation.nationalityRequired"),
            })}
            error={!!errors.nationalityCountryId}
            placeholder={t("add.basic.selectNationality")}
          />
        </Field>

        <Field label={t("add.basic.phoneNumber")} required error={errors.phone || errors.phoneCountry}>
          <div className="flex gap-2">
            <div className="relative flex-shrink-0 min-w-[100px]">
              <PhoneCountrySelect
                {...register("phoneCountry", { required: t("common:geo.phoneCountryRequired") })}
                error={!!errors.phoneCountry}
              />
            </div>
            <input
              {...register("phone", {
                validate: phoneRule(() => getValues("phoneCountry"), t, {
                  required: true,
                  requiredMessage: t("add.validation.phoneRequired"),
                }),
              })}
              type="tel"
              inputMode="numeric"
              maxLength={20}
              placeholder={t("add.basic.phonePlaceholder")}
              className={inputCls(errors.phone)}
              onInput={(e) => {
                e.target.value = e.target.value.replace(/[^\d\s+()-]/g, "");
              }}
            />
          </div>
        </Field>

        <Field label={t("add.basic.email")} required error={errors.email}>
          <input
            {...register("email", {
              required: t("add.validation.emailRequired"),

              pattern: {
                value: /^[a-zA-Z0-9._+-]+@[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/,
                message: t("add.validation.emailInvalid"),
              },

              validate: {
                noSpaces: (value) =>
                  !/\s/.test(value) || t("add.validation.spacesNotAllowed"),

                noDoubleDots: (value) =>
                  !value.includes("..") || t("add.validation.emailFormatInvalid"),

                noStartDot: (value) =>
                  !value.startsWith(".") || t("add.validation.emailStartDot"),

                noEndDot: (value) =>
                  !value.endsWith(".") || t("add.validation.emailEndDot"),
              },
            })}
            type="email"
            placeholder={t("add.basic.emailPlaceholder")}
            className={inputCls(errors.email)}
            onInput={(e) => {
              let value = e.target.value;

              // Remove spaces
              value = value.replace(/\s/g, "");

              // Remove invalid characters
              value = value.replace(/[^a-zA-Z0-9._@+-]/g, "");

              e.target.value = value;
            }}
          />
        </Field>

        <Field
          label={t("add.basic.countryEmpId")}
          required
          error={errors.countryEmpId}
          hint={t("add.basic.countryEmpIdHint")}
        >
          <input
            {...register("countryEmpId", {
              required: t("add.validation.countryEmpIdRequired"),
              validate: {
                noOnlySpaces: (v) => v.trim() !== "" || t("add.validation.cannotBeEmpty"),
                minLen: (v) =>
                  v.trim().length >= 3 || t("add.validation.min3Chars"),
                maxLen: (v) =>
                  v.trim().length <= 10 || t("add.validation.max10Chars"),
                validChars: (v) =>
                  /^[A-Za-z0-9-]+$/.test(v.trim()) ||
                  t("add.validation.idChars"),
              },
            })}
            placeholder={t("add.basic.countryEmpIdPlaceholder")}
            className={inputCls(errors.countryEmpId)}
            onInput={(e) => {
              e.target.value = e.target.value.replace(/^\s+/, "");
            }}
          />
        </Field>

        {/* Optional. Company-provided housing — not the employee's own address. */}
        <Field
          label={t("add.basic.accommodation")}
          error={errors.accommodation}
          hint={t("add.basic.accommodationHint")}
        >
          <input
            {...register("accommodation", {
              validate: {
                maxLen: (v) =>
                  !v ||
                  v.trim().length <= 255 ||
                  t("add.validation.max255Chars"),
              },
            })}
            maxLength={255}
            placeholder={t("add.basic.accommodationPlaceholder")}
            className={inputCls(errors.accommodation)}
            onInput={(e) => {
              e.target.value = e.target.value.trimStart();
            }}
          />
        </Field>
      </div>

      {/* Residence country (default: the company's) → city (approved UI addition, countries D12). */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Field label={t("add.basic.residenceCountry")} required error={errors.residenceCountryId}>
          <CountrySelect
            {...register("residenceCountryId", { required: t("common:geo.countryRequired") })}
            error={!!errors.residenceCountryId}
          />
        </Field>
        <Field label={t("add.basic.residenceCity")} error={errors.residenceCityId}>
          <CitySelect {...register("residenceCityId")} countryId={residenceCountryId} error={!!errors.residenceCityId} />
        </Field>
      </div>

      <Field label={t("add.basic.address")} required error={errors.address}>
        <textarea
          {...register("address", {
            required: t("add.validation.addressRequired"),
            validate: {
              noOnlySpaces: (value) =>
                value.trim() !== "" || t("add.validation.addressEmpty"),
              minLength: (value) =>
                value.trim().length >= 5 || t("add.validation.min5Chars"),
              maxLength: (value) =>
                value.trim().length <= 255 ||
                t("add.validation.addressMax255"),
              noEmojis: (value) =>
                !/(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu.test(
                  value,
                ) || t("add.validation.noEmojis"),
            },
          })}
          rows={2}
          placeholder={t("add.basic.addressPlaceholder")}
          className={`${inputCls(errors.address)} resize-none`}
          onInput={(e) => {
            let val = e.target.value.replace(/^\s+/, "");
            val = val.replace(
              /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu,
              "",
            );
            e.target.value = val;
          }}
        />
      </Field>

      <div className="flex items-start gap-3 border border-gray-200 rounded-xl px-4 py-3.5">
        <MdInfoOutline className="text-gray-400 text-lg flex-shrink-0 mt-0.5" />
        <p className="text-sm text-gray-500">{t("add.basic.infoNote")}</p>
      </div>
    </div>
  );
}

// ── Step 2 — Job Details ──────────────────────────────────────────────────────
function StepJob({
  register,
  errors,
  watch,
  setValue,
  roles = [],
  projects = [],
  leavePolicies = [],
  staffingCompanies = [],
  shifts = [],
  departments = [],
  isOwner = false,
  loadingRoles = false,
  loadingProjects = false,
  loadingPolicies = false,
  loadingStaffing = false,
  loadingShifts = false,
}) {
  const { t } = useTranslation("employees");
  // Joining date limits: today and the max (1 year ahead) in company time.
  const companyToday = useFiscalYear().today;
  const fmtShiftTime = (val) => (val ? String(val).slice(0, 5) : "");
  const employmentType = watch("employmentType") || "Full-time";
  const isContract = employmentType === "Contract";
  const accessLevel = watch("accessLevel");
  // The owner may add a Sub admin; nobody can add another Admin (D48).
  const accessLevelOptions = ACCESS_LEVELS.filter((a) => a.value !== "SUB_ADMIN" || isOwner);
  const selectedPolicies = watch("leavePolicyIds") || [];
  const selectedProjects = watch("projectIds") || [];

  // Register custom-controlled fields so RHF validates them on Next.
  register("leavePolicyIds", {
    validate: (v) =>
      (Array.isArray(v) && v.length > 0) || t("add.validation.leavePolicyRequired"),
  });

  register("projectIds", {
    validate: (v, fv) => {
      if (!Array.isArray(v) || v.length === 0)
        return t("add.validation.projectRequired");
      if (fv.accessLevel === "GENERAL_EMPLOYEE" && v.length > 1)
        return t("add.validation.generalOneProject");
      return true;
    },
  });

  const mainProjectId = watch("mainProjectId");

  register("mainProjectId", {
    validate: (v, fv) => {
      const ids = fv.projectIds || [];
      if (!ids.length) return true; // no projects → no main project needed
      if (v === "" || v === null || v === undefined)
        return t("add.validation.mainProjectRequired");
      return (
        ids.map(String).includes(String(v)) ||
        t("add.validation.mainProjectInSelection")
      );
    },
  });

  // Keep the main project consistent with the selected projects: auto-pick when
  // exactly one project is chosen, and clear it if it leaves the selection.
  const projectIdsKey = selectedProjects.map(String).join(",");
  useEffect(() => {
    if (selectedProjects.length === 1) {
      if (String(mainProjectId) !== String(selectedProjects[0])) {
        setValue("mainProjectId", selectedProjects[0], {
          shouldValidate: true,
        });
      }
    } else if (
      mainProjectId &&
      !selectedProjects.map(String).includes(String(mainProjectId))
    ) {
      setValue("mainProjectId", "", { shouldValidate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectIdsKey]);

  const projectOptions = projects.map((p) => ({
    value: getProjectId(p),
    label: p.name,
  }));

  // One policy per leave type (D30): the option is the type's policy.
  const policyOptions = leavePolicies.map((lt) => ({
    value: lt.policy_id,
    label: lt.name,
  }));

  // ── Department + Designation (designation list depends on the department) ──
  const loadingDepartments = false;

  register("departmentId");
  register("designationId");
  const departmentId = watch("departmentId");

  // The designation list depends on the selected department (active ones only).
  const { data: designationData, loading: loadingDesignations } = useApiQuery(
    () => (departmentId ? listOrEmpty(() => designationDropdown(departmentId)) : Promise.resolve(null)),
    [departmentId],
  );
  const designations = designationData?.items || [];

  // Joining date (D49): empty = today; not more than 12 months ahead; not before the main
  // project's start.
  const mainProject = projects.find((p) => String(getProjectId(p)) === String(mainProjectId));
  const joiningRule = {
    validate: (v) => {
      if (!v) return true;
      if (v > maxJoiningDate(companyToday)) return t("add.validation.joiningTooFar");
      if (mainProject?.start_date && v < mainProject.start_date) return t("add.validation.joiningBeforeProjectStart");
      return true;
    },
  };

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h3 className="text-lg font-bold text-gray-900">
          {t("add.job.title")}
        </h3>
        <p className="text-sm text-gray-400 mt-0.5">{t("add.job.subtitle")}</p>
      </div>
      <div className="border-t border-gray-100" />

      {/* Employment Type Toggle */}
      <Field
        label={t("add.job.employmentType")}
        required
        error={errors.employmentType}
      >
        <div className="flex gap-0 border border-gray-200 rounded-lg p-1 w-fit">
          {[
            { value: "Full-time", label: t("add.job.fullTime") },
            { value: "Contract", label: t("add.job.contract") },
          ].map((opt) => (
            <label
              key={opt.value}
              className={`px-5 py-2 rounded-md text-sm font-medium cursor-pointer transition-all select-none ${employmentType === opt.value
                ? "bg-white shadow text-cyan-600 border border-gray-200"
                : "text-gray-500 hover:text-gray-700 border border-transparent"
                }`}
            >
              <input
                {...register("employmentType", {
                  required: t("add.validation.employmentTypeRequired"),
                  onChange: (e) => {
                    // When leaving Contract, clear the staffing company selection.
                    if (e.target.value !== "Contract") {
                      setValue("staffingCompanyId", "", {
                        shouldValidate: true,
                      });
                    }
                  },
                })}
                type="radio"
                value={opt.value}
                className="hidden"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </Field>

      {/* Date of joining — optional; empty = today (company time) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Field
          label={t("add.job.dateOfJoining")}
          error={errors.dateOfJoining}
          hint={t("add.job.dateOfJoiningHint")}
        >
          <input
            type="date"
            max={maxJoiningDate(companyToday)}
            aria-invalid={!!errors.dateOfJoining}
            className={inputCls(errors.dateOfJoining)}
            {...register("dateOfJoining", joiningRule)}
          />
        </Field>
      </div>

      {/* Role + Project */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Field
          label={t("add.job.designatedRole")}
          required={accessLevel === "SUB_ADMIN"}
          error={errors.designatedRole}
        >
          <CustomDropdown
            {...register("designatedRole", {
              // Required only for a Sub admin (D48); an Employee may have no role.
              validate: (v, fv) => fv.accessLevel !== "SUB_ADMIN" || !!v || t("add.validation.roleRequired"),
            })}
            error={!!errors.designatedRole}
            disabled={loadingRoles}
            placeholder={
              loadingRoles
                ? t("add.job.loadingRoles")
                : t("add.job.selectRole")
            }
            options={roles.map((r) => ({ label: r.name, value: r.id }))}
          />
        </Field>

        <Field
          label={t("add.job.projectAssignment")}
          required
          error={errors.projectIds}
          hint={
            accessLevel === "GENERAL_EMPLOYEE"
              ? t("add.job.projectHintGeneral")
              : t("add.job.projectHintMultiple")
          }
        >
          <MultiSelect
            options={projectOptions}
            value={selectedProjects}
            loading={loadingProjects}
            loadingText={t("add.job.loadingProjects")}
            placeholder={t("add.job.selectProjects")}
            error={errors.projectIds}
            onChange={(next) =>
              setValue("projectIds", next, { shouldValidate: true })
            }
          />
        </Field>
      </div>

      {/* Main Project — required once any project is assigned; drives payroll
          and approval-group scoping. */}
      {selectedProjects.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field
            label={t("add.job.mainProject", "Main Project")}
            required
            error={errors.mainProjectId}
            hint={t(
              "add.job.mainProjectHint",
              "The primary project this employee is paid and approved under.",
            )}
          >
            <CustomDropdown
              value={mainProjectId || ""}
              onChange={(e) =>
                setValue("mainProjectId", e.target.value || "", { shouldValidate: true })
              }
              error={!!errors.mainProjectId}
              placeholder={t("add.job.selectMainProject", "Select main project")}
              options={selectedProjects.map((pid) => {
                const proj = projects.find(
                  (p) => String(getProjectId(p)) === String(pid)
                );
                return {
                  label: proj?.name || t("add.job.projectFallback", { id: pid }),
                  value: pid
                };
              })}
            />
          </Field>
        </div>
      )}

      {/* Access Level + Leave Policies */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Field
          label={t("add.job.accessLevel")}
          required
          error={errors.accessLevel}
          hint={t("add.job.accessLevelHint")}
        >
          <CustomDropdown
            {...register("accessLevel", {
              required: t("add.validation.accessLevelRequired"),
              validate: (v) => v !== "ADMIN" || t("add.validation.adminExists"),
            })}
            error={!!errors.accessLevel}
            placeholder={t("add.job.selectAccessLevel")}
            options={accessLevelOptions.map((a) => ({ label: t(a.labelKey), value: a.value }))}
          />
        </Field>

        <Field
          label={t("add.job.leavePolicies")}
          required
          error={errors.leavePolicyIds}
          hint={t("add.job.leavePoliciesHint")}
        >
          <MultiSelect
            options={policyOptions}
            value={selectedPolicies}
            loading={loadingPolicies}
            placeholder={t("add.job.selectLeavePolicies")}
            error={errors.leavePolicyIds}
            onChange={(next) =>
              setValue("leavePolicyIds", next, { shouldValidate: true })
            }
          />
        </Field>
      </div>

      {/* Shift — one per employee (optional) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Field
          label={t("add.job.shift")}
          error={errors.shiftId}
          hint={t("add.job.shiftHint")}
        >
          <CustomDropdown
            {...register("shiftId")}
            error={!!errors.shiftId}
            disabled={loadingShifts}
            placeholder={
              loadingShifts
                ? t("add.job.loadingShifts")
                : t("add.job.selectShift")
            }
            options={shifts.map((s) => ({
              label: `${s.name} (${fmtShiftTime(s.start_time)}–${fmtShiftTime(s.end_time)})`,
              value: s.id
            }))}
          />
        </Field>
      </div>

      {/* Department + Designation (designation depends on department) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Field label={t("add.job.department", "Department")} error={errors.departmentId}>
          <CustomDropdown
            {...register("departmentId")}
            error={!!errors.departmentId}
            disabled={loadingDepartments}
            onChange={(e) => {
              setValue("departmentId", e.target.value);
              // Reset the dependent designation whenever the department changes.
              setValue("designationId", "");
            }}
            placeholder={
              loadingDepartments
                ? t("add.job.loading", "Loading…")
                : t("add.job.selectDepartment", "Select department")
            }
            options={departments.map((d) => ({
              label: d.name,
              value: d.id
            }))}
          />
        </Field>

        <Field
          label={t("add.job.designation", "Designation")}
          error={errors.designationId}
        >
          <CustomDropdown
            {...register("designationId")}
            error={!!errors.designationId}
            disabled={!departmentId || loadingDesignations}
            placeholder={
              !departmentId
                ? t("add.job.selectDepartmentFirst", "Select a department first")
                : loadingDesignations
                  ? t("add.job.loading", "Loading…")
                  : t("add.job.selectDesignation", "Select designation")
            }
            options={designations.map((d) => ({ label: d.name, value: d.id }))}
          />
        </Field>
      </div>

      {/* Staffing Company — only for Contract employees */}
      {isContract && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field
            label={t("add.job.staffingCompany")}
            error={errors.staffingCompanyId}
            hint={t("add.job.staffingCompanyHint")}
          >
            <CustomDropdown
              {...register("staffingCompanyId")}
              error={!!errors.staffingCompanyId}
              disabled={loadingStaffing}
              placeholder={
                loadingStaffing
                  ? t("add.job.loadingCompanies")
                  : t("add.job.selectStaffingCompany")
              }
              options={staffingCompanies.map((c) => ({
                label: c.code ? `${c.name} (${c.code})` : c.name,
                value: c.id
              }))}
            />
          </Field>
        </div>
      )}

      {/* Salary Preview Box */}
      {/* <div className="border border-dashed border-gray-200 rounded-xl p-5 bg-gray-50">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 bg-gray-200 rounded-md flex items-center justify-center">
            <MdOutlineAttachMoney className="text-gray-500 text-base" />
          </div>
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
            Next: Salary Configuration
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Basic Salary (USD)</label>
            <input
              disabled
              placeholder=""
              className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-white text-sm text-gray-300"
            />
          </div>
          <div>
            <label className={labelCls}>Allowances</label>
            <input
              disabled
              placeholder=""
              className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-white text-sm text-gray-300"
            />
          </div>
        </div>
      </div> */}

      {/* Policy Note + Last Updated */}
      {/* <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {note ? (
          <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-4">
            <MdInfoOutline className="text-cyan-500 text-lg flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-cyan-600 mb-1">
                System Policy Note
              </p>
              <p className="text-sm text-gray-600">{note.text}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-4">
            <MdInfoOutline className="text-cyan-500 text-lg flex-shrink-0 mt-0.5" />
            <p className="text-sm text-gray-500">
              Select a role to see relevant system policy notes.
            </p>
          </div>
        )}
        <div className="flex flex-col items-center justify-center border border-gray-200 rounded-xl px-4 py-4 gap-1">
          <MdOutlineHistory className="text-gray-400 text-xl mb-1" />
          <p className="text-xs text-gray-400">Last Updated</p>
          <p className="text-sm font-bold text-gray-700">2 mins ago</p>
        </div>
      </div> */}
    </div>
  );
}

// ── Step 3 — Salary Structure ─────────────────────────────────────────────────
// Currency is SAR only for now (D52).
const SALARY_CURRENCIES = ["SAR"];
// The default components (D42), in this order, are the locked first rows in monthly modes.
const DEFAULT_CODES = ["BASIC", "HOUSING", "TRANSPORT"];

// Salary calculation modes and how they're labelled.
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

function StepSalary({
  register,
  errors,
  watch,
  setValue,
  salaryCatalog = [],
  loadingComponents = false,
}) {
  const { t } = useTranslation("employees");
  const rows = watch("salaryComponents") || [];
  const currency = watch("salaryCurrency") || "SAR";
  const employmentType = watch("employmentType");
  const staffingCompanyId = watch("staffingCompanyId");
  const isStaffing = employmentType === "Contract" && !!staffingCompanyId;

  const allowedModes = allowedSalaryModes({ employmentType, staffingCompanyId });
  const mode = watch("salaryCalcMode") || allowedModes[0];
  const isHourly = mode === "HOURLY";

  // The locked defaults from the catalog (auto-added in monthly modes).
  const defaultComps = DEFAULT_CODES.map((code) => salaryCatalog.find((c) => codeOf(c) === code)).filter(Boolean);
  const defaultIds = defaultComps.map((c) => String(c.id));
  const basicComp = defaultComps.find((c) => codeOf(c) === "BASIC");

  // Keep the selected mode within the allowed set as hire type / staffing changes.
  useEffect(() => {
    if (!allowedModes.includes(mode)) {
      setValue("salaryCalcMode", allowedModes[0], { shouldValidate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedModes.join(","), mode]);

  // For monthly modes, the default rows (Basic, Housing, Transport) come first, once each.
  useEffect(() => {
    if (isHourly || !defaultComps.length) return;
    const others = rows.filter((r) => !defaultIds.includes(String(r.salary_component_id)));
    const firsts = defaultComps.map(
      (c) => rows.find((r) => String(r.salary_component_id) === String(c.id)) || { salary_component_id: c.id, calculation_type: "FIXED", amount: "" },
    );
    const next = [...firsts, ...others];
    if (next.length !== rows.length || next.some((r, i) => r !== rows[i])) {
      setValue("salaryComponents", next, { shouldValidate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHourly, defaultIds.join(",")]);

  // Validate the component rows on Next (mode-aware — HOURLY uses its own fields).
  // The server's rules (D52, standards §7.2), checked on Next.
  register("salaryComponents", {
    validate: (v) => {
      if (isHourly) return true;
      if (!Array.isArray(v) || v.length === 0)
        return t("add.validation.componentRequired");
      const ids = [];
      for (const row of v) {
        if (!row.salary_component_id) return t("add.validation.componentEveryRow");
        const amt = Number(row.amount);
        if (row.amount === "" || row.amount === null || Number.isNaN(amt) || amt < 0)
          return t("add.validation.amountEveryRow");
        if (row.calculation_type === "PERCENTAGE" && amt > 100)
          return t("add.validation.percentMax");
        ids.push(String(row.salary_component_id));
      }
      if (new Set(ids).size !== ids.length)
        return t("add.validation.duplicateComponent");
      if (!defaultIds.every((id) => ids.includes(id)))
        return t("add.validation.defaultComponentsRequired");
      const basic = basicComp && v.find((r) => String(r.salary_component_id) === String(basicComp.id));
      if (basic && !(Number(basic.amount) > 0))
        return t("add.validation.basicPositive");
      return true;
    },
  });

  const componentById = (id) =>
    salaryCatalog.find((c) => String(c.id) === String(id));

  // The default rows are locked in monthly modes — their component can't be changed and the
  // rows can't be removed.
  const isLockedRow = (row, idx) =>
    !isHourly && idx < defaultIds.length && defaultIds[idx] === String(row.salary_component_id);
  // Other rows offer every active component except the defaults and Hourly (HOURLY mode only).
  const optionalCatalog = salaryCatalog.filter((c) => !defaultIds.includes(String(c.id)) && codeOf(c) !== "HOURLY");

  const updateRows = (next) =>
    setValue("salaryComponents", next, { shouldValidate: true });

  const handleUpdate = (idx, field, value) => {
    updateRows(rows.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };

  const handleRemove = (idx) => {
    updateRows(rows.filter((_, i) => i !== idx));
  };

  const handleAdd = () => {
    updateRows([
      ...rows,
      { salary_component_id: "", calculation_type: "FIXED", amount: "" },
    ]);
  };

  // Estimated net — mirrors the backend resolveSalary: PERCENTAGE lines compute
  // against the sum of FIXED earnings named "BASIC"; earnings add, deductions
  // subtract. Purely a preview.
  const basicBase = rows.reduce((sum, r) => {
    const c = componentById(r.salary_component_id);
    if (c && c.type === "EARNING" && r.calculation_type === "FIXED" && codeOf(c) === "BASIC")
      return sum + (Number(r.amount) || 0);
    return sum;
  }, 0);

  const estNet = rows.reduce((net, r) => {
    const c = componentById(r.salary_component_id);
    if (!c) return net;
    const amt = Number(r.amount) || 0;
    const resolved =
      r.calculation_type === "PERCENTAGE" ? (amt / 100) * basicBase : amt;
    return c.type === "DEDUCTION" ? net - resolved : net + resolved;
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-lg font-bold text-gray-900">{t("add.salary.title")}</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {t("add.salary.buildSubtitle")}
          </p>
        </div>
        <div className="w-32">
          <label className={labelCls}>{t("add.salary.currency")}</label>
          <CustomDropdown
            {...register("salaryCurrency")}
            options={SALARY_CURRENCIES.map((c) => ({ label: c, value: c }))}
          />
        </div>
      </div>

      {/* Salary calculation mode + mode-specific fields */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className={labelCls}>{t("add.salary.calcMode")}</label>
          <CustomDropdown
            value={mode}
            onChange={(e) =>
              setValue("salaryCalcMode", e.target.value, { shouldValidate: true })
            }
            options={allowedModes.map((m) => ({ label: t(MODE_LABEL_KEYS[m]), value: m }))}
          />
          <p className="mt-1 text-[11px] text-gray-400">
            {isHourly
              ? t("add.salary.modeHintHourly")
              : mode === "MONTHLY_HOURLY"
                ? t("add.salary.modeHintMonthlyHourly")
                : t("add.salary.modeHintMonthlyFixed")}
          </p>
        </div>

        <div>
          <label className={labelCls}>{t("add.salary.overtimeRate")}</label>
          <CustomDropdown
            value={watch("overtimeRate") || (isStaffing ? "1" : "1.5")}
            onChange={(e) => setValue("overtimeRate", e.target.value)}
            options={OVERTIME_RATE_OPTIONS}
          />
          <p className="mt-1 text-[11px] text-gray-400">
            {t("add.salary.overtimeHint")}
          </p>
        </div>

        {mode === "MONTHLY_HOURLY" && (
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
                  (Number(val) > 0 && Number(val) <= 24) ||
                  t("add.validation.workingHours"),
              })}
              className={inputCls(errors.salaryWorkingHours)}
              placeholder={t("add.salary.workingHoursPlaceholder")}
            />
            {errors.salaryWorkingHours && (
              <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                <MdOutlineError className="flex-shrink-0 text-sm" />
                {errors.salaryWorkingHours.message}
              </p>
            )}
          </div>
        )}

        {isHourly && (
          <>
            <div>
              <label className={labelCls}>{t("add.salary.hourlyRate", { currency })}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                onKeyDown={(e) => {
                  if (e.key === "-" || e.key === "e") e.preventDefault();
                }}
                {...register("salaryHourlyRate", {
                  validate: (val) =>
                    Number(val) > 0 || t("add.validation.hourlyRate"),
                })}
                className={inputCls(errors.salaryHourlyRate)}
                placeholder={t("add.salary.hourlyRatePlaceholder")}
              />
              {errors.salaryHourlyRate && (
                <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                  <MdOutlineError className="flex-shrink-0 text-sm" />
                  {errors.salaryHourlyRate.message}
                </p>
              )}
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
                {...register("salaryMinHours", {
                  validate: (val) =>
                    val === "" ||
                    val == null ||
                    Number(val) >= 0 ||
                    t("add.validation.minHours"),
                })}
                className={inputCls(errors.salaryMinHours)}
                placeholder={t("add.salary.minHoursPlaceholder")}
              />
              <p className="mt-1 text-[11px] text-amber-600">
                {t("add.salary.minHoursAdvisory")}
              </p>
              {errors.salaryMinHours && (
                <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                  <MdOutlineError className="flex-shrink-0 text-sm" />
                  {errors.salaryMinHours.message}
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Component grid — monthly modes only (hourly uses the rate field above). */}
      <div
        className={`bg-gray-50/50 border border-gray-100 p-6 rounded-2xl ${
          isHourly ? "hidden" : ""
        }`}
      >
        <div className="space-y-3">
          {rows.length === 0 && (
            <p className="text-sm text-gray-400 italic">
              {t("add.salary.noComponents")}
            </p>
          )}
          {rows.map((row, idx) => {
            return (
              <div key={idx} className="flex gap-3 items-center flex-wrap sm:flex-nowrap">
                {/* Component */}
                <div className="flex-1 min-w-[180px] relative">
                  <CustomDropdown
                    value={row.salary_component_id || ""}
                    onChange={(e) => handleUpdate(idx, "salary_component_id", e.target.value || "")}
                    disabled={loadingComponents || isLockedRow(row, idx)}
                    placeholder={loadingComponents ? t("add.salary.loadingComponents") : t("add.salary.selectComponent")}
                    options={(isLockedRow(row, idx) ? salaryCatalog.filter((c) => String(c.id) === String(row.salary_component_id)) : optionalCatalog).map((c) => ({
                      label: t(
                        c.is_system
                          ? "add.salary.componentOptionDefault"
                          : "add.salary.componentOption",
                        {
                          name: c.name,
                          type:
                            c.type === "DEDUCTION"
                              ? t("add.salary.deduction")
                              : t("add.salary.earning"),
                        },
                      ),
                      value: c.id
                    }))}
                  />
                </div>

                {/* Calc type */}
                <div className="w-32 relative">
                  <CustomDropdown
                    value={row.calculation_type || "FIXED"}
                    onChange={(e) => handleUpdate(idx, "calculation_type", e.target.value)}
                    options={[
                      { label: t("add.salary.fixed"), value: "FIXED" },
                      { label: t("add.salary.percent"), value: "PERCENTAGE" }
                    ]}
                  />
                </div>

                {/* Amount */}
                <div className="w-40 relative">
                  <span className="absolute start-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">
                    {row.calculation_type === "PERCENTAGE" ? "%" : currency}
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={row.amount}
                    onKeyDown={(e) => {
                      if (e.key === "-" || e.key === "e") e.preventDefault();
                    }}
                    onChange={(e) =>
                      handleUpdate(idx, "amount", e.target.value.replace("-", ""))
                    }
                    className="w-full pl-12 pr-3 py-3 border border-gray-200 rounded-lg text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition text-right"
                    placeholder="0.00"
                  />
                </div>

                {isLockedRow(row, idx) ? (
                  <span className="w-[46px] h-[46px] flex-shrink-0 flex items-center justify-center text-gray-300">
                    <MdOutlineLock className="text-lg" />
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleRemove(idx)}
                    className="w-[46px] h-[46px] flex-shrink-0 flex items-center justify-center bg-white border border-gray-200 rounded-lg text-red-500 hover:bg-red-50 hover:border-red-200 transition"
                  >
                    <MdOutlineDelete className="text-xl" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* The rows' rule texts (§7.2 components), under the rows. */}
        {errors.salaryComponents && (
          <p className="flex items-center gap-1 text-xs text-red-500 mt-3">
            <MdOutlineError className="flex-shrink-0 text-sm" />
            {errors.salaryComponents.message}
          </p>
        )}

        <button
          type="button"
          onClick={handleAdd}
          className="mt-5 flex items-center gap-2 text-[#0b5c91] font-semibold text-sm hover:text-cyan-800 transition"
        >
          <MdAddCircleOutline className="text-xl" /> {t("add.salary.addComponent")}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
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
            {currency}{" "}
            {estNet.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Step 4 — Documents ────────────────────────────────────────────────────────
function StepDocuments({ docs, setDocs, showErrors = false }) {
  const { t } = useTranslation("employees");
  const fileRef = useRef();
  const [dragging, setDragging] = useState(false);

  const iqamaDoc = docs.find((d) => d.docType === IQAMA_DOC_TYPE);
  const iqamaComplete =
    !!iqamaDoc && Object.keys(getIqamaErrors(iqamaDoc)).length === 0;
  // Inline error for an Iqama field (only after a failed attempt).
  const iqamaFieldError = (doc, field) => {
    if (!showErrors || doc.docType !== IQAMA_DOC_TYPE) return null;
    const key = getIqamaErrors(doc)[field];
    return key ? t(key) : null;
  };
  const today = localISODate();
  const iqamaBannerCls = iqamaComplete
    ? "border-green-200 bg-green-50 text-green-700"
    : showErrors
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-amber-200 bg-amber-50 text-amber-800";
  // The Iqama is uploaded first: the first file is auto-typed as Iqama, and
  // further uploads stay locked until the Iqama has a valid number.
  const uploadsLocked = !!iqamaDoc && !iqamaComplete;

  const openFilePicker = () => {
    if (uploadsLocked) {
      toast.error(t("add.toast.iqamaFirst"));
      return;
    }
    fileRef.current.click();
  };

  const handleFiles = (files) => {
    if (uploadsLocked) {
      toast.error(t("add.toast.iqamaFirst"));
      return;
    }
    const validFiles = [];
    Array.from(files).forEach((f) => {
      // Documents restored from a draft have no File object, only sizeBytes.
      const isDuplicateInState = docs.some(
        (d) => d.name === f.name && (d.file?.size ?? d.sizeBytes) === f.size
      );
      const isDuplicateInBatch = validFiles.some(
        (vf) => vf.name === f.name && vf.size === f.size
      );

      if (f.type.startsWith("video/")) {
        toast.error(t("add.toast.videoNotAllowed", { name: f.name }));
      } else if (f.size > 10 * 1024 * 1024) {
        toast.error(t("add.toast.fileTooLarge", { name: f.name }));
      } else if (isDuplicateInState || isDuplicateInBatch) {
        toast.error(t("add.toast.duplicateFile", { name: f.name }));
      } else {
        validFiles.push(f);
      }
    });

    // No Iqama yet: only the first file is accepted, and it becomes the Iqama.
    const needsIqama = !iqamaDoc;
    if (needsIqama && validFiles.length > 1) {
      toast.info(t("add.toast.iqamaFirstOnlyOne"));
      validFiles.length = 1;
    }

    const newDocs = validFiles.map((f, i) => ({
      id: Date.now() + i,
      file: f,
      fileUrl: null,
      name: f.name,
      sizeBytes: f.size,
      size:
        f.size < 1024 * 1024
          ? `${(f.size / 1024).toFixed(1)} KB`
          : `${(f.size / 1024 / 1024).toFixed(1)} MB`,
      time: "Just now",
      docType: needsIqama ? IQAMA_DOC_TYPE : "",
      docNumber: "",
      authority: "",
      issueDate: "",
      expiryDate: "",
    }));
    setDocs((d) => [...d, ...newDocs]);
  };

  const updateDoc = (id, field, value) =>
    setDocs((d) =>
      d.map((doc) => (doc.id === id ? { ...doc, [field]: value } : doc)),
    );

  const removeDoc = (id) => setDocs((d) => d.filter((doc) => doc.id !== id));

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-gray-900">
          {t("add.documents.title")}
        </h3>
        <p className="text-sm text-gray-400 mt-0.5">
          {t("add.documents.subtitle")}
        </p>
      </div>

      {/* Mandatory Iqama notice */}
      <div
        role={iqamaComplete ? "status" : "alert"}
        className={`flex items-start gap-3 border rounded-xl px-4 py-3 ${iqamaBannerCls}`}
      >
        {iqamaComplete ? (
          <MdOutlineCheckCircle className="text-xl shrink-0 mt-0.5" />
        ) : (
          <MdOutlineError className="text-xl shrink-0 mt-0.5" />
        )}
        <div className="text-sm">
          <p className="font-semibold">
            {iqamaComplete
              ? t("add.documents.iqamaNotice.doneTitle")
              : t("add.documents.iqamaNotice.title")}
          </p>
          {!iqamaComplete && (
            <p className="mt-0.5">
              {iqamaDoc
                ? t("add.documents.iqamaNotice.numberMissing")
                : t("add.documents.iqamaNotice.body")}
            </p>
          )}
        </div>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!uploadsLocked) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={openFilePicker}
        aria-disabled={uploadsLocked}
        className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center gap-3 transition-colors ${uploadsLocked
          ? "border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed"
          : dragging
            ? "border-cyan-400 bg-cyan-50 cursor-pointer"
            : "border-gray-200 hover:border-cyan-300 hover:bg-gray-50 cursor-pointer"
          }`}
      >
        <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center">
          <MdOutlineUpload className="text-cyan-500 text-3xl" />
        </div>
        <div className="text-center">
          {!iqamaDoc && (
            <p className="text-sm font-semibold text-cyan-700 mb-1">
              {t("add.documents.uploadIqamaFirst")}
            </p>
          )}
          {uploadsLocked && (
            <p className="text-sm font-semibold text-gray-600 mb-1">
              {t("add.documents.uploadsLockedHint")}
            </p>
          )}
          <p className="text-sm font-medium text-gray-700">
            {t("add.documents.dragDrop")}
          </p>
          <p className="text-sm text-gray-400">
            {t("add.documents.or")}{" "}
            <button
              type="button"
              className="text-cyan-600 underline font-medium"
            >
              {t("add.documents.browse")}
            </button>
          </p>
        </div>
        <p className="text-[11px] text-gray-300 uppercase tracking-wider font-semibold">
          {t("add.documents.supports")}
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="hidden"
          multiple
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* Uploaded Documents */}
      {docs.map((doc) => (
        <div
          key={doc.id}
          className="border border-gray-200 rounded-xl overflow-hidden"
        >
          {/* File Header */}
          <div className="flex items-center justify-between px-5 py-4 bg-white">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                <MdOutlineDescription className="text-cyan-500 text-xl" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {doc.name}
                </p>
                <p className="text-xs text-gray-400 uppercase tracking-wider">
                  {t("add.documents.uploadedMeta", {
                    time:
                      doc.time === "Just now"
                        ? t("add.documents.justNow")
                        : doc.time,
                    size: doc.size,
                  })}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => removeDoc(doc.id)}
              className="p-2 text-gray-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
            >
              <MdOutlineDelete className="text-xl" />
            </button>
          </div>

          {/* Document Meta Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-5 pb-5 bg-white">
            <div>
              <label className={labelCls}>
                {t("add.documents.documentType")}
              </label>
              <CustomDropdown
                value={doc.docType}
                onChange={(e) => updateDoc(doc.id, "docType", e.target.value)}
                // The Iqama slot is fixed; other types are chosen freely.
                disabled={doc.docType === IQAMA_DOC_TYPE}
                placeholder={t("add.documents.selectType")}
                options={DOC_TYPES
                  .filter(
                    (d) =>
                      d.value === doc.docType ||
                      !docs.some((otherDoc) => otherDoc.docType === d.value)
                  )
                  .map((d) => ({ label: t(d.labelKey), value: d.value }))}
              />
            </div>
            <div>
              <label className={labelCls}>
                {t("add.documents.documentNumber")}
                {doc.docType === IQAMA_DOC_TYPE && (
                  <span className="text-red-500 ms-0.5">*</span>
                )}
              </label>
              <input
                value={doc.docNumber}
                onChange={(e) => {
                  // Iqama numbers are exactly 10 digits; other documents
                  // accept letters and digits.
                  let val =
                    doc.docType === IQAMA_DOC_TYPE
                      ? e.target.value.replace(/\D/g, "").slice(0, 10)
                      : e.target.value.replace(/[^a-zA-Z0-9]/g, "");
                  updateDoc(doc.id, "docNumber", val);
                }}
                {...(doc.docType === IQAMA_DOC_TYPE
                  ? { inputMode: "numeric", maxLength: 10 }
                  : {})}
                placeholder={
                  doc.docType === IQAMA_DOC_TYPE
                    ? t("add.documents.iqamaNumberPlaceholder")
                    : t("add.documents.documentNumberPlaceholder")
                }
                className={inputCls(!!iqamaFieldError(doc, "docNumber"))}
              />
              {iqamaFieldError(doc, "docNumber") && (
                <p className="text-xs text-red-500 mt-1">
                  {iqamaFieldError(doc, "docNumber")}
                </p>
              )}
            </div>
            <div>
              <label className={labelCls}>
                {t("add.documents.issuingAuthority")}
              </label>
              <input
                value={doc.authority}
                onChange={(e) => {
                  let val = e.target.value.replace(
                    /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu,
                    "",
                  );
                  updateDoc(doc.id, "authority", val);
                }}
                maxLength={150}
                placeholder={t("add.documents.issuingAuthorityPlaceholder")}
                className={inputCls(false)}
              />
            </div>
            <div>
              <label className={labelCls}>
                {t("add.documents.issueDate")}
                {doc.docType === IQAMA_DOC_TYPE && (
                  <span className="text-red-500 ms-0.5">*</span>
                )}
              </label>
              <input
                type="date"
                value={doc.issueDate}
                onChange={(e) => {
                  const val = e.target.value;
                  // Clearing the field is always allowed.
                  if (val && val > today) {
                    toast.error(t("add.toast.issueDateFuture"));
                    return;
                  }
                  if (val && doc.expiryDate && val >= doc.expiryDate) {
                    toast.error(t("add.toast.issueBeforeExpiry"));
                    return;
                  }
                  updateDoc(doc.id, "issueDate", val);
                }}
                max={
                  doc.expiryDate && doc.expiryDate <= today
                    ? addDaysISO(doc.expiryDate, -1)
                    : today
                }
                required={doc.docType === IQAMA_DOC_TYPE}
                placeholder={t("add.documents.datePlaceholder")}
                className={inputCls(!!iqamaFieldError(doc, "issueDate"))}
              />
              {iqamaFieldError(doc, "issueDate") && (
                <p className="text-xs text-red-500 mt-1">
                  {iqamaFieldError(doc, "issueDate")}
                </p>
              )}
            </div>
            <div>
              <label className={labelCls}>
                {t("add.documents.expiryDate")}
                {doc.docType === IQAMA_DOC_TYPE && (
                  <span className="text-red-500 ms-0.5">*</span>
                )}
              </label>
              <input
                type="date"
                value={doc.expiryDate}
                onChange={(e) => {
                  const val = e.target.value;
                  // Clearing the field is always allowed.
                  if (val && doc.issueDate && val <= doc.issueDate) {
                    toast.error(t("add.toast.expiryAfterIssue"));
                    return;
                  }
                  // An expired Iqama cannot be registered.
                  if (val && doc.docType === IQAMA_DOC_TYPE && val <= today) {
                    toast.error(t("add.toast.iqamaExpired"));
                    return;
                  }
                  updateDoc(doc.id, "expiryDate", val);
                }}
                min={(() => {
                  const afterIssue = doc.issueDate
                    ? addDaysISO(doc.issueDate, 1)
                    : undefined;
                  if (doc.docType !== IQAMA_DOC_TYPE) return afterIssue;
                  const tomorrow = addDaysISO(today, 1);
                  return afterIssue && afterIssue > tomorrow
                    ? afterIssue
                    : tomorrow;
                })()}
                required={doc.docType === IQAMA_DOC_TYPE}
                placeholder={t("add.documents.datePlaceholder")}
                className={inputCls(!!iqamaFieldError(doc, "expiryDate"))}
              />
              {iqamaFieldError(doc, "expiryDate") && (
                <p className="text-xs text-red-500 mt-1">
                  {iqamaFieldError(doc, "expiryDate")}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Add Another Document — only once the Iqama (step 1) is uploaded */}
      {iqamaDoc && (
      <button
        type="button"
        onClick={openFilePicker}
        disabled={uploadsLocked}
        title={uploadsLocked ? t("add.documents.uploadsLockedHint") : undefined}
        className="flex items-center gap-2 text-cyan-600 hover:text-cyan-700 text-sm font-semibold transition-colors disabled:text-gray-400 disabled:cursor-not-allowed"
      >
        <MdAddCircleOutline className="text-xl" />
        {t("add.documents.addAnother")}
      </button>
      )}
    </div>
  );
}

// ── Step 5 — Review ───────────────────────────────────────────────────────────
const InfoRow = ({ label, value }) => (
  <div>
    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">
      {label}
    </p>
    <p className="text-sm text-gray-900 font-medium break-all sm:break-words">
      {value || <span className="text-gray-300">—</span>}
    </p>
  </div>
);

const Card = ({ title, onEdit, children }) => {
  const { t } = useTranslation("employees");
  return (
    <div className="border border-gray-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-base font-bold text-gray-900">{title}</h4>
        <button
          type="button"
          onClick={onEdit}
          className="flex items-center gap-1 text-sm text-cyan-600 hover:text-cyan-700 font-medium transition-colors"
        >
          <MdOutlineEdit className="text-base" /> {t("add.review.edit")}
        </button>
      </div>
      {children}
    </div>
  );
};

function StepReview({
  data,
  onEditStep,
  preview,
  roles = [],
  projects = [],
  salaryCatalog = [],
  docs = [],
  departments = [],
  shifts = [],
  leavePolicies = [],
  staffingCompanies = [],
}) {
  const { t } = useTranslation("employees");
  const { fmtDate } = useFormat();
  // Names for the ids the steps picked (countries, city, designation).
  const { data: countries } = useApiQuery(() => listOrEmpty(() => getCountries()), []);
  const { data: cities } = useApiQuery(
    () => (data.residenceCountryId ? listOrEmpty(() => getCities(data.residenceCountryId, { limit: 100 })) : Promise.resolve(null)),
    [data.residenceCountryId],
  );
  const { data: designationData } = useApiQuery(
    () => (data.departmentId ? listOrEmpty(() => designationDropdown(data.departmentId)) : Promise.resolve(null)),
    [data.departmentId],
  );
  const countryList = Array.isArray(countries) ? countries : countries?.items || [];
  const countryName = (id) => countryList.find((c) => String(c.id) === String(id))?.name || "";
  const cityName = (cities?.items || []).find((c) => String(c.id) === String(data.residenceCityId))?.name || "";
  const nameOf = (list, id) => list.find((x) => String(x.id) === String(id))?.name || "";
  const phoneText =
    parsePhoneNumberFromString(String(data.phone || ""), data.phoneCountry)?.formatInternational() || data.phone;
  const policyNames = (data.leavePolicyIds || [])
    .map((id) => leavePolicies.find((lt) => String(lt.policy_id) === String(id))?.name)
    .filter(Boolean)
    .join(", ");
  const isContract = data.employmentType === "Contract";
  const roleName =
    roles.find((r) => String(r.id) === String(data.designatedRole))?.name || "";
  const projectNames =
    (data.projectIds || [])
      .map(
        (pid) =>
          projects.find((p) => String(getProjectId(p)) === String(pid))
            ?.name,
      )
      .filter(Boolean)
      .join(", ") || "";
  const mainProjectName =
    projects.find(
      (p) => String(getProjectId(p)) === String(data.mainProjectId),
    )?.name || "";
  const salaryRows = data.salaryComponents || [];
  const currency = data.salaryCurrency || "SAR";
  const componentName = (id) =>
    salaryCatalog.find((c) => String(c.id) === String(id))?.name || `#${id}`;
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">{t("add.review.intro")}</p>

      {/* Top row: Basic Info + Documents */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Basic Information */}
        <Card
          title={t("add.review.basicInformation")}
          onEdit={() => onEditStep(1)}
        >
          <div className="flex gap-4">
            <div className="w-16 h-16 rounded-xl bg-gray-200 flex-shrink-0 overflow-hidden">
              {preview ? (
                <img
                  src={preview}
                  alt={t("add.review.avatarAlt")}
                  className="w-full h-full object-cover"
                />
              ) : (
                <MdOutlinePerson className="text-4xl text-gray-400 m-auto mt-3" />
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 flex-1">
              <InfoRow label={t("add.review.fullName")} value={data.fullName} />
              <InfoRow
                label={t("add.review.email")}
                value={data.email ? <Ltr>{data.email}</Ltr> : undefined}
              />
              <InfoRow
                label={t("add.review.phoneNumber")}
                value={<Ltr>{phoneText}</Ltr>}
              />
              <InfoRow label={t("add.basic.countryEmpId")} value={data.countryEmpId ? <Ltr>{data.countryEmpId}</Ltr> : undefined} />
              <InfoRow label={t("add.basic.nationality")} value={countryName(data.nationalityCountryId)} />
              <InfoRow
                label={t("add.basic.residenceCountry")}
                value={[countryName(data.residenceCountryId), cityName].filter(Boolean).join(", ")}
              />
              <InfoRow label={t("add.review.address")} value={data.address} />
              <InfoRow label={t("add.basic.accommodation")} value={data.accommodation} />
            </div>
          </div>
        </Card>

        {/* Documents */}
        <Card title={t("add.review.documents")} onEdit={() => onEditStep(4)}>
          <div className="space-y-3">
            {docs.length > 0 ? (
              docs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-lg px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                      <MdOutlineDescription className="text-cyan-500 text-base" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {doc.name}
                      </p>
                      <p className="text-xs text-gray-400">{doc.size}</p>
                    </div>
                  </div>
                  <MdOutlineCheckCircle className="text-green-500 text-xl" />
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-400 italic">
                {t("add.review.noDocuments")}
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* Bottom row: Job Details + Salary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title={t("add.review.jobDetails")} onEdit={() => onEditStep(2)}>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            <InfoRow label={t("add.job.designatedRole")} value={roleName} />
            <InfoRow label={t("add.job.employmentType")} value={isContract ? t("add.job.contract") : t("add.job.fullTime")} />
            <InfoRow label={t("add.job.department")} value={nameOf(departments, data.departmentId)} />
            <InfoRow label={t("add.job.designation")} value={nameOf(designationData?.items || [], data.designationId)} />
            <InfoRow label={t("add.job.shift")} value={nameOf(shifts, data.shiftId)} />
            <InfoRow label={t("add.job.leavePolicies")} value={policyNames} />
            {isContract && <InfoRow label={t("add.job.staffingCompany")} value={nameOf(staffingCompanies, data.staffingCompanyId)} />}
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">
                {t("add.job.dateOfJoining")}
              </p>
              <p className="text-sm text-gray-900 font-medium">
                {data.dateOfJoining ? fmtDate(data.dateOfJoining) : t("add.review.joiningToday")}
              </p>
            </div>
            <InfoRow
              label={t("add.job.mainProject", "Main Project")}
              value={mainProjectName}
            />
            <div className="col-span-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                {t("add.review.projects")}
              </span>
              <p className="text-sm text-gray-900 font-medium mt-0.5">
                {projectNames || <span className="text-gray-300">—</span>}
              </p>
            </div>
          </div>
        </Card>

        <Card
          title={t("add.review.salaryBenefits")}
          onEdit={() => onEditStep(3)}
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <InfoRow label={t("add.review.currency")} value={currency} />
              <InfoRow
                label={t("add.review.accessLevel")}
                value={(() => {
                  const a = ACCESS_LEVELS.find(
                    (x) => x.value === data.accessLevel,
                  );
                  return a ? t(a.labelKey) : undefined;
                })()}
              />
            </div>
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                {t("add.review.salaryComponents", "Salary Components")}
              </span>
              {salaryRows.length ? (
                <div className="mt-1.5 space-y-1.5">
                  {salaryRows.map((r, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-gray-700">
                        {componentName(r.salary_component_id)}
                      </span>
                      <span className="font-medium text-gray-900">
                        <Ltr>
                          {r.calculation_type === "PERCENTAGE"
                            ? `${r.amount}%`
                            : `${currency} ${Number(r.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
                        </Ltr>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-300 mt-0.5">—</p>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── Bottom Feature Cards ───────────────────────────────────────────────────────
const FEATURE_CARDS_BY_STEP = {
  1: [
    {
      icon: MdOutlineSecurity,
      titleKey: "add.features.secureData",
      descKey: "add.features.secureDataDesc",
    },
    {
      icon: MdOutlineBolt,
      titleKey: "add.features.quickSetup",
      descKey: "add.features.quickSetupDesc",
    },
    {
      icon: MdOutlineSyncAlt,
      titleKey: "add.features.autoSync",
      descKey: "add.features.autoSyncDesc",
    },
  ],
  3: [
    {
      icon: MdOutlineAccountBalance,
      titleKey: "add.features.complianceCheck",
      descKey: "add.features.complianceCheckDesc",
    },
    {
      icon: MdOutlineShield,
      titleKey: "add.features.dataEncryption",
      descKey: "add.features.dataEncryptionDesc",
    },
  ],
};

// ── Main ──────────────────────────────────────────────────────────────────────
// Initial wizard values; a resumed draft is merged over these.
const EMPLOYEE_FORM_DEFAULTS = {
  fullName: "",
  nationalityCountryId: "",
  phoneCountry: DEFAULT_PHONE_COUNTRY,
  residenceCountryId: "",
  residenceCityId: "",
  phone: "",
  email: "",
  countryEmpId: "",
  accommodation: "",
  address: "",
  employmentType: "Full-time",
  dateOfJoining: "",
  designatedRole: "",
  projectIds: [],
  mainProjectId: "",
  accessLevel: "",
  leavePolicyIds: [],
  staffingCompanyId: "",
  shiftId: "",
  salaryCurrency: "SAR",
  salaryCalcMode: "MONTHLY_FIXED",
  salaryWorkingHours: "",
  salaryHourlyRate: "",
  salaryMinHours: "",
  overtimeRate: "",
  salaryComponents: [],
};

export default function AddEmployee({ onCancel, onComplete }) {
  const { t } = useTranslation("employees");
  const [step, setStep] = useState(1);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [docs, setDocs] = useState([]);
  // Set once the user tries to leave step 4 without a valid Iqama, so the
  // missing fields are highlighted from then on.
  const [docsTouched, setDocsTouched] = useState(false);
  const [approvalRouting, setApprovalRouting] = useState([]);
  const [routingError, setRoutingError] = useState("");

  // ── Draft state ──
  // `?draft=<id>` resumes a saved draft. photoUrl is the already-uploaded
  // photo (from a draft save); a newly picked photoFile always wins over it.
  const [searchParams, setSearchParams] = useSearchParams();
  const draftParam = searchParams.get("draft");
  const [draftId, setDraftId] = useState(null);
  const [loadingDraft, setLoadingDraft] = useState(!!draftParam);
  const [savingDraft, setSavingDraft] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [unsaved, setUnsaved] = useState(false);
  const loadedDraftRef = useRef(null);

  const navigate = useNavigate();
  const user = useCurrentUser();
  const isOwner = user?.accessLevel === "ADMIN";

  // Lookups (each one is empty when the caller can't read it).
  const projectsQ = useApiQuery(() => listOrEmpty(() => listProjects({ limit: 100, status: "ACTIVE" })), []);
  const rolesQ = useApiQuery(() => listOrEmpty(() => listRoles()), []);
  const policiesQ = useApiQuery(() => listOrEmpty(() => listLeaveTypes({ limit: 100, status: "ACTIVE" })), []);
  const staffingQ = useApiQuery(() => listOrEmpty(() => listStaffingCompanies("ACTIVE")), []);
  const shiftsQ = useApiQuery(() => listOrEmpty(() => listShifts({ limit: 100 })), []);
  const componentsQ = useApiQuery(() => listOrEmpty(() => listSalaryComponents({ limit: 100, status: "ACTIVE" })), []);
  const departmentsQ = useApiQuery(() => listOrEmpty(() => listDepartments({ limit: 100, status: "ACTIVE" })), []);
  const projects = useMemo(() => projectsQ.data?.items || [], [projectsQ.data]);
  const loadingProjects = projectsQ.loading;
  const roles = useMemo(() => rolesQ.data || [], [rolesQ.data]);
  const loadingRoles = rolesQ.loading;
  const leavePolicies = useMemo(() => (policiesQ.data?.items || []).filter((lt) => lt.policy_id), [policiesQ.data]);
  const loadingPolicies = policiesQ.loading;
  const staffingCompanies = useMemo(() => staffingQ.data || [], [staffingQ.data]);
  const loadingStaffing = staffingQ.loading;
  const shifts = useMemo(() => shiftsQ.data?.items || [], [shiftsQ.data]);
  const loadingShifts = shiftsQ.loading;
  const salaryCatalog = useMemo(() => componentsQ.data?.items || [], [componentsQ.data]);
  const loadingComponents = componentsQ.loading;
  const departments = useMemo(() => departmentsQ.data?.items || [], [departmentsQ.data]);


  const {
    register,
    handleSubmit,
    trigger,
    getValues,
    watch,
    setValue,
    reset,
    setError,
    formState: { errors },
  } = useForm({
    mode: "onTouched",
    defaultValues: {
      ...EMPLOYEE_FORM_DEFAULTS,
      phoneCountry: user?.company?.country?.iso2 || DEFAULT_PHONE_COUNTRY,
      residenceCountryId: user?.company?.country?.id || "",
    },
  });

  // Resume a saved draft: restore values, documents, photo, routing and step.
  // Skipped when the URL param is the draft we just saved ourselves.
  useEffect(() => {
    if (!draftParam || loadedDraftRef.current === draftParam) return;
    let active = true;
    setLoadingDraft(true);
    getEmployeeDraft(draftParam)
      .then((draft) => {
        if (!draft) throw new Error("not found");
        if (!active) return;
        const data = draft.data || {};
        const savedAt = draft.last_saved_at
          ? new Date(draft.last_saved_at).toLocaleDateString()
          : "";
        loadedDraftRef.current = String(draft.id);
        setDraftId(draft.id);
        reset({ ...EMPLOYEE_FORM_DEFAULTS, ...(data.values || {}) });
        setDocs(
          (data.docs || []).map((d, i) => ({
            ...d,
            id: d.id ?? Date.now() + i,
            file: null,
            time: savedAt || d.time,
          })),
        );
        setApprovalRouting(
          Array.isArray(data.approvalRouting) ? data.approvalRouting : [],
        );
        setPhotoFile(null);
        setPhotoUrl(data.profileUrl || null);
        setPhotoPreview(data.profileUrl || null);
        setStep(Math.min(Math.max(Number(draft.current_step) || 1, 1), 5));
        setUnsaved(false);
      })
      .catch(() => {
        if (!active) return;
        toast.error(t("add.drafts.loadFailed"));
        setSearchParams({}, { replace: true });
      })
      .finally(() => {
        if (active) setLoadingDraft(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftParam]);

  // Any field change (typed or set by a step) marks the wizard as unsaved;
  // reset() — used when a draft loads — reports no field name, so it doesn't.
  useEffect(() => {
    const sub = watch((_, { name }) => {
      if (name) setUnsaved(true);
    });
    return () => sub.unsubscribe();
  }, [watch]);

  // Browser prompt on refresh / tab close while there are unsaved changes.
  useEffect(() => {
    if (!unsaved) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [unsaved]);

  // Setters handed to the steps also mark the wizard as unsaved.
  const setDocsTracked = (updater) => {
    setUnsaved(true);
    setDocs(updater);
  };
  const setPhotoFileTracked = (file) => {
    setUnsaved(true);
    setPhotoFile(file);
  };
  const setApprovalRoutingTracked = (value) => {
    setUnsaved(true);
    setApprovalRouting(value);
  };

  // In-app exits (Cancel / Back on step 1) ask before discarding changes.
  const confirmDiscard = () =>
    !unsaved || window.confirm(t("add.drafts.leaveConfirm"));

  // Upload whatever hasn't been uploaded yet (photo + document files) and
  // return the URLs. Shared by "Save as Draft" and the final create, so files
  // uploaded for a draft are never uploaded twice.
  // Document files go to private storage: fileUrl is then an "s3:<key>"
  // reference (drafts store it as-is; older drafts may still hold a public
  // /uploads URL — both are accepted by the create endpoint).
  // Static build: files stay in the browser (object URLs), nothing is uploaded.
  const uploadPendingFiles = async () => {
    let profileUrl = photoPreview ? photoUrl : null;
    if (photoFile) profileUrl = URL.createObjectURL(photoFile);
    const uploadedDocs = [];
    for (const doc of docs) {
      let fileUrl = doc.fileUrl || null;
      if (doc.file && !fileUrl) fileUrl = URL.createObjectURL(doc.file);
      uploadedDocs.push({ ...doc, fileUrl });
    }
    return { profileUrl, uploadedDocs };
  };

  const saveDraft = async () => {
    if (savingDraft || creating || loadingDraft) return;
    setSavingDraft(true);
    try {
      const { profileUrl, uploadedDocs } = await uploadPendingFiles();
      // Remember the uploads so the next save / final create reuses them.
      setPhotoUrl(profileUrl);
      if (photoFile) setPhotoFile(null);
      setDocs((prev) =>
        prev.map((d) => {
          const up = uploadedDocs.find((u) => u.id === d.id);
          return up ? { ...d, fileUrl: up.fileUrl } : d;
        }),
      );

      const values = getValues();
      const payload = {
        step,
        fullName: values.fullName || "",
        email: values.email || "",
        data: {
          values,
          // Documents aren't saved yet (D44): only their details stay with the draft.
          docs: uploadedDocs.map((d) => ({ ...d, file: undefined, fileUrl: null })),
          approvalRouting,
          // The photo stays in this browser until the employee exists.
          profileUrl: null,
        },
      };

      const saved = draftId ? await updateEmployeeDraft(draftId, payload) : await createEmployeeDraft(payload);

      if (String(saved.id) !== String(draftId)) {
        loadedDraftRef.current = String(saved.id);
        setDraftId(saved.id);
        setSearchParams({ draft: String(saved.id) }, { replace: true });
      }
      setUnsaved(false);
      toast.success(t("add.drafts.saved"));
    } catch (err) {
      // e.g. "Draft is too large (max 1 MB)." under data.
      toast.error(err?.response?.data?.errors?.data || apiErrorMessage(err, t("add.drafts.saveFailed")));
    } finally {
      setSavingDraft(false);
    }
  };

  // Server field → wizard field, and the step it's on (a failed create goes back there, ticket 28b).
  const SERVER_FIELD = {
    name: "fullName",
    country_emp_id: "countryEmpId",
    roleId: "designatedRole",
    joiningDate: "dateOfJoining",
    currency: "salaryCurrency",
    salaryMode: "salaryCalcMode",
    workingHours: "salaryWorkingHours",
    hourlyRate: "salaryHourlyRate",
    minHours: "salaryMinHours",
    components: "salaryComponents",
  };
  const CODE_FIELD = {
    EMPLOYEE_EMAIL_TAKEN: "email",
    ACCOUNT_EMAIL_IN_OTHER_COMPANY: "email",
    EMPLOYEE_PHONE_TAKEN: "phone",
    EMPLOYEE_ID_NUMBER_TAKEN: "countryEmpId",
    ACCOUNT_ADMIN_EXISTS: "accessLevel",
    PROJECT_GENERAL_EMPLOYEE_SINGLE: "projectIds",
  };
  const ROUTING_CODES = ["APPROVAL_GROUP_PROJECT_MISMATCH", "APPROVAL_ROUTING_PER_MODULE_DISABLED"];
  const stepOfField = (field) => {
    const found = Object.keys(STEP_FIELDS).find((st) => (STEP_FIELDS[st] || []).includes(field));
    return found ? Number(found) : 5;
  };

  // The wizard → POST /employees (workforce 13a/13b). Documents and the photo aren't saved yet (D44).
  const toCreateBody = (data) => {
    const isContract = data.employmentType === "Contract";
    const mode = data.salaryCalcMode || "MONTHLY_FIXED";
    const routing = approvalRouting.find((x) => x.module_key === "ALL") || approvalRouting[0];
    const num = (v) => (v === "" || v === null || v === undefined ? undefined : Number(v));
    return {
      name: data.fullName.trim(),
      country_emp_id: data.countryEmpId.trim(),
      email: data.email.trim(),
      phone: data.phone.trim(),
      phoneCountry: data.phoneCountry,
      nationalityCountryId: data.nationalityCountryId,
      residenceCountryId: data.residenceCountryId || null,
      residenceCityId: data.residenceCityId || null,
      address: (data.address || "").trim() || null,
      accommodation: (data.accommodation || "").trim() || null,
      employmentType: isContract ? "CONTRACT" : "FULL_TIME",
      accessLevel: data.accessLevel,
      roleId: data.designatedRole || null,
      projectIds: data.projectIds || [],
      mainProjectId: data.mainProjectId,
      joiningDate: data.dateOfJoining || null,
      departmentId: data.departmentId || null,
      designationId: data.designationId || null,
      staffingCompanyId: isContract && data.staffingCompanyId ? data.staffingCompanyId : null,
      leavePolicyIds: data.leavePolicyIds || [],
      shiftId: data.shiftId || null,
      approvalGroupId: routing ? routing.approval_group_id : null,
      moduleKey: routing ? routing.module_key : "ALL",
      currency: data.salaryCurrency || "SAR",
      salaryMode: mode,
      overtimeRate: num(data.overtimeRate),
      ...(mode === "MONTHLY_HOURLY" ? { workingHours: num(data.salaryWorkingHours) } : {}),
      ...(mode === "HOURLY"
        ? { hourlyRate: num(data.salaryHourlyRate), minHours: num(data.salaryMinHours) }
        : {
            components: (data.salaryComponents || [])
              .filter((row) => row.salary_component_id)
              .map((row) => ({
                componentId: String(row.salary_component_id),
                calculationType: row.calculation_type || "FIXED",
                amount: row.amount === "" || row.amount === null ? NaN : Number(row.amount),
              })),
          }),
      // Resumed from a draft → the server deletes it with the create.
      ...(draftId ? { draft_id: draftId } : {}),
    };
  };

  // One create at a time: a double click sends one request.
  const creatingRef = useRef(false);
  const [creating, setCreating] = useState(false);
  const submitEmployee = async (data) => {
    if (creatingRef.current) return;
    if (!validateDocs()) {
      setStep(4);
      return;
    }
    creatingRef.current = true;
    setCreating(true);
    setRoutingError("");
    let created;
    try {
      created = await createEmployee(toCreateBody(data));
    } catch (err) {
      creatingRef.current = false;
      setCreating(false);
      const code = apiErrorCode(err);
      if (ROUTING_CODES.includes(code)) {
        setRoutingError(apiErrorMessage(err));
        return;
      }
      if (CODE_FIELD[code]) {
        setError(CODE_FIELD[code], { type: "server", message: apiErrorMessage(err) }, { shouldFocus: true });
        setStep(stepOfField(CODE_FIELD[code]));
        return;
      }
      const rows = serverErrors(err);
      const routing = rows.find((row) => row.field === "approvalGroupId" || row.field === "moduleKey");
      if (routing) setRoutingError(routing.message);
      const fields = rows
        .filter((row) => row !== routing)
        .map((row) => ({ field: SERVER_FIELD[row.field] || row.field, message: row.message }));
      fields.forEach(({ field, message }, i) => setError(field, { type: "server", message }, { shouldFocus: i === 0 }));
      if (fields.length) setStep(Math.min(...fields.map(({ field }) => stepOfField(field))));
      else if (!routing) toast.error(apiErrorMessage(err));
      return;
    }
    toast.success(t("add.toast.created"));
    setUnsaved(false);
    onComplete?.(created);
    navigate(`/admin/employees/${created.id}`);
  };

  // Every uploaded document must have a type selected before leaving step 4
  // (whether via "Next" or "Skip for now"), and an Iqama with a valid number,
  // issue date and expiry date is mandatory.
  const validateDocs = () => {
    const missingType = docs.some((d) => !d.docType || d.docType.trim() === "");
    if (missingType) {
      toast.error(t("add.toast.docTypeRequired"));
      return false;
    }
    const iqama = docs.find((d) => d.docType === IQAMA_DOC_TYPE);
    if (!iqama) {
      setDocsTouched(true);
      toast.error(t("add.toast.iqamaRequired"));
      return false;
    }
    const firstError = Object.values(getIqamaErrors(iqama))[0];
    if (firstError) {
      setDocsTouched(true);
      toast.error(t(firstError));
      return false;
    }
    return true;
  };

  // Step 1: ask the server whether the ID number / email / phone are free, so a duplicate is
  // flagged under its input now. A failed check (network) never blocks — create re-checks.
  const [checkingIdentity, setCheckingIdentity] = useState(false);
  const identityIsAvailable = async () => {
    const v = getValues();
    let answer;
    setCheckingIdentity(true);
    try {
      answer = await checkEmployeeUnique({
        country_emp_id: (v.countryEmpId || "").trim(),
        email: (v.email || "").trim(),
        phone: (v.phone || "").trim(),
        phoneCountry: v.phoneCountry,
      });
    } catch {
      return true;
    } finally {
      setCheckingIdentity(false);
    }
    const taken = [
      ["countryEmpId", answer.country_emp_id],
      ["email", answer.email],
      ["phone", answer.phone],
    ].filter(([, r]) => r && !r.available);
    taken.forEach(([field, r], i) => setError(field, { type: "server", message: r.message }, { shouldFocus: i === 0 }));
    return taken.length === 0;
  };

  const handleNext = async () => {
    if (step === 5) {
      handleSubmit(submitEmployee)();
      return;
    }
    const valid = await trigger(STEP_FIELDS[step] || []);
    if (valid) {
      if (step === 1 && !(await identityIsAvailable())) return;
      if (step === 4 && !validateDocs()) return;
      setStep((s) => s + 1);
    }
  };

  const exitWizard = () => {
    if (!confirmDiscard()) return;
    if (onCancel) onCancel();
    else navigate("/admin/employees");
  };

  const handleBack = () => (step === 1 ? exitWizard() : setStep((s) => s - 1));

  const stepProps = {
    register,
    errors,
    watch,
    setValue,
    getValues,
    roles,
    projects,
    departments,
    isOwner,
    leavePolicies,
    staffingCompanies,
    shifts,
    salaryCatalog,
    loadingRoles,
    loadingProjects,
    loadingPolicies,
    loadingStaffing,
    loadingShifts,
    loadingComponents,
  };

  const stepContent = () => {
    // Steps mount only after a resumed draft is restored, so their
    // keep-consistent effects see the saved values, not the empty defaults.
    if (loadingDraft)
      return (
        <div className="py-16 flex flex-col items-center gap-3 text-sm text-gray-400">
          <span className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          {t("add.drafts.loading")}
        </div>
      );
    if (step === 1)
      return (
        <StepBasic
          {...stepProps}
          photoFile={photoFile}
          setPhotoFile={setPhotoFileTracked}
          photoPreview={photoPreview}
          setPhotoPreview={setPhotoPreview}
        />
      );
    if (step === 2) return <StepJob {...stepProps} />;
    if (step === 3) return <StepSalary {...stepProps} />;
    if (step === 4)
      return (
        <StepDocuments
          docs={docs}
          setDocs={setDocsTracked}
          showErrors={docsTouched}
        />
      );
    return (
      <StepReview
        data={getValues()}
        onEditStep={setStep}
        preview={photoPreview}
        roles={roles}
        projects={projects}
        salaryCatalog={salaryCatalog}
        docs={docs}
        departments={departments}
        shifts={shifts}
        leavePolicies={leavePolicies}
        staffingCompanies={staffingCompanies}
      />
    );
  };

  const submitting = creating;

  const featureCards = FEATURE_CARDS_BY_STEP[step];

  // Step-specific button labels
  const nextLabel =
    step === 5 ? (
      submitting ? (
        <span className="flex items-center gap-2">
          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          {t("add.buttons.creating")}
        </span>
      ) : (
        <span className="flex items-center gap-2">
          <MdOutlinePersonAdd className="text-lg" />{" "}
          {t("add.buttons.createEmployee")}
        </span>
      )
    ) : step === 4 ? (
      <span className="flex items-center gap-2">
        {t("add.buttons.next")}{" "}
        <MdOutlineArrowForward className="rtl:rotate-180" />
      </span>
    ) : (
      <span className="flex items-center gap-2">
        {t("add.buttons.nextStep")}{" "}
        <MdOutlineArrowForward className="rtl:rotate-180" />
      </span>
    );

  const backLabel =
    step === 4 ? (
      <span className="flex items-center gap-1.5">
        <MdOutlineArrowBack />
        {t("add.buttons.back")}
      </span>
    ) : step === 1 ? (
      t("add.buttons.cancel")
    ) : (
      <span className="flex items-center gap-1.5">
        <MdOutlineArrowBack className="rtl:rotate-180" />
        {t("add.buttons.back")}
      </span>
    );

  return (
    <div className="space-y-6">
      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-1.5 text-sm flex-wrap">
        <Link
          to="/admin/employees"
          className="text-gray-400 hover:text-cyan-600 transition-colors"
        >
          {t("add.breadcrumbEmployees")}
        </Link>
        <MdOutlineChevronRight className="text-gray-300 rtl:rotate-180" />
        <span className="text-cyan-600 font-semibold">
          {t("add.breadcrumbAdd")}
        </span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
          {t("add.title")}
        </h1>
        <p className="text-gray-400 mt-1 text-sm">{t("add.subtitle")}</p>
        {draftId && !loadingDraft && (
          <p className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
            <MdOutlineHistory className="text-sm" />
            {unsaved
              ? t("add.drafts.editingUnsaved")
              : t("add.drafts.editingSaved")}
          </p>
        )}
      </div>

      {/* Step Indicator */}
      <div className="relative py-2">
        {/* Background line */}
        <div className="absolute top-7 start-5 end-5 h-0.5 bg-gray-200 hidden sm:block" />
        {/* Progress line */}
        <div
          className="absolute top-7 start-5 h-0.5 bg-cyan-500 hidden sm:block transition-all duration-500"
          style={{
            width: `calc(${((step - 1) / (STEPS.length - 1)) * 100}% - 10px)`,
          }}
        />
        <div className="relative flex justify-between">
          {STEPS.map((s) => {
            const done = step > s.id;
            const current = step === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => done && setStep(s.id)}
                className={`flex flex-col items-center gap-2 ${done ? "cursor-pointer" : "cursor-default"}`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold z-10 transition-all ${done || current
                    ? "bg-cyan-600 text-white shadow-md shadow-cyan-200"
                    : "bg-white border-2 border-gray-200 text-gray-400"
                    }`}
                >
                  {done ? <MdOutlineCheckCircle className="text-xl" /> : s.id}
                </div>
                <span
                  className={`text-[11px] sm:text-xs font-medium text-center leading-tight hidden sm:block ${current
                    ? "text-cyan-600"
                    : done
                      ? "text-gray-600"
                      : "text-gray-400"
                    }`}
                >
                  {t(s.labelKey)}
                </span>
              </button>
            );
          })}
        </div>
        {/* Mobile label */}
        <p className="sm:hidden text-center text-xs font-semibold text-cyan-600 mt-3">
          {t("add.stepLabel", {
            current: step,
            total: STEPS.length,
            label: t(STEPS[step - 1].labelKey),
          })}
        </p>
      </div>

      {/* Form Card */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 lg:p-8">
        {stepContent()}

        {step === 5 && !loadingDraft && (
          <div className="mt-6">
            <ApprovalRoutingSection
              value={approvalRouting}
              projectId={getValues("mainProjectId")}
              error={routingError}
              onChange={(next) => {
                setApprovalRoutingTracked(next);
                setRoutingError("");
              }}
            />
          </div>
        )}

        {/* Navigation */}
        <div className="border-t border-gray-100 mt-8 pt-6 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="w-full sm:w-auto flex items-center justify-center cursor-pointer gap-1.5 text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 px-5 py-2.5 rounded-lg transition-colors"
          >
            {backLabel}
          </button>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={saveDraft}
              disabled={savingDraft || submitting || loadingDraft}
              className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed transition-colors px-4 py-2.5"
            >
              {savingDraft && (
                <span className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              )}
              {savingDraft
                ? t("add.drafts.saving")
                : t("add.buttons.saveAsDraft")}
            </button>
            {step === 4 && (
              <button
                type="button"
                onClick={() => {
                  if (validateDocs()) setStep(5);
                }}
                className="text-sm font-medium text-gray-400 bg-gray-100 rounded-lg cursor-pointer hover:text-gray-600 transition-colors px-4 py-2.5"
              >
                {t("add.buttons.skipForNow")}
              </button>
            )}
            {step === 5 && (
              <button
                type="button"
                onClick={exitWizard}
                className="text-sm font-medium text-gray-400 hover:text-gray-600 bg-gray-100 rounded cursor-pointer transition-colors px-4 py-2.5"
              >
                {t("add.buttons.cancel")}
              </button>
            )}
            <button
              type="button"
              onClick={handleNext}
              disabled={submitting || savingDraft || loadingDraft || checkingIdentity}
              className="flex-1 sm:flex-none flex items-center justify-center cursor-pointer gap-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-60 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg font-semibold text-sm transition-colors"
            >
              {nextLabel}
            </button>
          </div>
        </div>
      </div>

      {/* Feature Cards (only on certain steps) */}
      {featureCards && (
        <div
          className={`grid grid-cols-1 ${featureCards.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3"} gap-4`}
        >
          {featureCards.map(({ icon: Icon, titleKey, descKey }) => (
            <div
              key={titleKey}
              className="bg-white border border-gray-200 rounded-xl p-5"
            >
              <div className="flex items-center gap-3 mb-3">
                <Icon className="text-cyan-600 text-2xl" />
                <p className="text-sm font-bold text-gray-900">{t(titleKey)}</p>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                {t(descKey)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
