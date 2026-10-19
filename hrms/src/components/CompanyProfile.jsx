import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { MdOutlineBusiness, MdOutlineError } from "react-icons/md";
import { toast } from "react-toastify";
import Ltr from "./Ltr";
import { useFormat } from "../hooks/useFormat";
import CustomDropdown from "./CustomDropdown";
import Loader from "./Loader";
import ConfirmationModal from "./ConfirmationModal";
import { COMPANY_PROFILE, INDUSTRIES } from "../data/groupA";

const p = COMPANY_PROFILE;
const INITIAL_VALUES = {
  companyName: p.company_name || p.full_name || "",
  phone: p.phone_number || "",
  email: p.email || "",
  address: p.address || "",
  industry: p.industry_type_id ? String(p.industry_type_id) : "",
};
// ── Shared input styles ───────────────────────────────────────────────────────
const inputBase =
  "w-full px-4 py-3 border rounded-lg text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition bg-white";
const inputCls = (err) =>
  `${inputBase} ${err ? "border-red-400 bg-red-50" : "border-gray-200"}`;
const labelCls = "block text-xs font-semibold text-gray-500 mb-1.5";

const FieldErr = ({ error }) =>
  error ? (
    <p className="flex items-center gap-1 text-xs text-red-500 mt-1.5">
      <MdOutlineError className="flex-shrink-0" />
      {error.message}
    </p>
  ) : null;

