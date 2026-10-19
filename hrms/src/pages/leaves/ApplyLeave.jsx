import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import {
  MdOutlineCalendarToday,
  MdOutlineUploadFile,
  MdInfoOutline,
  MdOutlineBeachAccess,
  MdOutlineLocalHospital,
  MdOutlineMoreHoriz,
  MdOutlineError,
  MdOutlineClose,
  MdOutlineCheckCircle,
  MdOutlineChevronRight,
} from "react-icons/md";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Ltr from "../../components/Ltr";
import { toast } from "react-toastify";
import CustomDropdown from "../../components/CustomDropdown";
import NoticeBanner from "../../components/exits/NoticeBanner";
import useFiscalYear from "../../hooks/useFiscalYear";
import { LS_MY_LEAVE_BALANCES } from "../../data/groupD";
import { lockedYearOf } from "../../hooks/useYearLock";
import CarriedLeaveNote from "../../components/leave/CarriedLeaveNote";

// ── Constants ─────────────────────────────────────────────────────────────────
const LEAVE_TYPES_ICONS = {
  1: {
    icon: MdOutlineBeachAccess,
    iconColor: "text-cyan-500",
    iconBg: "bg-cyan-50",
  },
  2: {
    icon: MdOutlineLocalHospital,
    iconColor: "text-orange-500",
    iconBg: "bg-orange-50",
  },
  3: {
    icon: MdOutlineMoreHoriz,
    iconColor: "text-purple-500",
    iconBg: "bg-purple-50",
  },
};

