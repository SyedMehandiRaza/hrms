import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import {
  MdOutlineEmail,
  MdOutlineLock,
  MdOutlineBusiness,
  MdOutlinePerson,
  MdOutlinePhone,
  MdOutlineVisibility,
  MdOutlineVisibilityOff,
} from "react-icons/md";
import { BsGlobe } from "react-icons/bs";
import AuthLeft from "../../components/AuthLeft";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import * as authApi from "../../api/auth";
import { establishSession } from "../../hooks/useSession";
import { PANEL_HOME } from "../../data/sessionStore";
import { apiErrorMessage } from "../../utils/apiError";
import { applyFieldErrors } from "../../utils/applyFieldErrors";
import { isStrongPassword } from "../../utils/passwordRule";
import PhoneCountrySelect from "../../components/geo/PhoneCountrySelect";
import { DEFAULT_PHONE_COUNTRY, phoneRule } from "../../utils/phone";

// The server trims these too; the rules run on the trimmed value.
const trim = (v) => (typeof v === "string" ? v.trim() : v);

// Server field → form input (the others keep their names).
const FIELD_MAP = { name: "contactPersonName", phone: "phoneNumber" };
const KNOWN_FIELDS = ["companyName", "contactPersonName", "email", "phoneNumber", "phoneCountry", "password", "confirmPassword"];

