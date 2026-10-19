import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import {
  MdInfoOutline,
  MdOutlineError,
  MdOutlineLock,
  MdOutlineVisibility,
  MdOutlineVisibilityOff,
} from "react-icons/md";
import Loader from "./Loader";
import { getStaticUser } from "../data/session";
import { myProfile } from "../data/groupB";
import CustomDropdown from "./CustomDropdown";
import ConfirmationModal from "./ConfirmationModal";
import useChangePassword from "../hooks/useChangePassword";

// ── Constants ─────────────────────────────────────────────────────────────────
// Values are persisted as-is; only the visible labels are translated.
const NATIONALITIES = [
  { value: "United States", labelKey: "personal.nationalities.unitedStates" },
  { value: "United Kingdom", labelKey: "personal.nationalities.unitedKingdom" },
  { value: "Canada", labelKey: "personal.nationalities.canada" },
  { value: "Australia", labelKey: "personal.nationalities.australia" },
  { value: "India", labelKey: "personal.nationalities.india" },
  { value: "Germany", labelKey: "personal.nationalities.germany" },
  { value: "France", labelKey: "personal.nationalities.france" },
  { value: "Japan", labelKey: "personal.nationalities.japan" },
  { value: "Brazil", labelKey: "personal.nationalities.brazil" },
  { value: "Other", labelKey: "personal.nationalities.other" },
];
// Backend ENUM is MALE / FEMALE / OTHER — values must stay as-is; only the
// visible labels are translated.
const GENDERS = [
  { value: "MALE", labelKey: "personal.genders.male" },
  { value: "FEMALE", labelKey: "personal.genders.female" },
  { value: "OTHER", labelKey: "personal.genders.other" },
];

const FieldErr = ({ error }) =>
  error ? (
    <p className="flex items-center gap-1 text-xs text-red-500 mt-1.5">
      <MdOutlineError className="flex-shrink-0" />
      {error.message}
    </p>
  ) : null;

const inputBase =
  "w-full px-4 py-3 border rounded-lg text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition bg-white";
const inputCls = (err) =>
  `${inputBase} ${err ? "border-red-400 bg-red-50" : "border-gray-200"}`;
const labelCls = "block text-xs font-semibold text-gray-500 mb-1.5";