const SESSION_TYPES = [
  { value: "FULL_DAY", labelKey: "apply.sessions.fullDay" },
  { value: "FIRST_HALF", labelKey: "apply.sessions.firstHalf" },
  { value: "SECOND_HALF", labelKey: "apply.sessions.secondHalf" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
// Local calendar date (not UTC) as YYYY-MM-DD, `offset` days from today.
const localDate = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Same window the backend enforces: leave may be back-dated up to 30 days
// (e.g. sick leave filed afterwards) and planned up to 365 days ahead.
const LEAVE_BACKDATE_DAYS = 30;
const LEAVE_MAX_AHEAD_DAYS = 365;
const minLeaveDate = localDate(-LEAVE_BACKDATE_DAYS);
const maxLeaveDate = localDate(LEAVE_MAX_AHEAD_DAYS);

// Supporting document: same types / size the backend accepts.
const DOC_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];
const DOC_MAX_BYTES = 10 * 1024 * 1024;

const inputBase =
  "w-full ps-10 pe-4 py-2.5 border rounded-lg text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition bg-white";
const inputCls = (err) =>
  `${inputBase} ${err ? "border-red-400 bg-red-50" : "border-gray-200"}`;
const labelCls =
  "block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5";

const FieldErr = ({ error }) =>
  error ? (
    <p className="flex items-center gap-1 text-xs text-red-500 mt-1.5">
      <MdOutlineError className="flex-shrink-0 text-sm" />
      {error.message}
    </p>
  ) : null;

// ── Main Component ────────────────────────────────────────────────────────────
export default function ApplyLeave({ onBack, onCancel }) {
  const { t } = useTranslation("leaves");
  const { t: tFy } = useTranslation("fiscalYear");
  const fy = useFiscalYear();
  const navigate = useNavigate();
  const location = useLocation();
  const backLink = location.pathname.includes('/my-requests') 
    ? '/admin/my-requests/leave' 
    : location.pathname.includes('/employee') 
      ? '/employee/my-leaves' 
      : '/admin/leave-management';
  // The employee's balances for the selected FY (each row carries the leave type).
  const myLeavesBalances = { data: LS_MY_LEAVE_BALANCES };
  const leaveTypesListLoading = false;
  const assignedBalances = myLeavesBalances.data.leave_balances;
  const leaveTypes = assignedBalances.map((lb) => ({
    ...lb,
    leave_name: lb.leave_name || lb.name,
  }));
  const [selectedLeaveTypeId, setSelectedLeaveTypeId] = useState(leaveTypes[0]?.id ?? null);
  const [selectedOtherLeaveId, setSelectedOtherLeaveId] = useState(null);
  const [isOtherLeaveSelected, setIsOtherLeaveSelected] = useState(false);
  const [sessionType, setSessionType] = useState("FULL_DAY");
  const [uploadedFile, setUploadedFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const loading = false;
  const error = null;
  const fileRef = useRef();
  const mainLeaveTypes = leaveTypes.slice(0, 2);
  const otherLeaveTypes = leaveTypes.slice(2);

  const selectedLeaveType = leaveTypes.find(
    (lt) => lt.id === selectedLeaveTypeId,
  );
  const selectedOtherLeave = leaveTypes.find(
    (lt) => lt.id === selectedOtherLeaveId,
  );

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    mode: "onTouched",
    defaultValues: {
      from_date: "",
      to_date: "",
      reason: "",
    },
  });

  const from_date = watch("from_date");
  const to_date = watch("to_date");

  const totalDayCount = (start, end) => {
    if (!start || !end) return 0;
    const s = new Date(start),
      e = new Date(end);
    if (s > e) return 0;
    return Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
  };

  const selected =
    sessionType === "FULL_DAY" ? totalDayCount(from_date, to_date) : 0.5;

  const handleLeaveTypeChange = (id) => {
    setSelectedLeaveTypeId(id);
    setValue("leaveType", id);
    // Check if this is an "Other" leave type selection
    if (otherLeaveTypes.some((lt) => lt.id === id)) {
      setIsOtherLeaveSelected(true);
      setSelectedOtherLeaveId(id);
    } else {
      setIsOtherLeaveSelected(false);
      setSelectedOtherLeaveId(null);
    }
  };

  const handleOtherLeaveChange = (id) => {
    setSelectedOtherLeaveId(id);
    setSelectedLeaveTypeId(id);
    setValue("leaveType", id);
  };

  const handleFile = (f) => {
    if (!f) return;
    const name = (f.name || "").toLowerCase();
    if (!DOC_EXTENSIONS.some((ext) => name.endsWith(ext))) {
      toast.error(t("validation.fileType"));
      return;
    }
    if (f.size > DOC_MAX_BYTES) {
      toast.error(t("validation.fileTooLarge"));
      return;
    }
    setUploadedFile({
      file: f,
      file_name: f.name,
      file_size: f.size,
      file_type: f.type,
    });
  };

  // Static build: the form validated client-side → show the success state.
  const onSubmit = () => {
    toast.success(t("toast.applySuccess"));
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
          <MdOutlineCheckCircle className="text-green-500 text-4xl" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">
          {t("apply.submitted.title")}
        </h2>
        <p className="text-sm text-gray-400 text-center max-w-xs">
          {t("apply.submitted.body")}
        </p>
        <button
          onClick={() => (onBack ? onBack() : navigate(backLink))}
          className="mt-2 px-6 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-semibold transition-colors"
        >
          {t("apply.submitted.backToManagement")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-1.5 text-sm flex-wrap">
        <button
          onClick={() => (onBack ? onBack() : navigate(backLink))}
          className="text-gray-400 hover:text-cyan-600 transition-colors"
        >
          {t("common.leaveManagement")}
        </button>
        <MdOutlineChevronRight className="text-gray-300 rtl:rotate-180" />
        <span className="text-cyan-600 font-semibold">
          {t("apply.breadcrumb")}
        </span>
      </div>

      {/* ── Page Header ── */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
          {t("apply.title")}
        </h1>
        <p className="text-gray-400 mt-1 text-sm">{t("apply.subtitle")}</p>
      </div>

      <NoticeBanner />

      {/* ── Two-column layout ── */}
      <div className="flex flex-col lg:flex-row gap-5 items-start">
        {/* ── LEFT: Form ── */}
        <div className="flex-1 bg-white border border-gray-200 rounded-xl p-5 lg:p-6 space-y-5">
          {/* Leave Type cards */}
          <div>
            <label className={labelCls}>{t("apply.leaveType")}</label>
            {leaveTypesListLoading || leaveTypes.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600 mb-2"></div>
                  <p className="text-gray-400 text-sm">
                    {t("apply.loadingLeaveTypes")}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  {/* Main Leave Types (First 2) */}
                  {mainLeaveTypes.map(
                    ({ id, leave_name, is_paid, allow_half_day }) => {
                      const iconData =
                        LEAVE_TYPES_ICONS[id] || LEAVE_TYPES_ICONS[1];
                      const Icon = iconData.icon;
                      return (
                        <label
                          key={id}
                          className={`flex items-center justify-between p-4 border-2 rounded-xl cursor-pointer transition-all ${selectedLeaveTypeId === id
                            ? "border-cyan-500 bg-cyan-50/40"
                            : "border-gray-200 hover:border-gray-300"
                            }`}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div
                              className={`w-8 h-8 ${iconData.iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}
                            >
                              <Icon
                                className={`${iconData.iconColor} text-lg`}
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">
                                {leave_name}
                              </p>
                              <p className="text-xs text-gray-400">
                                {is_paid
                                  ? t("common.paid")
                                  : t("common.unpaid")}
                                {allow_half_day &&
                                  ` • ${t("apply.halfDayAllowed")}`}
                              </p>
                            </div>
                          </div>
                          <input
                            type="radio"
                            name="leaveType"
                            value={id}
                            checked={selectedLeaveTypeId === id}
                            onChange={() => handleLeaveTypeChange(id)}
                            className="w-4 h-4 accent-cyan-600 flex-shrink-0 ms-2"
                          />
                        </label>
                      );
                    },
                  )}

                  {/* Other Leave Type Card */}
                  {otherLeaveTypes.length > 0 && (
                    <label
                      className={`flex items-center justify-between p-4 border-2 rounded-xl cursor-pointer transition-all ${isOtherLeaveSelected
                        ? "border-cyan-500 bg-cyan-50/40"
                        : "border-gray-200 hover:border-gray-300"
                        }`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div
                          className={`w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center flex-shrink-0`}
                        >
                          <MdOutlineMoreHoriz
                            className={`text-purple-500 text-lg`}
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {t("apply.otherLeave")}
                          </p>
                          <p className="text-xs text-gray-400">
                            {t("apply.viewMoreOptions")}
                          </p>
                        </div>
                      </div>
                      <input
                        type="radio"
                        name="leaveType"
                        checked={isOtherLeaveSelected}
                        onChange={() => {
                          setIsOtherLeaveSelected(true);
                          if (
                            !selectedOtherLeaveId &&
                            otherLeaveTypes.length > 0
                          ) {
                            handleOtherLeaveChange(otherLeaveTypes[0].id);
                          }
                        }}
                        className="w-4 h-4 accent-cyan-600 flex-shrink-0 ms-2"
                      />
                    </label>
                  )}
                </div>

                {/* Other Leave Types Dropdown */}
                {isOtherLeaveSelected && otherLeaveTypes.length > 0 && (
                  <div>
                    <label className={labelCls}>
                      {t("apply.selectLeaveType")}{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <CustomDropdown
                        value={selectedOtherLeaveId || ""}
                        onChange={(e) =>
                          handleOtherLeaveChange(parseInt(e.target.value))
                        }
                        options={[
                          { label: t("apply.selectLeaveTypePlaceholder"), value: "" },
                          ...otherLeaveTypes.map(({ id, leave_name }) => ({
                            label: leave_name,
                            value: id
                          }))
                        ]}
                      />
                    </div>
                    {!selectedOtherLeaveId && (
                      <p className="flex items-center gap-1 text-xs text-amber-500 mt-1.5">
                        <MdOutlineError className="text-sm flex-shrink-0" />
                        {t("apply.pleaseSelectLeaveType")}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
            {error && !leaveTypes.length && (
              <FieldErr error={{ message: error }} />
            )}
          </div>

          {/* Session Type Selection - Only show if selected leave type allows half day */}
          {(selectedLeaveType || selectedOtherLeave)?.allow_half_day && (
            <div>
              <label className={labelCls}>{t("apply.sessionType")}</label>
              <div className="grid grid-cols-3 gap-2">
                {SESSION_TYPES.map(({ value, labelKey }) => (
                  <label
                    key={value}
                    className={`flex items-center justify-center p-3 border-2 rounded-lg cursor-pointer transition-all ${sessionType === value
                      ? "border-cyan-500 bg-cyan-50"
                      : "border-gray-200 hover:border-gray-300"
                      }`}
                  >
                    <input
                      type="radio"
                      name="sessionType"
                      value={value}
                      checked={sessionType === value}
                      onChange={(e) => setSessionType(e.target.value)}
                      className="w-4 h-4 accent-cyan-600 me-2"
                    />
                    <span className="text-sm font-medium text-gray-800">
                      {t(labelKey)}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Start + End Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>
                {t("apply.startDate")} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <MdOutlineCalendarToday className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
                <input
                  {...register("from_date", {
                    required: t("validation.startDateRequired"),
                    validate: (v) => {
                      if (v < minLeaveDate)
                        return t("validation.startDateTooOld", { days: LEAVE_BACKDATE_DAYS });
                      if (v > maxLeaveDate)
                        return t("validation.dateTooFar", { days: LEAVE_MAX_AHEAD_DAYS });
                      // No leave inside a closed + locked financial year (backend: PeriodClosed).
                      const closed = lockedYearOf(fy.years, v);
                      if (closed) return tFy("locked.tooltip", { label: closed.label });
                      return true;
                    },
                  })}
                  type="date"
                  min={minLeaveDate}
                  max={maxLeaveDate}
                  className={inputCls(errors.from_date)}
                />
              </div>
              <FieldErr error={errors.from_date} />
            </div>

            <div>
              <label className={labelCls}>
                {t("apply.endDate")}{" "}
                {sessionType === "FULL_DAY" && <span className="text-red-500">*</span>}
              </label>
              <div className="relative">
                <MdOutlineCalendarToday className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
                <input
                  {...register("to_date", {
                    required:
                      sessionType === "FULL_DAY" ||
                        !(
                          selectedLeaveType?.allow_half_day ||
                          selectedOtherLeave?.allow_half_day
                        )
                        ? t("validation.endDateRequired")
                        : false,
                    validate: (v) => {
                      const allowsHalfDay =
                        selectedLeaveType?.allow_half_day ||
                        selectedOtherLeave?.allow_half_day;
                      if (sessionType !== "FULL_DAY" && allowsHalfDay)
                        return true;
                      if (!from_date) return t("validation.selectStartFirst");
                      if (v > maxLeaveDate)
                        return t("validation.dateTooFar", { days: LEAVE_MAX_AHEAD_DAYS });
                      const closed = lockedYearOf(fy.years, v);
                      if (closed) return tFy("locked.tooltip", { label: closed.label });
                      return (
                        v >= from_date || t("validation.endAfterStart")
                      );
                    },
                  })}
                  type="date"
                  min={from_date || minLeaveDate}
                  max={maxLeaveDate}
                  disabled={
                    sessionType !== "FULL_DAY" &&
                    (selectedLeaveType?.allow_half_day ||
                      selectedOtherLeave?.allow_half_day)
                  }
                  className={`${inputCls(errors.to_date)} ${sessionType !== "FULL_DAY" && (selectedLeaveType?.allow_half_day || selectedOtherLeave?.allow_half_day) ? "opacity-40 cursor-not-allowed" : ""}`}
                />
              </div>
              {sessionType !== "FULL_DAY" &&
                (selectedLeaveType?.allow_half_day ||
                  selectedOtherLeave?.allow_half_day) ? (
                <p className="text-[10px] text-gray-400 mt-1.5">
                  {t("apply.notRequiredHalfDay")}
                </p>
              ) : (
                <FieldErr error={errors.to_date} />
              )}
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className={labelCls}>
              {t("apply.reason")} <span className="text-red-500">*</span>
            </label>
            <textarea
              {...register("reason", {
                required: t("validation.reasonRequired"),
                minLength: {
                  value: 10,
                  message: t("validation.reasonMin"),
                },
                maxLength: { value: 500, message: t("validation.reasonMax") },
              })}
              rows={4}
              placeholder={t("apply.reasonPlaceholder")}
              className={`w-full px-4 py-2.5 border rounded-lg text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition resize-none bg-white ${errors.reason ? "border-red-400 bg-red-50" : "border-gray-200"
                }`}
            />
            <FieldErr error={errors.reason} />
          </div>

          {/* File Upload */}
          <div>
            <label className={labelCls}>
              {t("apply.supportingDocument")}{" "}

            </label>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                handleFile(e.dataTransfer.files[0]);
              }}
              onClick={() => !uploadedFile && fileRef.current.click()}
              className={`border-2 border-dashed rounded-xl p-7 flex flex-col items-center justify-center gap-2 transition-colors ${uploadedFile
                ? "border-green-300 bg-green-50 cursor-default"
                : dragging
                  ? "border-cyan-400 bg-cyan-50 cursor-copy"
                  : "border-gray-200 hover:border-cyan-300 hover:bg-gray-50 cursor-pointer"
                }`}
            >
              {uploadedFile ? (
                <>
                  <MdOutlineCheckCircle className="text-green-500 text-3xl" />
                  <p className="text-sm font-semibold text-green-700">
                    {uploadedFile.file_name}
                  </p>
                  <p className="text-xs text-green-500">
                    {t("apply.kbUploaded", {
                      size: (uploadedFile.file_size / 1024).toFixed(0),
                    })}
                  </p>
                  <button
                    type="button"
                    onClick={() => setUploadedFile(null)}
                    className="mt-1 flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition-colors"
                  >
                    <MdOutlineClose className="text-sm" />{" "}
                    {t("apply.removeFile")}
                  </button>
                </>
              ) : (
                <>
                  <MdOutlineUploadFile className="text-gray-300 text-4xl" />
                  <p className="text-sm font-semibold text-gray-700">
                    {t("apply.uploadCta")}
                  </p>
                  <p className="text-xs text-gray-400">
                    {t("apply.uploadHint")}
                  </p>
                </>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={(e) => handleFile(e.target.files[0])}
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-2 border-t border-gray-100">
            {error && (
              <div className="w-full flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <MdOutlineError className="text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
            <button
              type="button"
              onClick={() => (onCancel ? onCancel() : navigate(backLink))}
              className="w-full sm:w-auto px-6 py-2.5 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-sm font-semibold transition-colors"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              onClick={handleSubmit(onSubmit)}
              disabled={loading}
              className={`w-full sm:w-auto px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${loading
                ? "bg-cyan-400 text-white cursor-not-allowed opacity-70"
                : "bg-cyan-600 hover:bg-cyan-700 text-white"
                }`}
            >
              {loading ? t("apply.submitting") : t("apply.submitRequest")}
            </button>
          </div>
        </div>

        {/* ── RIGHT: Sidebar ── */}
        <div className="w-full lg:w-72 xl:w-80 flex-shrink-0 space-y-4">
          {/* Leave Balances */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900">
                {t("apply.leaveBalances")}
              </h3>
              {myLeavesBalances?.data?.total_available_balance !== undefined && (
                <span className="text-sm font-bold text-cyan-600 bg-cyan-50 px-2.5 py-0.5 rounded-lg border border-cyan-100">
                  {t("fy.totalBalance", { count: myLeavesBalances.data.total_available_balance })}
                </span>
              )}
            </div>
            {leaveTypesListLoading ? (
              <div className="flex items-center justify-center py-6">
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-600 mb-2"></div>
                  <p className="text-gray-400 text-xs">{t("common.loading")}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 max-h-[260px] overflow-y-auto pr-2">
                {((myLeavesBalances?.data?.leave_balances?.length > 0) ? myLeavesBalances.data.leave_balances : leaveTypes)
                  .map((item) => {
                    // Item could be from myLeavesBalances (has 'name', 'balance') or leaveTypes (has 'leave_name', 'yearly_quota')
                    const id = item.id;
                    const leaveName = item.name || item.leave_name;

                    const iconData =
                      LEAVE_TYPES_ICONS[id] || LEAVE_TYPES_ICONS[1];
                    const Icon = iconData.icon;
                    const isSelected = selectedLeaveTypeId === id;

                    // Only what was actually credited — never the policy's yearly quota.
                    const balanceRecord = (myLeavesBalances?.data?.leave_balances || []).find(b => b.id === id);
                    const availableBalance = balanceRecord !== undefined ? Number(balanceRecord.balance || 0) : null;

                    return (
                      <div
                        key={id}
                        className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${isSelected ? "bg-indigo-50 border border-indigo-100" : "bg-gray-50"}`}
                      >
                        <div
                          className={`w-9 h-9 ${iconData.iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}
                        >
                          <Icon className={`${iconData.iconColor} text-lg`} />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                            {leaveName}
                          </p>
                          <p className="text-sm font-bold text-gray-900">
                            {availableBalance === null
                              ? t("fy.noBalance")
                              : t("apply.daysAvailable", { count: availableBalance })}
                          </p>
                          {balanceRecord && (
                            <CarriedLeaveNote
                              balance={{ ...balanceRecord, balance_year: myLeavesBalances?.data?.balance_year }}
                              className="mt-0.5"
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Request Preview */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900">
                {t("apply.requestPreview")}
              </h3>
              <MdOutlineUploadFile className="text-gray-200 text-3xl" />
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">
                  {t("apply.preview.leaveType")}
                </span>
                <span className="font-bold text-gray-900">
                  {(selectedLeaveType || selectedOtherLeave)?.leave_name || "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">
                  {t("apply.preview.sessionType")}
                </span>
                <span className="font-bold text-gray-900">
                  {(() => {
                    const sess = SESSION_TYPES.find(
                      (s) => s.value === sessionType,
                    );
                    return sess ? t(sess.labelKey) : "—";
                  })()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">
                  {t("apply.preview.selectedDays")}
                </span>
                <span className="font-bold text-gray-900">
                  {selected > 0
                    ? `${selected} ${sessionType !== "FULL_DAY" ? t("apply.preview.half") : t("apply.preview.days")}`
                    : "—"}
                </span>
              </div>
            </div>
            <div className="border-t border-gray-100 my-3" />
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-gray-400 mb-1">
                  {t("apply.preview.totalDays")}
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  <Ltr>{selected > 0 ? `${selected}` : "0"}</Ltr>
                </p>
              </div>
            </div>
          </div>

          {/* Policy Reminder */}
          <div className="bg-cyan-600 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <MdInfoOutline className="text-white text-lg" />
              <h3 className="text-sm font-bold text-white">
                {t("apply.policyReminder")}
              </h3>
            </div>
            <p className="text-xs text-cyan-100 leading-relaxed mb-4">
              {t("apply.policyReminderBody")}
            </p>
            <button className="text-xs font-bold text-white underline hover:text-cyan-200 transition-colors">
              {t("apply.readCompanyPolicy")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
