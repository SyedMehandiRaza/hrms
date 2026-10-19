import { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { MdClose, MdOutlineError, MdOutlinePerson } from "react-icons/md";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { CALLING_COUNTRIES, searchCallingCountries } from "../data/groupC";
import CustomDropdown from "./CustomDropdown";

// Split a stored phone like "+919876543210" back into ("+91", "9876543210").
// The code is the LONGEST known calling code the number starts with — the old
// "+ up to 4 digits" guess took "+9198" out of "+919876543210".
const splitPhone = (raw, knownCodes = []) => {
  if (!raw) return { countryCode: "+1", phone: "" };
  const value = String(raw).replace(/[\s-]/g, "");
  const code = [...knownCodes]
    .sort((a, b) => b.length - a.length)
    .find((c) => c && value.startsWith(c) && value.length > c.length);
  if (code) return { countryCode: code, phone: value.slice(code.length) };
  const match = value.match(/^(\+\d{1,3})(\d+)$/);
  if (match) return { countryCode: match[1], phone: match[2] };
  return { countryCode: "+1", phone: value };
};

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

// Every calling code, used to split the stored phone correctly.
const allCodes = CALLING_COUNTRIES.map((c) => c.calling_code);

const getOfficeId = (office) => office?.id ?? office?._id ?? office?.office_id;



export default function EditHeadOfficeModal({ office, onClose, onSaved, isViewMode = false }) {
  const { t } = useTranslation("offices");
  const updateLoading = false;

  const photoRef = useRef();
  const [photo, setPhoto] = useState(null);
  const [, setPhotoFile] = useState(null);
  const isUploading = false;
  const [countries, setCountries] = useState(() => searchCallingCountries(""));

  const handleCountrySearch = (val) => {
    setCountries(searchCallingCountries(val));
  };

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm();

  useEffect(() => {
    if (!office) return;
    const { countryCode, phone } = splitPhone(office.office_phone, allCodes);
    reset({
      headOfficeName: office.office_name || "",
      email: office.office_email || "",
      countryCode,
      phone,
      location: office.office_location || "",
    });
    setPhoto(office.office_image || null);
    setPhotoFile(null);
  }, [office, reset]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const onSubmit = async (data) => {
    const id = getOfficeId(office);
    if (id == null) {
      toast.error(t("toast.missingId"));
      return;
    }

    // Static build: a picked file is kept as its local preview URL.
    const uploadedPhotoUrl = photo;

    const payload = {
      office_name: data.headOfficeName.trim(),
      office_email: data.email.trim(),
      office_phone: `${data.countryCode}${data.phone}`,
      office_location: data.location.trim(),
      ...(uploadedPhotoUrl && { office_image: uploadedPhotoUrl }),
    };

    toast.success(t("toast.updated"));
    if (onSaved) onSaved({ ...office, ...payload });
    onClose();
  };

  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!office) return null;

  const currentCountryCode = watch("countryCode");
  const countryOptions = countries.map((c) => ({ label: c.calling_code, value: c.calling_code }));
  if (currentCountryCode && !countryOptions.some((o) => o.value === currentCountryCode)) {
    countryOptions.unshift({ label: currentCountryCode, value: currentCountryCode });
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
        {/* ── Fixed Header ── */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {isViewMode ? t("edit.viewTitle") : t("edit.title")}
            </h2>
            <p className="text-sm text-gray-400 mt-0.5">
              {isViewMode ? t("edit.viewSubtitle") : t("edit.subtitle")}
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

        {/* ── Form ── */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col flex-1 min-h-0"
        >
          <div
            className="flex-1 overflow-visible px-6 py-6 space-y-5"
          >
            {/* Company Photo */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 pb-6 mb-2 border-b border-gray-100">
              <div
                onClick={() => !isViewMode && photoRef.current.click()}
                className={`w-24 h-24 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center flex-shrink-0 ${
                  !isViewMode ? "cursor-pointer hover:border-cyan-400" : ""
                } transition-colors overflow-hidden`}
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
                  {t("create.photoTitle") || "Company Photo"}
                </p>
                <p className="text-sm text-gray-400 mb-3">
                  {t("create.photoHelp") || "Upload a company logo or image."}
                </p>
                {!isViewMode && (
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => photoRef.current.click()}
                      className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-semibold rounded-lg transition-colors"
                    >
                      {t("create.uploadPhoto") || "Upload Photo"}
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
                      {t("create.removePhoto") || "Remove"}
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
            {/* Row 1: Name + Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>
                  {t("edit.nameLabel")} <span className="text-red-500">*</span>
                </label>
                <input
                  {...register("headOfficeName", {
                    required: t("validation.nameRequiredShort"),
                    validate: {
                      noSpaces: (v) => v.trim() !== "" || t("validation.cannotBeEmpty"),
                      minLen: (v) =>
                        v.trim().length >= 2 || t("validation.min2"),
                      validChars: (v) =>
                        /^[A-Za-z0-9\s\-&,()]+$/.test(v.trim()) ||
                        t("validation.invalidChars"),
                    },
                  })}
                  placeholder={t("edit.namePlaceholder")}
                  className={inputCls(errors.headOfficeName)}
                  onInput={(e) => {
                    e.target.value = e.target.value.replace(/^\s+/, "");
                  }}
                  disabled={isViewMode}
                />
                <FieldErr error={errors.headOfficeName} />
              </div>

              <div>
                <label className={labelCls}>
                  {t("edit.emailLabel")} {!isViewMode && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="email"
                  {...register("email", {
                    required: t("validation.emailRequired"),
                    pattern: {
                      value:
                        /^[a-zA-Z0-9._+-]+@[a-zA-Z0-9-]+(\.[a-zA-Z]{2,})+$/,
                      message: t("validation.emailValid"),
                    },
                  })}
                  placeholder={t("edit.emailPlaceholder")}
                  className={inputCls(errors.email)}
                  onInput={(e) => {
                    e.target.value = e.target.value.replace(/\s/g, "");
                  }}
                  disabled={isViewMode}
                />
                <FieldErr error={errors.email} />
              </div>
            </div>

            {/* Row 2: Phone + Location */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>
                  {t("edit.phoneLabel")} {!isViewMode && <span className="text-red-500">*</span>}
                </label>
                <div className="flex gap-2">
                  <div className="shrink-0 min-w-[100px]">
                    <CustomDropdown
                      {...register("countryCode")}
                      value={watch("countryCode")}
                      onChange={(val) => setValue("countryCode", val, { shouldValidate: true })}
                      isSearchable={true}
                      onSearchChange={handleCountrySearch}
                      options={countryOptions}
                      disabled={isViewMode}
                    />
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={15}
                    {...register("phone", {
                      required: t("validation.phoneRequired"),
                      pattern: {
                        value: /^[0-9]{6,15}$/,
                        message: t("validation.phoneValid"),
                      },
                    })}
                    placeholder={t("edit.phonePlaceholder")}
                    className={inputCls(errors.phone)}
                    onInput={(e) => {
                      e.target.value = e.target.value.replace(/\D/g, "");
                    }}
                    disabled={isViewMode}
                  />
                </div>
                <FieldErr error={errors.phone} />
              </div>
              <div>
                <label className={labelCls}>
                  {t("edit.locationLabel")}{" "}
                  {!isViewMode && <span className="text-red-500">*</span>}
                </label>
                <input
                  {...register("location", {
                    required: t("validation.locationRequired"),
                    validate: {
                      noSpaces: (v) => v.trim() !== "" || t("validation.cannotBeEmpty"),
                      minLen: (v) =>
                        v.trim().length >= 3 || t("validation.min3"),
                      validChars: (v) =>
                        /^[A-Za-z0-9,\s-]+$/.test(v.trim()) ||
                        t("validation.locationFormat"),
                    },
                  })}
                  placeholder={t("edit.locationPlaceholder")}
                  className={inputCls(errors.location)}
                  onInput={(e) => {
                    e.target.value = e.target.value.replace(/^\s+/, "");
                  }}
                  disabled={isViewMode}
                />
                <FieldErr error={errors.location} />
              </div>
            </div>
          </div>

          {/* ── Fixed Footer ── */}
          <hr className="border-gray-100 shrink-0" />
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 px-6 py-4 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={updateLoading || isUploading}
              className="w-full sm:w-auto px-6 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-60 transition-colors"
            >
              {isViewMode ? t("edit.close") : t("edit.cancel")}
            </button>
            {!isViewMode && (
              <button
                type="submit"
                disabled={updateLoading || isUploading}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-700 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                {updateLoading || isUploading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {isUploading ? t("uploading") : t("edit.saving")}
                  </>
                ) : (
                  t("edit.submit")
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
