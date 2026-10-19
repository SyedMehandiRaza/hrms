import { useState } from "react";
import { useNavigate, useLocation, Link, Navigate } from "react-router-dom";
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
import * as authApi from "../../api/auth";
import { establishSession, useSession } from "../../hooks/useSession";
import { PANEL_HOME, sessionStore } from "../../data/sessionStore";
import { apiErrorCode, apiErrorMessage } from "../../utils/apiError";
import { applyFieldErrors } from "../../utils/applyFieldErrors";

const INACTIVE_CODES = new Set(["AUTH_ACCOUNT_INACTIVE", "AUTH_COMPANY_INACTIVE"]);

// Where a logged-in user goes: the page they were sent here from (only when it
// belongs to their own panel), else their panel's dashboard.
const landingPath = (panel, from) => {
  const home = PANEL_HOME[panel];
  if (!home) return null;
  const path = from?.pathname;
  if (path && (path === `/${panel}` || path.startsWith(`/${panel}/`))) {
    return `${path}${from.search || ""}${from.hash || ""}`;
  }
  return home;
};

function Login() {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const location = useLocation();
  const { status, me } = useSession();
  const [showPassword, setShowPassword] = useState(false);
  // In flight: the button is disabled and shows "Signing In...".
  const [loading, setLoading] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
  });
  const from = location.state?.from;

  const onSubmit = async ({ email, password }) => {
    if (loading) return;
    setLoading(true);
    try {
      const data = await authApi.login({ email, password });
      const session = await establishSession({
        accessToken: data.accessToken,
        mustChangePassword: data.mustChangePassword,
      });
      // The login answer's flag wins (ticket 20 opens the forced-change modal from it).
      if (data.mustChangePassword) sessionStore.setMustChangePassword(true);
      const target = landingPath(session.me?.account?.panel, from);
      if (!target) throw new Error("Unknown panel");
      toast.success(t("more.loginSuccessfull"));
      navigate(target, { replace: true });
    } catch (err) {
      const code = apiErrorCode(err);
      if (INACTIVE_CODES.has(code)) {
        // /auth/login is skipped by the client interceptor, so access ends here (once).
        const message = err.response.data.message || null;
        sessionStore.endAccess(message);
        navigate("/access-ended", { replace: true, state: { message } });
        return;
      }
      // An inactive answer from /auth/me was already sent to /access-ended by the interceptor.
      if (sessionStore.getState().accessEnded) return;
      // No half-made session (e.g. /auth/me failed after a good login).
      sessionStore.clear();
      const { mapped } = applyFieldErrors(err, setError, { knownFields: ["email", "password"] });
      if (mapped.length === 0) toast.error(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Already logged in (e.g. /login opened in a new tab) → their dashboard.
  // Not while submitting: the submit navigates by itself.
  if (status === "authenticated" && me && !loading) {
    const target = landingPath(me.account?.panel, from);
    if (target) return <Navigate to={target} replace />;
  }

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
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
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
                    // The server trims the email too.
                    setValueAs: (v) => (typeof v === "string" ? v.trim() : v),
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
                    // Login only checks presence (D17), never the format.
                    required: t("more.passwordIsRequired"),
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
