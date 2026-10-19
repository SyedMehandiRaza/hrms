import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { MdAdd, MdChecklist, MdOutlineEditNote } from "react-icons/md";

import CustomDropdown from "../CustomDropdown";
import FieldError from "../FieldError";
import { Spinner } from "../Loader";
import { addChecklistItem, setChecklistItem } from "../../data/groupG";
import { CHECKLIST_CATEGORIES, exitRules } from "../../utils/exitValidation";
import { useFormat } from "../../hooks/useFormat";

// Clearance checklist of one exit (FE-7). Rows grouped by category; each row
// has a Done / Not done / Not applicable segmented control. Not applicable
// needs a reason (V15) entered in an inline editor under the row.
//   <ChecklistPanel exit={exit} onUpdated={setExit} locked={lock.locked} lockTitle={lock.title} />
// locked → the exit's year is closed + locked: read-only (no edits / adds).

const EDITABLE_STATUSES = ["IN_NOTICE", "EXITED"];
const SEGMENTS = ["DONE", "PENDING", "NA"];
const SEGMENT_ACTIVE = {
  DONE: "bg-emerald-600 text-white border-emerald-600",
  PENDING: "bg-gray-700 text-white border-gray-700",
  NA: "bg-slate-500 text-white border-slate-500",
};
const chip = "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border whitespace-nowrap";
const inputBase = "w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500";
const inputCls = (bad) => `${inputBase} ${bad ? "border-red-400 bg-red-50" : "border-gray-300 bg-white"}`;

