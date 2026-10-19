import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import {
  MdOutlineLock,
  MdOutlineBusiness,
  MdOutlinePerson,
  MdOutlinePhone,
  MdOutlineVisibility,
  MdOutlineVisibilityOff,
} from "react-icons/md";
import { toast } from "react-toastify";
import { useTranslation, Trans } from "react-i18next";

import AuthLeft from "../../components/AuthLeft";
import { INVITE_INFO } from "../../data/groupA";

function InviteLanding() {
  const { t } = useTranslation("collaboration");
  const navigate = useNavigate();
  const [state] = useState({ loading: false, error: null, info: INVITE_INFO });
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      companyName: "",
      contactPersonName: "",
      phoneNumber: "",
      password: "",
      confirmPassword: "",
    },
  });
  const passwordValue = watch("password");

  const onSubmit = () => {
    setSubmitting(false);
    toast.success(t("landing.toast.registered"));
    navigate("/login");
  };

  const inputCls = (hasError) =>
    `w-full ps-12 pe-4 py-3 bg-gray-100 border rounded-lg focus:outline-none focus:ring-2 focus:bg-white transition-all ${
      hasError
        ? "border-red-500 focus:ring-red-500"
        : "border-gray-200 focus:ring-cyan-500"
    }`;

  const info = state.info;

  return (
    <div className="flex min-h-screen bg-white">
      <AuthLeft />
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 sm:px-8 py-12 bg-white">
        <div className="w-full max-w-sm">
          {state.loading ? (
            <p className="text-center text-gray-500">{t("landing.loading")}</p>
          ) : state.error ? (
            <div className="text-center">
              <div className="mb-4 text-4xl">⚠️</div>
              <h1 className="text-xl font-bold text-blue-900 mb-2">
                {t("landing.unavailable")}
              </h1>
              <p className="text-gray-600 mb-6">{state.error}</p>
              <Link
                to="/login"
                className="text-cyan-600 font-semibold hover:text-cyan-700"
              >
                {t("landing.goToLogin")}
              </Link>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <h1 className="text-2xl font-bold text-blue-900 mb-2">
                  {t("landing.title")}
                </h1>
                <p className="text-gray-600 text-sm">
                  <Trans
                    t={t}
                    i18nKey="landing.invitedText"
                    values={{
                      company: info?.invitingCompany?.name || t("landing.aCompany"),
                      role: info?.role ? t(`role.${info.role}`, { defaultValue: info.role }) : "",
                      under: info?.parentCompany ? t("landing.underParent", { name: info.parentCompany.name }) : "",
                      on: info?.projects?.length
                        ? t("landing.onProjects", { count: info.projects.length })
                        : t("landing.fullStop"),
                    }}
                    components={{ b: <b /> }}
                  />
                </p>
              </div>

              <div className="mb-5 p-3 bg-cyan-50 border border-cyan-100 rounded-lg text-sm text-cyan-800">
                <Trans t={t} i18nKey="landing.registeringAs" values={{ email: info?.invitedEmail || "" }} components={{ b: <b /> }} />
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <div className="relative">
                    <MdOutlineBusiness className="absolute start-4 top-4 text-gray-400 text-lg" />
                    <input
                      type="text"
                      placeholder={t("landing.form.companyName")}
                      {...register("companyName", {
                        required: t("landing.validation.companyNameRequired"),
                        minLength: { value: 2, message: t("landing.validation.tooShort") },
                      })}
                      className={inputCls(errors.companyName)}
                    />
                  </div>
                  {errors.companyName && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.companyName.message}
                    </p>
                  )}
                </div>

                <div>
                  <div className="relative">
                    <MdOutlinePerson className="absolute start-4 top-4 text-gray-400 text-lg" />
                    <input
                      type="text"
                      placeholder={t("landing.form.yourName")}
                      {...register("contactPersonName", {
                        required: t("landing.validation.nameRequired"),
                        minLength: { value: 2, message: t("landing.validation.tooShort") },
                      })}
                      className={inputCls(errors.contactPersonName)}
                    />
                  </div>
                  {errors.contactPersonName && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.contactPersonName.message}
                    </p>
                  )}
                </div>

                <div>
                  <div className="relative">
                    <MdOutlinePhone className="absolute start-4 top-4 text-gray-400 text-lg" />
                    <input
                      type="tel"
                      placeholder={t("landing.form.phone")}
                      {...register("phoneNumber", {
                        pattern: {
                          value: /^[0-9+\-\s()]{6,20}$/,
                          message: t("landing.validation.invalidPhone"),
                        },
                      })}
                      className={inputCls(errors.phoneNumber)}
                    />
                  </div>
                  {errors.phoneNumber && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.phoneNumber.message}
                    </p>
                  )}
                </div>

                <div>
                  <div className="relative">
                    <MdOutlineLock className="absolute start-4 top-4 text-gray-400 text-lg" />
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder={t("landing.form.password")}
                      {...register("password", {
                        required: t("landing.validation.passwordRequired"),
                        minLength: { value: 8, message: t("landing.validation.minPassword") },
                      })}
                      className={`${inputCls(errors.password)} pe-12`}
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

                <div>
                  <div className="relative">
                    <MdOutlineLock className="absolute start-4 top-4 text-gray-400 text-lg" />
                    <input
                      type="password"
                      placeholder={t("landing.form.confirmPassword")}
                      {...register("confirmPassword", {
                        required: t("landing.validation.confirmRequired"),
                        validate: (v) =>
                          v === passwordValue || t("landing.validation.mismatch"),
                      })}
                      className={inputCls(errors.confirmPassword)}
                    />
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.confirmPassword.message}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-semibold rounded-lg hover:from-cyan-600 hover:to-cyan-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting && (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  {t("landing.submit")}
                </button>
              </form>

              <p className="text-center text-gray-600 text-sm mt-6">
                {t("landing.haveAccount")}{" "}
                <Link
                  to="/login"
                  className="text-cyan-600 font-semibold hover:text-cyan-700"
                >
                  {t("landing.login")}
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default InviteLanding;
