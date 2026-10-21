import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import {
  MdClose,
  MdOutlineError,
  MdOutlineLocationOn,
  MdOutlinePerson,
} from "react-icons/md";
import { useTranslation } from "react-i18next";
import OfflineAttendanceToggle from "./projects/OfflineAttendanceToggle";
import { toast } from "react-toastify";
import LocationPickerModal from "./LocationPickerModal";
import Ltr from "./Ltr";
import CustomDropdown from "./CustomDropdown";
import CountrySelect from "./geo/CountrySelect";
import CitySelect from "./geo/CitySelect";
import { assetUrl } from "../api/client";
import { listOfficeOptions, removeProjectImage, updateProject, uploadProjectImage } from "../api/projects";
import useApiQuery from "../hooks/useApiQuery";
import { useCurrentUser } from "../hooks/useSession";
import { applyFieldErrors } from "../utils/applyFieldErrors";
import { apiErrorCode, apiErrorMessage, toastApiError } from "../utils/apiError";
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
} from "../utils/projectRules";

// The backend stores three statuses: Active, On Hold, Completed.
const STATUS_OPTIONS = PROJECT_STATUS_OPTIONS;

const inputBase =
  "w-full px-4 py-3 border rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition";

const inputCls = (err) =>
  `${inputBase} ${err ? "border-red-300 bg-red-50" : "border-gray-200 bg-white"}`;

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

