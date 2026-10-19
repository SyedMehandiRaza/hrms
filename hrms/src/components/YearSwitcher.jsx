import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { MdOutlineExpandMore, MdLockOutline, MdCheck, MdOutlineEventNote } from "react-icons/md";
import { getStaticUser } from "../data/session";
import useFiscalYear from "../hooks/useFiscalYear";
import YearStatusBadge from "./fiscalYear/YearStatusBadge";
import FyLoadError from "./fiscalYear/FyLoadError";
import { visibleYearsFor } from "../utils/fiscalYear";

// Header dropdown: "FY 2026-27 ▾" with a status badge per year.
export default function YearSwitcher() {
  const { t } = useTranslation("fiscalYear");
  const user = getStaticUser();
  const fy = useFiscalYear();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  if (fy.failed) return <FyLoadError compact />;
  if (!fy.loaded || !fy.selected) return null;

  const years = [...visibleYearsFor(fy.years, user, fy.current, fy.me)].sort((a, b) => b.year_key - a.year_key);

  // Static build: one fixed year is shown; picking just closes the menu.
  const pick = () => {
    setOpen(false);
  };

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("switcher.aria")}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={t("switcher.label")}
        className={`flex items-center gap-1.5 sm:gap-2 border rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold transition-colors ${
          fy.isLocked
            ? "border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100"
            : fy.isCurrent
              ? "border-cyan-200 bg-cyan-50 text-cyan-800 hover:bg-cyan-100"
              : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
        }`}
      >
        {fy.isLocked ? <MdLockOutline className="text-base" /> : <MdOutlineEventNote className="text-base" />}
        <span className="whitespace-nowrap" dir="ltr">{fy.label}</span>
        <MdOutlineExpandMore className={`text-base transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute start-0 top-full mt-2 w-60 bg-white border border-gray-200 rounded-xl shadow-xl z-50 py-1.5 max-h-80 overflow-y-auto"
        >
          <p className="px-3 pt-1 pb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            {t("switcher.label")}
          </p>
          {years.map((y) => {
            const active = y.year_key === fy.selected;
            const isCurrent = y.year_key === fy.current?.year_key;
            return (
              <button
                key={y.year_key}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => pick()}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-start transition-colors ${
                  active ? "bg-cyan-50 text-cyan-800" : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="w-4 shrink-0">{active && <MdCheck className="text-cyan-600" />}</span>
                  <span className="font-medium truncate" dir="ltr">{y.label}</span>
                  {isCurrent && (
                    <span className="text-[10px] text-cyan-600 font-semibold">{t("switcher.current")}</span>
                  )}
                </span>
                <YearStatusBadge year={y} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
