import { useEffect, useState, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import {
  MdDeleteOutline,
  MdOutlineEdit,
  MdOutlineHealthAndSafety,
  MdOutlineSchool,
  MdOutlineShield,
  MdPersonOutline,
  MdOutlineDescription,
  MdCheck,
  MdClose,
  MdOutlineVisibility,
  MdOutlineMoreVert,
} from "react-icons/md";
import { dependentsFor, searchCountries } from "../data/groupB";
import { nextId } from "../data/common";
import { TableLoader } from "./Loader";
import Ltr from "./Ltr";
import { useFormat } from "../hooks/useFormat";
import { useCan } from "../hooks/usePermission";
import { MODULES, ACTIONS } from "../constants/permissions";
import CustomDropdown from "./CustomDropdown";
import DependentDetailModal from "./DependentDetailModal";
import DependentRejectModal from "./DependentRejectModal";

const REL_STYLES = {
  SPOUSE: "text-indigo-700 bg-indigo-50 border-indigo-200",
  CHILD: "text-blue-700 bg-blue-50 border-blue-200",
  PARENT: "text-purple-700 bg-purple-50 border-purple-200",
  OTHER: "text-gray-600 bg-gray-100 border-gray-200",
};

const STATUS_STYLES = {
  PENDING: "text-amber-700 bg-amber-50 border-amber-200",
  VERIFIED: "text-green-700 bg-green-50 border-green-200",
  REJECTED: "text-red-700 bg-red-50 border-red-200",
};

const AVATAR_COLORS = [
  ["bg-indigo-200", "text-indigo-700"],
  ["bg-blue-200", "text-blue-700"],
  ["bg-green-200", "text-green-700"],
  ["bg-pink-200", "text-pink-700"],
  ["bg-teal-200", "text-teal-700"],
  ["bg-orange-200", "text-orange-700"],
];

const getInitials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

const EMPTY_FORM = {
  full_name: "",
  relationship: "SPOUSE",
  id_details: "",
  date_of_birth: "",
  gender: "",
  nationality: "",
  contact: "",
};

function ActionMenu({ onView, onVerify, onReject, onEdit, onDelete, canApprove, status, t }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target) &&
        menuRef.current && !menuRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };

    const handleScroll = () => setOpen(false);

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("scroll", handleScroll, true);
      window.addEventListener("resize", handleScroll);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleScroll);
    };
  }, [open]);

  const toggle = (e) => {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const menuHeight = 180;
      const top = rect.bottom + menuHeight > window.innerHeight ? Math.max(10, rect.top - menuHeight - 4) : rect.bottom + 4;
      const left = Math.max(10, rect.right - 140);
      setCoords({ top, left });
    }
    setOpen(!open);
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        title={t("dependent.actions", { defaultValue: "Actions" })}
      >
        <MdOutlineMoreVert className="text-xl" />
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: coords.top, left: coords.left }}
          className="w-36 bg-white rounded-xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.15)] border border-gray-100 z-[9999] py-1.5 animate-fadeIn"
        >
          {onView && (
            <button
              onClick={(e) => { e.stopPropagation(); setOpen(false); onView(); }}
              className="w-full text-left px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:text-cyan-600 flex items-center gap-2.5 transition-colors"
            >
              <MdOutlineVisibility className="text-base text-cyan-500 flex-shrink-0" /> {t("dependent.view", { defaultValue: "View" })}
            </button>
          )}
          {canApprove && status !== "VERIFIED" && onVerify && (
            <button
              onClick={(e) => { e.stopPropagation(); setOpen(false); onVerify(); }}
              className="w-full text-left px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:text-emerald-600 flex items-center gap-2.5 transition-colors"
            >
              <MdCheck className="text-base text-emerald-500 flex-shrink-0" /> {t("dependent.verify", { defaultValue: "Verify" })}
            </button>
          )}
          {canApprove && status !== "REJECTED" && onReject && (
            <button
              onClick={(e) => { e.stopPropagation(); setOpen(false); onReject(); }}
              className="w-full text-left px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:text-rose-600 flex items-center gap-2.5 transition-colors"
            >
              <MdClose className="text-base text-rose-500 flex-shrink-0" /> {t("dependent.reject", { defaultValue: "Reject" })}
            </button>
          )}
          {onEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); setOpen(false); onEdit(); }}
              className="w-full text-left px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:text-blue-600 flex items-center gap-2.5 transition-colors"
            >
              <MdOutlineEdit className="text-base text-blue-500 flex-shrink-0" /> {t("dependent.edit", { defaultValue: "Edit" })}
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete(); }}
              className="w-full text-left px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:text-red-600 flex items-center gap-2.5 transition-colors"
            >
              <MdDeleteOutline className="text-base text-red-500 flex-shrink-0" /> {t("dependent.delete", { defaultValue: "Delete" })}
            </button>
          )}
        </div>,
        document.body
      )}
    </>
  );
}

