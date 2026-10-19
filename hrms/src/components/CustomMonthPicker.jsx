import { useState, useRef, useEffect, useMemo } from "react";
import { MdOutlineCalendarToday, MdChevronLeft, MdChevronRight, MdLockOutline } from "react-icons/md";
import { useTranslation } from "react-i18next";
import useFiscalYear from "../hooks/useFiscalYear";
import { MONTH_KEYS } from "../utils/fiscalYear";

// Takes and returns value in "YYYY-MM" format.
//
// By default the picker is bound to the financial year chosen in the header
// (useFiscalYear): it shows that FY's 12 months in FY order (Apr…Mar for an
// April company) and nothing outside it. Pass fyBound={false} for a free
// calendar picker (e.g. a future effective month). min / max ("YYYY-MM")
// disable months outside them in either mode.
export default function CustomMonthPicker({
  value,
  onChange,
  className,
  containerClassName,
  fyBound = true,
  min,
  max,
  disabled = false,
}) {
  const { t } = useTranslation("common");
  const fy = useFiscalYear();
  const MONTHS = MONTH_KEYS.map((k) => t(`monthPicker.months.${k}`));
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const today = fy.today;
  const thisMonth = today.slice(0, 7);
  const bound = fyBound && fy.selected && fy.months.length === 12;

  // Parse current value
  const parsedYear = value ? parseInt(value.split("-")[0], 10) : Number(today.slice(0, 4));
  const parsedMonth = value ? parseInt(value.split("-")[1], 10) - 1 : Number(today.slice(5, 7)) - 1;

  const [displayYear, setDisplayYear] = useState(parsedYear);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const outOfBounds = (ym) => (min && ym < min) || (max && ym > max);

  // The grid: the FY's months in FY order, or Jan…Dec of the displayed year.
  const cells = bound
    ? fy.months.map((m) => ({ value: m.value, label: MONTHS[m.month - 1], year: m.year }))
    : MONTHS.map((label, idx) => ({
        value: `${displayYear}-${String(idx + 1).padStart(2, "0")}`,
        label,
        year: displayYear,
      }));

  const pick = (ym) => {
    if (outOfBounds(ym)) return;
    onChange(ym);
    setIsOpen(false);
  };

  const canPickThisMonth = !outOfBounds(thisMonth) && (!bound || fy.inFy(thisMonth));

  const selectedText = useMemo(() => {
    if (!value) return t("monthPicker.selectMonth");
    return t("monthPicker.selected", { month: MONTHS[parsedMonth], year: parsedYear });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, parsedMonth, parsedYear, t]);

  return (
    <div className={`relative inline-block ${containerClassName || ""}`} ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          // every opening starts on the selected value's year
          if (!isOpen) setDisplayYear(parsedYear);
          setIsOpen(!isOpen);
        }}
        className={`flex items-center justify-between gap-3 min-w-[160px] border border-gray-200 rounded-lg px-4 py-2.5 bg-white text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${className || ""}`}
      >
        <span className="font-medium">{selectedText}</span>
        <MdOutlineCalendarToday className="text-gray-400 text-lg" />
      </button>

      {isOpen && (
        <div className="absolute end-0 top-full mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Header: the FY label (bound) or a year selector (free) */}
          {bound ? (
            <div className="flex items-center justify-center gap-1.5 px-4 py-3 border-b border-gray-100 bg-gray-50">
              {fy.isLocked && <MdLockOutline className="text-gray-400" />}
              <span className="font-bold text-gray-700">{fy.label}</span>
            </div>
          ) : (
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
              <button
                type="button"
                onClick={() => setDisplayYear((y) => y - 1)}
                aria-label={t("monthPicker.prevYear")}
                className="p-1 hover:bg-gray-200 rounded text-gray-500 transition-colors"
              >
                <MdChevronLeft className="text-xl rtl:rotate-180" />
              </button>
              <span className="font-bold text-gray-700">{displayYear}</span>
              <button
                type="button"
                onClick={() => setDisplayYear((y) => y + 1)}
                aria-label={t("monthPicker.nextYear")}
                className="p-1 hover:bg-gray-200 rounded text-gray-500 transition-colors"
              >
                <MdChevronRight className="text-xl rtl:rotate-180" />
              </button>
            </div>
          )}

          {/* Months Grid */}
          <div className="grid grid-cols-3 gap-2 p-4">
            {cells.map((c) => {
              const isSelected = value === c.value;
              const off = outOfBounds(c.value);
              // An FY spanning two calendar years shows the year under each month.
              const showYear = bound && fy.startMonth !== 1;
              return (
                <button
                  key={c.value}
                  type="button"
                  disabled={off}
                  onClick={() => pick(c.value)}
                  className={`py-2 rounded-lg text-sm font-medium transition-colors flex flex-col items-center leading-tight ${
                    isSelected
                      ? "bg-cyan-600 text-white shadow-md"
                      : off
                        ? "text-gray-300 cursor-not-allowed"
                        : "text-gray-600 hover:bg-cyan-50 hover:text-cyan-700"
                  }`}
                >
                  <span>{c.label}</span>
                  {showYear && (
                    <span className={`text-[10px] ${isSelected ? "text-cyan-100" : "text-gray-400"}`}>{c.year}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50 text-sm">
            {canPickThisMonth ? (
              <button
                type="button"
                onClick={() => pick(thisMonth)}
                className="text-cyan-600 hover:text-cyan-800 font-medium transition-colors"
              >
                {t("monthPicker.thisMonth")}
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-gray-500 hover:text-gray-700 font-medium transition-colors"
            >
              {t("monthPicker.close")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
