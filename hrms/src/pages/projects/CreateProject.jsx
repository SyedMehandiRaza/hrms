import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
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
import { HEAD_OFFICES, searchCities } from "../../data/groupC";
import SuccessModal from "../../components/SuccessModal";
import useFiscalYear from "../../hooks/useFiscalYear";
import { fyLabel, yearKeyFor } from "../../utils/fiscalYear";
import {
  PROJECT_NAME_PATTERN,
  PROJECT_NAME_MIN,
  PROJECT_NAME_MAX,
  PROJECT_DESCRIPTION_MAX,
  RADIUS_MIN,
  RADIUS_MAX,
  PROJECT_STATUS_OPTIONS,
} from "../../utils/projectRules";

// The backend stores three statuses; "Planning" and "In Progress" both used
// to save as ACTIVE, so the form now offers exactly those three.
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

const getOfficeId = (o) => o?.id ?? o?._id ?? o?.office_id;

// Form values are the API values; anything unknown falls back to ACTIVE.
const formStatusToApi = (s) =>
  ["ACTIVE", "INACTIVE", "COMPLETED"].includes(s) ? s : "ACTIVE";

// The year part is the financial year the project is created in (today, in
// company time): "FY 2026" → PRJ-FY26-AB12, "FY 2026-27" → PRJ-FY26-27-AB12.
const generateProjectCode = (fy) => {
  const yearKey = fy.current?.year_key ?? yearKeyFor(fy.startMonth, fy.today);
  const label = (fy.current?.label || fyLabel(fy.startMonth, yearKey)).replace(/^FY\s*/, "");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PRJ-FY${label.slice(2)}-${rand}`;
};

const removeEmojis = (e) => {
  const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
  if (emojiRegex.test(e.target.value)) {
    e.target.value = e.target.value.replace(emojiRegex, "");
  }
};

export default function CreateProject() {
  const { t } = useTranslation("projects");
  const fy = useFiscalYear();
  const photoRef = useRef();
  const [photo, setPhoto] = useState(null);
  const uploading = false;
  const [submitted, setSubmitted] = useState(false);
  // Static build: the created project is handed to the list via navigation state.
  const [createdProject, setCreatedProject] = useState(null);

  const navigate = useNavigate();
  const officeList = HEAD_OFFICES;
  const createLoading = false;

  // Location state
  const [position, setPosition] = useState(null);
  const [address, setAddress] = useState("");
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [locationError, setLocationError] = useState(false);

  const [cityQuery, setCityQuery] = useState("");
  // Tracks the actual selected office_id (form input is for display only)
  const [selectedOfficeId, setSelectedOfficeId] = useState(null);
  const [officeError, setOfficeError] = useState(false);
  const [selectedCityId, setSelectedCityId] = useState(null);



  const list = searchCities(cityQuery);

  const {
    register,
    handleSubmit,
    formState: { errors },
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

  const onSubmit = async (data) => {
    if (!position) {
      setLocationError(true);
      return;
    }
    if (!selectedOfficeId) {
      setOfficeError(true);
      return;
    }
    setLocationError(false);
    setOfficeError(false);

    // Static build: a picked photo is kept as its local preview URL.
    const photoUrl = photo || null;

    const payload = {
      project_name: data.projectName.trim(),
      project_code: generateProjectCode(fy),
      description: data.description?.trim() || null,
      project_location: address || null,
      start_date: data.startDate || null,
      end_date: data.endDate || null,
      office_id: selectedOfficeId,
      city_id: selectedCityId,
      lat: position.lat,
      lng: position.lng,
      radius_meters: Number(data.radius) || null,
      allow_offline_attendance: !!data.allowOffline,
      status: formStatusToApi(data.status),
      photo_url: photoUrl,
    };

    const office = officeList.find((o) => getOfficeId(o) == selectedOfficeId);
    setCreatedProject({ ...payload, office, city_name: watch("city") || null });
    toast.success(t("create.toast.created"));
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

  const currentOfficeOptions = officeList.map((o) => ({ label: o.office_name, value: getOfficeId(o) }));
  const initialOfficeName = watch("officeName");
  if (selectedOfficeId && initialOfficeName && !currentOfficeOptions.some((o) => String(o.value) === String(selectedOfficeId))) {
    currentOfficeOptions.unshift({ label: initialOfficeName, value: selectedOfficeId });
  }

  const currentCityOptions = list?.map((c) => ({ label: c.city_name, value: c.id })) || [];
  const initialCityName = watch("city");
  if (selectedCityId && initialCityName && !currentCityOptions.some((o) => String(o.value) === String(selectedCityId))) {
    currentCityOptions.unshift({ label: initialCityName, value: selectedCityId });
  }

  return (
    <>
      <SuccessModal
        isOpen={submitted}
        onClose={() => {
          setSubmitted(false);
          navigate("/admin/projects", { state: { createdProject } });
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
          <form onSubmit={handleSubmit(onSubmit)}>
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
                      onClick={() => setPhoto(null)}
                      className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
                    >
                      {t("buttons.remove")}
                    </button>
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
                {/* Office Dropdown — fed from redux office.list */}
                <div className="relative">
                  <label className={labelCls}>
                    {t("create.fields.officeName")}
                  </label>
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

                  {locationError && !position && (
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
                      options={STATUS_OPTIONS.map((item) => ({
                        label: t(item.labelKey),
                        value: item.value
                      }))}
                    />
                  </div>
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
                        const startDate = watch("startDate");
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

              {/* Row 5: Radius + City */}
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

                {/* City Dropdown (UI-only, not sent to API) */}
                <div className="relative">
                  <label className={labelCls}>{t("create.fields.city")}</label>
                  <CustomDropdown
                    value={selectedCityId || ""}
                    onChange={(e) => {
                      setSelectedCityId(e.target.value);
                      const selectedCity = list?.find((c) => c.id == e.target.value);
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
