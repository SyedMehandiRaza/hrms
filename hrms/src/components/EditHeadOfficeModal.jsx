import { useEffect, useState, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { MdClose, MdOutlineError, MdOutlinePerson } from "react-icons/md";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import PhoneCountrySelect from "./geo/PhoneCountrySelect";
import CountrySelect from "./geo/CountrySelect";
import CitySelect from "./geo/CitySelect";
import { assetUrl } from "../api/client";
import { removeOfficeImage, updateOffice, uploadOfficeImage } from "../api/offices";
import { useCurrentUser } from "../hooks/useSession";
import { applyFieldErrors } from "../utils/applyFieldErrors";
import { apiErrorCode, apiErrorMessage, toastApiError } from "../utils/apiError";
import {
  OFFICE_FIELDS,
  isValidOfficeImage,
  officeRules,
  toOfficeBody,
  toOfficeFormValues,
} from "../utils/officeRules";

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

// Edit (or view) one head office from the list (D5). `office` is the list item; on save the
// details are sent first, then the photo is uploaded or removed if it changed.
export default function EditHeadOfficeModal({ office, onClose, onSaved, isViewMode = false }) {
  const { t } = useTranslation("offices");
  const user = useCurrentUser();
  const [updateLoading, setUpdateLoading] = useState(false);

  const photoRef = useRef();
  const [photo, setPhoto] = useState(() => assetUrl(office?.image));
  const [photoFile, setPhotoFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    getValues,
    setError,
    formState: { errors },
  } = useForm({
    defaultValues: toOfficeFormValues(office, user?.company?.country),
  });
  const rules = officeRules(t, getValues);
  const countryId = useWatch({ control, name: "countryId" });
  const cityId = useWatch({ control, name: "cityId" });

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

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
    const id = office?.id;
    if (id == null) {
      toast.error(t("toast.missingId"));
      return;
    }

    setUpdateLoading(true);
    try {
      await updateOffice(id, toOfficeBody(data));
    } catch (err) {
      setUpdateLoading(false);
      // 409 OFFICE_NAME_TAKEN belongs under the name.
      if (apiErrorCode(err) === "OFFICE_NAME_TAKEN") {
        setError("name", { type: "server", message: apiErrorMessage(err) }, { shouldFocus: true });
        return;
      }
      const { mapped } = applyFieldErrors(err, setError, { knownFields: OFFICE_FIELDS });
      if (!mapped.length) toastApiError(err, t("toast.updateFailed"));
      return;
    }

    // The photo: a new file is uploaded; a removed one is deleted.
    let photoOk = true;
    if (photoFile || (!photo && office.image)) {
      setIsUploading(true);
      try {
        if (photoFile) await uploadOfficeImage(id, photoFile);
        else await removeOfficeImage(id);
      } catch (err) {
        photoOk = false;
        toastApiError(err, t("toast.uploadImageFailed"));
      } finally {
        setIsUploading(false);
      }
    }

    setUpdateLoading(false);
    if (photoOk) toast.success(t("toast.updated"));
    if (onSaved) onSaved();
    onClose();
  };

  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!office) return null;

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
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={onPhotoSelected}
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
                  {...register("name", rules.name)}
                  placeholder={t("edit.namePlaceholder")}
                  className={inputCls(errors.name)}
                  onInput={(e) => {
                    e.target.value = e.target.value.replace(/^\s+/, "");
                  }}
                  disabled={isViewMode}
                />
                <FieldErr error={errors.name} />
              </div>

              <div>
                <label className={labelCls}>
                  {t("edit.emailLabel")} {!isViewMode && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="email"
                  {...register("email", rules.email)}
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
                    <PhoneCountrySelect
                      {...register("phoneCountry", rules.phoneCountry)}
                      error={!!errors.phoneCountry}
                      disabled={isViewMode}
                    />
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    {...register("phone", rules.phone)}
                    placeholder={t("edit.phonePlaceholder")}
                    className={inputCls(errors.phone)}
                    onInput={(e) => {
                      e.target.value = e.target.value.replace(/[^\d\s+()-]/g, "");
                    }}
                    disabled={isViewMode}
                  />
                </div>
                <FieldErr error={errors.phone || errors.phoneCountry} />
              </div>
              <div>
                <label className={labelCls}>
                  {t("edit.locationLabel")}{" "}
                  {!isViewMode && <span className="text-red-500">*</span>}
                </label>
                <input
                  {...register("location", rules.location)}
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

            {/* Row 3: Country + City */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>
                  {t("edit.countryLabel")} {!isViewMode && <span className="text-red-500">*</span>}
                </label>
                <CountrySelect
                  {...register("countryId", rules.countryId)}
                  error={!!errors.countryId}
                  disabled={isViewMode}
                />
                <FieldErr error={errors.countryId} />
              </div>
              <div>
                <label className={labelCls}>{t("edit.cityLabel")}</label>
                <CitySelect
                  {...register("cityId")}
                  countryId={countryId}
                  // The saved city shows only while it's still the chosen one (a country round trip
                  // clears it, and the field must then show that).
                  selected={cityId && cityId === office.city?.id ? office.city : null}
                  error={!!errors.cityId}
                  disabled={isViewMode}
                />
                <FieldErr error={errors.cityId} />
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
