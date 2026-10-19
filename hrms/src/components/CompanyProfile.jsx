import { useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { MdOutlineBusiness, MdOutlineError } from "react-icons/md";
import { toast } from "react-toastify";
import Ltr from "./Ltr";
import { useFormat } from "../hooks/useFormat";
import CustomDropdown from "./CustomDropdown";
import Loader from "./Loader";
import ConfirmationModal from "./ConfirmationModal";
import { ScreenError } from "./ScreenState";
import { assetUrl } from "../api/client";
import * as companyApi from "../api/company";
import useApiQuery from "../hooks/useApiQuery";
import { reloadMe, useCurrentUser } from "../hooks/useSession";
import { applyFieldErrors } from "../utils/applyFieldErrors";
import { toastApiError } from "../utils/apiError";

// Limits shared with the server (backend/src/validations/company.validation.js, D28/D29).
const NAME_MIN = 2;
const NAME_MAX = 100;
const ADDRESS_MAX = 500;
const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const LOGO_TYPES = ["image/png", "image/jpeg"];

// API field → form field, for server field errors.
const FIELD_MAP = {
  companyName: "companyName",
  industryTypeId: "industry",
  email: "email",
  phone: "phone",
  address: "address",
};

// GET /company → the form's values.
const toFormValues = (c) => ({
  companyName: c.company_name || "",
  phone: c.company_phone_number || "",
  email: c.company_email || "",
  address: c.address || "",
  industry: c.industry_type_id ? String(c.industry_type_id) : "",
});

// After a profile/logo change the header (name, logo) re-reads /auth/me (D35).
// A failure there must not undo the change the user just saw succeed.
const refreshHeader = () => reloadMe().catch(() => {});
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

// Settings → Company Profile (D27–D29, D35). Loads the company and the industry
// list, then shows the form. Only the owner (ADMIN) edits; everyone else reads.
function CompanyProfile() {
  const { t } = useTranslation("settings");
  const { data, loading, error, reload } = useApiQuery(
    () => Promise.all([companyApi.getCompany(), companyApi.getIndustryTypes()]),
    [],
  );

  if (loading) {
    return <Loader label={t("common:companyProfile.loading")} />;
  }
  if (error || !data) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl">
        <ScreenError message={t("company.toast.loadFailed")} onRetry={reload} />
      </div>
    );
  }
  const [company, industries] = data;
  return <CompanyProfileForm company={company} industries={industries} />;
}

