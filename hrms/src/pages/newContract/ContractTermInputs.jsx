import { useTranslation } from "react-i18next";
import { ContractTermFields } from "../contract/ContractTermModal";
import { RATE_UNITS, inputCls } from "./contractTerms";

// Term inputs shared by the send wizard and the viewer's "Edit terms".

const FieldError = ({ message }) => (message ? <p className="text-red-500 text-xs mt-1">{message}</p> : null);

export default function ContractTermInputs({ values, errors, onChange, disabled }) {
  const { t } = useTranslation("contractStudio");
  return (
    <>
      <ContractTermFields values={values} errors={errors} onChange={onChange} disabled={disabled} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
        <div className="min-w-0">
          <label htmlFor="term-sign_by" className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">{t("wizard.terms.signBy")}</label>
          <input id="term-sign_by" type="date" value={values.sign_by} disabled={disabled} onChange={(e) => onChange("sign_by", e.target.value)} className={inputCls(!!errors.sign_by)} />
          <FieldError message={errors.sign_by} />
        </div>
        <div className="min-w-0">
          <label htmlFor="term-rate" className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">{t("wizard.terms.rate")}</label>
          <input id="term-rate" type="number" step="0.01" min="0" value={values.rate} disabled={disabled} onChange={(e) => onChange("rate", e.target.value)} className={inputCls(!!errors.rate)} />
          <FieldError message={errors.rate} />
        </div>
        <div className="min-w-0">
          <label htmlFor="term-rate_unit" className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">{t("wizard.terms.rateUnit")}</label>
          <select id="term-rate_unit" value={values.rate_unit} disabled={disabled} onChange={(e) => onChange("rate_unit", e.target.value)} className={inputCls(!!errors.rate_unit)}>
            <option value="">{t("wizard.terms.rateUnitPlaceholder")}</option>
            {RATE_UNITS.map((u) => (
              <option key={u} value={u}>{t(`wizard.terms.units.${u}`)}</option>
            ))}
          </select>
          <FieldError message={errors.rate_unit} />
        </div>
        <div className="min-w-0">
          <label htmlFor="term-currency" className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">{t("wizard.terms.currency")}</label>
          <input id="term-currency" maxLength={3} value={values.currency} disabled={disabled} onChange={(e) => onChange("currency", e.target.value.toUpperCase())} className={inputCls(!!errors.currency)} />
          <FieldError message={errors.currency} />
        </div>
        <div className="min-w-0">
          <label htmlFor="term-notice" className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">{t("wizard.terms.noticePeriod")}</label>
          <input id="term-notice" type="number" min="0" max="365" step="1" value={values.notice_period_days} disabled={disabled} onChange={(e) => onChange("notice_period_days", e.target.value)} className={inputCls(!!errors.notice_period_days)} />
          <FieldError message={errors.notice_period_days} />
        </div>
      </div>
    </>
  );
}
