import { useState, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import {
  MdOutlinePerson,
  MdOutlineError,
  MdOutlineChevronRight,
  MdOutlineLocationOn,
  MdOutlineClose,
} from "react-icons/md";

import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import OfflineAttendanceToggle from "../../components/projects/OfflineAttendanceToggle";
import { toast } from "react-toastify";
import LocationPickerModal from "../../components/LocationPickerModal";
import Ltr from "../../components/Ltr";
import CustomDropdown from "../../components/CustomDropdown";
import CountrySelect from "../../components/geo/CountrySelect";
import CitySelect from "../../components/geo/CitySelect";
import SuccessModal from "../../components/SuccessModal";
import { createProject, listOfficeOptions, uploadProjectImage } from "../../api/projects";
import useApiQuery from "../../hooks/useApiQuery";
import { useCurrentUser } from "../../hooks/useSession";
import { applyFieldErrors } from "../../utils/applyFieldErrors";
import { apiErrorCode, apiErrorMessage, toastApiError } from "../../utils/apiError";
import {
  PROJECT_NAME_PATTERN,
  PROJECT_NAME_MIN,
  PROJECT_NAME_MAX,
  PROJECT_DESCRIPTION_MAX,
  RADIUS_MIN,
  RADIUS_MAX,
  PROJECT_STATUS_OPTIONS,
  PROJECT_FIELDS,
  PROJECT_FIELD_MAP,
  PROJECT_CODE_FIELDS,
  PROJECT_OFFICE_FIELDS,
  PROJECT_LOCATION_FIELDS,
  isValidProjectImage,
  toProjectBody,
  toProjectFormValues,
} from "../../utils/projectRules";

// The backend stores three statuses: Active, On Hold, Completed.
const STATUS_OPTIONS = PROJECT_STATUS_OPTIONS;

const inputBase =
  "w-full px-4 py-3 border rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition";

const inputCls = (err) =>
  `${inputBase} ${err ? "border-red-300 bg-red-50" : "border-gray-200 bg-white"}`;

const selectCls = (err) =>
  `${inputBase} appearance-none pe-10 cursor-pointer ${err ? "border-red-300 bg-red-50" : "border-gray-200 bg-white"
  }`;

const labelCls =
  "block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5";

const FieldErr = ({ error }) =>
  error ? (
    <p className="flex items-center gap-1 text-xs text-red-500 mt-1.5">
      <MdOutlineError className="text-sm flex-shrink-0" />
      {error.message}
    </p>
  ) : null;

const removeEmojis = (e) => {
  const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
  if (emojiRegex.test(e.target.value)) {
    e.target.value = e.target.value.replace(emojiRegex, "");
  }
};

export default function CreateProject() {
  const { t } = useTranslation("projects");
  const user = useCurrentUser();
  const photoRef = useRef();
  const [photo, setPhoto] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const navigate = useNavigate();
  // Head offices without a project (D12): each office has at most one project.
  const { data: officeList = [] } = useApiQuery(() => listOfficeOptions(), []);

  // Location state
  const [position, setPosition] = useState(null);
  const [address, setAddress] = useState("");
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [locationError, setLocationError] = useState(false);

  const [selectedOfficeId, setSelectedOfficeId] = useState(null);
  // true → "Please select an office"; a string → the server's message for the office.
  const [officeError, setOfficeError] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
    getValues,
  } = useForm({ defaultValues: toProjectFormValues(null, user?.company?.country) });
  const countryId = useWatch({ control, name: "countryId" });

  const onPhotoSelected = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    // Same rule as the server; an invalid file is never kept.
    if (!isValidProjectImage(file)) {
      toast.error(t("create.validation.imageInvalid"));
      return;
    }
    setPhotoFile(file);
    setPhoto(URL.createObjectURL(file));
  };

  const onSubmit = async (data) => {
    // The map point and the office are checked together (both shown at once).
    setLocationError(!position);
    setOfficeError(!selectedOfficeId);
    if (!position || !selectedOfficeId) return;

    setCreateLoading(true);
    let project;
    try {
      project = await createProject(toProjectBody(data, { officeId: selectedOfficeId, position, address }));
    } catch (err) {
      setCreateLoading(false);
      const code = apiErrorCode(err);
      if (code === "PROJECT_OFFICE_TAKEN") {
        setOfficeError(apiErrorMessage(err));
        return;
      }
      if (PROJECT_CODE_FIELDS[code]) {
        setError(PROJECT_CODE_FIELDS[code], { type: "server", message: apiErrorMessage(err) }, { shouldFocus: true });
        return;
      }
      const { mapped, unmapped } = applyFieldErrors(err, setError, {
        fieldMap: PROJECT_FIELD_MAP,
        knownFields: [...PROJECT_FIELDS, ...PROJECT_OFFICE_FIELDS, ...PROJECT_LOCATION_FIELDS],
      });
      if (mapped.some((f) => PROJECT_OFFICE_FIELDS.includes(f))) setOfficeError(true);
      if (mapped.some((f) => PROJECT_LOCATION_FIELDS.includes(f))) setLocationError(true);
      if (!mapped.length || unmapped.length) toastApiError(err, t("create.toast.createFailed"));
      return;
    }

    let photoOk = true;
    if (photoFile) {
      setUploading(true);
      try {
        await uploadProjectImage(project.id, photoFile);
      } catch (err) {
        // The project exists; only the photo failed (it can be added from Edit). Only this toast
        // shows, so it isn't queued behind the success one (one toast at a time).
        photoOk = false;
        toastApiError(err, t("create.toast.uploadFailed"));
      }
      setUploading(false);
    }
    setCreateLoading(false);
    if (photoOk) toast.success(t("create.toast.created"));
    setSubmitted(true);
  };

  // Called when user confirms location in modal
  const handleLocationConfirm = ({ position: pos, address: addr }) => {
    setPosition(pos);
    setAddress(addr);
    setLocationError(false);
  };

  const clearLocation = () => {
    setPosition(null);
    setAddress("");
  };

  const currentOfficeOptions = officeList.map((o) => ({ label: o.name, value: o.id }));

  return (
    <>
      <SuccessModal
        isOpen={submitted}
        onClose={() => {
          setSubmitted(false);
          navigate("/admin/projects");
        }}
        title={t("create.successTitle")}
        message={t("create.successMessage")}
        buttonText={t("buttons.backToProjects")}
      />

      {/* Location Picker Modal */}
      <LocationPickerModal
        isOpen={mapModalOpen}
        onClose={() => setMapModalOpen(false)}
        onConfirm={handleLocationConfirm}
        initialPosition={position}
        initialAddress={address}
      />

      <div className="space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-sm flex-wrap mb-2">
          <Link
            to="/admin/projects"
            className="text-gray-400 hover:text-cyan-600 transition-colors"
          >
            {t("breadcrumb.projectManagement")}
          </Link>
          <MdOutlineChevronRight className="text-gray-300 rtl:rotate-180" />
          <span className="text-cyan-600 font-semibold">
            {t("breadcrumb.createProject")}
          </span>
        </div>

        {/* Page Header */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
            {t("create.title")}
          </h1>
          <p className="text-gray-500 mt-1 text-sm">{t("create.subtitle")}</p>
        </div>

        {/* Main Card */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            {/* ── Photo Section ── */}
            <div className="px-6 py-6 md:px-8 border-b border-gray-100">
              <div className="flex flex-col sm:flex-row gap-5 items-start">
                <div
                  onClick={() => photoRef.current.click()}
                  className="w-20 h-20 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50 cursor-pointer hover:border-cyan-400 flex items-center justify-center overflow-hidden flex-shrink-0 transition-colors"
                >
                  {photo ? (
                    <img
                      src={photo}
                      alt={t("detail.imageAlt")}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <MdOutlinePerson className="text-3xl text-gray-300" />
                  )}
                </div>
                <div>
                  <p className="text-base font-semibold text-gray-900">
                    {t("create.photoTitle")}
                  </p>
                  <p className="text-sm text-gray-400 mt-0.5 mb-3">
                    {t("create.photoHelper")}
                  </p>
                  <div className="flex items-center gap-4 flex-wrap">
                    <button
                      type="button"
                      onClick={() => photoRef.current.click()}
                      className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-semibold transition-colors"
                    >
                      {t("buttons.uploadPhoto")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPhoto(null);
                        setPhotoFile(null);
                      }}
                      className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
                    >
                      {t("buttons.remove")}
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
            </div>

            {/* ── Form Fields ── */}
            <div className="px-6 py-6 md:px-8 space-y-5">
              {/* Row 1: Project Name + Office — 2 columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className={labelCls}>
                    {t("create.fields.projectName")}
                  </label>
                  <input
                    {...register("projectName", {
                      required: t("create.validation.nameRequired"),
                      maxLength: {
                        value: PROJECT_NAME_MAX,
                        message: t("create.validation.nameMax")
                      },
                      validate: {
                        noOnlySpaces: (v) =>
                          v.trim() !== "" || t("create.validation.nameEmpty"),
                        noDoubleSpaces: (v) =>
                          !/\s{2,}/.test(v) ||
                          t("create.validation.multipleSpaces"),
                        // Any language (Arabic…) and ' . / : # as well.
                        validChars: (v) =>
                          PROJECT_NAME_PATTERN.test(v.trim()) ||
                          t("create.validation.nameInvalidChars"),
                        minLen: (v) =>
                          v.trim().length >= PROJECT_NAME_MIN ||
                          t("create.validation.min2"),
                      },
                    })}
                    maxLength={PROJECT_NAME_MAX}
                    placeholder={t("create.fields.projectNamePlaceholder")}
                    className={inputCls(errors.projectName)}
                    onInput={(e) => {
                      removeEmojis(e);
                      e.target.value = e.target.value.replace(/^\s+/, "");
                    }}
                  />
                  <FieldErr error={errors.projectName} />
                </div>
                {/* Office Dropdown — head offices without a project */}
                <div className="relative">
                  <label className={labelCls}>
                    {t("create.fields.officeName")}
                  </label>
                  <CustomDropdown
                    value={selectedOfficeId || ""}
                    onChange={(e) => {
                      setSelectedOfficeId(e.target.value);
                      setOfficeError(false);
                    }}
                    options={currentOfficeOptions}
                    isSearchable={true}
                    error={!!officeError}
                    placeholder={t("create.fields.officeSearchPlaceholder")}
                  />
                  {officeError && (
                    <p className="flex items-center gap-1 text-xs text-red-500 mt-1.5">
                      <MdOutlineError className="text-sm flex-shrink-0" />
                      {typeof officeError === "string" ? officeError : t("create.fields.selectOfficeError")}
                    </p>
                  )}
                </div>
              </div>

              {/* Row 2: Location + Status — 2 columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Location trigger */}
                <div>
                  <label className={labelCls}>
                    {t("create.fields.projectLocation")}
                  </label>

                  {/* If no location selected — show trigger button */}
                  {!position ? (
                    <button
                      type="button"
                      onClick={() => setMapModalOpen(true)}
                      className={`w-full flex items-center gap-2 px-4 py-3 border rounded-lg text-sm transition-colors hover:border-cyan-400 hover:bg-cyan-50 ${locationError
                          ? "border-red-300 bg-red-50 text-red-400"
                          : "border-gray-200 bg-white text-gray-400"
                        }`}
                    >
                      <MdOutlineLocationOn
                        className={`text-lg flex-shrink-0 ${locationError ? "text-red-400" : "text-gray-400"}`}
                      />
                      <span>{t("create.fields.selectLocation")}</span>
                    </button>
                  ) : (
                    /* If location selected — show address chip */
                    <div
                      onClick={() => setMapModalOpen(true)}
                      className="w-full flex items-start gap-2 px-4 py-3 border border-cyan-200 bg-cyan-50 rounded-lg cursor-pointer hover:border-cyan-400 transition-colors group"
                    >
                      <MdOutlineLocationOn className="text-cyan-600 text-lg flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-gray-700 flex-1 line-clamp-2 leading-relaxed">
                        {address || (
                          <Ltr>{`${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`}</Ltr>
                        )}
                      </p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          clearLocation();
                        }}
                        className="flex-shrink-0 p-0.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title={t("tooltips.clearLocation")}
                      >
                        <MdOutlineClose className="text-base" />
                      </button>
                    </div>
                  )}

                  {locationError && (
                    <p className="flex items-center gap-1 text-xs text-red-500 mt-1.5">
                      <MdOutlineError className="text-sm flex-shrink-0" />
                      {t("create.fields.selectLocationError")}
                    </p>
                  )}

                  {/* Coordinates pill shown below when selected */}
                  {position && (
                    <p className="text-[10px] text-gray-400 mt-1.5 font-medium">
                      📍{" "}
                      <Ltr>{`${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`}</Ltr>
                      <span
                        className="ms-2 text-cyan-600 underline cursor-pointer"
                        onClick={() => setMapModalOpen(true)}
                      >
                        {t("buttons.change")}
                      </span>
                    </p>
                  )}
                </div>

                {/* Status */}
                <div>
                  <label className={labelCls}>
                    {t("create.fields.status")}
                  </label>
                  <div className="relative">
                    <CustomDropdown
                      {...register("status")}
                      className={selectCls(errors.status)}
                      error={!!errors.status}
                      options={STATUS_OPTIONS.map((item) => ({
                        label: t(item.labelKey),
                        value: item.value
                      }))}
                    />
                  </div>
                  <FieldErr error={errors.status} />
                </div>
              </div>

              {/* Offline (mobile) attendance for employees whose main project this is */}
              <OfflineAttendanceToggle register={register} name="allowOffline" />

              {/* Row 3: Start Date + End Date — 2 columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className={labelCls}>
                    {t("create.fields.startDate")}
                  </label>
                  <input
                    type="date"
                    {...register("startDate", {
                      required: t("create.validation.startRequired"),
                    })}
                    className={inputCls(errors.startDate)}
                  />
                  <FieldErr error={errors.startDate} />
                </div>

                <div>
                  <label className={labelCls}>
                    {t("create.fields.endDate")}
                  </label>
                  <input
                    type="date"
                    {...register("endDate", {
                      required: t("create.validation.endRequired"),
                      validate: (value) => {
                        const startDate = getValues("startDate");
                        if (!startDate) return true;
                        return (
                          new Date(value) >= new Date(startDate) ||
                          t("create.validation.endAfterStart")
                        );
                      },
                    })}
                    className={inputCls(errors.endDate)}
                  />
                  <FieldErr error={errors.endDate} />
                </div>
              </div>

              {/* Row 5: Radius + Country, then City (in the chosen country) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Radius */}
                <div>
                  <label className={labelCls}>
                    {t("create.fields.radius")}
                  </label>
                  <input
                    type="number"
                    min={RADIUS_MIN}
                    max={RADIUS_MAX}
                    {...register("radius", {
                      required: t("create.validation.radiusRequired"),
                      min: {
                        value: RADIUS_MIN,
                        message: t("create.validation.radiusMin"),
                      },
                      max: {
                        value: RADIUS_MAX,
                        message: t("create.validation.radiusMax"),
                      },
                    })}
                    placeholder={t("create.fields.radiusPlaceholder")}
                    className={inputCls(errors.radius)}
                    onInput={(e) => {
                      removeEmojis(e);
                      e.target.value = e.target.value.replace(/[^0-9]/g, "");
                    }}
                  />
                  <FieldErr error={errors.radius} />
                </div>

                {/* Country (approved UI addition) */}
                <div className="relative">
                  <label className={labelCls}>{t("create.fields.country")}</label>
                  <CountrySelect
                    {...register("countryId", { required: t("common:geo.countryRequired") })}
                    error={!!errors.countryId}
                  />
                  <FieldErr error={errors.countryId} />
                </div>

                {/* City — that country's cities */}
                <div className="relative">
                  <label className={labelCls}>{t("create.fields.city")}</label>
                  <CitySelect {...register("cityId")} countryId={countryId} error={!!errors.cityId} />
                  <FieldErr error={errors.cityId} />
                </div>
              </div>

              {/* Row 4: Description — full width */}
              <div>
                <label className={labelCls}>
                  {t("create.fields.projectDescription")}
                </label>
                <textarea
                  rows={5}
                  {...register("description", {
                    // Optional free text, like the API: any language and
                    // punctuation, line breaks allowed (emoji stripped below).
                    maxLength: {
                      value: PROJECT_DESCRIPTION_MAX,
                      message: t("create.validation.descriptionMax")
                    },
                  })}
                  maxLength={PROJECT_DESCRIPTION_MAX}
                  placeholder={t("create.fields.descriptionPlaceholder")}
                  className={`${inputCls(errors.description)} resize-none`}
                  onInput={(e) => {
                    removeEmojis(e);
                    e.target.value = e.target.value.replace(/^\s+/, "");
                  }}
                />
                <FieldErr error={errors.description} />
              </div>
            </div>

            {/* ── Footer Buttons ── */}
            <div className="border-t border-gray-100 px-6 md:px-8 py-5 flex flex-col-reverse sm:flex-row justify-end gap-3">
              <button
                type="button"
                onClick={() => navigate("/admin/projects")}
                className="px-8 py-2.5 rounded-lg text-sm text-gray-600 cursor-pointer bg-gray-100 hover:bg-gray-200 font-semibold transition-colors"
              >
                {t("buttons.cancel")}
              </button>
                <button
                  type="submit"
                  disabled={createLoading || uploading}
                  className="px-8 py-3 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-semibold rounded-lg shadow hover:shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {createLoading || uploading ? t("buttons.saving") : t("buttons.saveProject")}
                </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
