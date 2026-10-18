import { useRef, useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { groupedDocumentTypes, uploadDocument, EMPLOYEE_RECORDS } from "../../data/groupB";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import {
  MdOutlineCloudUpload,
  MdOutlineDescription,
  MdOutlineDelete,
  MdOutlineLightbulb,
  MdOutlineCheckCircle,
  MdOutlineWarningAmber,
  MdOutlineOpenInNew,
  MdChevronRight,
  MdOutlinePerson,
} from "react-icons/md";
import CustomDropdown from "../../components/CustomDropdown";

// ── Static data ───────────────────────────────────────────────────────────────
const COMPLIANCE_ITEMS = [
  { labelKey: "add.sidebar.items.nationalIdVerified", status: "verified" },
  { labelKey: "add.sidebar.items.contractSigned", status: "verified" },
  { labelKey: "add.sidebar.items.passportMissing", status: "missing" },
];

function SearchableSelect({ options, value, onChange, placeholder, error }) {
  const { t } = useTranslation("documents");
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => opt.label.toLowerCase().includes(search.toLowerCase()));
  const selectedOpt = options.find(opt => String(opt.value) === String(value));

  return (
    <div className="relative" ref={dropdownRef}>
      <div
        className={`w-full border rounded-lg px-3 py-2.5 text-sm bg-white cursor-pointer flex justify-between items-center transition ${error ? "border-red-400 bg-red-50" : "border-gray-200"
          }`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={selectedOpt ? "text-gray-700" : "text-gray-400"}>
          {selectedOpt ? selectedOpt.label : placeholder}
        </span>
        <span className="text-gray-400 text-xs">▾</span>
      </div>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto custom-scrollbar">
          <div className="sticky top-0 bg-white p-2 border-b border-gray-100">
            <input
              type="text"
              className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-cyan-500"
              placeholder={t("add.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="py-1">
            {filteredOptions.length > 0 ? filteredOptions.map((opt) => (
              <div
                key={opt.value}
                className="px-3 py-2 text-sm text-gray-700 hover:bg-cyan-50 cursor-pointer"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                  setSearch("");
                }}
              >
                {opt.label}
              </div>
            )) : (
              <div className="px-3 py-2 text-sm text-gray-500">{t("add.noResults")}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function AddNewDocument({ onCancel, onComplete }) {
  const { t } = useTranslation("documents");
  const navigate = useNavigate();
  const fileInputRef = useRef();
  const [uploadedFile, setUploadedFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [saved, setSaved] = useState(false);

  const [documentTypes] = useState(() => groupedDocumentTypes());
  const employeesList = EMPLOYEE_RECORDS;

  const groupedData = documentTypes?.data || {};
  const docTypesList = Object.values(groupedData).flat().filter(Boolean);

  const employeeOptions = employeesList.map(emp => {
    const name = emp.full_name || emp.name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || t("my.unknownEmployee");
    return {
      value: emp.id || emp._id || emp.employee_id,
      label: name
    };
  });

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    trigger,
    watch,
    formState: { errors },
  } = useForm();

  // ── File handling ──────────────────────────────────────────────────────────
  const handleFileDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer?.files?.[0] || e.target?.files?.[0];
    if (file) {
      setUploadedFile({
        name: file.name,
        size: (file.size / (1024 * 1024)).toFixed(1) + " MB",
        status: "COMPLETE",
        file: file
      });
    }
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const onSubmit = async (data) => {
    if (!uploadedFile?.file) {
      toast.error(t("add.toasts.fileRequired"));
      return;
    }

    // Static build: the document is added to the in-memory store.
    uploadDocument({
      employeeId: data.employee,
      documentTypeId: data.docType,
      documentNumber: data.referenceNumber,
      issuingAuthority: data.issuingAuthority,
      issueDate: data.issueDate,
      expiryDate: data.expiryDate,
      fileName: uploadedFile.file.name,
    });
    toast.success(t("add.toasts.uploaded"));
    setSaved(true);
    setTimeout(() => {
      onComplete ? onComplete() : navigate("/admin/documents");
    }, 1500);
  };

  // ── Success screen ─────────────────────────────────────────────────────────
  if (saved) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-4 px-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <MdOutlineCheckCircle className="text-green-600 text-4xl" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">{t("add.savedTitle")}</h2>
          <p className="text-sm text-gray-500">
            {t("add.savedMessage")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 w-full">
      {/* ── Breadcrumb ── */}
      <nav className="flex items-center gap-1 text-sm">
        <Link
          to="/documents"
          className="text-cyan-600 hover:text-cyan-700 font-medium transition-colors"
        >
          {t("add.breadcrumb.documents")}
        </Link>
        <MdChevronRight className="text-gray-400 rtl:rotate-180" />
        <span className="text-gray-500">{t("add.breadcrumb.uploadDocument")}</span>
      </nav>

      {/* ── Page Title ── */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
          {t("add.title")}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {t("add.subtitle")}
        </p>
      </div>

      {/* ── Main grid: form (left) + sidebar (right) ── */}
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="flex flex-col lg:flex-row gap-6">
          {/* ── LEFT: form sections ── */}
          <div className="flex-1 space-y-5">
            {/* ── Section 01: General Information ── */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 bg-cyan-50 text-cyan-600 text-xs font-bold rounded-lg flex items-center justify-center flex-shrink-0">
                  01
                </span>
                <h2 className="text-base font-bold text-gray-900">
                  {t("add.sections.generalInformation")}
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Select Employee */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    {t("add.selectEmployee")}
                  </label>
                  <SearchableSelect
                    options={employeeOptions}
                    value={watch("employee")}
                    onChange={(val) => setValue("employee", val, { shouldValidate: true })}
                    placeholder={t("add.selectEmployeePlaceholder")}
                    error={errors.employee}
                  />
                  {/* Hidden input to register the field with React Hook Form rules */}
                  <input type="hidden" {...register("employee", { required: t("add.validation.employeeRequired") })} />
                  {errors.employee && (
                    <p className="text-xs text-red-500 mt-1">
                      {errors.employee.message}
                    </p>
                  )}
                </div>

                {/* Document Type */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    {t("add.documentType")}
                  </label>
                  <div className="relative">
                    <CustomDropdown
                      {...register("docType", {
                        required: t("add.validation.docTypeRequired"),
                      })}
                      value={watch("docType")}
                      placeholder={t("add.documentTypePlaceholder")}
                      options={docTypesList.map(d => ({ label: d.label, value: d.id }))}
                      className={errors.docType ? "border-red-400 bg-red-50 rounded-lg" : ""}
                    />
                  </div>
                  {errors.docType && (
                    <p className="text-xs text-red-500 mt-1">
                      {errors.docType.message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* ── Section 02: Upload Document ── */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 bg-cyan-50 text-cyan-600 text-xs font-bold rounded-lg flex items-center justify-center flex-shrink-0">
                  02
                </span>
                <h2 className="text-base font-bold text-gray-900">
                  {t("add.sections.uploadDocument")}
                </h2>
              </div>

              {/* Drop zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl px-6 py-10 flex flex-col items-center gap-3 cursor-pointer transition-colors ${dragging
                  ? "border-cyan-400 bg-cyan-50"
                  : "border-gray-200 hover:border-cyan-300 hover:bg-gray-50"
                  }`}
              >
                <MdOutlineCloudUpload className="text-gray-300 text-5xl" />
                <div className="text-center">
                  <p className="text-sm font-bold text-gray-800">
                    {t("add.dropzone.title")}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {t("add.dropzone.hint")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="mt-1 px-5 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  {t("add.dropzone.browseFiles")}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={handleFileDrop}
                />
              </div>

              {/* Uploaded file row */}
              {uploadedFile && (
                <div className="flex items-center gap-3 border border-gray-200 rounded-xl px-4 py-3 bg-white">
                  <div className="w-9 h-9 bg-cyan-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <MdOutlineDescription className="text-cyan-600 text-xl" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {uploadedFile.name}
                    </p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      {uploadedFile.size} • {t(`statusLabels.${uploadedFile.status}`, { defaultValue: uploadedFile.status })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUploadedFile(null)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                  >
                    <MdOutlineDelete className="text-xl" />
                  </button>
                </div>
              )}
            </div>

            {/* ── Section 03: Document Metadata ── */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 bg-cyan-50 text-cyan-600 text-xs font-bold rounded-lg flex items-center justify-center flex-shrink-0">
                  03
                </span>
                <h2 className="text-base font-bold text-gray-900">
                  {t("add.sections.documentMetadata")}
                </h2>
              </div>

              {/* Issue Date + Expiry Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    {t("add.issueDate")}
                  </label>
                  <input
                    type="date"
                    {...register("issueDate", {
                      required: t("add.validation.issueDateRequired"),
                      validate: (val) => {
                        const exp = getValues("expiryDate");
                        if (!val || !exp) return true;
                        return (
                          new Date(val) < new Date(exp) ||
                          t("add.validation.issueBeforeExpiry")
                        );
                      },
                      onChange: () => {
                        if (getValues("expiryDate")) trigger("expiryDate");
                      },
                    })}
                    className={`w-full border rounded-lg px-3 py-2.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 transition ${errors.issueDate
                      ? "border-red-400 bg-red-50"
                      : "border-gray-200"
                      }`}
                    placeholder="mm/dd/yyyy"
                  />
                  {errors.issueDate && (
                    <p className="text-xs text-red-500 mt-1">
                      {errors.issueDate.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    {t("add.expiryDate")}
                  </label>
                  <input
                    type="date"
                    {...register("expiryDate", {
                      required: t("add.validation.expiryDateRequired"),
                      validate: (val) => {
                        const iss = getValues("issueDate");
                        if (!val || !iss) return true;
                        return (
                          new Date(val) > new Date(iss) ||
                          t("add.validation.expiryAfterIssue")
                        );
                      },
                      onChange: () => {
                        if (getValues("issueDate")) trigger("issueDate");
                      },
                    })}
                    className={`w-full border rounded-lg px-3 py-2.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 transition ${errors.expiryDate
                      ? "border-red-400 bg-red-50"
                      : "border-gray-200"
                      }`}
                    placeholder="mm/dd/yyyy"
                  />
                  {errors.expiryDate && (
                    <p className="text-xs text-red-500 mt-1">
                      {errors.expiryDate.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Issuing Authority */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  {t("add.issuingAuthority")}
                </label>
                <input
                  type="text"
                  {...register("issuingAuthority", {
                    required: t("add.validation.issuingAuthorityRequired"),
                    maxLength: {
                      value: 150,
                      message: t("add.validation.max150")
                    }
                  })}
                  maxLength={150}
                  placeholder={t("add.issuingAuthorityPlaceholder")}
                  className={`w-full border rounded-lg px-3 py-2.5 text-sm text-gray-700 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition ${errors.issuingAuthority
                    ? "border-red-400 bg-red-50"
                    : "border-gray-200"
                    }`}
                />
                {errors.issuingAuthority && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.issuingAuthority.message}
                  </p>
                )}
              </div>

              {/* Reference Number */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  {t("add.referenceNumber")}
                </label>
                <input
                  type="text"
                  {...register("referenceNumber", {
                    required: t("add.validation.referenceRequired"),
                    minLength: { value: 4, message: t("add.validation.min4") },
                  })}
                  onInput={(e) => {
                    e.target.value = e.target.value.replace(/[^a-zA-Z0-9]/g, "");
                  }}
                  placeholder={t("add.referenceNumberPlaceholder")}
                  className={`w-full border rounded-lg px-3 py-2.5 text-sm text-gray-700 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition ${errors.referenceNumber
                    ? "border-red-400 bg-red-50"
                    : "border-gray-200"
                    }`}
                />
                {errors.referenceNumber && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.referenceNumber.message}
                  </p>
                )}
              </div>
            </div>

            {/* ── Footer Buttons ── */}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pb-4">
              <button
                type="button"
                onClick={() => (onCancel ? onCancel() : navigate("/documents"))}
                className="w-full sm:w-auto px-8 py-3 text-sm font-semibold text-gray-600 hover:text-gray-800 transition-colors"
              >
                {t("add.cancel")}
              </button>
              <button
                type="submit"
                className="w-full sm:w-auto px-8 py-3 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {t("add.saveDocument")}
              </button>
            </div>
          </div>

          {/* ── RIGHT: sidebar ── */}
          <div className="w-full lg:w-72 xl:w-80 space-y-4 flex-shrink-0">
            {/* Compliance Tip */}
            <div className="bg-cyan-600 rounded-xl p-5 space-y-2">
              <MdOutlineLightbulb className="text-white text-2xl" />
              <p className="text-white font-bold text-base">{t("add.sidebar.complianceTipTitle")}</p>
              <p className="text-cyan-100 text-sm leading-relaxed">
                {t("add.sidebar.complianceTipBody")}
              </p>
            </div>

            {/* Employee Stats */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                {t("add.sidebar.employeeStats")}
              </p>

              {/* Employee row */}
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl overflow-hidden bg-gray-200 flex-shrink-0">
                  <div className="w-full h-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center">
                    <MdOutlinePerson className="text-white text-2xl" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">
                    Michael Chen
                  </p>
                  <p className="text-xs text-gray-500">{t("add.sidebar.demoRole")}</p>
                </div>
              </div>

              {/* Compliance score */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs text-gray-600">{t("add.sidebar.complianceScore")}</p>
                  <span className="text-xs font-bold text-gray-800">85%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-500 rounded-full"
                    style={{ width: "85%" }}
                  />
                </div>
              </div>

              {/* Compliance items */}
              <div className="space-y-2.5">
                {COMPLIANCE_ITEMS.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    {item.status === "verified" ? (
                      <MdOutlineCheckCircle className="text-green-500 text-lg flex-shrink-0" />
                    ) : (
                      <MdOutlineWarningAmber className="text-amber-500 text-lg flex-shrink-0" />
                    )}
                    <span className="text-sm text-gray-700">{t(item.labelKey)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Need assistance */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-2">
              <p className="text-sm font-bold text-gray-900">
                {t("add.sidebar.needAssistance")}
              </p>
              <p className="text-sm text-gray-500 leading-relaxed">
                {t("add.sidebar.needAssistanceBody")}
              </p>
              <button
                type="button"
                className="flex items-center gap-1 text-cyan-600 hover:text-cyan-700 text-sm font-semibold transition-colors"
              >
                {t("add.sidebar.viewGuide")}
                <MdOutlineOpenInNew className="text-base" />
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
