import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import {
  MdClose,
  MdOutlineError,
  MdOutlineLocationOn,
  MdOutlinePerson,
} from "react-icons/md";
import { useTranslation } from "react-i18next";
import OfflineAttendanceToggle from "./projects/OfflineAttendanceToggle";
import { toast } from "react-toastify";
import { HEAD_OFFICES, PROJECT_CITIES, searchCities } from "../data/groupC";
import LocationPickerModal from "./LocationPickerModal";
import Ltr from "./Ltr";
import CustomDropdown from "./CustomDropdown";
import {
  PROJECT_NAME_PATTERN,
  PROJECT_NAME_MIN,
  PROJECT_NAME_MAX,
  PROJECT_DESCRIPTION_MAX,
  RADIUS_MIN,
  RADIUS_MAX,
  PROJECT_STATUS_OPTIONS,
} from "../utils/projectRules";

// The backend stores three statuses; "Planning" and "In Progress" both used
// to save as ACTIVE, so the form now offers exactly those three.
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

const getOfficeId = (o) => o?.id ?? o?._id ?? o?.office_id;
const getProjectId = (p) => p?.id ?? p?._id ?? p?.project_id;

// Form values are the API values now; anything unknown falls back to ACTIVE.
const apiStatusToForm = (s) =>
  ["ACTIVE", "INACTIVE", "COMPLETED"].includes(s) ? s : "ACTIVE";
const formStatusToApi = apiStatusToForm;

const removeEmojis = (e) => {
  const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
  if (emojiRegex.test(e.target.value)) {
    e.target.value = e.target.value.replace(emojiRegex, "");
  }
};

export default function EditProjectModal({ project, onClose, onSaved }) {
  const { t } = useTranslation("projects");
  const photoRef = useRef();
  const [photo, setPhoto] = useState(null);
  const uploading = false;

  const updateLoading = false;
  const officeList = HEAD_OFFICES;

  const [position, setPosition] = useState(null);
  const [address, setAddress] = useState("");
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [, setLocationError] = useState(false);

  const [cityQuery, setCityQuery] = useState("");

  const [selectedOfficeId, setSelectedOfficeId] = useState(null);
  const [officeError, setOfficeError] = useState(false);
  const [selectedCityId, setSelectedCityId] = useState(null);

  const cityList = searchCities(cityQuery);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm({
    defaultValues: {
      projectName: "",
      status: "ACTIVE",
      allowOffline: true,
      startDate: "",
      endDate: "",
      description: "",
      radius: "",
      city: "",
      officeName: "",
    },
  });

  useEffect(() => {
    if (project) {
      reset({
        projectName: project.project_name || "",
        status: apiStatusToForm(project.status),
        startDate: project.start_date ? project.start_date.split("T")[0] : "",
        endDate: project.end_date ? project.end_date.split("T")[0] : "",
        radius: project.radius_meters || "",
        allowOffline: project.allow_offline_attendance !== false,
        description: project.description || "",
        officeName: project.office?.office_name || "",
        city: project.city?.city_name || project.city_name || "",
      });
      setPhoto(project.photo_url || null);
      if (project.lat && project.lng) {
        setPosition({ lat: project.lat, lng: project.lng });
      } else {
        setPosition(null);
      }
      setAddress(project.project_location || "");
      setSelectedOfficeId(project.office_id || getOfficeId(project.office) || null);
      setSelectedCityId(project.city?.id || project.city_id || null);
      setCityQuery(project.city?.city_name || project.city_name || "");
    }
  }, [project, reset]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const onSubmit = async (data) => {
    // Location editing is disabled, so we don't require it on update if it's not set.

    if (!selectedOfficeId) {
      setOfficeError(true);
      return;
    }
    setLocationError(false);
    setOfficeError(false);

    const id = getProjectId(project);
    if (!id) {
      toast.error(t("edit.toast.missingId"));
      return;
    }

    // Static build: a new photo is kept as its local preview URL.
    const photoUrl = photo || null;

    const payload = {
      project_name: data.projectName.trim(),
      description: data.description?.trim() || null,
      start_date: data.startDate || null,
      end_date: data.endDate || null,
      office_id: selectedOfficeId,
      city_id: selectedCityId,
      radius_meters: Number(data.radius) || null,
      allow_offline_attendance: !!data.allowOffline,
      status: formStatusToApi(data.status),
      photo_url: photoUrl,
    };

    const office = officeList.find((o) => String(getOfficeId(o)) === String(selectedOfficeId));
    const city = PROJECT_CITIES.find((c) => String(c.id) === String(selectedCityId));
    toast.success(t("edit.toast.updated"));
    onSaved?.({
      ...project,
      ...payload,
      office: office || project.office,
      city: city || project.city,
      city_name: city?.city_name || project.city_name,
    });
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

  const initialOfficeName = watch("officeName");
  const currentOfficeOptions = officeList.map((o) => ({ label: o.office_name, value: getOfficeId(o) }));
  if (selectedOfficeId && initialOfficeName && !currentOfficeOptions.some((o) => String(o.value) === String(selectedOfficeId))) {
    currentOfficeOptions.unshift({ label: initialOfficeName, value: selectedOfficeId });
  }

  const initialCityName = watch("city");
  const currentCityOptions = cityList?.map((c) => ({ label: c.city_name, value: c.id })) || [];
  if (selectedCityId && initialCityName && !currentCityOptions.some((o) => String(o.value) === String(selectedCityId))) {
    currentCityOptions.unshift({ label: initialCityName, value: selectedCityId });
  }

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
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
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
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setPhoto(URL.createObjectURL(file));
                    }}
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
                      const selectedOffice = officeList.find((o) => getOfficeId(o) == e.target.value);
                      setValue("officeName", selectedOffice?.office_name || "");
                      setOfficeError(false);
                    }}
                    options={currentOfficeOptions}
                    isSearchable={true}
                    error={officeError}
                    placeholder={t("create.fields.officeSearchPlaceholder")}
                  />
                  {officeError && (
                    <p className="flex items-center gap-1 text-xs text-red-500 mt-1.5">
                      <MdOutlineError className="text-sm flex-shrink-0" />
                      {t("create.fields.selectOfficeError")}
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
                        const startDate = watch("startDate");
                        if (!startDate) return true;
                        return new Date(value) >= new Date(startDate) || t("edit.validation.endAfterStart");
                      },
                    })}
                    className={inputCls(errors.endDate)}
                  />
                  <FieldErr error={errors.endDate} />
                </div>
              </div>

              {/* Row 4: Radius + City */}
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

                <div className="relative">
                  <label className={labelCls}>{t("create.fields.city")}</label>
                  <CustomDropdown
                    value={selectedCityId || ""}
                    onChange={(e) => {
                      setSelectedCityId(e.target.value);
                      const selectedCity = cityList?.find((c) => c.id == e.target.value);
                      setValue("city", selectedCity?.city_name || "");
                    }}
                    onSearchChange={(val) => {
                      setCityQuery(val);
                    }}
                    options={currentCityOptions}
                    isSearchable={true}
                    error={!!errors.city}
                    placeholder={t("create.fields.citySearchPlaceholder")}
                  />
                  <FieldErr error={errors.city} />
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
