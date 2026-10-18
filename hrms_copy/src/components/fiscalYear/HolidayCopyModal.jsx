import { useEffect, useMemo, useState } from "react";
import {
  MdClose,
  MdOutlineContentCopy,
  MdOutlineEventNote,
  MdOutlineWarningAmber,
  MdOutlineCheckBox,
  MdOutlineCheckBoxOutlineBlank,
  MdOutlineIndeterminateCheckBox,
} from "react-icons/md";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import Loader, { Spinner } from "../Loader";
import FieldError from "../FieldError";
import Ltr from "../Ltr";
import { useFormat } from "../../hooks/useFormat";
import { holidayCopyErrors } from "../../utils/fyValidation/leave";
import { holidayCopyPreview } from "../../data/groupA";

const FLAG_STYLE = {
  CHECK_DATE: "text-amber-700 bg-amber-50 border-amber-200",
  CONFLICT: "text-red-700 bg-red-50 border-red-200",
  ALREADY_COPIED: "text-gray-600 bg-gray-100 border-gray-200",
};

// Copy one financial year's holidays into another (FE-8).
//   <HolidayCopyModal open onClose={fn} fromFy={yearKey} toFy={yearKey} onDone={fn} />
// GET  /holidays/copy-year/preview?from_fy&to_fy → rows with a proposed date
//      + flags (CHECK_DATE: moving festival, CONFLICT: date taken,
//      ALREADY_COPIED: copied before). Flagged rows start unticked.
// POST /holidays/copy-year { from_fy, to_fy, items:[{ source_id, holiday_date,
//      holiday_name, include }] } — every row is sent (include true/false) so
//      the server's items.N.<field> errors land under row N.
export default function HolidayCopyModal({ open, onClose, fromFy, toFy, onDone }) {
  const { t } = useTranslation("holidays");
  const { fmtDate } = useFormat();
  const reqKey = open && fromFy && toFy ? `${fromFy}>${toFy}` : null;

  // Static preview for the requested years; row edits live in local state.
  const preview = useMemo(() => {
    if (!reqKey) return null;
    const data = holidayCopyPreview(fromFy, toFy);
    const rows = (data?.items || []).map((it) => ({
      ...it,
      include: !!it.include_default,
      holiday_date: it.proposed_date,
    }));
    return { key: reqKey, data, rows, error: "" };
  }, [reqKey, fromFy, toFy]);
  const [edited, setState] = useState({ key: null, rows: [] });
  const state = {
    key: reqKey,
    data: preview?.data || null,
    rows: edited.key === reqKey ? edited.rows : preview?.rows || [],
    error: "",
  };
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const loading = false;
  const rows = state.key === reqKey ? state.rows : [];
  const to = state.data?.to || null;
  const from = state.data?.from || null;
  const targetLocked = !!to?.is_locked;
  const selected = rows.filter((r) => r.include).length;
  const allSelected = rows.length > 0 && selected === rows.length;

  const counts = { CHECK_DATE: 0, CONFLICT: 0, ALREADY_COPIED: 0 };
  rows.forEach((r) => (r.flags || []).forEach((f) => (counts[f] = (counts[f] || 0) + 1)));

  if (!open) return null;

  const setRows = (fn) => setState({ key: reqKey, rows: fn(state.rows) });
  const clearRowErrors = (idx) =>
    setErrors((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => k.startsWith(`items.${idx}.`) && delete next[k]);
      return next;
    });

  const toggle = (idx) => {
    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, include: !r.include } : r)));
    clearRowErrors(idx);
  };
  const toggleAll = () => {
    const value = !allSelected;
    setRows((rs) => rs.map((r) => ({ ...r, include: value })));
    setErrors({});
  };
  const setDate = (idx, value) => {
    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, holiday_date: value } : r)));
    clearRowErrors(idx);
  };

  const close = () => {
    if (saving) return;
    setErrors({});
    setFormError("");
    onClose?.();
  };

  const submit = () => {
    if (saving || targetLocked) return;
    setFormError("");
    if (!selected) {
      setFormError(t("copy.noneSelected"));
      return;
    }
    const errs = holidayCopyErrors(t, rows, to);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(false);
    const res = { count: selected };
    toast.success(t("copy.success", { count: res.count, label: to?.label || "" }));
    onDone?.(res);
  };

  const rowErrors = (idx) =>
    ["source_id", "holiday_name", "holiday_date"].map((f) => errors[`items.${idx}.${f}`]).filter(Boolean);
  const errorCount = Object.keys(errors).length;

  const renderFlags = (flags) =>
    (flags || []).length ? (
      <div className="flex flex-wrap gap-1">
        {flags.map((f) => (
          <span
            key={f}
            title={t(`copy.flagHints.${f}`, { defaultValue: "" })}
            className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wide ${FLAG_STYLE[f] || FLAG_STYLE.ALREADY_COPIED}`}
          >
            {t(`copy.flags.${f}`, { defaultValue: f })}
          </span>
        ))}
      </div>
    ) : (
      <span className="text-[11px] font-semibold text-green-600">{t("copy.flags.OK")}</span>
    );

  const CheckIcon = allSelected
    ? MdOutlineCheckBox
    : selected > 0
      ? MdOutlineIndeterminateCheckBox
      : MdOutlineCheckBoxOutlineBlank;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={close}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col"
        style={{ maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 flex-shrink-0 gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-cyan-50 flex items-center justify-center flex-shrink-0">
              <MdOutlineContentCopy className="text-cyan-600 text-xl" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-900">
                {t("copy.title", { to: to?.label || "" })}
              </h2>
              <p className="text-sm text-gray-400 mt-0.5">
                {t("copy.subtitle", { from: from?.label || "" })}
              </p>
            </div>
          </div>
          <button type="button" onClick={close} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0">
            <MdClose className="text-xl" />
          </button>
        </div>
        <hr className="border-gray-100 flex-shrink-0" />

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <Loader label={t("copy.loading")} />
          ) : state.error ? (
            <div className="px-6 py-12 text-center">
              <MdOutlineWarningAmber className="text-4xl text-red-300 mx-auto mb-2" />
              <p className="text-sm text-red-600">{state.error}</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <MdOutlineEventNote className="text-5xl text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-700">{t("copy.emptyTitle")}</p>
              <p className="text-xs text-gray-400 mt-1">{t("copy.empty", { from: from?.label || "" })}</p>
            </div>
          ) : (
            <div className="px-6 py-4 space-y-3">
              {targetLocked && (
                <p className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  {t("copy.targetLocked", { label: to?.label })}
                </p>
              )}
              {(counts.CHECK_DATE > 0 || counts.CONFLICT > 0 || counts.ALREADY_COPIED > 0) && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                  {["CHECK_DATE", "CONFLICT", "ALREADY_COPIED"].map((f) =>
                    counts[f] ? (
                      <span key={f} className="flex items-center gap-1.5">
                        <span className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-bold ${FLAG_STYLE[f]}`}>
                          {t(`copy.flags.${f}`)}
                        </span>
                        {t(`copy.flagHints.${f}`)}
                      </span>
                    ) : null,
                  )}
                </div>
              )}

              {/* Desktop table */}
              <div className="hidden md:block border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2.5 w-10 text-start">
                        <button
                          type="button"
                          onClick={toggleAll}
                          disabled={targetLocked}
                          className="text-xl text-cyan-600 disabled:text-gray-300 flex"
                          aria-label={t("copy.selectAll")}
                          title={t("copy.selectAll")}
                        >
                          <CheckIcon />
                        </button>
                      </th>
                      {["copy.table.holiday", "copy.table.sourceDate", "copy.table.newDate", "copy.table.flags"].map((k) => (
                        <th key={k} className="px-3 py-2.5 text-start text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                          {t(k)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.map((r, idx) => {
                      const errs = rowErrors(idx);
                      const dateErr = errors[`items.${idx}.holiday_date`];
                      return (
                        <tr key={r.source_id} className={`align-top ${r.include ? "bg-white" : "bg-gray-50/60"}`}>
                          <td className="px-3 py-3">
                            <button
                              type="button"
                              onClick={() => toggle(idx)}
                              disabled={targetLocked}
                              className={`text-xl flex ${r.include ? "text-cyan-600" : "text-gray-300"} disabled:opacity-50`}
                              aria-pressed={r.include}
                              aria-label={r.holiday_name}
                            >
                              {r.include ? <MdOutlineCheckBox /> : <MdOutlineCheckBoxOutlineBlank />}
                            </button>
                          </td>
                          <td className="px-3 py-3">
                            <p className={`font-semibold ${r.include ? "text-gray-900" : "text-gray-500"}`}>{r.holiday_name}</p>
                            <p className="text-[11px] text-gray-400">
                              {t(`types.${typeKey(r.holiday_type)}`, { defaultValue: r.holiday_type })}
                            </p>
                            {errs
                              .filter((m) => m !== dateErr)
                              .map((m) => (
                                <FieldError key={m} message={m} />
                              ))}
                          </td>
                          <td className="px-3 py-3 text-gray-600 whitespace-nowrap">
                            <Ltr>{fmtDate(r.source_date, { day: "2-digit", month: "short", year: "numeric" })}</Ltr>
                          </td>
                          <td className="px-3 py-3 min-w-[170px]">
                            <input
                              type="date"
                              name={`items.${idx}.holiday_date`}
                              value={r.holiday_date || ""}
                              min={to?.from}
                              max={to?.to}
                              disabled={!r.include || targetLocked}
                              onChange={(e) => setDate(idx, e.target.value)}
                              className={`w-full border rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:bg-gray-50 disabled:text-gray-400 ${
                                dateErr ? "border-red-400 bg-red-50" : "border-gray-200 bg-white"
                              }`}
                            />
                            <FieldError message={dateErr} />
                          </td>
                          <td className="px-3 py-3">
                            {renderFlags(r.flags)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-2">
                <button
                  type="button"
                  onClick={toggleAll}
                  disabled={targetLocked}
                  className="flex items-center gap-2 text-sm font-semibold text-cyan-700"
                >
                  <CheckIcon className="text-xl" /> {t("copy.selectAll")}
                </button>
                {rows.map((r, idx) => {
                  const dateErr = errors[`items.${idx}.holiday_date`];
                  return (
                    <div key={r.source_id} className={`border rounded-xl p-3 space-y-2 ${r.include ? "border-cyan-200 bg-white" : "border-gray-200 bg-gray-50"}`}>
                      <div className="flex items-start gap-2">
                        <button
                          type="button"
                          onClick={() => toggle(idx)}
                          disabled={targetLocked}
                          className={`text-xl flex flex-shrink-0 ${r.include ? "text-cyan-600" : "text-gray-300"}`}
                          aria-pressed={r.include}
                          aria-label={r.holiday_name}
                        >
                          {r.include ? <MdOutlineCheckBox /> : <MdOutlineCheckBoxOutlineBlank />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900">{r.holiday_name}</p>
                          <p className="text-[11px] text-gray-400">
                            {t("copy.table.sourceDate")}:{" "}
                            <Ltr>{fmtDate(r.source_date, { day: "2-digit", month: "short", year: "numeric" })}</Ltr>
                          </p>
                        </div>
                        {renderFlags(r.flags)}
                      </div>
                      <input
                        type="date"
                        value={r.holiday_date || ""}
                        min={to?.from}
                        max={to?.to}
                        disabled={!r.include || targetLocked}
                        onChange={(e) => setDate(idx, e.target.value)}
                        className={`w-full border rounded-lg px-3 py-1.5 text-sm ${dateErr ? "border-red-400 bg-red-50" : "border-gray-200"}`}
                      />
                      {rowErrors(idx).map((m) => (
                        <FieldError key={m} message={m} />
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <hr className="border-gray-100 flex-shrink-0" />
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-6 py-4 flex-shrink-0">
          <div className="sm:me-auto min-h-[20px]">
            {formError ? (
              <FieldError message={formError} className="mt-0" />
            ) : errorCount > 0 ? (
              <FieldError message={t("copy.fixRows", { count: errorCount })} className="mt-0" />
            ) : rows.length > 0 ? (
              <p className="text-xs text-gray-500">{t("copy.selectedCount", { selected, total: rows.length })}</p>
            ) : null}
          </div>
          <div className="flex flex-col-reverse sm:flex-row gap-3">
            <button
              type="button"
              onClick={close}
              disabled={saving}
              className="w-full sm:w-auto px-6 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
            >
              {t("modal.cancel")}
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={saving || loading || !rows.length || targetLocked}
              title={targetLocked ? t("copy.targetLocked", { label: to?.label }) : undefined}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving && <Spinner size="sm" />}
              {saving ? t("copy.copying") : t("copy.submit", { count: selected })}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// holiday_type enum → holidays:types.* key
const typeKey = (v) =>
  ({
    PUBLIC: "public",
    FESTIVAL: "festival",
    NATIONAL: "national",
    COMPANY: "company",
    OPTIONAL: "optional",
    WEEKLY_OFF: "weeklyOff",
  })[v] || "public";
