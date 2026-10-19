import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";

import FieldError from "../FieldError";
import { ErrorBox, Modal } from "./shared";
import { inputCls, labelCls, primaryBtn, secondaryBtn } from "./styles";
import { setLeaveOverride } from "../../data/groupG";
import { OVERRIDE_LIMITS, validateLeaveOverride } from "../../utils/fyValidation/yearEnd";
import { useFormat } from "../../hooks/useFormat";

const FIELDS = ["carry_days", "encash_days", "reason"];

// Override one balance's year-end split (carry / encash; the rest lapses).
//   <LeaveOverrideModal yearKey row={previewRow} onClose onSaved={(row) => …} />
export default function LeaveOverrideModal({ yearKey, row, onClose, onSaved }) {
  const { t } = useTranslation("fiscalYear");
  const { fmtNumber } = useFormat();
  const [values, setValues] = useState({
    carry_days: String(row.override?.carry_days ?? row.carry ?? 0),
    encash_days: String(row.override?.encash_days ?? row.encash ?? 0),
    reason: row.override?.reason || "",
  });
  const [touched, setTouched] = useState({});
  const [server, setServer] = useState({});
  const [general, setGeneral] = useState(null);
  const [saving, setSaving] = useState(false);

  const live = validateLeaveOverride(t, values, row);
  const shown = (f) => server[f] || (touched[f] ? live[f] : null);

  const set = (f, v) => {
    setValues((s) => ({ ...s, [f]: v }));
    setServer((e) => ({ ...e, [f]: null }));
    setGeneral(null);
  };
  const blur = (f) => () => setTouched((s) => ({ ...s, [f]: true }));

  const carry = Number(values.carry_days) || 0;
  const encash = Number(values.encash_days) || 0;
  const lapse = Math.round((Number(row.left) - carry - encash) * 100) / 100;
  const cap = row.policy?.allow_carry_forward ? row.policy.max_carry_forward_days : 0;

  const submit = async (e) => {
    e.preventDefault();
    setTouched({ carry_days: true, encash_days: true, reason: true });
    if (Object.keys(live).length) return;
    setSaving(true);
    try {
      const saved = setLeaveOverride(yearKey, row.balance_id, {
        carry_days: Number(values.carry_days),
        encash_days: Number(values.encash_days),
        reason: values.reason.trim(),
      });
      toast.success(t("leaveStep.overrideSaved"));
      onSaved?.(saved);
      onClose();
    } catch {
      setServer({});
      setGeneral(t("ui.genericError"));
    } finally {
      setSaving(false);
    }
  };

  const days = (n) => t("leaveStep.daysValue", { value: fmtNumber(n) });
  const hasErrors = FIELDS.some((f) => shown(f));

  return (
    <Modal
      title={t("leaveStep.overrideTitle")}
      subtitle={`${row.employee?.full_name || ""} · ${row.leave_type?.name || ""}`}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className={secondaryBtn}>
            {t("ui.cancel")}
          </button>
          <button type="submit" disabled={saving || hasErrors} className={primaryBtn}>
            {saving ? t("ui.saving") : t("ui.save")}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-gray-50 border border-gray-100 px-2 py-2">
          <p className="text-[11px] text-gray-500">{t("leaveStep.cols.left")}</p>
          <p className="text-sm font-bold text-gray-900">{days(row.left)}</p>
        </div>
        <div className="rounded-lg bg-gray-50 border border-gray-100 px-2 py-2">
          <p className="text-[11px] text-gray-500">{t("leaveStep.policyCap")}</p>
          <p className="text-sm font-bold text-gray-900">{days(cap)}</p>
        </div>
        <div className={`rounded-lg border px-2 py-2 ${lapse < 0 ? "bg-red-50 border-red-100" : "bg-gray-50 border-gray-100"}`}>
          <p className="text-[11px] text-gray-500">{t("leaveStep.cols.lapse")}</p>
          <p className="text-sm font-bold text-gray-900">{days(lapse)}</p>
        </div>
      </div>
      <ErrorBox message={general} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {["carry_days", "encash_days"].map((f) => (
          <div key={f}>
            <label htmlFor={`ov-${f}`} className={labelCls}>
              {t(`leaveStep.fields.${f}`)}
            </label>
            <input
              id={`ov-${f}`}
              type="number"
              inputMode="decimal"
              min={0}
              step="0.5"
              value={values[f]}
              onChange={(e) => set(f, e.target.value)}
              onBlur={blur(f)}
              className={inputCls(shown(f))}
            />
            <FieldError message={shown(f)} />
          </div>
        ))}
      </div>
      <div>
        <label htmlFor="ov-reason" className={labelCls}>
          {t("ui.reason")} <span className="text-red-500">*</span>
        </label>
        <textarea
          id="ov-reason"
          rows={3}
          maxLength={OVERRIDE_LIMITS.reasonMax + 50}
          value={values.reason}
          placeholder={t("leaveStep.reasonPlaceholder")}
          onChange={(e) => set("reason", e.target.value)}
          onBlur={blur("reason")}
          className={`${inputCls(shown("reason"))} resize-none`}
        />
        <div className="flex items-start justify-between gap-3">
          <FieldError message={shown("reason")} />
          <span className="ms-auto text-[11px] text-gray-400 mt-1.5 shrink-0">
            {values.reason.trim().length}/{OVERRIDE_LIMITS.reasonMax}
          </span>
        </div>
      </div>
    </Modal>
  );
}
