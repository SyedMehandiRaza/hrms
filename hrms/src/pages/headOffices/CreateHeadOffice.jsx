import { useState, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import {
  MdOutlineArrowForward,
  MdOutlinePerson,
  MdOutlineError,
  MdOutlineChevronRight,
} from "react-icons/md";

import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import PhoneCountrySelect from "../../components/geo/PhoneCountrySelect";
import CountrySelect from "../../components/geo/CountrySelect";
import CitySelect from "../../components/geo/CitySelect";
import { createOffice, uploadOfficeImage } from "../../api/offices";
import { useCurrentUser } from "../../hooks/useSession";
import { applyFieldErrors } from "../../utils/applyFieldErrors";
import { apiErrorCode, apiErrorMessage, toastApiError } from "../../utils/apiError";
import {
  OFFICE_FIELDS,
  isValidOfficeImage,
  officeRules,
  toOfficeBody,
  toOfficeFormValues,
} from "../../utils/officeRules";

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
  const [photoFile, setPhotoFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const user = useCurrentUser();

  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    control,
    getValues,
    setError,
    formState: { errors },
  } = useForm({
    defaultValues: toOfficeFormValues(null, user?.company?.country),
  });
  const rules = officeRules(t, getValues);
  const countryId = useWatch({ control, name: "countryId" });

  const onPhotoSelected = (e) => {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    // Same rule as the server; an invalid file is never kept.
    if (!isValidOfficeImage(f)) {
      toast.error(t("validation.imageInvalid"));
      return;
    }
    setPhotoFile(f);
    setPhoto(URL.createObjectURL(f));
  };

  const onSubmit = async (data) => {
    setCreateLoading(true);
    let office;
    try {
      office = await createOffice(toOfficeBody(data));
    } catch (err) {
      setCreateLoading(false);
      // 409 OFFICE_NAME_TAKEN belongs under the name.
      if (apiErrorCode(err) === "OFFICE_NAME_TAKEN") {
        setError("name", { type: "server", message: apiErrorMessage(err) }, { shouldFocus: true });
        return;
      }
      const { mapped } = applyFieldErrors(err, setError, { knownFields: OFFICE_FIELDS });
      if (!mapped.length) toastApiError(err, t("toast.createFailed"));
      return;
    }

    let photoOk = true;
    if (photoFile) {
      setIsUploading(true);
      try {
        await uploadOfficeImage(office.id, photoFile);
      } catch (err) {
        // The office exists; only the photo failed (it can be added from Edit). Only this toast
        // shows, so it isn't queued behind the success one (one toast at a time).
        photoOk = false;
        toastApiError(err, t("toast.uploadImageFailed"));
      }
    }
    if (photoOk) toast.success(t("toast.created"));
    navigate("/admin/head-offices");
  };

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
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={onPhotoSelected}
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
              {...register("name", rules.name)}
              placeholder={t("create.namePlaceholder")}
              className={inputCls(errors.name)}
              onInput={(e) => {
                removeEmojis(e);
                e.target.value = e.target.value.replace(/^\s+/, "");
              }}
            />
            <FieldErr error={errors.name} />
          </div>

          {/* Email Address */}
          <div>
            <label className={labelCls}>
              {t("create.emailLabel")} <span className="text-red-500">*</span>
            </label>
            <input
              {...register("email", rules.email)}
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
                <PhoneCountrySelect
                  {...register("phoneCountry", rules.phoneCountry)}
                  error={!!errors.phoneCountry}
                />
              </div>
              <input
                {...register("phone", rules.phone)}
                type="tel"
                inputMode="numeric"
                placeholder={t("create.phonePlaceholder")}
                className={inputCls(errors.phone)}
                onInput={(e) => {
                  removeEmojis(e);
                  e.target.value = e.target.value.replace(/[^\d\s+()-]/g, "");
                }}
              />
            </div>
            <FieldErr error={errors.phone || errors.phoneCountry} />
          </div>

          {/* Location */}
          <div>
            <label className={labelCls}>
              {t("create.locationLabel")}{" "}
              <span className="text-red-500">*</span>
            </label>
            <input
              {...register("location", rules.location)}
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

          {/* Country */}
          <div>
            <label className={labelCls}>
              {t("create.countryLabel")} <span className="text-red-500">*</span>
            </label>
            <CountrySelect {...register("countryId", rules.countryId)} error={!!errors.countryId} />
            <FieldErr error={errors.countryId} />
          </div>

          {/* City */}
          <div>
            <label className={labelCls}>{t("create.cityLabel")}</label>
            <CitySelect {...register("cityId")} countryId={countryId} error={!!errors.cityId} />
            <FieldErr error={errors.cityId} />
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