function ProgressBar({ value, total, color }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function ChecklistRow({ exitId, item, editable, onUpdated }) {
  const { t } = useTranslation("exits");
  const { fmtDate } = useFormat();
  const rules = useMemo(() => exitRules(t), [t]);

  // Inline note editor: { status, value } while open, null when closed.
  const [editor, setEditor] = useState(null);
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState("");
  const [saving, setSaving] = useState(false);

  const noteCheck = editor ? rules.checklist_note.validate(editor.value, { status: editor.status }) : true;
  const clientError = noteCheck === true ? "" : noteCheck;
  const shownError = serverError || (touched ? clientError : "");

  const openEditor = (status) => {
    setEditor({ status, value: item.note || "" });
    setTouched(false);
    setServerError("");
  };
  const closeEditor = () => {
    setEditor(null);
    setTouched(false);
    setServerError("");
  };

  const save = async (status, note) => {
    setSaving(true);
    setServerError("");
    try {
      const detail = setChecklistItem(exitId, item.id, { status, note: (note || "").trim() });
      closeEditor();
      onUpdated?.(detail);
    } catch {
      toast.error(t("common.genericError"));
    } finally {
      setSaving(false);
    }
  };

  const onSegment = (status) => {
    if (!editable || saving) return;
    if (status === "NA") {
      if (item.status === "NA" && !editor) return;
      openEditor("NA");
      return;
    }
    if (status === item.status && !editor) return;
    // Done / Not done save immediately (keep the existing note; drop an NA reason editor).
    const note = editor && editor.status !== "NA" ? editor.value : item.note || "";
    const check = rules.checklist_note.validate(note, { status });
    if (check !== true) {
      setEditor({ status, value: note });
      setTouched(true);
      return;
    }
    save(status, note);
  };

  const onEditorSave = () => {
    setTouched(true);
    if (clientError || saving) return;
    save(editor.status, editor.value);
  };

  const selected = editor?.status === "NA" ? "NA" : item.status;

  return (
    <li className="py-3.5 first:pt-0 last:pb-0">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium text-gray-900 wrap-break-word">{item.label}</span>
            {item.is_required && (
              <span className={`${chip} bg-amber-50 text-amber-700 border-amber-200`}>{t("checklist.required")}</span>
            )}
            {item.auto && (
              <span className={`${chip} bg-cyan-50 text-cyan-700 border-cyan-200`} title={t("checklist.autoHint")}>
                {t("checklist.auto")}
              </span>
            )}
          </div>
          {item.note && !editor && (
            <p className="mt-1 text-xs text-gray-600 whitespace-pre-line wrap-break-word">{item.note}</p>
          )}
          {item.actioned_at && item.status !== "PENDING" && (
            <p className="mt-1 text-[11px] text-gray-400">
              {item.actioned_by?.email
                ? t("checklist.actionedBy", { email: item.actioned_by.email, date: fmtDate(item.actioned_at) })
                : t("checklist.actionedOn", { date: fmtDate(item.actioned_at) })}
            </p>
          )}
          {editable && !editor && (
            <button
              type="button"
              onClick={() => openEditor(item.status)}
              disabled={saving}
              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-cyan-700 hover:text-cyan-800 disabled:opacity-50"
            >
              <MdOutlineEditNote className="text-sm" />
              {item.note ? t("checklist.editNote") : t("checklist.addNote")}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {saving && <Spinner size="sm" />}
          <div
            role="radiogroup"
            aria-label={t("checklist.statusAria")}
            className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5"
          >
            {SEGMENTS.map((s) => {
              const active = selected === s;
              return (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={!editable || saving}
                  onClick={() => onSegment(s)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md border transition-colors whitespace-nowrap ${
                    active ? SEGMENT_ACTIVE[s] : "border-transparent text-gray-600 hover:bg-white"
                  } ${!editable ? "cursor-default" : "disabled:opacity-60"}`}
                >
                  {t(`checklistStatus.${s}`)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {editor && (
        <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <label htmlFor={`note-${item.id}`} className="block text-xs font-semibold text-gray-500 mb-1.5">
            {editor.status === "NA" ? t("checklist.naReasonLabel") : t("checklist.noteLabel")}
          </label>
          <textarea
            id={`note-${item.id}`}
            rows={2}
            autoFocus
            value={editor.value}
            onChange={(e) => {
              setEditor({ ...editor, value: e.target.value });
              setServerError("");
            }}
            onBlur={() => setTouched(true)}
            placeholder={editor.status === "NA" ? t("checklist.naReasonPlaceholder") : t("checklist.notePlaceholder")}
            aria-invalid={!!shownError}
            className={`${inputCls(!!shownError)} resize-y`}
          />
          <FieldError message={shownError} />
          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={closeEditor}
              disabled={saving}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              onClick={onEditorSave}
              disabled={saving || !!clientError || !!serverError}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function AddItemForm({ exitId, onUpdated }) {
  const { t } = useTranslation("exits");
  const rules = useMemo(() => exitRules(t), [t]);
  const [saving, setSaving] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: { category: "", label: "", is_required: false },
  });
  const hasErrors = Object.keys(errors).length > 0;

  const onSubmit = async (values) => {
    setSaving(true);
    try {
      const detail = addChecklistItem(exitId, {
        category: values.category,
        label: values.label.trim(),
        is_required: !!values.is_required,
      });
      reset({ category: "", label: "", is_required: false });
      toast.success(t("checklist.itemAdded"));
      onUpdated?.(detail);
    } catch {
      toast.error(t("common.genericError"));
    } finally {
      setSaving(false);
    }
  };

  const options = CHECKLIST_CATEGORIES.map((c) => ({ value: c, label: t(`checklistCategory.${c}`) }));

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="border-t border-gray-100 pt-4 mt-5">
      <h4 className="text-sm font-semibold text-gray-800 mb-3">{t("checklist.addTitle")}</h4>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
        <div className="md:col-span-4">
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t("checklist.category")}</label>
          <Controller
            name="category"
            control={control}
            rules={rules.category}
            render={({ field }) => (
              <CustomDropdown
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                ref={field.ref}
                options={options}
                placeholder={t("checklist.categoryPlaceholder")}
                error={!!errors.category}
                disabled={saving}
              />
            )}
          />
          <FieldError error={errors.category} />
        </div>
        <div className="md:col-span-5">
          <label htmlFor="checklist-new-label" className="block text-xs font-semibold text-gray-500 mb-1.5">
            {t("checklist.label")}
          </label>
          <input
            id="checklist-new-label"
            type="text"
            maxLength={200}
            disabled={saving}
            placeholder={t("checklist.labelPlaceholder")}
            aria-invalid={!!errors.label}
            className={inputCls(!!errors.label)}
            {...register("label", rules.label)}
          />
          <FieldError error={errors.label} />
        </div>
        <div className="md:col-span-3 flex flex-col gap-2 md:pt-6">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700 select-none">
            <input
              type="checkbox"
              disabled={saving}
              className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
              {...register("is_required")}
            />
            {t("checklist.requiredLabel")}
          </label>
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <button
          type="submit"
          disabled={saving || hasErrors}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? <Spinner size="sm" className="border-white border-t-transparent" /> : <MdAdd className="text-base" />}
          {saving ? t("common.saving") : t("checklist.addButton")}
        </button>
      </div>
    </form>
  );
}

export default function ChecklistPanel({ exit, onUpdated, locked = false, lockTitle }) {
  const { t } = useTranslation("exits");
  const items = useMemo(() => exit?.checklist || [], [exit]);
  const editable = EDITABLE_STATUSES.includes(exit?.status) && !locked;

  const groups = useMemo(() => {
    const known = CHECKLIST_CATEGORIES.map((cat) => ({
      cat,
      rows: items.filter((i) => i.category === cat).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
    }));
    const others = items.filter((i) => !CHECKLIST_CATEGORIES.includes(i.category));
    if (others.length) known.push({ cat: "OTHER", rows: others, extra: true });
    return known.filter((g) => g.rows.length);
  }, [items]);

  const closed = (i) => i.status === "DONE" || i.status === "NA";
  const required = items.filter((i) => i.is_required);
  const p = {
    required_total: required.length,
    required_closed: required.filter(closed).length,
    total: items.length,
    closed: items.filter(closed).length,
  };
  const allRequiredDone = p.required_total > 0 && p.required_closed === p.required_total;

  if (!exit) return null;

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
        <div>
          <h3 className="text-base font-semibold text-gray-900">{t("checklist.title")}</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {editable ? t("checklist.subtitle") : locked && lockTitle ? lockTitle : t("checklist.readOnly")}
          </p>
        </div>
        <div className="w-full sm:w-64 space-y-2.5">
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-semibold text-gray-600">{t("checklist.requiredProgress")}</span>
              <span className={`font-semibold ${allRequiredDone ? "text-emerald-700" : "text-gray-700"}`}>
                {t("checklist.ofTotal", { done: p.required_closed, total: p.required_total })}
              </span>
            </div>
            <ProgressBar value={p.required_closed} total={p.required_total} color={allRequiredDone ? "bg-emerald-500" : "bg-cyan-500"} />
          </div>
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-semibold text-gray-500">{t("checklist.allProgress")}</span>
              <span className="text-gray-600">{t("checklist.ofTotal", { done: p.closed, total: p.total })}</span>
            </div>
            <ProgressBar value={p.closed} total={p.total} color="bg-gray-400" />
          </div>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <MdChecklist className="text-3xl text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">{t("checklist.empty")}</p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={`${g.cat}${g.extra ? "-x" : ""}`}>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2.5">
                {t(`checklistCategory.${g.cat}`)}
              </h4>
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100 px-4 py-3.5">
                {g.rows.map((item) => (
                  <ChecklistRow key={item.id} exitId={exit.id} item={item} editable={editable} onUpdated={onUpdated} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {editable && <AddItemForm exitId={exit.id} onUpdated={onUpdated} />}
    </section>
  );
}