function CompanyProfileForm({ company, industries }) {
  const { t } = useTranslation("settings");
  const { fmtDate } = useFormat();
  const logoRef = useRef();
  const user = useCurrentUser();
  // PUT /company and the logo endpoints are owner-only (D28).
  const canEdit = user?.accessLevel === "ADMIN";

  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState(assetUrl(company.company_logo));
  const hasLogo = !!logoPreview;
  const [logoBusy, setLogoBusy] = useState(false);
  const [metadata, setMetadata] = useState({ id: company.id, createdAt: company.created_at });
  const [confirm, setConfirm] = useState(null);
  // The last saved values, for Discard.
  const [savedValues, setSavedValues] = useState(() => toFormValues(company));

  const {
    register,
    handleSubmit,
    reset,
    control,
    setError,
    formState: { errors },
  } = useForm({
    defaultValues: savedValues,
  });

  const formValues = useWatch({ control });

  // The company returned by a save / logo call → preview, metadata and (after a
  // profile save) the form and its "last saved" values.
  const applyCompany = (c, { resetForm = false } = {}) => {
    setLogoPreview(assetUrl(c.company_logo));
    setMetadata({ id: c.id, createdAt: c.created_at });
    if (resetForm) {
      const values = toFormValues(c);
      setSavedValues(values);
      reset(values);
    }
  };

  const onProfileSave = async (data) => {
    setSaving(true);
    try {
      const updated = await companyApi.updateCompany({
        companyName: data.companyName.trim(),
        industryTypeId: data.industry,
        email: data.email.trim(),
        phone: data.phone.trim(),
        address: data.address.trim(),
      });
      applyCompany(updated, { resetForm: true });
      toast.success(t("company.saved"));
      refreshHeader();
    } catch (err) {
      const { mapped } = applyFieldErrors(err, setError, {
        fieldMap: FIELD_MAP,
        knownFields: Object.values(FIELD_MAP),
      });
      if (!mapped.length) toastApiError(err, t("company.toast.updateFailed"));
    } finally {
      setSaving(false);
    }
  };

  const onLogoSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    // Same rule as the server (D29); nothing is uploaded when it fails.
    if (!LOGO_TYPES.includes(file.type) || file.size > LOGO_MAX_BYTES) {
      toast.error(t("company.validation.logoInvalid"));
      return;
    }
    setLogoBusy(true);
    try {
      applyCompany(await companyApi.uploadLogo(file));
      toast.success(t("common:companyProfile.logoUpdated"));
      refreshHeader();
    } catch (err) {
      toastApiError(err, t("company.toast.logoUpdateFailed"));
    } finally {
      setLogoBusy(false);
    }
  };

  const onLogoDelete = async () => {
    setLogoBusy(true);
    try {
      applyCompany(await companyApi.removeLogo());
      toast.success(t("common:companyProfile.logoRemoved"));
      refreshHeader();
    } catch (err) {
      toastApiError(err, t("company.toast.logoRemoveFailed"));
    } finally {
      setLogoBusy(false);
    }
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
              validate: (v) => {
                const name = (v || "").trim();
                if (!name) return t("company.validation.nameRequired");
                if (name.length < NAME_MIN) return t("company.validation.nameMin");
                if (name.length > NAME_MAX) return t("company.validation.nameMax");
                return true;
              },
            })}
            disabled={!canEdit}
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
              disabled={!canEdit}
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
              disabled={!canEdit}
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
              validate: (v) => !!(v || "").trim() || t("company.validation.emailRequired"),
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: t("company.validation.emailValid"),
              },
            })}
            type="email"
            disabled={!canEdit}
            className={inputCls(errors.email)}
          />
          <FieldErr error={errors.email} />
        </div>

        {/* HQ Address */}
        <div>
          <label className={labelCls}>{t("company.address")}</label>
          <textarea
            {...register("address", {
              validate: (v) => {
                const address = (v || "").trim();
                if (!address) return t("company.validation.addressRequired");
                if (address.length > ADDRESS_MAX) return t("company.validation.addressMax");
                return true;
              },
            })}
            disabled={!canEdit}
            rows={4}
            className={inputCls(errors.address) + " resize-none"}
          />
          <FieldErr error={errors.address} />
        </div>

        {/* Actions (owner only) */}
        {canEdit && (
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
        )}
      </div>

      {/* Right: Branding + Strength + Metadata */}
      <div className="w-full lg:w-64 xl:w-72 flex-shrink-0 space-y-4">
        {/* Company Branding */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 text-center">
          <p className="text-sm font-semibold text-gray-700 mb-4 text-start">
            {t("company.branding")}
          </p>
          <div
            onClick={() => canEdit && !logoBusy && logoRef.current.click()}
            className={`w-28 h-28 mx-auto border-2 border-dashed border-gray-200 rounded-xl bg-gray-50 flex items-center justify-center overflow-hidden mb-3 ${canEdit ? "cursor-pointer hover:border-cyan-400 transition-colors" : ""}`}
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
          {canEdit && (
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
          )}
          {canEdit && (
            <input
              ref={logoRef}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={onLogoSelected}
            />
          )}
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
              { label: t("company.metaCompanyId"), value: <Ltr className="break-all">{metadata?.id ? `CMP-${metadata.id}` : t("company.na")}</Ltr> },
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
