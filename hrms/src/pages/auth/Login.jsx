import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import {
  MdOutlineEmail,
  MdOutlineLock,
  MdOutlineVisibility,
  MdOutlineVisibilityOff,
} from "react-icons/md";
import { BsGlobe } from "react-icons/bs";
import AuthLeft from "../../components/AuthLeft";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";

function Login() {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
  });
  const loading = false;

  // Static build: any valid form signs in to the admin panel.
  const onSubmit = () => {
    toast.success(t("more.loginSuccessfull"));
    navigate("/admin/dashboard");
  };

  return (
    <div className="flex min-h-screen bg-white">
      {/* Left Side - Branding */}
      <AuthLeft />
      {/* Right Side - Login Form */}
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
              {t("login.welcome")}
            </h1>
            <p className="text-gray-600">{t("login.subtitle")}</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Email Input */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                {t("login.emailLabel")}
              </label>
              <div className="relative">
                <MdOutlineEmail className="absolute start-4 top-4 text-gray-400 text-lg" />
                <input
                  type="email"
                  placeholder={t("login.emailPlaceholder")}
                  {...register("email", {
                    required: t("more.emailIsRequired"),
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: t("more.invalidEmailAddress"),
                    },
                  })}
                  className={`w-full ps-12 pe-4 py-3 bg-gray-100 border rounded-lg focus:outline-none focus:ring-2 focus:bg-white transition-all ${errors.email
                      ? "border-red-500 focus:ring-red-500"
                      : "border-gray-200 focus:ring-cyan-500"
                    }`}
                />
              </div>
              {errors.email && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                {t("login.passwordLabel")}
              </label>

              <div className="relative">
                <MdOutlineLock className="absolute start-4 top-4 text-gray-400 text-lg" />

                <input
                  type={showPassword ? "text" : "password"}
                  placeholder={t("login.passwordPlaceholder")}
                  {...register("password", {
                    required: t("more.passwordIsRequired"),
                    minLength: {
                      value: 8,
                      message: t("more.passwordMustBeAtLeast"),
                    },
                  })}
                  className={`w-full ps-12 pe-12 py-3 bg-gray-100 border rounded-lg focus:outline-none focus:ring-2 focus:bg-white transition-all ${errors.password
                      ? "border-red-500 focus:ring-red-500"
                      : "border-gray-200 focus:ring-cyan-500"
                    }`}
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

            {/* Forgot Password */}
            <div className="text-end">
              <Link
                to="/forgot-password"
                className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
              >
                {t("login.forgotPassword")}
              </Link>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r cursor-pointer from-cyan-500 to-cyan-600 text-white font-semibold rounded-lg hover:from-cyan-600 hover:to-cyan-700 transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  {t("login.signingIn")}
                </>
              ) : (
                t("login.signIn")
              )}
            </button>
          </form>

          {/* Sign Up Link */}
          <p className="text-center text-gray-600 text-sm mt-8">
            {t("login.noAccount")}{" "}
            <Link
              to="/signup"
              className="text-blue-600 font-semibold hover:text-blue-700 transition-colors"
            >
              {t("login.signUp")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
