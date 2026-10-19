import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { BsGlobe } from "react-icons/bs";
import AuthLeft from "../../components/AuthLeft";
import { useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";

function VerifyOTP() {
  const { t } = useTranslation("auth");
  const [timer, setTimer] = useState(59);
  const [canResend, setCanResend] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const inputRefs = useRef([]);
  const email = location.state?.email || "ahmed@fyinder.com";

  const loading = false;

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      otp: ["", "", "", "", "", ""],
    },
  });

  const otpValues = watch("otp");

  // Timer effect
  useEffect(() => {
    if (timer > 0 && !canResend) {
      const interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    } else if (timer === 0) {
      setCanResend(true);
    }
  }, [timer, canResend]);

  // Handle OTP input change
  const handleOTPChange = (index, value) => {
    if (isNaN(value)) return;

    const newOtp = [...otpValues];
    newOtp[index] = value.slice(-1);
    setValue("otp", newOtp);

    // Auto focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle backspace
  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otpValues[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Handle paste
  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").slice(0, 6);
    const newOtp = pastedData
      .split("")
      .concat(otpValues.slice(pastedData.length));
    setValue("otp", newOtp.slice(0, 6));
  };

  const onSubmit = (data) => {
    if (!email) {
      toast.error(t("more.emailNotFoundPleaseGo"));
      return;
    }
    const otpCode = data.otp.join("");

    if (otpCode.length !== 6) {
      toast.error(t("more.pleaseEnterCompleteOtp"));
      return;
    }
    toast.success(t("verify.otpVerifiedRedirecting"));
    navigate("/reset-password");
  };

  const handleResendOTP = () => {
    if (!email) {
      toast.error(t("more.emailNotFoundPleaseGo"));
      return;
    }
    setValue("otp", ["", "", "", "", "", ""]);
    setTimer(59);
    setCanResend(false);
    toast.success(t("more.aNewOtpHasBeen"));
  };

  return (
    <div className="flex min-h-screen bg-white">
      {/* Left Side - Branding */}
      <AuthLeft />

      {/* Right Side - Verify OTP Form */}
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
              {t("verify.title")}
            </h1>
            <p className="text-gray-600 text-sm">{t("verify.subtitle")}</p>
            {email && (
              <p className="text-gray-500 text-xs mt-2">
                {t("verify.emailLabel")}{" "}
                <span className="font-semibold">{email}</span>
              </p>
            )}
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit(onSubmit, (err) =>
              console.log("Validation errors:", err),
            )}
            className="space-y-6"
          >
            {/* OTP Input Fields */}
            <div>
              <div className="flex gap-3 justify-center mb-6">
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <Controller
                    key={index}
                    name={`otp.${index}`}
                    control={control}
                    rules={{ required: t("more.required") }}
                    render={({ field }) => (
                      <input
                        {...field}
                        ref={(el) => (inputRefs.current[index] = el)}
                        type="text"
                        inputMode="numeric"
                        maxLength="1"
                        onChange={(e) => {
                          field.onChange(e);
                          handleOTPChange(index, e.target.value);
                        }}
                        onKeyDown={(e) => handleKeyDown(index, e)}
                        onPaste={handlePaste}
                        className={`w-14 h-14 text-center text-2xl font-bold border-2 rounded-lg focus:outline-none transition-all ${
                          field.value
                            ? "border-cyan-500 bg-cyan-50"
                            : "border-gray-300 bg-white"
                        } focus:ring-2 focus:ring-cyan-500 focus:border-transparent`}
                      />
                    )}
                  />
                ))}
              </div>
              {errors.otp?.[5] && (
                <p className="text-red-500 text-xs text-center mt-1">
                  {errors.otp[5].message}
                </p>
              )}
            </div>

            {/* Timer and Resend OTP */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <span>⏱</span>
                <span>
                  {canResend
                    ? t("verify.didntReceive")
                    : t("verify.resendInTimer", { time: `${String(timer).padStart(2, "0")}:00` })}
                </span>
              </div>
              <button
                type="button"
                onClick={handleResendOTP}
                disabled={!canResend}
                className={`font-semibold transition-colors ${
                  canResend
                    ? "text-cyan-600 hover:text-cyan-700 cursor-pointer"
                    : "text-gray-400 cursor-not-allowed"
                }`}
              >
                {t("verify.resendOtp")}
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || otpValues.some((digit) => !digit)}
              className="w-full cursor-pointer py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-semibold rounded-lg hover:from-cyan-600 hover:to-cyan-700 transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  {t("verify.verifying")}
                </>
              ) : (
                t("verify.verify")
              )}
            </button>
          </form>

          {/* Back to Login */}
          <div className="text-center mt-8">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-600 hover:text-cyan-700 transition-colors"
            >
              <span>←</span> {t("verify.backToLogin")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VerifyOTP;