function CompanyProfile() {
  const { t } = useTranslation("settings");
  const { fmtDate } = useFormat();
  const logoRef = useRef();
  
  const loading = false;
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState(p.profile_url || null);
  const [hasLogo, setHasLogo] = useState(!!p.profile_url);
  const [logoBusy, setLogoBusy] = useState(false);
  const [metadata] = useState({ id: p.id, createdAt: p.created_at });
  const [confirm, setConfirm] = useState(null);
  // Industry list from the platform's industry types (stored as
  // employers.industry_type_id) and the last saved values, for Discard.
  const [industries] = useState(INDUSTRIES);
  const [savedValues, setSavedValues] = useState(INITIAL_VALUES);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: INITIAL_VALUES,
  });

  const formValues = watch();

  const onProfileSave = (data) => {
    setSaving(false);
    setSavedValues(data);
    toast.success(t("company.saved") || "Profile updated successfully");
  };

  const onLogoSelected = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setLogoBusy(false);
    setLogoPreview(URL.createObjectURL(file));
    setHasLogo(true);
    toast.success(t("common:companyProfile.logoUpdated"));
  };

  const onLogoDelete = () => {
    setLogoBusy(false);
    setHasLogo(false);
    setLogoPreview(null);
    toast.success(t("common:companyProfile.logoRemoved"));
  };

  const calculateStrength = () => {
    let strength = 0;
    if (formValues.companyName?.trim()) strength += 20;
    if (formValues.industry) strength += 20;
    if (formValues.phone?.trim()) strength += 20;
    if (formValues.email?.trim()) strength += 10;
    if (formValues.address?.trim()) strength += 20;
    if (hasLogo) strength += 10;
    return strength;
  };

  // Put the form back to the last loaded/saved values (no page reload).
  const onDiscard = () => {
    if (savedValues) reset(savedValues);
  };

  if (loading) {
    return <Loader label={t("common:companyProfile.loading")} />;
  }

  const profileStrength = calculateStrength();

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      {/* Left: General Information */}
      <div className="flex-1 bg-white border border-gray-200 rounded-xl p-5 lg:p-6 space-y-5">
        <h3 className="text-base font-bold text-gray-900">
          {t("company.generalInfo")}
        </h3>

        {/* Company Name */}
        <div>
          <label className={labelCls}>{t("company.companyName")}</label>
          <input
            {...register("companyName", {
              required: t("company.validation.nameRequired"),
              minLength: { value: 2, message: t("company.validation.tooShort") },
            })}
            className={inputCls(errors.companyName)}
          />
          <FieldErr error={errors.companyName} />
        </div>

        {/* Industry + Phone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>{t("company.industry")}</label>
            <CustomDropdown
              {...register("industry", {
                required: t("company.validation.industryRequired"),
              })}
              error={!!errors.industry}
              placeholder={t("company.selectIndustry")}
              options={industries.map((i) => ({
                label: i.name,
                value: String(i.id),
              }))}
            />
            <FieldErr error={errors.industry} />
          </div>
          <div>
            <label className={labelCls}>{t("company.phone")}</label>
            <input
              {...register("phone", {
                required: t("company.validation.phoneRequired"),
                pattern: {
                  value: /^[0-9]{6,15}$/,
                  message: t("company.validation.phoneValid"),
                },
              })}
              type="tel"
              className={inputCls(errors.phone)}
              onInput={(e) => {
                let val = e.target.value.replace(/\D/g, "");
                e.target.value = val;
              }}
            />
            <FieldErr error={errors.phone} />
          </div>
        </div>

        {/* Contact Email */}
        <div>
          <label className={labelCls}>{t("company.email")}</label>
          <input
            {...register("email", {
              required: t("company.validation.emailRequired"),
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: t("company.validation.emailValid"),
              },
            })}
            type="email"
            className={inputCls(errors.email)}
          />
          <FieldErr error={errors.email} />
        </div>

        {/* HQ Address */}
        <div>
          <label className={labelCls}>{t("company.address")}</label>
          <textarea
            {...register("address", { required: t("company.validation.addressRequired") })}
            rows={4}
            className={inputCls(errors.address) + " resize-none"}
          />
          <FieldErr error={errors.address} />
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={onDiscard}
            className="w-full sm:w-auto px-6 py-2.5 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors"
          >
            {t("company.discard")}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSubmit((data) => setConfirm({
              title: t("company.confirmSave.title"),
              message: t("company.confirmSave.message"),
              confirmText: t("company.confirmSave.confirm"),
              type: "status",
              action: () => onProfileSave(data)
            }))}
            className="w-full sm:w-auto px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors text-white bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50"
          >
            {saving ? t("company.saving") : t("company.save")}
          </button>
        </div>
      </div>

      {/* Right: Branding + Strength + Metadata */}
      <div className="w-full lg:w-64 xl:w-72 flex-shrink-0 space-y-4">
        {/* Company Branding */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 text-center">
          <p className="text-sm font-semibold text-gray-700 mb-4 text-start">
            {t("company.branding")}
          </p>
          <div
            onClick={() => logoRef.current.click()}
            className="w-28 h-28 mx-auto border-2 border-dashed border-gray-200 rounded-xl bg-gray-50 flex items-center justify-center cursor-pointer hover:border-cyan-400 transition-colors overflow-hidden mb-3"
          >
            {logoPreview ? (
              <img
                src={logoPreview}
                alt="logo"
                className="w-full h-full object-contain p-2"
              />
            ) : (
              <MdOutlineBusiness className="text-5xl text-gray-200" />
            )}
          </div>
          <p className="text-xs text-gray-400 mb-3 leading-relaxed">
            {t("company.uploadHint")}
            <br />
            {t("company.recommendedSize")}
          </p>
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              disabled={logoBusy}
              onClick={() => logoRef.current.click()}
              className="text-sm font-semibold text-cyan-600 hover:text-cyan-700 transition-colors disabled:opacity-50"
            >
              {logoBusy ? t("company.working") : t("company.changeLogo")}
            </button>
            {hasLogo && (
              <button
                type="button"
                disabled={logoBusy}
                onClick={() => setConfirm({
                  title: t("company.confirmRemoveLogo.title"),
                  message: t("company.confirmRemoveLogo.message"),
                  confirmText: t("company.confirmRemoveLogo.confirm"),
                  type: "delete",
                  action: () => onLogoDelete()
                })}
                className="text-sm font-semibold text-red-500 hover:text-red-600 transition-colors disabled:opacity-50"
              >
                {t("company.removeLogo")}
              </button>
            )}
          </div>
          <input
            ref={logoRef}
            type="file"
            accept="image/png,image/svg+xml,image/jpeg"
            className="hidden"
            onChange={onLogoSelected}
          />
        </div>

        {/* Profile Strength */}
        <div className="bg-gray-900 rounded-xl p-5 text-white">
          <p className="text-sm font-bold mb-1">{t("company.profileStrength")}</p>
          <p className="text-xs text-gray-400 mb-4">
            {t("company.profileStrengthHint")}
          </p>
          <div className="flex items-end justify-between mb-2">
            <p className="text-3xl font-bold">{profileStrength}%</p>
            <p className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
              {profileStrength === 100 ? t("company.complete") : t("company.almostThere")}
            </p>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${profileStrength}%` }} />
          </div>
        </div>

        {/* Metadata */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-sm font-semibold text-gray-700 mb-4">{t("company.metadata")}</p>
          <div className="space-y-3">
            {[
              { label: t("company.metaCompanyId"), value: <Ltr>{metadata ? `CMP-${metadata.id}` : t("company.na")}</Ltr> },
              { label: t("company.metaAccountCreated"), value: metadata?.createdAt ? fmtDate(metadata.createdAt) : t("company.na") },
              { label: t("company.metaDataResidency"), value: "US-West (Oregon)" }, // Static as there is no region setup
            ].map(({ label, value }) => (
              <div
                key={label}
                className="flex items-center justify-between gap-4"
              >
                <span className="text-xs text-gray-400">{label}</span>
                <span className="text-xs font-semibold text-gray-800 text-end">
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {confirm && (
        <ConfirmationModal
          isOpen={!!confirm}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await confirm.action();
            setConfirm(null);
          }}
          title={confirm.title}
          message={confirm.message}
          type={confirm.type}
          confirmText={confirm.confirmText}
          isLoading={saving || logoBusy}
        />
      )}
    </div>
  );
}

export default CompanyProfile;