const avatarFor = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name || "Employee",
  )}&background=1e3a5f&color=fff&size=120`;

function PersonalInformation() {
  const { t } = useTranslation("profile");
  const user = getStaticUser();
  const isEmployer = user?.role?.name?.toLowerCase() === "employer" || (typeof user?.role === "string" && user.role.toLowerCase() === "employer");
  const photoRef = useRef();
  // Static profile of the signed-in user (src/data/groupB.js).
  const [profile] = useState(() => myProfile());
  const [photo, setPhoto] = useState(() => profile.profile_url || avatarFor(profile.full_name));
  const [hasPhoto, setHasPhoto] = useState(() => !!profile.profile_url);
  const loading = false;
  const [savingProfile] = useState(false);
  const [photoBusy] = useState(false);

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      fullName: profile.full_name || profile.company_name || "",
      phone: profile.phone_number || "",
      email: profile.email || "",
      dob: profile.dob ? String(profile.dob).slice(0, 10) : "",
      nationality: profile.nationality || "",
      gender: profile.gender || "",
      address: profile.address || "",
      contactPerson: profile.contact_person_name || "",
    },
  });

  const {
    register: regPw,
    handleSubmit: handlePw,
    reset: resetPw,
    setError: setPwError,
    formState: { errors: pwErrors },
  } = useForm({ defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" } });

  // POST /auth/change-password, then the session picker (useChangePassword).
  const {
    rules: pwRules,
    submit: changePassword,
    saving: savingPw,
    picker: sessionPicker,
  } = useChangePassword({ setError: setPwError, successMessage: t("personal.toast.passwordChanged") });

  // Static build: saves are acknowledged locally (no request is sent).
  const onProfileSave = () => {
    toast.success(t("personal.toast.profileUpdated"));
  };

  const onPhotoSelected = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setPhoto(URL.createObjectURL(file));
    setHasPhoto(true);
    toast.success(t("personal.toast.photoUpdated"));
  };

  const onPhotoDelete = () => {
    setHasPhoto(false);
    setPhoto(avatarFor("Employee"));
    toast.success(t("personal.toast.photoRemoved"));
  };

  const onPasswordUpdate = async (data) => {
    if (await changePassword(data)) resetPw();
  };

  if (loading) {
    return <Loader label={t("personal.loading")} />;
  }

  return (
    <div className="space-y-5">
      {/* Profile Photo */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-base font-bold text-gray-900 mb-4">
          {t("personal.profilePhoto")}
        </h3>
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="flex justify-center sm:justify-start">
            <div className="relative">
              <img
                src={photo}
                alt={t("personal.photoAlt")}
                className="w-24 h-24 rounded-full object-cover border-4 border-gray-200"
              />
            </div>
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-400 mb-3">
              {t("personal.photoHint")}
            </p>
            <div className="flex items-center gap-4">
              <button
                type="button"
                disabled={photoBusy}
                onClick={() => photoRef.current.click()}
                className="text-sm font-bold text-amber-500 hover:text-amber-600 transition-colors disabled:opacity-50"
              >
                {photoBusy ? t("personal.working") : t("personal.change")}
              </button>
              <button
                type="button"
                disabled={photoBusy || !hasPhoto}
                onClick={() => setConfirm({
                  title: t("personal.confirm.deletePhotoTitle"),
                  message: t("personal.confirm.deletePhotoMessage"),
                  confirmText: t("personal.delete"),
                  type: "delete",
                  action: () => onPhotoDelete()
                })}
                className="text-sm font-bold text-red-500 hover:text-red-600 transition-colors disabled:opacity-40"
              >
                {t("personal.delete")}
              </button>
            </div>
          </div>
          <input
            ref={photoRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            className="hidden"
            onChange={onPhotoSelected}
          />
        </div>
      </div>

      {/* Basic Details */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 lg:p-6">
        <div className="flex items-center justify-between mb-5 pb-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900">
            {t("personal.basicDetails")}
          </h3>
          <MdInfoOutline className="text-gray-300 text-xl" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className={labelCls}>{isEmployer ? t("personal.companyName") : t("personal.fullName")}</label>
            <input
              {...register("fullName", {
                required: t("personal.validation.nameRequired"),
                validate: {
                  noOnlySpaces: (value) =>
                    value.trim() !== "" || t("personal.validation.nameEmpty"),
                  minLength: (value) =>
                    value.trim().length >= 2 ||
                    t("personal.validation.nameMinLength"),
                },
              })}
              className={inputCls(errors.fullName)}
              onInput={(e) => {
                e.target.value = e.target.value.replace(/^\s+/, "");
              }}
            />
            <FieldErr error={errors.fullName} />
          </div>

          {isEmployer && (
            <div>
              <label className={labelCls}>{t("personal.contactPerson")}</label>
              <input
                {...register("contactPerson", {
                  required: t("personal.validation.contactPersonRequired"),
                  validate: {
                    noOnlySpaces: (value) =>
                      value.trim() !== "" || t("personal.validation.cannotBeEmpty"),
                  },
                })}
                className={inputCls(errors.contactPerson)}
                onInput={(e) => {
                  e.target.value = e.target.value.replace(/^\s+/, "");
                }}
              />
              <FieldErr error={errors.contactPerson} />
            </div>
          )}

          <div>
            <label className={labelCls}>{t("personal.phone")}</label>
            <input
              {...register("phone", {
                pattern: {
                  value: /^[0-9]{6,15}$/,
                  message: t("personal.validation.phoneInvalid"),
                },
              })}
              className={inputCls(errors.phone)}
            />
            <FieldErr error={errors.phone} />
          </div>

          <div>
            <label className={labelCls}>{t("personal.email")}</label>
            <input
              {...register("email")}
              type="email"
              className={inputCls(false) + " bg-gray-50 cursor-not-allowed"}
              readOnly
            />
          </div>

          {!isEmployer && (
            <>
              <div>
                <label className={labelCls}>{t("personal.dob")}</label>
                <input
                  type="date"
                  {...register("dob", {
                    required: t("personal.validation.dobRequired"),
                    validate: (value) => {
                      if (!value) return true;

                      const date = new Date(value); // value is YYYY-MM-DD
                      const today = new Date();

                      date.setHours(0, 0, 0, 0);
                      today.setHours(0, 0, 0, 0);

                      return (
                        date <= today || t("personal.validation.dobFuture")
                      );
                    },
                  })}
                  className={inputCls(errors.dob)}
                />
                <FieldErr error={errors.dob} />
              </div>

              <div>
                <label className={labelCls}>{t("personal.nationality")}</label>
                <CustomDropdown
                  {...register("nationality")}
                  error={!!errors.nationality}
                  options={[
                    { label: t("personal.selectNationality"), value: "" },
                    ...NATIONALITIES.map((n) => ({ label: t(n.labelKey), value: n.value }))
                  ]}
                />
              </div>

              <div>
                <label className={labelCls}>{t("personal.gender")}</label>
                <CustomDropdown
                  {...register("gender")}
                  options={[
                    { label: t("personal.selectGender"), value: "" },
                    ...GENDERS.map((g) => ({ label: t(g.labelKey), value: g.value }))
                  ]}
                />
              </div>
            </>
          )}
        </div>

        <div className="mb-5">
          <label className={labelCls}>{t("personal.address")}</label>
          <textarea
            {...register("address", {
              validate: {
                validChars: (value) => {
                  if (!value || value.trim() === "") return true;
                  return /^[A-Za-z0-9,\s-]+$/.test(value.trim()) || t("personal.validation.addressInvalid");
                }
              }
            })}
            rows={3}
            className={inputCls(errors.address) + " resize-none"}
            onInput={(e) => {
              e.target.value = e.target.value.replace(/^\s+/, "");
            }}
          />
          <FieldErr error={errors.address} />
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            disabled={savingProfile}
            onClick={handleSubmit((data) => setConfirm({
              title: t("personal.saveChanges"),
              message: t("personal.confirm.saveChangesMessage"),
              confirmText: t("personal.saveChanges"),
              type: "status",
              action: () => onProfileSave(data)
            }))}
            className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50"
          >
            {savingProfile ? t("personal.saving") : t("personal.saveChanges")}
          </button>
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 lg:p-6">
        <div className="flex items-center gap-2 mb-5 pb-4 border-b border-gray-100">
          <MdOutlineLock className="text-cyan-600 text-xl" />
          <h3 className="text-base font-bold text-gray-900">
            {t("personal.changePassword")}
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          {/* Current */}
          <div>
            <label
              className={labelCls + " uppercase tracking-wider text-[10px]"}
            >
              {t("personal.currentPassword")}
            </label>
            <div className="relative">
              <input
                {...regPw("currentPassword", pwRules.currentPassword)}
                type={showCurrent ? "text" : "password"}
                className={inputCls(pwErrors.currentPassword) + " pe-10"}
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showCurrent ? (
                  <MdOutlineVisibilityOff />
                ) : (
                  <MdOutlineVisibility />
                )}
              </button>
            </div>
            <FieldErr error={pwErrors.currentPassword} />
          </div>

          {/* New */}
          <div>
            <label
              className={labelCls + " uppercase tracking-wider text-[10px]"}
            >
              {t("personal.newPassword")}
            </label>
            <div className="relative">
              <input
                {...regPw("newPassword", pwRules.newPassword)}
                type={showNew ? "text" : "password"}
                className={inputCls(pwErrors.newPassword) + " pe-10"}
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showNew ? <MdOutlineVisibilityOff /> : <MdOutlineVisibility />}
              </button>
            </div>
            <FieldErr error={pwErrors.newPassword} />
          </div>

          {/* Confirm */}
          <div>
            <label
              className={labelCls + " uppercase tracking-wider text-[10px]"}
            >
              {t("personal.confirmPassword")}
            </label>
            <div className="relative">
              <input
                {...regPw("confirmPassword", pwRules.confirmPassword)}
                type={showConfirm ? "text" : "password"}
                className={inputCls(pwErrors.confirmPassword) + " pe-10"}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showConfirm ? (
                  <MdOutlineVisibilityOff />
                ) : (
                  <MdOutlineVisibility />
                )}
              </button>
            </div>
            <FieldErr error={pwErrors.confirmPassword} />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            disabled={savingPw}
            onClick={handlePw((data) => setConfirm({
              title: t("personal.updatePassword"),
              message: t("personal.confirm.updatePasswordMessage"),
              confirmText: t("personal.updatePassword"),
              type: "status",
              action: () => onPasswordUpdate(data)
            }))}
            className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50"
          >
            {savingPw ? t("personal.updating") : t("personal.updatePassword")}
          </button>
        </div>
      </div>

      {confirm && (
        <ConfirmationModal
          isOpen={!!confirm}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await confirm.action();
            setConfirm(null);
          }}
          title={confirm.title}
          message={confirm.message}
          type={confirm.type}
          confirmText={confirm.confirmText}
          isLoading={savingProfile || photoBusy || savingPw}
        />
      )}

      {sessionPicker}
    </div>
  );
}

export default PersonalInformation;
