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

function SignUp() {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const loading = false;

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      companyName: "",
      contactPersonName: "",
      email: "",
      phoneNumber: "",
      password: "",
      confirmPassword: "",
    },
  });

  // Watch the password so the confirm field can validate against it.
  const passwordValue = watch("password");

  const onSubmit = () => {
    toast.success(t("signup.success"));
    navigate("/login");
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
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
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
                    required: t("validation.companyNameRequired"),
                    minLength: {
                      value: 2,
                      message: t("validation.companyNameMin"),
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
                    required: t("validation.yourNameRequired"),
                    minLength: {
                      value: 2,
                      message: t("validation.nameMin"),
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
              <div className="relative">
                <MdOutlinePhone className="absolute start-4 top-4 text-gray-400 text-lg" />
                <input
                  type="tel"
                  placeholder={t("signup.phonePlaceholder")}
                  {...register("phoneNumber", {
                    pattern: {
                      value: /^[0-9+\-\s()]{6,20}$/,
                      message: t("validation.invalidPhone"),
                    },
                  })}
                  className={inputClass(errors.phoneNumber)}
                />
              </div>
              {errors.phoneNumber && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.phoneNumber.message}
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
                    required: t("more.passwordIsRequired"),
                    minLength: {
                      value: 8,
                      message: t("more.passwordMustBeAtLeast"),
                    },
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
                    validate: (value) =>
                      value === passwordValue || t("validation.passwordsDoNotMatch"),
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