function SignUp() {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // In flight: the button is disabled and shows "Creating Account...".
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    getValues,
    formState: { errors },
  } = useForm({
    defaultValues: {
      companyName: "",
      contactPersonName: "",
      email: "",
      phoneNumber: "",
      phoneCountry: DEFAULT_PHONE_COUNTRY,
      password: "",
      confirmPassword: "",
    },
  });

  // Sign up logs the owner in (refresh cookie + access token) and lands on the
  // Admin dashboard. On an error the typed values stay in the form.
  const onSubmit = async (values) => {
    if (loading) return;
    setLoading(true);
    try {
      const data = await authApi.signup({
        companyName: values.companyName,
        name: values.contactPersonName,
        email: values.email,
        // Optional; sent with its phone country and stored as E.164 (countries-cities-phones D15–D19).
        phone: values.phoneNumber || undefined,
        phoneCountry: values.phoneNumber ? values.phoneCountry : undefined,
        password: values.password,
        confirmPassword: values.confirmPassword,
      });
      await establishSession({
        accessToken: data.accessToken,
        mustChangePassword: data.mustChangePassword,
        me: data.me,
      });
      toast.success(t("signup.success"));
      navigate(PANEL_HOME.admin, { replace: true });
    } catch (err) {
      const { mapped } = applyFieldErrors(err, setError, { fieldMap: FIELD_MAP, knownFields: KNOWN_FIELDS });
      if (mapped.length === 0) toast.error(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (hasError) =>
    `w-full ps-12 pe-4 py-3 bg-gray-100 border rounded-lg focus:outline-none focus:ring-2 focus:bg-white transition-all ${
      hasError
        ? "border-red-500 focus:ring-red-500"
        : "border-gray-200 focus:ring-cyan-500"
    }`;

  return (
    <div className="flex min-h-screen bg-white">
      {/* Left Side - Branding */}
      <AuthLeft />

      {/* Right Side - Sign Up Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 sm:px-8 py-12 bg-white">
        <div className="w-full max-w-sm">
          {/* Mobile Logo */}
          <div className="lg:hidden mb-8 text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-8 h-8 bg-cyan-400 rounded-full flex items-center justify-center">
                <BsGlobe className="text-blue-900 text-lg" />
              </div>
              <span className="text-blue-900 text-xl font-bold">
                {t("brand")}
              </span>
            </div>
          </div>

          {/* Form Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-blue-900 mb-2">
              {t("signup.title")}
            </h1>
            <p className="text-gray-600">{t("signup.subtitle")}</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
            {/* Company Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t("signup.companyNameLabel")}
              </label>
              <div className="relative">
                <MdOutlineBusiness className="absolute start-4 top-4 text-gray-400 text-lg" />
                <input
                  type="text"
                  placeholder={t("signup.companyNamePlaceholder")}
                  {...register("companyName", {
                    setValueAs: trim,
                    required: t("validation.companyNameRequired"),
                    minLength: {
                      value: 2,
                      message: t("validation.companyNameMin"),
                    },
                    maxLength: {
                      value: 100,
                      message: t("validation.companyNameMax"),
                    },
                  })}
                  className={inputClass(errors.companyName)}
                />
              </div>
              {errors.companyName && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.companyName.message}
                </p>
              )}
            </div>

            {/* Contact Person Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t("signup.contactNameLabel")}
              </label>
              <div className="relative">
                <MdOutlinePerson className="absolute start-4 top-4 text-gray-400 text-lg" />
                <input
                  type="text"
                  placeholder={t("signup.contactNamePlaceholder")}
                  {...register("contactPersonName", {
                    setValueAs: trim,
                    required: t("validation.yourNameRequired"),
                    minLength: {
                      value: 2,
                      message: t("validation.nameMin"),
                    },
                    maxLength: {
                      value: 100,
                      message: t("validation.nameMax"),
                    },
                  })}
                  className={inputClass(errors.contactPersonName)}
                />
              </div>
              {errors.contactPersonName && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.contactPersonName.message}
                </p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t("signup.emailLabel")}
              </label>
              <div className="relative">
                <MdOutlineEmail className="absolute start-4 top-4 text-gray-400 text-lg" />
                <input
                  type="email"
                  placeholder={t("signup.emailPlaceholder")}
                  {...register("email", {
                    setValueAs: trim,
                    required: t("more.emailIsRequired"),
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: t("more.invalidEmailAddress"),
                    },
                  })}
                  className={inputClass(errors.email)}
                />
              </div>
              {errors.email && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Phone (optional) */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t("signup.phoneLabel")}
              </label>
              <div className="flex gap-2">
                <div className="shrink-0 min-w-27.5">
                  <PhoneCountrySelect
                    {...register("phoneCountry")}
                    error={!!errors.phoneCountry}
                    className="py-3! bg-gray-100!"
                  />
                </div>
                <div className="relative grow">
                  <MdOutlinePhone className="absolute start-4 top-4 text-gray-400 text-lg" />
                  <input
                    type="tel"
                    placeholder={t("signup.phonePlaceholder")}
                    {...register("phoneNumber", {
                      // Optional; a valid number of the chosen phone country (the server's rule).
                      setValueAs: trim,
                      validate: phoneRule(() => getValues("phoneCountry"), t),
                    })}
                    className={inputClass(errors.phoneNumber)}
                  />
                </div>
              </div>
              {(errors.phoneNumber || errors.phoneCountry) && (
                <p className="text-red-500 text-xs mt-1">
                  {(errors.phoneNumber || errors.phoneCountry).message}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t("signup.passwordLabel")}
              </label>
              <div className="relative">
                <MdOutlineLock className="absolute start-4 top-4 text-gray-400 text-lg" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder={t("signup.passwordPlaceholder")}
                  {...register("password", {
                    // No separate "required" text on sign up (§7.2): empty gets the rule text.
                    validate: (value) => isStrongPassword(value) || t("validation.passwordWeak"),
                  })}
                  className={`${inputClass(errors.password)} pe-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute end-4 top-4 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <MdOutlineVisibilityOff className="text-lg" />
                  ) : (
                    <MdOutlineVisibility className="text-lg" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t("signup.confirmPasswordLabel")}
              </label>
              <div className="relative">
                <MdOutlineLock className="absolute start-4 top-4 text-gray-400 text-lg" />
                <input
                  type={showConfirm ? "text" : "password"}
                  placeholder={t("signup.confirmPasswordPlaceholder")}
                  {...register("confirmPassword", {
                    required: t("more.pleaseConfirmYourPassword"),
                    validate: (value, formValues) =>
                      value === formValues.password || t("validation.passwordsDoNotMatch"),
                  })}
                  className={`${inputClass(errors.confirmPassword)} pe-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute end-4 top-4 text-gray-400 hover:text-gray-600"
                >
                  {showConfirm ? (
                    <MdOutlineVisibilityOff className="text-lg" />
                  ) : (
                    <MdOutlineVisibility className="text-lg" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r cursor-pointer from-cyan-500 to-cyan-600 text-white font-semibold rounded-lg hover:from-cyan-600 hover:to-cyan-700 transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  {t("signup.creating")}
                </>
              ) : (
                t("signup.createAccount")
              )}
            </button>
          </form>

          {/* Back to Login */}
          <p className="text-center text-gray-600 text-sm mt-8">
            {t("signup.haveAccount")}{" "}
            <Link
              to="/login"
              className="text-blue-600 font-semibold hover:text-blue-700 transition-colors"
            >
              {t("signup.signIn")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default SignUp;
