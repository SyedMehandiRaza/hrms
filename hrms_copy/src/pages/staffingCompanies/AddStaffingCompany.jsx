import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import {
  MdOutlineArrowBack,
  MdOutlineArrowForward,
  MdOutlinePerson,
  MdOutlineError,
  MdOutlineCheckCircle,
  MdOutlineChevronRight,
} from "react-icons/md";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import CustomDropdown from "../../components/CustomDropdown";

// ── Constants ─────────────────────────────────────────────────────────────────
const COUNTRY_CODES = [
  "+1",
  "+44",
  "+91",
  "+61",
  "+49",
  "+33",
  "+81",
  "+86",
  "+55",
  "+27",
  "+971",
  "+966",
];
const PROJECTS = [
  "Apollo Cloud Infrastructure",
  "Cloud Migration Alpha",
  "Cyber Defense 2.0",
  "Data Hub Expansion",
  "Project Alpha",
  "Project Omega",
  "Retail Expansion",
  "AI Integration",
];
const CONTACTS = [
  "Golden Spoon",
  "John Smith",
  "Sarah Lee",
  "Marcus Thorne",
  "Elena Rodriguez",
  "David Kim",
];

// ── Styles ────────────────────────────────────────────────────────────────────
const inputBase =
  "w-full px-4 py-3 border rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition bg-gray-50";
const inputCls = (err) =>
  `${inputBase} ${err ? "border-red-400 bg-red-50" : "border-gray-200"}`;
const selectCls = (err) =>
  `${inputBase} appearance-none pe-9 cursor-pointer ${err ? "border-red-400 bg-red-50" : "border-gray-200"}`;
const labelCls =
  "block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5";

const FieldErr = ({ error }) =>
  error ? (
    <p className="flex items-center gap-1 text-xs text-red-500 mt-1.5">
      <MdOutlineError className="flex-shrink-0 text-sm" />
      {error.message}
    </p>
  ) : null;

