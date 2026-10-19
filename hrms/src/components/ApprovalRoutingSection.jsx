import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import CustomDropdown from "./CustomDropdown";
import { APPR_GROUPS } from "../data/groupD";

// Optional per-employee approval routing. Emits `value` as an array of
// { module_key, approval_group_id }. Two modes:
//   ALL — one catch-all group for every request
//   PER — a group per module (Overtime / Leave / Correction / Exit Visa)
// A specific module overrides the catch-all.
// Labels are translated at render time via `labelKey` (approvals namespace).
const MODULES = [
  { key: "OVERTIME", labelKey: "routing.modules.OVERTIME" },
  { key: "LEAVE", labelKey: "routing.modules.LEAVE" },
  { key: "CORRECTION", labelKey: "routing.modules.CORRECTION" },
  { key: "EXIT_VISA", labelKey: "routing.modules.EXIT_VISA" },
];

export default function ApprovalRoutingSection({ value = [], onChange }) {
  const { t } = useTranslation("approvals");
  // Its own full list of active groups, loaded once. It used to reuse the
  // Approval Settings page's Redux list — capped at that page's 10 rows (or
  // whatever filter it last used) — and re-fetched in a loop when a company
  // had no groups (each empty response was a new [] reference).
  const [groups] = useState(() => APPR_GROUPS.filter((g) => g.is_active !== false));
  const modeFromValue = () => (value.some((v) => v.module_key === "ALL") ? "ALL" : "PER");
  const [mode, setMode] = useState(() => (value.length ? modeFromValue() : "ALL")); // ALL | PER

  // Derive UI state from incoming value (once, and on external changes).
  const allEntry = value.find((v) => v.module_key === "ALL");
  const perEntries = useMemo(
    () => Object.fromEntries(value.filter((v) => v.module_key !== "ALL").map((v) => [v.module_key, v.approval_group_id])),
    [value],
  );
  const [seenLength, setSeenLength] = useState(value.length);
  if (seenLength !== value.length) {
    setSeenLength(value.length);
    if (value.length) setMode(modeFromValue());
  }

  const norm = (s) => String(s || "").toUpperCase();
  // A specific module shows only that module's groups; the catch-all shows all.
  const optsFor = (moduleKey) => {
    const pool =
      moduleKey && moduleKey !== "ALL"
        ? groups.filter((g) => norm(g.module_key) === norm(moduleKey))
        : groups;
    return [
      { label: t("routing.none"), value: "" },
      ...pool.map((g) => ({
        label: `${g.group_name || g.name || t("routing.groupFallback", { id: g.id })}${g.group_code ? ` (${g.group_code})` : ""}`,
        value: String(g.id),
      })),
    ];
  };
  const countFor = (moduleKey) =>
    moduleKey && moduleKey !== "ALL"
      ? groups.filter((g) => norm(g.module_key) === norm(moduleKey)).length
      : groups.length;

  const emit = (entries) => onChange?.(entries.filter((e) => e.approval_group_id));

  const setAll = (gid) => emit(gid ? [{ module_key: "ALL", approval_group_id: Number(gid) }] : []);
  const setPer = (moduleKey, gid) => {
    const next = { ...perEntries };
    if (gid) next[moduleKey] = Number(gid);
    else delete next[moduleKey];
    emit(Object.entries(next).map(([module_key, approval_group_id]) => ({ module_key, approval_group_id })));
  };
  const switchMode = (m) => {
    setMode(m);
    emit([]); // clear when switching so the two modes don't mix
  };

  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-4 bg-white">
      <div>
        <p className="text-sm font-bold text-gray-900">{t("routing.title")} <span className="text-gray-400 font-normal">{t("routing.optional")}</span></p>
        <p className="text-[11px] text-gray-400 mt-0.5">{t("routing.hint")}</p>
      </div>

      <div className="flex gap-2">
        {[{ k: "ALL", l: t("routing.modes.ALL") }, { k: "PER", l: t("routing.modes.PER") }].map((o) => (
          <button
            key={o.k}
            type="button"
            onClick={() => switchMode(o.k)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${mode === o.k ? "bg-cyan-600 text-white border-cyan-600" : "bg-white text-gray-600 border-gray-200"}`}
          >
            {o.l}
          </button>
        ))}
      </div>

      {groups.length === 0 && (
        <p className="text-[11px] text-amber-600">
          {t("routing.noGroups")}
        </p>
      )}

      {mode === "ALL" ? (
        <div className="max-w-sm">
          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{t("routing.allRequestsLabel")}</label>
          <CustomDropdown value={String(allEntry?.approval_group_id || "")} onChange={(e) => setAll(e.target.value)} options={optsFor("ALL")} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {MODULES.map((m) => (
            <div key={m.key}>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{t(m.labelKey)}</label>
              <CustomDropdown value={String(perEntries[m.key] || "")} onChange={(e) => setPer(m.key, e.target.value)} options={optsFor(m.key)} />
              {countFor(m.key) === 0 && (
                <p className="text-[10px] text-gray-400 mt-1">{t("routing.noModuleGroup", { module: t(m.labelKey) })}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}