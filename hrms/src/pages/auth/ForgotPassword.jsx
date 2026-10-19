import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { MdOutlineEmail } from "react-icons/md";
import { BsGlobe } from "react-icons/bs";
import AuthLeft from "../../components/AuthLeft";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import * as authApi from "../../api/auth";
import { apiErrorMessage } from "../../utils/apiError";
import { applyFieldErrors } from "../../utils/applyFieldErrors";

function ForgotPassword() {
  const { t } = useTranslation("auth");
  const [success] = useState(false);
  const navigate = useNavigate();
  // In flight: the button is disabled and shows "Sending OTP...".
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    defaultValues: {
      email: "",
    },
  });

  // The server answers the same for known and unknown emails (AUTH_RESET_SENT):
  // show its message and go on to Verify OTP with the email. Too soon
  // (AUTH_OTP_RESEND_TOO_SOON) or any other error → its message, stay here.
  const onSubmit = async ({ email }) => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await authApi.forgotPassword({ email });
      toast.success(res.message);
      navigate("/verify-otp", { state: { email } });
    } catch (err) {
      const { mapped } = applyFieldErrors(err, setError, { knownFields: ["email"] });
      if (mapped.length === 0) toast.error(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-white">
      {/* Left Side - Branding */}
      <AuthLeft />

      {/* Right Side - Forgot Password Form */}
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
              {t("forgot.title")}
            </h1>
            <p className="text-gray-600">{t("forgot.subtitle")}</p>
          </div>

          {/* Success Message */}
          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-700 text-sm font-semibold">
                ✓ OTP sent successfully! Redirecting to verification page...
              </p>
            </div>
          )}

          {/* Form */}
          {!success ? (
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
              {/* Email Input */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  {t("forgot.emailLabel")}
                </label>
                <div className="relative">
                  <MdOutlineEmail className="absolute start-4 top-4 text-gray-400 text-lg" />
                  <input
                    type="email"
                    placeholder={t("forgot.emailPlaceholder")}
                    {...register("email", {
                      // The server trims the email too.
                      setValueAs: (v) => (typeof v === "string" ? v.trim() : v),
                      required: t("more.emailIsRequired"),
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: t("more.invalidEmailAddress"),
                      },
                    })}
                    className={`w-full ps-12 pe-4 py-3 bg-gray-100 border rounded-lg focus:outline-none focus:ring-2 focus:bg-white transition-all ${
                      errors.email
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

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r cursor-pointer from-cyan-500 to-cyan-600 text-white font-semibold rounded-lg hover:from-cyan-600 hover:to-cyan-700 transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    {t("forgot.sendingOtp")}
                  </>
                ) : (
                  t("forgot.sendOtp")
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
              <p className="text-gray-600">
                {t("more.redirectingToOtpVerification")}
              </p>
            </div>
          )}

          {/* Back to Login */}
          <div className="text-center mt-8">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-600 hover:text-cyan-700 transition-colors"
            >
              <span>←</span> {t("forgot.backToLogin")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;