function DependentTab({ onSwitchTab }) {
  const { t } = useTranslation("employees");
  const { fmtDate } = useFormat();
  const { id: employeeId } = useParams();

  const can = useCan();
  // Verify/Reject is only for users who can create AND edit employees.
  const canApprove =
    can(MODULES.EMPLOYEE, ACTIONS.CREATE) && can(MODULES.EMPLOYEE, ACTIONS.UPDATE);

  const relationshipLabel = (rel) => {
    const map = {
      SPOUSE: t("dependent.relationships.spouse"),
      CHILD: t("dependent.relationships.child"),
      PARENT: t("dependent.relationships.parent"),
      OTHER: t("dependent.relationships.other"),
    };
    return map[rel] || rel;
  };
  const statusLabel = (s) =>
    ({
      PENDING: t("dependent.statuses.pending"),
      VERIFIED: t("dependent.statuses.verified"),
      REJECTED: t("dependent.statuses.rejected"),
    })[s] ||
    s ||
    t("dependent.statuses.pending");
  const formatDob = (iso) => (iso ? fmtDate(iso) : "—");

  const [dependents, setDependents] = useState(() => dependentsFor(employeeId));
  const [loading] = useState(false);
  const [saving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [viewingDependent, setViewingDependent] = useState(null);
  const [rejectingDependent, setRejectingDependent] = useState(null);

  const [countries, setCountries] = useState(() => searchCountries("", 100));
  const searchTimeoutRef = useRef(null);

  const loadCountries = (search = "") => {
    setCountries(searchCountries(search, 100));
  };

  const handleCountrySearch = (val) => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      loadCountries(val);
    }, 300);
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm({
    defaultValues: EMPTY_FORM,
  });

  const selectedNationality = watch("nationality");

  const nationalityOptions = useMemo(() => {
    const opts = countries.map((c) => ({ label: c.name, value: c.name }));
    if (selectedNationality && !opts.some((o) => o.value === selectedNationality)) {
      opts.push({ label: selectedNationality, value: selectedNationality });
    }
    return opts;
  }, [countries, selectedNationality]);

  // Static build: changes are applied to local state only.
  const patchDependent = (depId, patch) =>
    setDependents((prev) => prev.map((d) => (d.id === depId ? { ...d, ...patch } : d)));

  const resetForm = () => {
    setShowForm(false);
    setEditId(null);
    reset(EMPTY_FORM);
  };

  const onSubmit = (data) => {
    const documentFile = data.document?.[0];
    const photoFile = data.photo?.[0];
    const fields = {
      full_name: data.full_name.trim(),
      relationship: data.relationship,
      date_of_birth: data.date_of_birth,
      id_details: data.id_details?.trim() || null,
      gender: data.gender || null,
      nationality: data.nationality?.trim() || null,
      contact: data.contact?.trim() || null,
      ...(documentFile
        ? { document_url: URL.createObjectURL(documentFile), document_name: documentFile.name }
        : {}),
      ...(photoFile ? { photo_url: URL.createObjectURL(photoFile) } : {}),
    };

    if (editId !== null) {
      patchDependent(editId, fields);
      toast.success(t("dependent.toast.updated"));
    } else {
      setDependents((prev) => [
        ...prev,
        { id: nextId(prev), status: "PENDING", document_url: null, document_name: null, photo_url: null, ...fields },
      ]);
      toast.success(t("dependent.toast.added"));
    }
    resetForm();
  };

  const handleEdit = (dep) => {
    reset({
      full_name: dep.full_name || "",
      relationship: dep.relationship || "SPOUSE",
      id_details: dep.id_details || "",
      date_of_birth: dep.date_of_birth ? dep.date_of_birth.slice(0, 10) : "",
      gender: dep.gender || "",
      nationality: dep.nationality || "",
      contact: dep.contact || "",
    });
    setEditId(dep.id);
    setShowForm(true);
  };

  const handleDelete = (dep) => {
    if (!window.confirm(t("dependent.confirmRemove", { name: dep.full_name }))) return;
    setDependents((prev) => prev.filter((d) => d.id !== dep.id));
    toast.success(t("dependent.toast.removed"));
  };

  const handleVerify = (dep) => {
    patchDependent(dep.id, { status: "VERIFIED", reject_reason: null });
    toast.success(t("dependent.toast.verified"));
  };

  const handleReject = (dep) => {
    setRejectingDependent(dep);
  };

  const inputCls = (err) =>
    `w-full px-3 py-2.5 border rounded-lg text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition bg-white ${err ? "border-red-400 bg-red-50" : "border-gray-200"}`;

  return (
    <div className="space-y-5">
      {/* ── Main Card ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 lg:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl font-bold text-gray-900">
              {t("dependent.title")}
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              {t("dependent.subtitle")}
            </p>
          </div>
          <button
            onClick={() => {
              setShowForm(true);
              setEditId(null);
              reset(EMPTY_FORM);
            }}
            className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors flex-shrink-0 self-start"
          >
            <MdPersonOutline className="text-lg" /> {t("dependent.addDependent")}
          </button>
        </div>

        {/* Add / Edit Form */}
        {showForm && (
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-5"
          >
            <p className="text-sm font-bold text-gray-800 mb-4">
              {editId ? t("dependent.editDependent") : t("dependent.addNewDependent")}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                  {t("dependent.fullName")} <span className="text-red-500">*</span>
                </label>
                <input
                  {...register("full_name", {
                    required: t("dependent.validation.nameRequired"),
                    minLength: { value: 2, message: t("dependent.validation.nameMin") },
                    maxLength: { value: 50, message: t("dependent.validation.nameMax") },
                  })}
                  onInput={(e) => {
                    let val = e.target.value.replace(/[^\p{L}\s]/gu, "");
                    e.target.value = val;
                  }}
                  placeholder={t("dependent.fullNamePlaceholder")}
                  className={inputCls(errors.full_name)}
                />
                {errors.full_name && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.full_name.message}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                  {t("dependent.relationship")} <span className="text-red-500">*</span>
                </label>
                <CustomDropdown
                  {...register("relationship", { required: t("dependent.validation.relationshipRequired") })}
                  error={!!errors.relationship}
                  options={[
                    { label: t("dependent.relationships.spouse"), value: "SPOUSE" },
                    { label: t("dependent.relationships.child"), value: "CHILD" },
                    { label: t("dependent.relationships.parent"), value: "PARENT" },
                    { label: t("dependent.relationships.other"), value: "OTHER" }
                  ]}
                />
                {errors.relationship && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.relationship.message}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                  {t("dependent.idDetails")}
                </label>
                <input
                  {...register("id_details", {
                    maxLength: {
                      value: 100,
                      message: t("dependent.validation.idDetailsMax"),
                    },
                    validate: {
                      validChars: (v) =>
                        !v ||
                        /^[\p{L}\p{N}\s\-:.,/_#]+$/u.test(v.trim()) ||
                        t("dependent.validation.idDetailsChars"),
                    },
                  })}
                  onInput={(e) => {
                    let val = e.target.value.replace(/(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu, "");
                    e.target.value = val;
                  }}
                  placeholder={t("dependent.idDetailsPlaceholder")}
                  className={inputCls(errors.id_details)}
                />
                {errors.id_details && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.id_details.message}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                  {t("dependent.dateOfBirth")} <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  max={new Date().toISOString().split("T")[0]}
                  {...register("date_of_birth", {
                    required: t("dependent.validation.dobRequired"),
                    validate: (value) => {
                      if (!value) return true;
                      const date = new Date(value);
                      if (isNaN(date.getTime())) return t("dependent.validation.dobInvalid");
                      const year = date.getFullYear();
                      if (year < 1900) return t("dependent.validation.dobInvalidYear");
                      const today = new Date();
                      date.setHours(0, 0, 0, 0);
                      today.setHours(0, 0, 0, 0);
                      return date <= today || t("dependent.validation.dobFuture");
                    }
                  })}
                  className={inputCls(errors.date_of_birth)}
                />
                {errors.date_of_birth && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.date_of_birth.message}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                  {t("dependent.gender")}
                </label>
                <CustomDropdown
                  {...register("gender", { required: t("dependent.validation.genderRequired") })}
                  error={!!errors.gender}
                  options={[
                    { label: t("dependent.genders.select"), value: "" },
                    { label: t("dependent.genders.male"), value: "MALE" },
                    { label: t("dependent.genders.female"), value: "FEMALE" },
                    { label: t("dependent.genders.other"), value: "OTHER" }
                  ]}
                />
                {errors.gender && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.gender.message}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                  {t("dependent.nationality")}
                </label>
                <CustomDropdown
                  {...register("nationality")}
                  error={!!errors.nationality}
                  isSearchable={true}
                  onSearchChange={handleCountrySearch}
                  placeholder={t("add.basic.selectNationality", { defaultValue: "Select Nationality" })}
                  options={nationalityOptions}
                />
                {errors.nationality && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.nationality.message}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                  {t("dependent.contactNumber")}
                </label>
                <input
                  type="tel"
                  {...register("contact", {
                    pattern: {
                      value: /^[0-9]{6,15}$/,
                      message: t("dependent.validation.contactInvalid")
                    }
                  })}
                  onInput={(e) => {
                    let val = e.target.value.replace(/\D/g, ""); // Allow only digits
                    e.target.value = val;
                  }}
                  placeholder={t("dependent.contactPlaceholder")}
                  className={inputCls(errors.contact)}
                />
                {errors.contact && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.contact.message}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                  {t("dependent.documentOptional")}
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  {...register("document", {
                    validate: (value) => {
                      if (value && value[0] && value[0].size > 10 * 1024 * 1024) {
                        return t("dependent.validation.fileTooLarge");
                      }
                      return true;
                    }
                  })}
                  className="w-full text-sm text-gray-600 border border-gray-200 rounded-lg cursor-pointer file:mr-3 file:py-2.5 file:px-3 file:border-0 file:text-xs file:font-semibold file:bg-cyan-50 file:text-cyan-700 hover:file:bg-cyan-100"
                />
                {errors.document && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.document.message}
                  </p>
                )}
                {editId && (
                  <p className="text-[10px] text-gray-400 mt-1">
                    {t("dependent.keepExistingDocument")}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                  {t("dependent.photoOptional")}
                </label>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png"
                  {...register("photo", {
                    validate: (value) => {
                      if (value && value[0] && value[0].size > 10 * 1024 * 1024) {
                        return t("dependent.validation.fileTooLarge");
                      }
                      return true;
                    }
                  })}
                  className="w-full text-sm text-gray-600 border border-gray-200 rounded-lg cursor-pointer file:mr-3 file:py-2.5 file:px-3 file:border-0 file:text-xs file:font-semibold file:bg-cyan-50 file:text-cyan-700 hover:file:bg-cyan-100"
                />
                {errors.photo && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.photo.message}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 justify-end">
              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                className="px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
              >
                {t("dependent.cancel")}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 flex items-center gap-2"
              >
                {saving && (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                {editId ? t("dependent.saveChanges") : t("dependent.addDependent")}
              </button>
            </div>
          </form>
        )}

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto mb-5">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {[
                  { label: t("dependent.table.sn") },
                  { label: t("dependent.table.dependentName") },
                  { label: t("dependent.table.relationship") },
                  { label: t("dependent.table.idDetails") },
                  { label: t("dependent.table.dateOfBirth") },
                  { label: t("dependent.table.document") },
                  { label: t("dependent.table.status") },
                  { label: t("dependent.table.actions"), end: true },
                ].map((h) => (
                  <th
                    key={h.label}
                    className={`text-start px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider ${h.end ? "text-end" : ""}`}
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <TableLoader colSpan={8} label={t("dependent.loading")} />
              ) : dependents.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="py-10 text-center text-sm text-gray-400"
                  >
                    {t("dependent.empty")}
                  </td>
                </tr>
              ) : (
                dependents.map((dep, idx) => {
                  const [bg, text] = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                  return (
                    <tr
                      key={dep.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-4 text-sm text-gray-700">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          {dep.photo_url ? (
                            <img
                              src={dep.photo_url}
                              alt={dep.full_name}
                              className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                            />
                          ) : (
                            <div
                              className={`w-9 h-9 rounded-full ${bg} ${text} text-xs font-bold flex items-center justify-center flex-shrink-0`}
                            >
                              {getInitials(dep.full_name)}
                            </div>
                          )}
                          <p className="text-sm font-semibold text-gray-900">
                            {dep.full_name}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded text-[10px] font-bold border ${REL_STYLES[dep.relationship] || REL_STYLES.OTHER}`}
                        >
                          {relationshipLabel(dep.relationship)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        {dep.id_details ? <Ltr>{dep.id_details}</Ltr> : "—"}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700">
                        <Ltr>{formatDob(dep.date_of_birth)}</Ltr>
                      </td>
                      <td className="px-4 py-4 text-sm">
                        {dep.document_url ? (
                          <a
                            href={dep.document_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-cyan-600 hover:text-cyan-700 hover:underline max-w-[160px]"
                            title={dep.document_name || t("dependent.viewDocument")}
                          >
                            <MdOutlineDescription className="text-base flex-shrink-0" />
                            <span className="truncate">
                              {dep.document_name || t("dependent.view")}
                            </span>
                          </a>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded text-[10px] font-bold border ${STATUS_STYLES[dep.status] || STATUS_STYLES.PENDING}`}
                          title={dep.reject_reason || ""}
                        >
                          {statusLabel(dep.status)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end">
                          <ActionMenu
                            onView={() => setViewingDependent(dep)}
                            onVerify={() => handleVerify(dep)}
                            onReject={() => handleReject(dep)}
                            onEdit={() => handleEdit(dep)}
                            onDelete={() => handleDelete(dep)}
                            canApprove={canApprove}
                            status={dep.status}
                            t={t}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden divide-y divide-gray-100 mb-5">
          {loading ? (
            <p className="py-10 text-center text-sm text-gray-400">
              {t("dependent.loading")}
            </p>
          ) : dependents.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">
              {t("dependent.empty")}
            </p>
          ) : (
            dependents.map((dep, idx) => {
              const [bg, text] = AVATAR_COLORS[idx % AVATAR_COLORS.length];
              return (
                <div key={dep.id} className="flex items-start gap-3 py-4">
                  <div
                    className={`w-10 h-10 rounded-full ${bg} ${text} text-sm font-bold flex items-center justify-center flex-shrink-0`}
                  >
                    {getInitials(dep.full_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm font-semibold text-gray-900">
                        {dep.full_name}
                      </p>
                      <div className="flex items-center flex-shrink-0">
                        <ActionMenu
                          onView={() => setViewingDependent(dep)}
                          onVerify={() => handleVerify(dep)}
                          onReject={() => handleReject(dep)}
                          onEdit={() => handleEdit(dep)}
                          onDelete={() => handleDelete(dep)}
                          canApprove={canApprove}
                          status={dep.status}
                          t={t}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${STATUS_STYLES[dep.status] || STATUS_STYLES.PENDING}`}
                      >
                        {statusLabel(dep.status)}
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${REL_STYLES[dep.relationship] || REL_STYLES.OTHER}`}
                      >
                        {relationshipLabel(dep.relationship)}
                      </span>
                      {dep.id_details && (
                        <span>
                          <Ltr>{dep.id_details}</Ltr>
                        </span>
                      )}
                      <span>
                        {t("dependent.dob")} <Ltr>{formatDob(dep.date_of_birth)}</Ltr>
                      </span>
                      {dep.document_url && (
                        <a
                          href={dep.document_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-cyan-600 hover:underline"
                        >
                          <MdOutlineDescription className="text-sm" />
                          {dep.document_name || t("dependent.table.document")}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Documentation Required Banner */}
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-4">
          <MdOutlineShield className="text-indigo-500 text-xl flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-indigo-600 mb-1">
              {t("dependent.documentationRequired")}
            </p>
            <p className="text-sm text-gray-600 leading-relaxed">
              {t("dependent.documentationRequiredBefore")}{" "}
              <button
                onClick={() => onSwitchTab?.("Documents")}
                className="text-cyan-600 underline font-medium hover:text-cyan-700 transition-colors"
              >
                {t("dependent.documentsTab")}
              </button>{" "}
              {t("dependent.documentationRequiredAfter")}
            </p>
          </div>
        </div>
      </div>

      {/* ── Bottom: Coverage + Allowance (informational) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Coverage Overview */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">
            {t("dependent.coverageOverview")}
          </p>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-700">{t("dependent.familyHealthPlan")}</p>
            <p className="text-sm font-bold text-green-600">{t("dependent.active")}</p>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-4">
            <div className="h-full w-full bg-green-500 rounded-full" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-cyan-50 rounded-lg flex items-center justify-center">
              <MdOutlineHealthAndSafety className="text-cyan-500 text-base" />
            </div>
            <p className="text-sm text-gray-700">{t("dependent.standardPpoCoverage")}</p>
          </div>
        </div>

        {/* Annual Allowance */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">
            {t("dependent.annualAllowance")}
          </p>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-700">{t("dependent.dependentEducationCredit")}</p>
            <p className="text-sm font-bold text-gray-900">
              <Ltr>$1,200 / $2,500</Ltr>
            </p>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-4">
            <div className="h-full w-[48%] bg-blue-500 rounded-full" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
              <MdOutlineSchool className="text-blue-500 text-base" />
            </div>
            <p className="text-sm text-gray-700">{t("dependent.utilization")}</p>
          </div>
        </div>
      </div>

      {/* ── Dependent Detail Modal ── */}
      <DependentDetailModal
        dependent={viewingDependent}
        onClose={() => setViewingDependent(null)}
        relationshipLabel={relationshipLabel}
        statusLabel={statusLabel}
        statusStyles={STATUS_STYLES}
        relStyles={REL_STYLES}
      />

      {/* ── Dependent Reject Modal ── */}
      {rejectingDependent && (
        <DependentRejectModal
          dependent={rejectingDependent}
          employeeId={employeeId}
          onClose={() => setRejectingDependent(null)}
          onSuccess={(reason) => {
            patchDependent(rejectingDependent.id, { status: "REJECTED", reject_reason: reason || null });
            setRejectingDependent(null);
          }}
        />
      )}
    </div>
  );
}

export default DependentTab;
