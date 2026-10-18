import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { MdClose, MdOutlineError, MdOutlineInfo, MdOutlinePerson } from "react-icons/md";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import { HRMS_PROJECTS, searchCities } from "../data/groupC";
import CustomDropdown from "./CustomDropdown";

const inputBase =
  "w-full px-4 py-3 border rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition bg-white disabled:bg-gray-50 disabled:text-gray-500";
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

const getId = (c) => c?.id ?? c?._id ?? c?.staffing_company_id;

const emailRule = {
  pattern: {
    value: /^[a-zA-Z0-9._+-]+@[a-zA-Z0-9-]+(\.[a-zA-Z]{2,})+$/,
    message: "Enter a valid email",
  },
};

const handleInput = (e) => {
  let val = e.target.value;
  const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
  if (emojiRegex.test(val)) {
    val = val.replace(emojiRegex, "");
  }
  if (val.startsWith(" ")) {
    val = val.trimStart();
  }
  if (/\s{2,}/.test(val)) {
    val = val.replace(/\s{2,}/g, " ");
  }
  if (e.target.value !== val) {
    e.target.value = val;
  }
};

const getProjectId = (p) => p?.id ?? p?._id ?? p?.project_id;

// Compact multi-select (checkbox dropdown) for allocating projects.
function ProjectMultiSelect({
  options = [],
  value = [],
  onChange,
  error,
  loading,
  disabled,
  placeholder,
}) {
  const { t } = useTranslation("staffing");
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
        className={`${inputBase} pr-9 cursor-pointer text-left flex items-center gap-2 flex-wrap min-h-[46px] ${error ? "border-red-400 bg-red-50" : "border-gray-200"
          }`}
      >
        {loading ? (
          <span className="text-gray-400">{t("modal.projects.loading")}</span>
        ) : selectedLabels.length === 0 ? (
          <span className="text-gray-400">{placeholder || t("modal.projects.selectProjects")}</span>
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
        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg py-1 custom-scrollbar">
          {options.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-400">{t("modal.projects.none")}</p>
          ) : (
            options.map((o) => {
              const checked = selected.some(
                (v) => String(v) === String(o.value),
              );
              return (
                <label
                  key={o.value}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(o.value)}
                    className="w-4 h-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
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

// mode: "create" | "edit" | "view"
export default function StaffingCompanyModal({ mode = "create", company, onClose, onSaved }) {
  const { t } = useTranslation("staffing");
  const projectList = HRMS_PROJECTS;
  const projectsLoading = false;

  const [cityQuery, setCityQuery] = useState("");
  const cityList = searchCities(cityQuery);
  const saving = false;
  const readOnly = mode === "view";
  const isEdit = mode === "edit";

  const photoRef = useRef();
  const [photo, setPhoto] = useState(null);
  const [, setPhotoFile] = useState(null);
  const isUploading = false;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: "",
      code: "",
      email: "",
      phone: "",
      contact_person_name: "",
      contact_person_email: "",
      contact_person_phone: "",
      city: "",
      address: "",
      status: "ACTIVE",
      project_ids: [],
    },
  });

  const statusValue = watch("status");
  const selectedProjectIds = watch("project_ids") || [];

  // Register the controlled project field so its validation runs on submit.
  // Projects are only required when creating (edit keeps existing allocation
  // unless changed).
  register("project_ids", {
    validate: (v) =>
      isEdit ||
      (Array.isArray(v) && v.length > 0) ||
      t("modal.validation.projectsRequired"),
  });

  const emailRuleT = {
    ...emailRule,
    pattern: { ...emailRule.pattern, message: t("modal.validation.invalidEmail") },
  };

  const projectOptions = (projectList || []).map((p) => ({
    value: getProjectId(p),
    label: p.project_name || t("modal.projects.fallbackName", { id: getProjectId(p) }),
  }));

  useEffect(() => {
    if (company) {
      reset({
        name: company.name || "",
        code: company.code || "",
        email: company.email || "",
        phone: company.phone || "",
        contact_person_name: company.contact_person_name || "",
        contact_person_email: company.contact_person_email || "",
        contact_person_phone: company.contact_person_phone || "",
        city: company.city || "",
        address: company.address || "",
        status: company.status || "ACTIVE",
        project_ids: Array.isArray(company.project_ids)
          ? company.project_ids
          : [],
      });
      setCityQuery(company.city || "");
      setPhoto(company.company_image || null);
      setPhotoFile(null);
    }
  }, [company, reset]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const buildPayload = (data) => {
    const base = {
      name: data.name.trim(),
      code: data.code?.trim() || null,
      email: data.email?.trim() || null,
      phone: data.phone?.trim() || null,
      contact_person_name: data.contact_person_name?.trim() || null,
      contact_person_email: data.contact_person_email?.trim() || null,
      contact_person_phone: data.contact_person_phone?.trim() || null,
      city: data.city?.trim() || null,
      address: data.address?.trim() || null,
      status: data.status,
    };
    const projectIds = Array.isArray(data.project_ids)
      ? data.project_ids.map(Number)
      : [];
    // Create requires projects; on edit only send them when re-allocating.
    if (!isEdit || projectIds.length) {
      base.project_ids = projectIds;
    }
    return base;
  };

  const onSubmit = async (data) => {
    // Static build: a picked file is kept as its local preview URL.
    const uploadedPhotoUrl = photo;

    const payload = buildPayload(data);
    if (uploadedPhotoUrl) {
      payload.company_image = uploadedPhotoUrl;
    }

    if (isEdit) {
      const id = getId(company);
      if (id == null) {
        toast.error(t("modal.toast.missingId"));
        return;
      }
      toast.success(t("modal.toast.updateSuccess"));
      onSaved?.({ ...company, ...payload, id });
      onClose();
      return;
    }

    toast.success(t("modal.toast.createSuccess"));
    onSaved?.(payload);
    onClose();
  };

  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const title =
    mode === "view"
      ? t("modal.title.view")
      : isEdit
        ? t("modal.title.edit")
        : t("modal.title.create");

  const currentCity = watch("city");
  const currentCityOptions = cityList?.map((c) => ({ label: c.city_name, value: c.city_name })) || [];
  if (currentCity && !currentCityOptions.some((o) => String(o.value) === String(currentCity))) {
    currentCityOptions.unshift({ label: currentCity, value: currentCity });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={handleBackdrop}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col"
        style={{ maxHeight: "90vh" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{title}</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              {readOnly
                ? t("modal.subtitle.view")
                : t("modal.subtitle.create")}
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

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col flex-1 min-h-0"
        >
          <div
            className="flex-1 overflow-y-auto px-6 py-6 space-y-5 custom-scrollbar"
          >
            {/* Credentials hint — a login is auto-created + emailed on create */}
            {!isEdit && !readOnly && (
              <div className="flex items-start gap-2.5 bg-cyan-50 border border-cyan-100 rounded-lg px-4 py-3">
                <MdOutlineInfo className="text-cyan-500 text-lg shrink-0 mt-0.5" />
                <p className="text-xs text-cyan-700 leading-relaxed">
                  {t("modal.credentialsHint")}
                </p>
              </div>
            )}

            {/* Company Photo */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 pb-6 mb-2 border-b border-gray-100">
              <div
                onClick={() => !readOnly && photoRef.current?.click()}
                className={`w-24 h-24 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center shrink-0 ${
                  !readOnly ? "cursor-pointer hover:border-cyan-400" : ""
                } transition-colors overflow-hidden`}
              >
                {photo ? (
                  <img
                    src={photo}
                    alt={t("modal.photo.alt")}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <MdOutlinePerson className="text-5xl text-gray-300" />
                )}
              </div>
              <div>
                <p className="text-base font-bold text-gray-900 mb-1">
                  {t("modal.photo.title")}
                </p>
                <p className="text-sm text-gray-400 mb-3">
                  {t("modal.photo.hint")}
                </p>
                {!readOnly && (
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => photoRef.current?.click()}
                      className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-semibold rounded-lg transition-colors"
                    >
                      {t("modal.photo.upload")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPhoto(null);
                        setPhotoFile(null);
                        if (photoRef.current) photoRef.current.value = "";
                      }}
                      className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      {t("modal.photo.remove")}
                    </button>
                  </div>
                )}
                <input
                  ref={photoRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files[0];
                    if (f) {
                      setPhotoFile(f);
                      setPhoto(URL.createObjectURL(f));
                    }
                  }}
                />
              </div>
            </div>

            {/* Name + Code */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>
                  {t("modal.fields.companyName")}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  disabled={readOnly}
                  onInput={handleInput}
                  {...register("name", {
                    required: t("modal.validation.companyNameRequired"),
                    validate: {
                      notEmpty: (v) => v.trim() !== "" || t("modal.validation.companyNameRequired"),
                      minLen: (v) =>
                        v.trim().length >= 2 || t("modal.validation.minTwoChars"),
                    },
                  })}
                  placeholder={t("modal.fields.companyNamePlaceholder")}
                  className={inputCls(errors.name)}
                />
                <FieldErr error={errors.name} />
              </div>

              <div>
                <label className={labelCls}>
                  {t("modal.fields.companyCode")}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  disabled={readOnly || isEdit}
                  maxLength={100}
                  onInput={handleInput}
                  {...register("code", {
                    required: t("modal.validation.companyCodeRequired"),
                    validate: {
                      notEmpty: (v) => v.trim() !== "" || t("modal.validation.companyCodeRequired"),
                    },
                    maxLength: { value: 100, message: t("modal.validation.tooLong") },
                  })}
                  placeholder={t("modal.fields.companyCodePlaceholder")}
                  className={inputCls(errors.code)}
                />
                <FieldErr error={errors.code} />
              </div>
            </div>

            {/* Company Email + Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>
                  {t("modal.fields.companyEmail")}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  disabled={readOnly || isEdit}
                  onInput={handleInput}
                  {...register("email", {
                    ...emailRuleT,
                    required: t("modal.validation.companyEmailRequired"),
                    validate: {
                      notEmpty: (v) => v.trim() !== "" || t("modal.validation.companyEmailRequired"),
                    },
                  })}
                  placeholder={t("modal.fields.companyEmailPlaceholder")}
                  className={inputCls(errors.email)}
                />
                <FieldErr error={errors.email} />
              </div>

              <div>
                <label className={labelCls}>
                  {t("modal.fields.companyPhone")}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={15}
                  disabled={readOnly}
                  onInput={(e) => {
                    e.target.value = e.target.value.replace(/\D/g, "");
                    handleInput(e);
                  }}
                  {...register("phone", {
                    required: t("modal.validation.companyPhoneRequired"),
                    pattern: {
                      value: /^[0-9]{6,15}$/,
                      message: t("modal.validation.invalidPhone")
                    },
                    validate: {
                      notEmpty: (v) => v.trim() !== "" || t("modal.validation.companyPhoneRequired"),
                    },
                  })}
                  placeholder={t("modal.fields.companyPhonePlaceholder")}
                  className={inputCls(errors.phone)}

                />
                <FieldErr error={errors.phone} />
              </div>
            </div>

            {/* Contact person name + email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>
                  {t("modal.fields.contactPersonName")}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  disabled={readOnly}
                  onInput={handleInput}
                  {...register("contact_person_name", {
                    required: t("modal.validation.contactNameRequired"),
                    pattern: {
                      value: /^[A-Za-z\s.]+$/,
                      message: t("modal.validation.lettersPeriodsOnly"),
                    },
                    validate: {
                      notEmpty: (v) => v.trim() !== "" || t("modal.validation.contactNameRequired"),
                    },
                  })}
                  placeholder={t("modal.fields.contactPersonNamePlaceholder")}
                  className={inputCls(errors.contact_person_name)}
                />
                <FieldErr error={errors.contact_person_name} />
              </div>

              <div>
                <label className={labelCls}>
                  {t("modal.fields.contactPersonEmail")}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  disabled={readOnly}
                  onInput={handleInput}
                  {...register("contact_person_email", {
                    ...emailRuleT,
                    required: t("modal.validation.contactEmailRequired"),
                    validate: {
                      notEmpty: (v) => v.trim() !== "" || t("modal.validation.contactEmailRequired"),
                    },
                    maxLength: { value: 100, message: t("modal.validation.emailTooLong") },
                  })}
                  placeholder={t("modal.fields.contactPersonEmailPlaceholder")}
                  className={inputCls(errors.contact_person_email)}
                />
                <FieldErr error={errors.contact_person_email} />
              </div>
            </div>

            {/* Contact person phone + city */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>
                  {t("modal.fields.contactPersonPhone")}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={15}
                  disabled={readOnly}
                  onInput={(e) => {
                    e.target.value = e.target.value.replace(/\D/g, "");
                    handleInput(e);
                  }}
                  {...register("contact_person_phone", {
                    required: t("modal.validation.contactPhoneRequired"),
                    pattern: {
                      value: /^[0-9]{6,15}$/,
                      message: t("modal.validation.invalidPhone")
                    },
                    validate: {
                      notEmpty: (v) => v.trim() !== "" || t("modal.validation.contactPhoneRequired"),
                    },
                  })}
                  placeholder={t("modal.fields.contactPersonPhonePlaceholder")}
                  className={inputCls(errors.contact_person_phone)}
                />
                <FieldErr error={errors.contact_person_phone} />
              </div>

              <div className="relative">
                <label className={labelCls}>
                  {t("modal.fields.city")}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <CustomDropdown
                  disabled={readOnly}
                  value={currentCity || ""}
                  onChange={(e) => {
                    setValue("city", e.target.value, { shouldValidate: true });
                  }}
                  onSearchChange={(val) => {
                    setCityQuery(val);
                  }}
                  options={currentCityOptions}
                  isSearchable={true}
                  error={!!errors.city}
                  placeholder={t("modal.fields.cityPlaceholder")}
                />
                <FieldErr error={errors.city} />
              </div>
            </div>

            {/* Address */}
            <div>
              <label className={labelCls}>
                {t("modal.fields.address")}{" "}
                <span className="text-red-500">*</span>
              </label>
              <textarea
                disabled={readOnly}
                onInput={handleInput}
                rows={2}
                {...register("address", {
                  required: t("modal.validation.addressRequired"),
                  validate: {
                    notEmpty: (v) => v.trim() !== "" || t("modal.validation.addressRequired"),
                    validChars: (v) => {
                      if (!v || v.trim() === "") return true;
                      return /^[A-Za-z0-9,\s-]+$/.test(v.trim()) || t("modal.validation.invalidAddressChars");
                    }
                  },
                  maxLength: { value: 2000, message: t("modal.validation.tooLong") },
                })}
                placeholder={t("modal.fields.addressPlaceholder")}
                className={`${inputCls(errors.address)} resize-none`}
              />
              <FieldErr error={errors.address} />
            </div>

            {/* Status */}
            <div>
              <label className={labelCls}>{t("modal.fields.status")}</label>
              <CustomDropdown
                disabled={readOnly}
                {...register("status")}
                value={statusValue}
                error={!!errors.status}
                options={[
                  { label: t("modal.statusOptions.active"), value: "ACTIVE" },
                  { label: t("modal.statusOptions.inactive"), value: "INACTIVE" }
                ]}
              />
            </div>

            {/* Projects — the staffing company can only staff these projects */}
            <div>
              <label className={labelCls}>
                {t("modal.projects.label")} <span className="text-red-500">*</span>
              </label>
              <ProjectMultiSelect
                options={projectOptions}
                value={selectedProjectIds}
                loading={projectsLoading}
                disabled={readOnly}
                placeholder={t("modal.projects.placeholder")}
                error={errors.project_ids}
                onChange={(next) =>
                  setValue("project_ids", next, { shouldValidate: true })
                }
              />
              <FieldErr error={errors.project_ids} />
              <p className="text-[11px] text-gray-400 mt-1.5">
                {t("modal.projects.hint")}
              </p>
            </div>
          </div>

          {/* Footer */}
          <hr className="border-gray-100 shrink-0" />
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 px-6 py-4 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={saving || isUploading}
              className="w-full sm:w-auto px-6 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-60 transition-colors"
            >
              {readOnly ? t("modal.buttons.close") : t("modal.buttons.cancel")}
            </button>
            {!readOnly && (
              <button
                type="submit"
                disabled={saving || isUploading}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-700 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                {saving || isUploading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {isUploading ? t("modal.buttons.uploading") : t("modal.buttons.saving")}
                  </>
                ) : isEdit ? (
                  t("modal.buttons.saveChanges")
                ) : (
                  t("modal.buttons.createCompany")
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
