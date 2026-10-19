import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  MdOutlineError,
  MdOutlineLock,
  MdOutlineVisibility,
  MdOutlineVisibilityOff,
} from "react-icons/md";
import { toast } from "react-toastify";
import ConfirmationModal from "../../components/ConfirmationModal";
import { STAFFING_PROFILE } from "../../data/groupH";

// ── Shared input styles ───────────────────────────────────────────────────────
const inputBase =
  "w-full px-4 py-3 border rounded-lg text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition bg-white";
const inputCls = (err) =>
  `${inputBase} ${err ? "border-red-400 bg-red-50" : "border-gray-200"}`;
const labelCls = "block text-xs font-semibold text-gray-500 mb-1.5";

const FieldErr = ({ error }) =>
  error ? (
    <p className="flex items-center gap-1 text-xs text-red-500 mt-1.5">
      <MdOutlineError className="flex-shrink-0" />
      {error.message}
    </p>
  ) : null;

export default function StaffingCompanyProfile() {
  const { t } = useTranslation("staffing");
  const loading = false;
  const savingProfile = false;
  const savingPw = false;

  // Profile Form
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ defaultValues: STAFFING_PROFILE });

  // Password Form
  const {
    register: regPw,
    handleSubmit: handlePw,
    reset: resetPw,
    watch: watchPw,
    formState: { errors: pwErrors },
  } = useForm();

  const newPw = watchPw("newPassword", "");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirm, setConfirm] = useState(null);

  // Static build: keep the saved values in the form (code/email stay read-only).
  const onProfileSave = (data) => {
    reset({ ...data, code: STAFFING_PROFILE.code, email: STAFFING_PROFILE.email });
    toast.success(t("profile.toast.updateSuccess"));
  };

  const onPasswordUpdate = () => {
    toast.success(t("profile.toast.passwordSuccess"));
    resetPw();
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
          {t("profile.title")}
        </h1>
        <p className="text-gray-500 mt-1 text-sm">
          {t("profile.subtitle")}
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left: General Information */}
        <div className="flex-1 space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-5 lg:p-6 space-y-5">
            <h3 className="text-base font-bold text-gray-900">
              {t("profile.generalInformation")}
            </h3>

            {/* Company Name & Code */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>{t("profile.fields.companyName")}</label>
                <input
                  {...register("name", {
                    required: t("profile.validation.companyNameRequired"),
                    minLength: { value: 2, message: t("profile.validation.tooShort") },
                  })}
                  className={inputCls(errors.name)}
                />
                <FieldErr error={errors.name} />
              </div>
              <div>
                <label className={labelCls}>{t("profile.fields.companyCode")}</label>
                <input
                  {...register("code")}
                  readOnly
                  className={inputCls(false)}
                />
              </div>
            </div>

            {/* Email + Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>{t("profile.fields.emailAddress")}</label>
                <input
                  {...register("email")}
                  type="email"
                  readOnly
                  className={inputCls(false)}
                />
              </div>
              <div>
                <label className={labelCls}>{t("profile.fields.phoneNumber")}</label>
                <input
                  {...register("phone", {
                    pattern: {
                      value: /^[0-9]{6,15}$/,
                      message: t("profile.validation.invalidPhone")
                    }
                  })}
                  type="tel"
                  maxLength={15}
                  onInput={(e) => {
                    e.target.value = e.target.value.replace(/\D/g, "");
                  }}
                  className={inputCls(errors.phone)}
                />
                <FieldErr error={errors.phone} />
              </div>
            </div>

            {/* City */}
            <div>
              <label className={labelCls}>{t("profile.fields.city")}</label>
              <input
                {...register("city", {
                  pattern: {
                    value: /^[A-Za-z\s-]+$/,
                    message: t("profile.validation.cityInvalid"),
                  },
                })}
                onInput={(e) => {
                  e.target.value = e.target.value.replace(/[^A-Za-z\s-]/g, "");
                }}
                className={inputCls(errors.city)}
              />
              <FieldErr error={errors.city} />
            </div>

            {/* Address */}
            <div>
              <label className={labelCls}>{t("profile.fields.address")}</label>
              <textarea
                {...register("address")}
                rows={3}
                className={inputCls(errors.address) + " resize-none"}
              />
              <FieldErr error={errors.address} />
            </div>

            <div className="border-t border-gray-100 pt-5 mt-5">
              <h4 className="text-sm font-bold text-gray-900 mb-4">
                {t("profile.primaryContactPerson")}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>{t("profile.fields.name")}</label>
                  <input
                    {...register("contact_person_name")}
                    className={inputCls(errors.contact_person_name)}
                  />
                  <FieldErr error={errors.contact_person_name} />
                </div>
                <div>
                  <label className={labelCls}>{t("profile.fields.email")}</label>
                  <input
                    {...register("contact_person_email", {
                      pattern: {
                        value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                        message: t("profile.validation.invalidEmail"),
                      },
                    })}
                    type="email"
                    className={inputCls(errors.contact_person_email)}
                  />
                  <FieldErr error={errors.contact_person_email} />
                </div>
                <div>
                  <label className={labelCls}>{t("profile.fields.phone")}</label>
                  <input
                    {...register("contact_person_phone", {
                      pattern: {
                        value: /^[0-9]{6,15}$/,
                        message: t("profile.validation.invalidPhone")
                      }
                    })}
                    type="tel"
                    maxLength={15}
                    onInput={(e) => {
                      e.target.value = e.target.value.replace(/\D/g, "");
                    }}
                    className={inputCls(errors.contact_person_phone)}
                  />
                  <FieldErr error={errors.contact_person_phone} />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end pt-4 border-t border-gray-100">
              <button
                type="button"
                disabled={savingProfile}
                onClick={handleSubmit((data) => setConfirm({
                  title: t("profile.confirm.saveTitle"),
                  message: t("profile.confirm.saveMessage"),
                  confirmText: t("profile.buttons.saveChanges"),
                  type: "status",
                  action: () => onProfileSave(data)
                }))}
                className="w-full sm:w-auto px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors text-white bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50"
              >
                {savingProfile ? t("profile.buttons.saving") : t("profile.buttons.saveChanges")}
              </button>
            </div>
          </div>

          {/* Change Password */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 lg:p-6">
            <div className="flex items-center gap-2 mb-5 pb-4 border-b border-gray-100">
              <MdOutlineLock className="text-cyan-600 text-xl" />
              <h3 className="text-base font-bold text-gray-900">
                {t("profile.changePassword")}
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
              {/* Current */}
              <div>
                <label
                  className={labelCls + " uppercase tracking-wider text-[10px]"}
                >
                  {t("profile.fields.currentPassword")}
                </label>
                <div className="relative">
                  <input
                    {...regPw("currentPassword", { required: t("profile.validation.required") })}
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
                  {t("profile.fields.newPassword")}
                </label>
                <div className="relative">
                  <input
                    {...regPw("newPassword", {
                      required: t("profile.validation.required"),
                      minLength: { value: 8, message: t("profile.validation.minPassword") },
                      pattern: {
                        value: /^(?=.*[A-Z])(?=.*\d)/,
                        message: t("profile.validation.passwordPattern"),
                      },
                    })}
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
                  {t("profile.fields.confirmPassword")}
                </label>
                <div className="relative">
                  <input
                    {...regPw("confirmPassword", {
                      required: t("profile.validation.required"),
                      validate: (v) => v === newPw || t("profile.validation.passwordMismatch"),
                    })}
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
                  title: t("profile.confirm.passwordTitle"),
                  message: t("profile.confirm.passwordMessage"),
                  confirmText: t("profile.buttons.updatePassword"),
                  type: "status",
                  action: () => onPasswordUpdate(data)
                }))}
                className="w-full sm:w-auto px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50"
              >
                {savingPw ? t("profile.buttons.updating") : t("profile.buttons.updatePassword")}
              </button>
            </div>
          </div>
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
          isLoading={savingProfile || savingPw}
        />
      )}
    </div>
  );
}
