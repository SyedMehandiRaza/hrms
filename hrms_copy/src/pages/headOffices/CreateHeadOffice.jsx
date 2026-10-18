import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import {
  MdOutlineArrowForward,
  MdOutlinePerson,
  MdOutlineError,
  MdOutlineChevronRight,
} from "react-icons/md";

import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { searchCallingCountries } from "../../data/groupC";
import CustomDropdown from "../../components/CustomDropdown";

// ── Constants ─────────────────────────────────────────────────────────────────

// ── Styles ────────────────────────────────────────────────────────────────────
const inputBase =
  "w-full px-4 py-3 border rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition bg-gray-50";
const inputCls = (err) =>
  `${inputBase} ${err ? "border-red-400 bg-red-50" : "border-gray-200"}`;
const labelCls =
  "block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5";

const FieldErr = ({ error }) =>
  error ? (
    <p className="flex items-center gap-1 text-xs text-red-500 mt-1.5">
      <MdOutlineError className="flex-shrink-0 text-sm" />
      {error.message}
    </p>
  ) : null;

const removeEmojis = (e) => {
  const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
  if (emojiRegex.test(e.target.value)) {
    e.target.value = e.target.value.replace(emojiRegex, "");
  }
};

// ── Main Component ─────────────────────────────────────────────────────────────
export default function CreateHeadOffice() {
  const { t } = useTranslation("offices");
  const photoRef = useRef();
  const [photo, setPhoto] = useState(null);
  const [, setPhotoFile] = useState(null);
  const isUploading = false;
  const [countries, setCountries] = useState(() => searchCallingCountries(""));

  const handleCountrySearch = (val) => {
    setCountries(searchCallingCountries(val));
  };

  const navigate = useNavigate();
  const createLoading = false;

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      headOfficeName: "",
      email: "",
      countryCode: "+1",
      phone: "",
      location: "",
    },
  });

  const onSubmit = async (data) => {
    // Static build: a picked file is kept as its local preview URL.
    const uploadedPhotoUrl = photo;

    const payload = {
      office_name: data.headOfficeName.trim(),
      office_email: data.email.trim(),
      office_phone: `${data.countryCode}${data.phone}`,
      office_location: data.location.trim(),
      ...(uploadedPhotoUrl && { office_image: uploadedPhotoUrl }),
    };

    toast.success(t("toast.created"));
    // The list picks the new office up from the navigation state.
    navigate("/admin/head-offices", { state: { createdOffice: payload } });
  };

  const currentCountryCode = watch("countryCode");
  const countryOptions = countries.map((c) => ({ label: c.calling_code, value: c.calling_code }));
  if (currentCountryCode && !countryOptions.some((o) => o.value === currentCountryCode)) {
    countryOptions.unshift({ label: currentCountryCode, value: currentCountryCode });
  }

  return (
    <div className="space-y-6">
      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-1.5 text-sm flex-wrap mb-2">
        <Link
          to="/admin/head-offices"
          className="text-gray-400 hover:text-cyan-600 transition-colors"
        >
          {t("create.breadcrumbManagement")}
        </Link>
        <MdOutlineChevronRight className="text-gray-300 rtl:rotate-180" />
        <span className="text-cyan-600 font-semibold">
          {t("create.breadcrumbCurrent")}
        </span>
      </div>
      {/* ── Page Header ── */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
          {t("create.title")}
        </h1>
        <p className="text-gray-400 mt-1 text-sm">{t("create.subtitle")}</p>
      </div>

      {/* ── Form Card ── */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="bg-white border border-gray-200 rounded-xl p-5 lg:p-8"
      >
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
              {t("create.photoTitle")}
            </p>
            <p className="text-sm text-gray-400 mb-3">
              {t("create.photoHelp")}
            </p>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => photoRef.current.click()}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {t("create.uploadPhoto")}
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
                {t("create.removePhoto")}
              </button>
            </div>
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

        {/* Form Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
          {/* Head Office Name */}
          <div>
            <label className={labelCls}>
              {t("create.nameLabel")} <span className="text-red-500">*</span>
            </label>
            <input
              {...register("headOfficeName", {
                required: t("validation.nameRequired"),

                validate: {
                  noOnlySpaces: (value) =>
                    value.trim() !== "" || t("validation.nameEmpty"),

                  noDoubleSpaces: (value) =>
                    !/\s{2,}/.test(value) || t("validation.multipleSpaces"),

                  validName: (value) =>
                    /^[A-Za-z0-9']+(?:\s[A-Za-z0-9']+)*$/.test(value.trim()) ||
                    t("validation.nameChars"),

                  minLength: (value) =>
                    value.trim().length >= 2 ||
                    t("validation.min2Required"),
                  maxLength: (value) =>
                    value.trim().length <= 100 || t("validation.nameMax"),
                },
              })}
              placeholder={t("create.namePlaceholder")}
              className={inputCls(errors.headOfficeName)}
              onInput={(e) => {
                removeEmojis(e);
                e.target.value = e.target.value.replace(/^\s+/, "");
              }}
            />
            <FieldErr error={errors.headOfficeName} />
          </div>

          {/* Email Address */}
          <div>
            <label className={labelCls}>
              {t("create.emailLabel")} <span className="text-red-500">*</span>
            </label>
            <input
              {...register("email", {
                required: t("validation.emailRequired"),

                pattern: {
                  value: /^[a-zA-Z0-9._+-]+@[a-zA-Z0-9-]+(\.[a-zA-Z]{2,})+$/,
                  message: t("validation.emailValidAddress"),
                },

                validate: {
                  noSpaces: (value) =>
                    !/\s/.test(value) || t("validation.noSpaces"),

                  noDoubleDots: (value) =>
                    !value.includes("..") || t("validation.emailFormat"),

                  noStartDot: (value) =>
                    !value.startsWith(".") || t("validation.emailStartDot"),

                  noEndDot: (value) =>
                    !value.endsWith(".") || t("validation.emailEndDot"),
                },
              })}
              type="email"
              placeholder={t("create.emailPlaceholder")}
              className={inputCls(errors.email)}
              onInput={(e) => {
                removeEmojis(e);
                let value = e.target.value;
                value = value.replace(/\s/g, "");
                value = value.replace(/[^a-zA-Z0-9._@+-]/g, "");
                e.target.value = value;
              }}
            />
            <FieldErr error={errors.email} />
          </div>

          {/* Phone Number */}
          <div>
            <label className={labelCls}>
              {t("create.phoneLabel")} <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <div className="relative flex-shrink-0 min-w-[100px]">
                <CustomDropdown
                  {...register("countryCode")}
                  isSearchable={true}
                  onSearchChange={handleCountrySearch}
                  options={countryOptions}
                />
              </div>
              <input
                {...register("phone", {
                  required: t("validation.phoneNumberRequired"),
                  pattern: {
                    value: /^[0-9]{6,15}$/,
                    message: t("validation.phoneValid"),
                  },
                })}
                type="tel"
                inputMode="numeric"
                maxLength={15}
                placeholder={t("create.phonePlaceholder")}
                className={inputCls(errors.phone)}
                onInput={(e) => {
                  removeEmojis(e);
                  e.target.value = e.target.value.replace(/\D/g, "");
                }}
              />
            </div>
            <FieldErr error={errors.phone} />
          </div>

          {/* Location */}
          <div>
            <label className={labelCls}>
              {t("create.locationLabel")}{" "}
              <span className="text-red-500">*</span>
            </label>
            <input
              {...register("location", {
                required: t("validation.locationRequired"),

                validate: {
                  noOnlySpaces: (value) =>
                    value.trim() !== "" || t("validation.locationEmpty"),

                  noDoubleSpaces: (value) =>
                    !/\s{2,}/.test(value) || t("validation.multipleSpaces"),

                  validLocation: (value) =>
                    /^[A-Za-z0-9,\s-]+$/.test(value.trim()) ||
                    t("validation.locationFormat"),

                  minLength: (value) => value.trim().length >= 3 || t("validation.tooShort"),
                  maxLength: (value) => value.trim().length <= 255 || t("validation.max255"),
                },
              })}
              maxLength={255}
              placeholder={t("create.locationPlaceholder")}
              className={inputCls(errors.location)}
              onInput={(e) => {
                removeEmojis(e);
                e.target.value = e.target.value.replace(/^\s+/, "");
              }}
            />
            <FieldErr error={errors.location} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={() => navigate("/admin/head-offices")}
            className="w-full sm:w-auto text-sm font-medium text-gray-500 hover:text-gray-800 px-4 py-2.5 rounded-lg bg-gray-100 transition-colors"
          >
            {t("create.cancel")}
          </button>
          <button
            type="submit"
            disabled={createLoading || isUploading}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-60 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg font-semibold text-sm transition-colors"
          >
            {createLoading || isUploading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {isUploading ? t("uploading") : t("create.creating")}
              </>
            ) : (
              <>
                {t("create.submit")}{" "}
                <MdOutlineArrowForward className="rtl:rotate-180" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