// `project` is an API item (api/projects.js); onSaved gets the saved item. The modal is mounted
// for one project at a time, so its state starts from that project.
export default function EditProjectModal({ project, onClose, onSaved }) {
  const { t } = useTranslation("projects");
  const user = useCurrentUser();
  const photoRef = useRef();
  const [photo, setPhoto] = useState(() => assetUrl(project?.photo) || null);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);

  // Head offices without a project, plus this project's own office (D12).
  const { data: officeList = [] } = useApiQuery(() => listOfficeOptions(project?.id), [project?.id]);

  const [position, setPosition] = useState(() =>
    project?.latitude != null && project?.longitude != null ? { lat: project.latitude, lng: project.longitude } : null
  );
  const [address, setAddress] = useState(() => project?.location || "");
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [locationError, setLocationError] = useState(false);

  const [selectedOfficeId, setSelectedOfficeId] = useState(() => project?.office?.id || null);
  // true → "Please select an office"; a string → the server's message for the office.
  const [officeError, setOfficeError] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
    getValues,
  } = useForm({ defaultValues: toProjectFormValues(project, user?.company?.country) });
  const countryId = useWatch({ control, name: "countryId" });
  const cityId = useWatch({ control, name: "cityId" });

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

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
    setPhotoRemoved(false);
    setPhoto(URL.createObjectURL(file));
  };

  const onSubmit = async (data) => {
    // The map point and the office are checked together (both shown at once).
    setLocationError(!position);
    setOfficeError(!selectedOfficeId);
    if (!position || !selectedOfficeId) return;

    setUpdateLoading(true);
    let saved;
    try {
      saved = await updateProject(project.id, toProjectBody(data, { officeId: selectedOfficeId, position, address }));
    } catch (err) {
      setUpdateLoading(false);
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
      if (!mapped.length || unmapped.length) toastApiError(err, t("edit.toast.updateFailed"));
      return;
    }

    // The photo is saved separately; the project itself is already saved. Only one toast shows
    // (one at a time), so a photo error replaces the success one.
    let photoOk = true;
    try {
      if (photoFile) {
        setUploading(true);
        saved = await uploadProjectImage(project.id, photoFile);
      } else if (photoRemoved && project.photo) {
        setUploading(true);
        saved = await removeProjectImage(project.id);
      }
    } catch (err) {
      photoOk = false;
      toastApiError(err, t("edit.toast.uploadPhotoFailed"));
    }
    setUploading(false);
    setUpdateLoading(false);
    if (photoOk) toast.success(t("edit.toast.updated"));
    onSaved?.(saved);
    onClose();
  };

  const handleLocationConfirm = ({ position: pos, address: addr }) => {
    setPosition(pos);
    setAddress(addr);
    setLocationError(false);
  };

  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!project) return null;

  const currentOfficeOptions = officeList.map((o) => ({ label: o.name, value: o.id }));

  return (
    <>
      <LocationPickerModal
        isOpen={mapModalOpen}
        onClose={() => setMapModalOpen(false)}
        onConfirm={handleLocationConfirm}
        initialPosition={position}
        initialAddress={address}
      />

      <div
        className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
        onClick={handleBackdrop}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col"
          style={{ maxHeight: "90vh" }}
        >
          {/* Header */}
          <div className="flex items-start justify-between px-6 pt-6 pb-4 flex-shrink-0">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{t("edit.title")}</h2>
              <p className="text-sm text-gray-500 mt-0.5">{t("edit.subtitle")}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0"
            >
              <MdClose className="text-xl" />
            </button>
          </div>

          <hr className="border-gray-100 flex-shrink-0" />

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col flex-1 min-h-0">
            <div
              className="flex-1 overflow-y-auto px-6 py-6 space-y-6 modal-body"
            >

              {/* Photo Section */}
              <div className="flex items-center gap-5 pb-6 border-b border-gray-100">
                <div
                  className="w-20 h-20 flex-shrink-0 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden cursor-pointer hover:border-cyan-400 transition-colors"
                  onClick={() => photoRef.current?.click()}
                >
                  {photo ? (
                    <img src={photo} alt="Project" className="w-full h-full object-cover" />
                  ) : (
                    <MdOutlinePerson className="text-3xl text-gray-300" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800 mb-0.5">{t("edit.photoTitle", "Project Image")}</p>
                  <p className="text-xs text-gray-400 mb-3">{t("edit.photoHelper", "Upload an image to represent this project.")}</p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => photoRef.current?.click()}
                      className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      {t("buttons.uploadPhoto", "Upload Image")}
                    </button>
                    {photo && (
                      <button
                        type="button"
                        onClick={() => {
                          setPhoto(null);
                          setPhotoFile(null);
                          setPhotoRemoved(true);
                          if (photoRef.current) photoRef.current.value = "";
                        }}
                        className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
                      >
                        {t("buttons.remove", "Remove")}
                      </button>
                    )}
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

              {/* Form Fields from CreateProject */}
              {/* Row 1: Project Name + Office */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className={labelCls}>{t("create.fields.projectName")}</label>
                  <input
                    {...register("projectName", {
                      required: t("edit.validation.nameRequired"),
                      maxLength: {
                        value: PROJECT_NAME_MAX,
                        message: t("edit.validation.nameMax")
                      },
                      validate: {
                        noOnlySpaces: (v) => v.trim() !== "" || t("edit.validation.nameEmpty"),
                        noDoubleSpaces: (v) => !/\s{2,}/.test(v) || t("edit.validation.multipleSpaces"),
                        // Any language (Arabic…) and ' . / : # as well.
                        validChars: (v) => PROJECT_NAME_PATTERN.test(v.trim()) || t("edit.validation.nameChars"),
                        minLen: (v) => v.trim().length >= PROJECT_NAME_MIN || t("edit.validation.min2"),
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

                <div className="relative">
                  <label className={labelCls}>{t("create.fields.officeName")}</label>
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

              {/* Row 2: Location + Status */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className={labelCls}>
                    {t("create.fields.projectLocation")}
                  </label>

                  {/* If no location selected — show trigger button (disabled) */}
                  {!position ? (
                    <div
                      className="w-full flex items-center gap-2 px-4 py-3 border rounded-lg text-sm bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed opacity-80"
                    >
                      <MdOutlineLocationOn className="text-lg flex-shrink-0 text-gray-400" />
                      <span>{t("create.fields.selectLocation", "Location Not Set")}</span>
                    </div>
                  ) : (
                    /* If location selected — show address chip (read-only) */
                    <div
                      className="w-full flex items-start gap-2 px-4 py-3 border border-gray-200 bg-gray-50 rounded-lg cursor-not-allowed opacity-90 group"
                    >
                      <MdOutlineLocationOn className="text-gray-500 text-lg flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-gray-600 flex-1 line-clamp-2 leading-relaxed">
                        {address || (
                          <Ltr>{`${Number(position.lat).toFixed(5)}, ${Number(position.lng).toFixed(5)}`}</Ltr>
                        )}
                      </p>
                    </div>
                  )}

                  {locationError && (
                    <p className="flex items-center gap-1 text-xs text-red-500 mt-1.5">
                      <MdOutlineError className="text-sm flex-shrink-0" />
                      {t("create.fields.selectLocationError")}
                    </p>
                  )}

                  {/* Coordinates pill shown below when selected (read-only) */}
                  {position && (
                    <p className="text-[10px] text-gray-400 mt-1.5 font-medium">
                      📍{" "}
                      <Ltr>{`${Number(position.lat).toFixed(5)}, ${Number(position.lng).toFixed(5)}`}</Ltr>
                    </p>
                  )}
                </div>

                <div>
                  <label className={labelCls}>{t("create.fields.status")}</label>
                  <CustomDropdown
                    {...register("status")}
                    error={!!errors.status}
                    options={STATUS_OPTIONS.map((item) => ({
                      label: t(item.labelKey),
                      value: item.value
                    }))}
                  />
                  <FieldErr error={errors.status} />
                </div>
              </div>

              {/* Offline (mobile) attendance for employees whose main project this is */}
              <OfflineAttendanceToggle register={register} name="allowOffline" />

              {/* Row 3: Start Date + End Date */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className={labelCls}>{t("create.fields.startDate")}</label>
                  <input type="date" {...register("startDate", { required: t("edit.validation.startDateRequired") })} className={inputCls(errors.startDate)} />
                  <FieldErr error={errors.startDate} />
                </div>
                <div>
                  <label className={labelCls}>{t("create.fields.endDate")}</label>
                  <input
                    type="date"
                    {...register("endDate", {
                      required: t("edit.validation.endDateRequired"),
                      validate: (value) => {
                        const startDate = getValues("startDate");
                        if (!startDate) return true;
                        return new Date(value) >= new Date(startDate) || t("edit.validation.endAfterStart");
                      },
                    })}
                    className={inputCls(errors.endDate)}
                  />
                  <FieldErr error={errors.endDate} />
                </div>
              </div>

              {/* Row 4: Radius + Country, then City (in the chosen country) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className={labelCls}>{t("create.fields.radius")}</label>
                  <input
                    type="number"
                    min={RADIUS_MIN}
                    max={RADIUS_MAX}
                    {...register("radius", {
                      required: t("edit.validation.radiusRequired"),
                      min: { value: RADIUS_MIN, message: t("edit.validation.radiusMin") },
                      max: { value: RADIUS_MAX, message: t("edit.validation.radiusMax") },
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

                <div className="relative">
                  <label className={labelCls}>{t("create.fields.city")}</label>
                  <CitySelect
                    {...register("cityId")}
                    countryId={countryId}
                    // The saved city shows only while it's still the chosen one.
                    selected={cityId && cityId === project.city?.id ? project.city : null}
                    error={!!errors.cityId}
                  />
                  <FieldErr error={errors.cityId} />
                </div>
              </div>

              {/* Row 5: Description */}
              <div>
                <label className={labelCls}>{t("create.fields.projectDescription")}</label>
                <textarea
                  rows={4}
                  {...register("description", {
                    // Optional free text, like the API: any language and
                    // punctuation, line breaks allowed (emoji stripped below).
                    maxLength: {
                      value: PROJECT_DESCRIPTION_MAX,
                      message: t("edit.validation.descriptionMax")
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

            {/* Footer */}
            <hr className="border-gray-100 flex-shrink-0" />
            <div className="flex justify-end gap-3 px-6 py-4 flex-shrink-0">
              <button
                type="button"
                onClick={onClose}
                disabled={updateLoading}
                className="px-6 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-60 transition-colors"
              >
                {t("buttons.cancel")}
              </button>
              <button
                type="submit"
                disabled={updateLoading || uploading}
                className="px-6 py-2.5 text-sm font-semibold text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {updateLoading || uploading ? t("buttons.saving") : t("buttons.saveChanges")}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
