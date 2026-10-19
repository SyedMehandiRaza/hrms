import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import * as authApi from "../api/auth";
import SessionPickerModal from "../components/sessions/SessionPickerModal";
import { endSession } from "./useSession";
import { sessionStore } from "../data/sessionStore";
import { apiErrorCode, apiErrorMessage } from "../utils/apiError";
import { applyFieldErrors } from "../utils/applyFieldErrors";
import { isStrongPassword } from "../utils/passwordRule";

// Change own password (D24) + the session picker (D15), shared by every
// change-password form (admin/employee Profile, staffing-company Profile, the forced
// change modal).
//
//   const { rules, submit, saving, picker } = useChangePassword({ setError, successMessage, onSuccess });
//   <input {...register("newPassword", rules.newPassword)} />
//   handleSubmit(submit)   → resolves true when the password was changed
//   {picker}               → render once; the picker modal when other sessions exist
//
// After a 200: onSuccess() runs, then GET /auth/sessions → other sessions → the picker
// (its "End" / "Keep all" close it, then onPickerClose()); no other sessions → the
// success toast. Errors: field errors under the inputs (wrong current password, same
// password, rule texts); 423 AUTH_ACCOUNT_LOCKED → the server message, and since the
// server ended this session: endSession() → /login.
export default function useChangePassword({ setError, successMessage, onSuccess, onPickerClose } = {}) {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [pickerSessions, setPickerSessions] = useState(null);

  // The same client rules and texts as the Reset / Set password screen (standards §1, §7.2).
  const rules = useMemo(
    () => ({
      currentPassword: { required: t("more.passwordIsRequired") },
      newPassword: {
        required: t("more.passwordIsRequired"),
        validate: (value) => isStrongPassword(value) || t("validation.passwordWeak"),
      },
      confirmPassword: {
        required: t("more.pleaseConfirmYourPassword"),
        validate: (value, values) => value === values.newPassword || t("validation.passwordsDoNotMatch"),
      },
    }),
    [t],
  );

  const submit = async ({ currentPassword, newPassword, confirmPassword }) => {
    if (saving) return false;
    setSaving(true);
    try {
      await authApi.changePassword({ currentPassword, newPassword, confirmPassword });
    } catch (err) {
      setSaving(false);
      // An inactive answer was already sent to /access-ended by the interceptor.
      if (sessionStore.getState().accessEnded) return false;
      if (err?.response?.status === 423 || apiErrorCode(err) === "AUTH_ACCOUNT_LOCKED") {
        toast.error(apiErrorMessage(err));
        await endSession();
        navigate("/login", { replace: true });
        return false;
      }
      const { mapped } = applyFieldErrors(err, setError, {
        knownFields: ["currentPassword", "newPassword", "confirmPassword"],
      });
      if (mapped.length === 0) toast.error(apiErrorMessage(err));
      return false;
    }

    try {
      await onSuccess?.();
    } catch {
      // The password is changed; a failed follow-up (e.g. /auth/me) doesn't undo it.
    }

    let others = [];
    try {
      others = (await authApi.listSessions()).filter((s) => !s.current);
    } catch {
      // No list → no picker; the change itself succeeded.
    }
    setSaving(false);
    if (others.length > 0) setPickerSessions(others);
    else {
      toast.success(successMessage);
      onPickerClose?.();
    }
    return true;
  };

  const closePicker = () => {
    setPickerSessions(null);
    onPickerClose?.();
  };

  const picker = pickerSessions ? <SessionPickerModal sessions={pickerSessions} onClose={closePicker} /> : null;

  return { rules, submit, saving, picker };
}