// ── Main Component ─────────────────────────────────────────────────────────────
export default function AddStaffingCompany({ onBack, onComplete }) {
  const { t } = useTranslation("staffing");
  const photoRef = useRef();
  const [photo, setPhoto] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      companyName: "Golden Spoon",
      contactPerson: "Golden Spoon",
      email: "",
      countryCode: "+1",
      phone: "",
      project: "",
      location: "",
    },
  });

  const onSubmit = (data) => {
    console.log("Staffing company added:", data);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
          <MdOutlineCheckCircle className="text-green-500 text-4xl" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">
          {t("add.success.title")}
        </h2>
        <p className="text-sm text-gray-400 max-w-xs">
          {t("add.success.message")}
        </p>
        <button
          onClick={() => {
            setSubmitted(false);
            onBack?.();
          }}
          className="mt-2 px-6 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-semibold transition-colors"
        >
          {t("add.success.back")}
        </button>
      </div>
    );
  }

  return (
    <form className="space-y-6">
      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-1.5 text-sm flex-wrap">
        <Link
          to="/admin/staffing-companies"
          className="text-gray-400 hover:text-cyan-600 transition-colors"
        >
          {t("add.breadcrumbManagement")}
        </Link>
        <MdOutlineChevronRight className="text-gray-300 rtl:rotate-180" />
        <span className="text-cyan-600 font-semibold">
          {t("add.breadcrumbCurrent")}
        </span>
      </div>
      {/* ── Page Header ── */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
          {t("add.title")}
        </h1>
        <p className="text-gray-400 mt-1 text-sm">
          {t("add.subtitle")}
        </p>
      </div>

      {/* ── Form Card ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 lg:p-8">
        {/* Company Photo */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 pb-6 mb-6 border-b border-gray-100">
          <div
            onClick={() => photoRef.current.click()}
            className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center flex-shrink-0 cursor-pointer hover:border-cyan-400 transition-colors overflow-hidden"
          >
            {photo ? (
              <img
                src={photo}
                alt="Company"
                className="w-full h-full object-cover"
              />
            ) : (
              <MdOutlinePerson className="text-5xl text-gray-300" />
            )}
          </div>
          <div>
            <p className="text-base font-bold text-gray-900 mb-1">
              {t("add.photo.title")}
            </p>
            <p className="text-sm text-gray-400 mb-3">
              {t("add.photo.hint")}
            </p>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => photoRef.current.click()}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {t("add.photo.upload")}
              </button>
              <button
                type="button"
                onClick={() => setPhoto(null)}
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                {t("add.photo.remove")}
              </button>
            </div>
            <input
              ref={photoRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files[0];
                if (f) setPhoto(URL.createObjectURL(f));
              }}
            />
          </div>
        </div>

        {/* Form Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
          {/* Company Name */}
          <div>
            <label className={labelCls}>
              {t("add.fields.companyName")}{" "}
              <span className="text-red-500">*</span>
            </label>
            <input
              {...register("companyName", {
                required: t("add.validation.companyNameRequired"),
                minLength: {
                  value: 2,
                  message: t("add.validation.min2Required"),
                },
              })}
              placeholder={t("add.fields.companyNamePlaceholder")}
              className={inputCls(errors.companyName)}
            />
            <FieldErr error={errors.companyName} />
          </div>

          {/* Contact Person Name */}
          <div>
            <label className={labelCls}>
              {t("add.fields.contactPerson")}{" "}
              <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <CustomDropdown
                {...register("contactPerson", {
                  required: t("add.validation.contactPersonRequired"),
                })}
                className={selectCls(errors.contactPerson)}
                options={[
                  { label: t("add.fields.contactPersonPlaceholder"), value: "" },
                  ...CONTACTS.map((c) => ({ label: c, value: c }))
                ]}
              />
            </div>
            <FieldErr error={errors.contactPerson} />
          </div>

          {/* Email Address */}
          <div>
            <label className={labelCls}>
              {t("add.fields.email")} <span className="text-red-500">*</span>
            </label>
            <input
              {...register("email", {
                required: t("add.validation.emailRequired"),
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: t("add.validation.emailValid"),
                },
              })}
              type="email"
              placeholder={t("add.fields.emailPlaceholder")}
              className={inputCls(errors.email)}
            />
            <FieldErr error={errors.email} />
          </div>

          {/* Phone Number */}
          <div>
            <label className={labelCls}>
              {t("add.fields.phone")} <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <div className="relative flex-shrink-0 w-24">
                <CustomDropdown
                  {...register("countryCode")}
                  className="appearance-none border border-gray-200 bg-gray-50 rounded-lg py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
                  options={COUNTRY_CODES.map((c) => ({ label: c, value: c }))}
                />
              </div>
              <input
                {...register("phone", {
                  required: t("add.validation.phoneRequired"),
                  pattern: {
                    value: /^[0-9]{6,15}$/,
                    message: t("add.validation.phoneValid"),
                  },
                })}
                type="tel"
                maxLength={15}
                onInput={(e) => {
                  e.target.value = e.target.value.replace(/[^0-9]/g, "");
                }}
                placeholder={t("add.fields.phonePlaceholder")}
                className={inputCls(errors.phone)}
              />
            </div>
            <FieldErr error={errors.phone} />
          </div>

          {/* Project */}
          <div>
            <label className={labelCls}>
              {t("add.fields.project")} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <CustomDropdown
                {...register("project", {
                  required: t("add.validation.projectRequired"),
                })}
                className={selectCls(errors.project)}
                options={[
                  { label: t("add.fields.projectPlaceholder"), value: "" },
                  ...PROJECTS.map((p) => ({ label: p, value: p }))
                ]}
              />
            </div>
            <FieldErr error={errors.project} />
          </div>

          {/* Location */}
          <div>
            <label className={labelCls}>
              {t("add.fields.location")} <span className="text-red-500">*</span>
            </label>
            <input
              {...register("location", {
                required: t("add.validation.locationRequired"),
                minLength: { value: 3, message: t("add.validation.locationMin") },
                validate: {
                  validChars: (v) => {
                    if (!v || v.trim() === "") return true;
                    return /^[A-Za-z0-9,\s-]+$/.test(v.trim()) || t("add.validation.locationChars");
                  }
                }
              })}
              placeholder={t("add.fields.locationPlaceholder")}
              className={inputCls(errors.location)}
            />
            <FieldErr error={errors.location} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onBack}
            className="w-full sm:w-auto text-sm font-medium text-gray-500 hover:text-gray-800 px-4 py-2.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {t("add.buttons.cancel")}
          </button>
          <button
            type="button"
            onClick={handleSubmit(onSubmit)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-2.5 rounded-lg font-semibold text-sm transition-colors"
          >
            {t("add.buttons.next")}{" "}
            <MdOutlineArrowForward className="rtl:rotate-180" />
          </button>
        </div>
      </div>
    </form>
  );
}
