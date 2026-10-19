import { useEffect, useState } from "react";
import { useNavigate, useLocation, useSearchParams, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { MdLock, MdVisibility, MdVisibilityOff } from "react-icons/md";
import { BsGlobe } from "react-icons/bs";
import AuthLeft from "../../components/AuthLeft";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import * as authApi from "../../api/auth";
import { establishSession } from "../../hooks/useSession";
import { PANEL_HOME, sessionStore } from "../../data/sessionStore";
import { apiErrorCode, apiErrorMessage } from "../../utils/apiError";
import { applyFieldErrors } from "../../utils/applyFieldErrors";
import { isStrongPassword } from "../../utils/passwordRule";

// Dead token/link: the form can't be used any more, only the message (and, for a
// reset, the way back to Forgot Password) is shown.
const LINK_ERRORS = new Set(["AUTH_RESET_TOKEN_INVALID", "AUTH_SETUP_LINK_INVALID"]);
const REDIRECT_MS = 2000;

// Two modes, one design:
//   reset — after Verify OTP; the reset token comes in the navigation state.
//   set   — the welcome email's link /reset-password?setup=<token>; logs the person in.
function ResetPassword() {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const setupToken = searchParams.get("setup");
  const isSetup = setupToken !== null;
  const resetToken = location.state?.resetToken;

  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  // In flight: the button is disabled and shows "Resetting Password...".
  const [loading, setLoading] = useState(false);
  // The server's message for a dead token/link.
  const [linkError, setLinkError] = useState(null);
  // Reset mode opened without a token (e.g. directly): nothing to send.
  const blockedMessage =
    linkError || (!isSetup && !resetToken ? t("more.resetTokenNotFoundPlease") : null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  // After a reset: "Redirecting to login page..." then the login screen.
  useEffect(() => {
    if (!success) return undefined;
    const timer = setTimeout(() => navigate("/login", { replace: true }), REDIRECT_MS);
    return () => clearTimeout(timer);
  }, [success, navigate]);

  const onSubmit = async ({ newPassword, confirmPassword }) => {
    if (loading || blockedMessage) return;
    setLoading(true);
    let sessionSet = false;
    try {
      if (isSetup) {
        const data = await authApi.setupPassword({ token: setupToken, newPassword, confirmPassword });
        sessionSet = true;
        const session = await establishSession({
          accessToken: data.accessToken,
          mustChangePassword: data.mustChangePassword,
        });
        const target = PANEL_HOME[session.me?.account?.panel];
        if (!target) throw new Error("Unknown panel");
        navigate(target, { replace: true });
      } else {
        await authApi.resetPassword({ resetToken, newPassword, confirmPassword });
        toast.success(t("more.passwordResetSuccessfully"));
        setSuccess(true);
      }
    } catch (err) {
      // An inactive answer was already sent to /access-ended by the interceptor.
      if (sessionStore.getState().accessEnded) return;
      // No half-made session (e.g. /auth/me failed after the password was set).
      if (sessionSet) sessionStore.clear();
      if (LINK_ERRORS.has(apiErrorCode(err))) {
        setLinkError(apiErrorMessage(err));
        return;
      }
      const { mapped } = applyFieldErrors(err, setError, {
        knownFields: ["newPassword", "confirmPassword"],
      });
      if (mapped.length === 0) toast.error(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-white">
      {/* Left Side - Branding */}
      <AuthLeft />

      {/* Right Side - Reset Password Form */}
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
              {t("reset.title")}
            </h1>
            <p className="text-gray-600 text-sm">{t("reset.subtitle")}</p>
          </div>

          {/* Success Message */}
          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-700 text-sm font-semibold">
                ✓ {t("more.passwordResetSuccessfully")}
              </p>
            </div>
          )}

          {/* Form */}
          {!success && blockedMessage ? (
            <div className="text-center">
              <p className="text-red-500 text-sm">{blockedMessage}</p>
              {!isSetup && (
                <Link
                  to="/forgot-password"
                  className="inline-block mt-3 text-sm font-semibold text-cyan-600 hover:text-cyan-700 transition-colors"
                >
                  {t("login.forgotPassword")}
                </Link>
              )}
            </div>
          ) : !success ? (
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
              {/* New Password Input */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  {t("reset.newPasswordLabel")}
                </label>
                <div className="relative">
                  <MdLock className="absolute start-4 top-4 text-gray-400 text-lg" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder={t("reset.newPasswordPlaceholder")}
                    {...register("newPassword", {
                      required: t("more.passwordIsRequired"),
                      validate: (value) => isStrongPassword(value) || t("validation.passwordWeak"),
                    })}
                    className={`w-full ps-12 pe-12 py-3 bg-gray-100 border rounded-lg focus:outline-none focus:ring-2 focus:bg-white transition-all ${
                      errors.newPassword
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
                      <MdVisibilityOff className="text-lg" />
                    ) : (
                      <MdVisibility className="text-lg" />
                    )}
                  </button>
                </div>
                {errors.newPassword && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.newPassword.message}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  {t("reset.passwordHint")}
                </p>
              </div>

              {/* Confirm Password Input */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  {t("reset.confirmPasswordLabel")}
                </label>
                <div className="relative">
                  <MdLock className="absolute start-4 top-4 text-gray-400 text-lg" />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder={t("reset.confirmPasswordPlaceholder")}
                    {...register("confirmPassword", {
                      required: t("more.pleaseConfirmYourPassword"),
                      validate: (value, formValues) =>
                        value === formValues.newPassword || t("validation.passwordsDoNotMatch"),
                    })}
                    className={`w-full ps-12 pe-12 py-3 bg-gray-100 border rounded-lg focus:outline-none focus:ring-2 focus:bg-white transition-all ${
                      errors.confirmPassword
                        ? "border-red-500 focus:ring-red-500"
                        : "border-gray-200 focus:ring-cyan-500"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute end-4 top-4 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? (
                      <MdVisibilityOff className="text-lg" />
                    ) : (
                      <MdVisibility className="text-lg" />
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
                disabled={loading || Object.keys(errors).length > 0}
                className="w-full py-3 bg-gradient-to-r cursor-pointer from-cyan-500 to-cyan-600 text-white font-semibold rounded-lg hover:from-cyan-600 hover:to-cyan-700 transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    {t("reset.resetting")}
                  </>
                ) : (
                  t("reset.reset")
                )}
              </button>
            </form>
          ) : (
            <div className="text-center">
              <div className="mb-6 flex justify-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-3xl">✓</span>
                </div>
              </div>
              <p className="text-gray-600">{t("more.redirectingToLoginPage")}</p>
            </div>
          )}

          {/* Back to Login */}
          <div className="text-center mt-8">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-600 hover:text-cyan-700 transition-colors"
            >
              <span>←</span> {t("reset.backToLogin")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ResetPassword;
