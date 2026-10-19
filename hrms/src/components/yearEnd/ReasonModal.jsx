import { useState } from "react";
import { useTranslation } from "react-i18next";

import CustomDropdown from "../CustomDropdown";
import FieldError from "../FieldError";
import { check, LIMITS, LOCK_MODULES, validateWith } from "../../utils/fyValidation/core";
import { serverMessage } from "../../utils/applyFieldErrors";
import { ErrorBox, Modal } from "./shared";
import { dangerBtn, inputCls, labelCls, primaryBtn, secondaryBtn } from "./styles";

// Reason (5–500) + optional lock module. Used for month lock / unlock and for
// reopening a closed year. `onSubmit({ reason, module })` returns a promise;
// a rejection's field errors land under the inputs, anything else (a refusal
// such as "Only the company owner can reopen …") in the red box.
//
//   <ReasonModal title=… withModule onSubmit={…} onClose={…} />
export default function ReasonModal({
  title,
  subtitle,
  intro,
  confirmText,
  tone = "primary",
  withModule = false,
  fixedModule,
  onSubmit,
  onClose,
}) {
  const { t } = useTranslation("fiscalYear");
  const [values, setValues] = useState({ reason: "", module: fixedModule || "ALL" });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [general, setGeneral] = useState(null);
  const [saving, setSaving] = useState(false);

  const checks = withModule ? { reason: check.reason, module: check.module } : { reason: check.reason };
  const live = validateWith(t, checks, values);
  const shown = (f) => errors[f] || (touched[f] ? live[f] : null);

  const set = (field, v) => {
    setValues((s) => ({ ...s, [field]: v }));
    setErrors((e) => ({ ...e, [field]: null }));
    setGeneral(null);
  };

  const submit = async (e) => {
    e.preventDefault();
    setTouched({ reason: true, module: true });
    if (Object.keys(live).length) return;
    setSaving(true);
    try {
      await onSubmit({ reason: values.reason.trim(), module: values.module });
    } catch (err) {
      setErrors({});
      setGeneral(serverMessage(err, t("ui.genericError")));
    } finally {
      setSaving(false);
    }
  };

  const len = values.reason.trim().length;
  const hasErrors = Object.values(live).some(Boolean) && Object.keys(touched).length > 0;

  return (
    <Modal
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className={secondaryBtn}>
            {t("ui.cancel")}
          </button>
          <button type="submit" disabled={saving || hasErrors} className={tone === "danger" ? dangerBtn : primaryBtn}>
            {saving ? t("ui.saving") : confirmText || t("ui.confirm")}
          </button>
        </>
      }
    >
      {intro && <p className="text-sm text-gray-600">{intro}</p>}
      <ErrorBox message={general} />
      {withModule && (
        <div>
          <label className={labelCls}>{t("locks.module")}</label>
          <CustomDropdown
            name="module"
            value={values.module}
            disabled={!!fixedModule || saving}
            error={!!shown("module")}
            onChange={(e) => set("module", e.target.value)}
            onBlur={() => setTouched((s) => ({ ...s, module: true }))}
            options={LOCK_MODULES.map((m) => ({ value: m, label: t(`lockModule.${m}`) }))}
          />
          <FieldError message={shown("module")} />
        </div>
      )}
      <div>
        <label htmlFor="fy-reason" className={labelCls}>
          {t("ui.reason")} <span className="text-red-500">*</span>
        </label>
        <textarea
          id="fy-reason"
          rows={4}
          maxLength={LIMITS.reasonMax + 50}
          value={values.reason}
          placeholder={t("ui.reasonPlaceholder")}
          onChange={(e) => set("reason", e.target.value)}
          onBlur={() => setTouched((s) => ({ ...s, reason: true }))}
          className={`${inputCls(shown("reason"))} resize-none`}
        />
        <div className="flex items-start justify-between gap-3">
          <FieldError message={shown("reason")} />
          <span className="ms-auto text-[11px] text-gray-400 mt-1.5 shrink-0">
            {len}/{LIMITS.reasonMax}
          </span>
        </div>
      </div>
    </Modal>
  );
}
