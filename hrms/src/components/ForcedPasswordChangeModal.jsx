import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  MdOutlineError,
  MdOutlineLock,
  MdOutlineLogout,
  MdOutlineVisibility,
  MdOutlineVisibilityOff,
} from "react-icons/md";
import useChangePassword from "../hooks/useChangePassword";
import { endSession, reloadMe, useSession } from "../hooks/useSession";
import { sessionStore } from "../data/sessionStore";

// Forced change of a temporary password (D21, ADR 0003). Mounted once in App: shown over
// any panel while the logged-in account still has a temporary password
// (useSession().mustChangePassword — set by login, /auth/me, or any 403
// AUTH_PASSWORD_CHANGE_REQUIRED). It can't be dismissed: no close button, no backdrop
// close; the only other action is Log out. After the change: the session picker when
// other sessions exist (useChangePassword), then the panel is usable.

const inputBase =
  "w-full px-4 py-3 border rounded-lg text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition bg-white";
const inputCls = (err) => `${inputBase} ${err ? "border-red-400 bg-red-50" : "border-gray-200"}`;
const labelCls = "block text-xs font-semibold text-gray-500 mb-1.5";

const FieldErr = ({ error }) =>
  error ? (
    <p className="flex items-center gap-1 text-xs text-red-500 mt-1.5">
      <MdOutlineError className="flex-shrink-0" />
      {error.message}
    </p>
  ) : null;

function PasswordInput({ id, label, registration, error, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          {...registration}
          className={inputCls(error) + " pe-10"}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          tabIndex={-1}
        >
          {show ? <MdOutlineVisibilityOff /> : <MdOutlineVisibility />}
        </button>
      </div>
      <FieldErr error={error} />
    </div>
  );
}

export default function ForcedPasswordChangeModal() {
  const { t } = useTranslation("shared");
  const navigate = useNavigate();
  const { status, mustChangePassword } = useSession();
  const [loggingOut, setLoggingOut] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm({ defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" } });

  const { rules, submit, saving, picker } = useChangePassword({
    setError,
    successMessage: t("profile:personal.toast.passwordChanged"),
    // The temporary password is replaced: unlock the panel, then refresh /auth/me.
    onSuccess: async () => {
      sessionStore.setMustChangePassword(false);
      await reloadMe();
    },
  });

  const onSubmit = async (data) => {
    if (await submit(data)) reset();
  };

  const logOut = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    await endSession();
    reset();
    setLoggingOut(false);
    navigate("/login", { replace: true });
  };

  const open = status === "authenticated" && mustChangePassword;
  const busy = saving || loggingOut;

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col"
            style={{ maxHeight: "90vh" }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="forced-change-title"
          >
            {/* Header */}
            <div className="flex items-start gap-3 px-6 pt-6 pb-4 shrink-0">
              <div className="w-10 h-10 rounded-xl bg-cyan-50 flex items-center justify-center flex-shrink-0">
                <MdOutlineLock className="text-cyan-600 text-xl" />
              </div>
              <div className="min-w-0">
                <h2 id="forced-change-title" className="text-xl font-bold text-gray-900">
                  {t("forcedChange.title")}
                </h2>
                <p className="text-sm text-gray-400 mt-0.5">{t("forcedChange.subtitle")}</p>
              </div>
            </div>

            <hr className="border-gray-100 shrink-0" />

            {/* Fields */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 custom-scrollbar">
              <PasswordInput
                id="forced-current-password"
                label={t("forcedChange.currentPassword")}
                registration={register("currentPassword", rules.currentPassword)}
                error={errors.currentPassword}
                autoComplete="current-password"
              />
              <PasswordInput
                id="forced-new-password"
                label={t("forcedChange.newPassword")}
                registration={register("newPassword", rules.newPassword)}
                error={errors.newPassword}
                autoComplete="new-password"
              />
              <PasswordInput
                id="forced-confirm-password"
                label={t("forcedChange.confirmPassword")}
                registration={register("confirmPassword", rules.confirmPassword)}
                error={errors.confirmPassword}
                autoComplete="new-password"
              />
              <p className="text-xs text-gray-400">{t("auth:reset.passwordHint")}</p>
            </div>

            {/* Footer */}
            <hr className="border-gray-100 shrink-0" />
            <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 px-6 py-4 shrink-0">
              <button
                type="button"
                onClick={logOut}
                disabled={busy}
                className="flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-60 transition-colors"
              >
                <MdOutlineLogout className="text-lg" /> {t("forcedChange.logout")}
              </button>
              <button
                type="submit"
                disabled={busy}
                className="flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-700 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                {saving ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {t("forcedChange.saving")}
                  </>
                ) : (
                  t("forcedChange.submit")
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {picker}
    </>
  );
}
