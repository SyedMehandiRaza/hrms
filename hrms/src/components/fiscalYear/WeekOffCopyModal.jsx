import { useEffect, useState } from "react";
import {
  MdClose,
  MdOutlineContentCopy,
  MdOutlineEventBusy,
  MdOutlineWarningAmber,
  MdOutlineCheckBox,
  MdOutlineCheckBoxOutlineBlank,
  MdOutlineIndeterminateCheckBox,
  MdOutlineInfo,
} from "react-icons/md";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import Loader, { Spinner } from "../Loader";
import FieldError from "../FieldError";
import Ltr from "../Ltr";
import { useFormat } from "../../hooks/useFormat";
import useApiQuery from "../../hooks/useApiQuery";
import { apiErrorMessage } from "../../utils/apiError";
import { copyWeekOffs, weekOffCopyPreview } from "../../api/shifts";

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]; // 0 = Sunday (backend weekdayOf)

// Backend reasons for a shift without a regular pattern → settings:shift.weekOffCopy.reasons.*
const REASON_KEYS = {
  "No off-days in the previous financial year": "noOffs",
  "No regular weekly pattern found in the previous financial year": "noPattern",
};

// Copy each shift's weekly-off pattern from the current FY into the next one, `toFy` (D39).
//   <WeekOffCopyModal open onClose={fn} toFy={financialYearId} onDone={fn} />
// GET  /shifts/week-offs/copy-preview?to_fy → per shift: the pattern found this year (weekdays
//      off ≥ 80% of the time) and how many dates it would add; a shift without a regular pattern
//      has no weekdays (listed as "irregular").
// POST /shifts/week-offs/copy { to_fy, shift_ids } — only ADDS missing dates.
export default function WeekOffCopyModal({ open, onClose, toFy, onDone }) {
  const { t } = useTranslation("settings");
  const { fmtDate } = useFormat();
  const reqKey = open && toFy ? String(toFy) : null;

  const query = useApiQuery(() => (reqKey ? weekOffCopyPreview(reqKey) : Promise.resolve(null)), [reqKey]);
  const preview = query.data
    ? {
        data: {
          ...query.data,
          irregular: query.data.shifts
            .filter((x) => !x.weekdays.length)
            .map((x) => ({ shift_id: x.shift_id, name: x.name, reason: "No regular weekly pattern found in the previous financial year" })),
        },
        // Shifts with something to add start ticked; the rest start unticked.
        rows: query.data.shifts
          .filter((x) => x.weekdays.length)
          .map((x) => ({ ...x, pattern: x.weekdays, include: (x.dates_to_add || 0) > 0 })),
      }
    : null;
  const [edited, setState] = useState({ key: null, rows: [] });
  const state = {
    key: reqKey,
    data: preview?.data || null,
    rows: edited.key === reqKey ? edited.rows : preview?.rows || [],
    error: query.error ? apiErrorMessage(query.error) : "",
  };
  const [errors, setErrors] = useState({}); // { to_fy, shift_ids }
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  const loading = query.loading;
  const data = state.key === reqKey ? state.data : null;
  const rows = state.key === reqKey ? state.rows : [];
  const irregular = data?.irregular || [];

  const toLabel = data?.to_fy?.label || "";
  const fromLabel = data?.from_fy?.label || "";
  // The server refuses a closed next year (SHIFT_WEEKOFF_NO_NEXT_FY, shown as the load error).
  const targetLocked = false;

  const actionable = rows.filter((r) => (r.dates_to_add || 0) > 0);
  const selected = rows.filter((r) => r.include);
  const selectedDays = selected.reduce((n, r) => n + (r.dates_to_add || 0), 0);
  const allSelected = actionable.length > 0 && actionable.every((r) => r.include);

  const setRows = (fn) => setState({ key: reqKey, rows: fn(state.rows) });
  const toggle = (id) => {
    setRows((rs) => rs.map((r) => (r.shift_id === id ? { ...r, include: !r.include } : r)));
    setErrors((e) => (e.shift_ids ? { ...e, shift_ids: undefined } : e));
  };
  const toggleAll = () => {
    const value = !allSelected;
    setRows((rs) => rs.map((r) => ((r.dates_to_add || 0) > 0 ? { ...r, include: value } : r)));
    setErrors((e) => (e.shift_ids ? { ...e, shift_ids: undefined } : e));
  };

  const close = () => {
    if (saving) return;
    setErrors({});
    onClose?.();
  };

  const submit = async () => {
    if (saving || targetLocked || !selected.length) return;
    setErrors({});
    setSaving(true);
    let out;
    try {
      out = await copyWeekOffs(toFy, selected.map((r) => r.shift_id));
    } catch (err) {
      setSaving(false);
      setErrors({ form: apiErrorMessage(err) });
      return;
    }
    setSaving(false);
    const counts = Object.values(out.added || {});
    const res = { added_total: counts.reduce((n, c) => n + c, 0), shifts_updated: counts.filter((c) => c > 0).length };
    toast.success(
      t("shift.weekOffCopy.success", {
        count: res.added_total,
        shifts: res.shifts_updated,
        label: toLabel,
      }),
    );
    onDone?.(res);
  };

  const patternChips = (pattern = []) => (
    <div className="flex flex-wrap gap-1">
      {WEEKDAYS.map((k, i) => {
        const on = pattern.includes(i);
        return (
          <span
            key={k}
            className={`inline-flex items-center justify-center min-w-[34px] px-1.5 py-0.5 rounded border text-[10px] font-bold ${
              on ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-gray-300 bg-white border-gray-100"
            }`}
          >
            {t(`shift.weekOffCopy.weekdays.${k}`)}
          </span>
        );
      })}
    </div>
  );

  const badges = (r) => (
    <div className="flex flex-wrap gap-1">
      {(r.dates_to_add || 0) === 0 && (r.already_present || 0) > 0 && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wide text-gray-600 bg-gray-100 border-gray-200">
          {t("shift.weekOffCopy.badges.alreadyCopied")}
        </span>
      )}
      {(r.skipped_locked || 0) > 0 && (
        <span
          title={t("shift.weekOffCopy.badges.lockedHint")}
          className="inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-bold text-amber-700 bg-amber-50 border-amber-200"
        >
          {t("shift.weekOffCopy.badges.locked", { count: r.skipped_locked })}
        </span>
      )}
      {(r.skipped_past || 0) > 0 && (
        <span
          title={t("shift.weekOffCopy.badges.pastHint")}
          className="inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-bold text-gray-500 bg-white border-gray-200"
        >
          {t("shift.weekOffCopy.badges.past", { count: r.skipped_past })}
        </span>
      )}
      {(r.dates_to_add || 0) > 0 && !(r.skipped_locked || 0) && !(r.skipped_past || 0) && (
        <span className="text-[11px] font-semibold text-green-600">{t("shift.weekOffCopy.badges.ready")}</span>
      )}
    </div>
  );

  const CheckIcon = allSelected
    ? MdOutlineCheckBox
    : selected.length > 0
      ? MdOutlineIndeterminateCheckBox
      : MdOutlineCheckBoxOutlineBlank;

  const range = (r) =>
    r?.from && r?.to ? (
      <Ltr>
        {fmtDate(r.from, { day: "2-digit", month: "short", year: "numeric" })} –{" "}
        {fmtDate(r.to, { day: "2-digit", month: "short", year: "numeric" })}
      </Ltr>
    ) : null;

  const nothing = !loading && !state.error && rows.length === 0 && irregular.length === 0;

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
        <div className="flex items-start justify-between px-6 pt-5 pb-4 shrink-0 gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-cyan-50 flex items-center justify-center shrink-0">
              <MdOutlineContentCopy className="text-cyan-600 text-xl" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-900">
                {t("shift.weekOffCopy.title", { to: toLabel })}
              </h2>
              <p className="text-sm text-gray-400 mt-0.5">
                {t("shift.weekOffCopy.subtitle", { from: fromLabel })}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label={t("shift.weekOffCopy.cancel")}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
          >
            <MdClose className="text-xl" />
          </button>
        </div>
        <hr className="border-gray-100 shrink-0" />

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <Loader label={t("shift.weekOffCopy.loading")} />
          ) : state.error ? (
            <div className="px-6 py-12 text-center">
              <MdOutlineWarningAmber className="text-4xl text-red-300 mx-auto mb-2" />
              <FieldError message={state.error} className="justify-center" />
            </div>
          ) : nothing ? (
            <div className="px-6 py-14 text-center">
              <MdOutlineEventBusy className="text-5xl text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-700">{t("shift.weekOffCopy.emptyTitle")}</p>
              <p className="text-xs text-gray-400 mt-1">{t("shift.weekOffCopy.empty")}</p>
            </div>
          ) : (
            <div className="px-6 py-4 space-y-4">
              {targetLocked && (
                <p className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  {t("shift.weekOffCopy.targetLocked", { label: toLabel })}
                </p>
              )}

              <div className="flex items-start gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <MdOutlineInfo className="text-cyan-600 shrink-0 mt-0.5" size={14} />
                <div className="space-y-0.5">
                  <p>{t("shift.weekOffCopy.howItWorks")}</p>
                  {data?.source_range && data?.target_range && (
                    <p className="text-gray-400">
                      {fromLabel}: {range(data.source_range)} · {toLabel}: {range(data.target_range)}
                    </p>
                  )}
                </div>
              </div>

              {rows.length > 0 && (
                <>
                  {/* Desktop table */}
                  <div className="hidden md:block border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-3 py-2.5 w-10 text-start">
                            <button
                              type="button"
                              onClick={toggleAll}
                              disabled={targetLocked || actionable.length === 0}
                              className="text-xl text-cyan-600 disabled:text-gray-300 flex"
                              aria-label={t("shift.weekOffCopy.selectAll")}
                              title={t("shift.weekOffCopy.selectAll")}
                            >
                              <CheckIcon />
                            </button>
                          </th>
                          {["shift", "pattern", "toAdd", "present", "status"].map((k) => (
                            <th
                              key={k}
                              className="px-3 py-2.5 text-start text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap"
                            >
                              {t(`shift.weekOffCopy.table.${k}`)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {rows.map((r) => {
                          const can = (r.dates_to_add || 0) > 0;
                          return (
                            <tr key={r.shift_id} className={`align-middle ${r.include ? "bg-white" : "bg-gray-50/60"}`}>
                              <td className="px-3 py-3">
                                <button
                                  type="button"
                                  onClick={() => toggle(r.shift_id)}
                                  disabled={targetLocked || !can}
                                  className={`text-xl flex ${r.include ? "text-cyan-600" : "text-gray-300"} disabled:opacity-50 disabled:cursor-not-allowed`}
                                  aria-pressed={r.include}
                                  aria-label={r.name}
                                >
                                  {r.include ? <MdOutlineCheckBox /> : <MdOutlineCheckBoxOutlineBlank />}
                                </button>
                              </td>
                              <td className="px-3 py-3">
                                <p className={`font-semibold ${r.include ? "text-gray-900" : "text-gray-500"}`}>{r.name}</p>
                              </td>
                              <td className="px-3 py-3">{patternChips(r.pattern)}</td>
                              <td className="px-3 py-3 font-bold text-gray-900">
                                <Ltr>{r.dates_to_add ?? 0}</Ltr>
                              </td>
                              <td className="px-3 py-3 text-gray-600">
                                <Ltr>{r.already_present ?? 0}</Ltr>
                              </td>
                              <td className="px-3 py-3">{badges(r)}</td>
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
                      disabled={targetLocked || actionable.length === 0}
                      className="flex items-center gap-2 text-sm font-semibold text-cyan-700 disabled:text-gray-300"
                    >
                      <CheckIcon className="text-xl" /> {t("shift.weekOffCopy.selectAll")}
                    </button>
                    {rows.map((r) => {
                      const can = (r.dates_to_add || 0) > 0;
                      return (
                        <div
                          key={r.shift_id}
                          className={`border rounded-xl p-3 space-y-2 ${r.include ? "border-cyan-200 bg-white" : "border-gray-200 bg-gray-50"}`}
                        >
                          <div className="flex items-start gap-2">
                            <button
                              type="button"
                              onClick={() => toggle(r.shift_id)}
                              disabled={targetLocked || !can}
                              className={`text-xl flex shrink-0 ${r.include ? "text-cyan-600" : "text-gray-300"} disabled:opacity-50`}
                              aria-pressed={r.include}
                              aria-label={r.name}
                            >
                              {r.include ? <MdOutlineCheckBox /> : <MdOutlineCheckBoxOutlineBlank />}
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900">{r.name}</p>
                              <p className="text-[11px] text-gray-400">
                                {t("shift.weekOffCopy.table.toAdd")}: <Ltr>{r.dates_to_add ?? 0}</Ltr> ·{" "}
                                {t("shift.weekOffCopy.table.present")}: <Ltr>{r.already_present ?? 0}</Ltr>
                              </p>
                            </div>
                          </div>
                          {patternChips(r.pattern)}
                          {badges(r)}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Shifts without a regular pattern — nothing to copy */}
              {irregular.length > 0 && (
                <div className="border border-amber-200 bg-amber-50/50 rounded-xl px-4 py-3">
                  <p className="text-xs font-bold text-amber-800 mb-2">
                    {t("shift.weekOffCopy.irregularTitle", { count: irregular.length })}
                  </p>
                  <ul className="space-y-1">
                    {irregular.map((s) => (
                      <li key={s.shift_id} className="text-xs text-gray-600 flex flex-wrap gap-x-1.5">
                        <span className="font-semibold text-gray-800">{s.name}</span>
                        <span>—</span>
                        <span>
                          {REASON_KEYS[s.reason]
                            ? t(`shift.weekOffCopy.reasons.${REASON_KEYS[s.reason]}`)
                            : s.reason}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <hr className="border-gray-100 shrink-0" />
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-6 py-4 shrink-0">
          <div className="sm:me-auto min-h-[20px] space-y-0.5">
            {errors.to_fy || errors.shift_ids || errors.form ? (
              <>
                <FieldError message={errors.to_fy} className="mt-0" />
                <FieldError message={errors.shift_ids} className="mt-0" />
                <FieldError message={errors.form} className="mt-0" />
              </>
            ) : rows.length > 0 ? (
              <p className="text-xs text-gray-500">
                {t("shift.weekOffCopy.selectedCount", { selected: selected.length, days: selectedDays })}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col-reverse sm:flex-row gap-3">
            <button
              type="button"
              onClick={close}
              disabled={saving}
              className="w-full sm:w-auto px-6 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
            >
              {t("shift.weekOffCopy.cancel")}
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={saving || loading || !!state.error || actionable.length === 0 || targetLocked}
              title={targetLocked ? t("shift.weekOffCopy.targetLocked", { label: toLabel }) : undefined}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving && <Spinner size="sm" />}
              {saving ? t("shift.weekOffCopy.copying") : t("shift.weekOffCopy.submit", { count: selectedDays })}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
