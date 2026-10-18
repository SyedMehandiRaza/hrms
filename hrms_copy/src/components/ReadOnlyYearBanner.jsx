import { useTranslation } from "react-i18next";
import { MdLockOutline, MdHistory } from "react-icons/md";
import useFiscalYear from "../hooks/useFiscalYear";

// Shown at the top of the page area whenever the year switcher is not on the
// current year: grey + lock for a closed (read-only) year, amber otherwise.
export default function ReadOnlyYearBanner() {
  const { t } = useTranslation("fiscalYear");
  const fy = useFiscalYear();

  if (!fy.loaded || !fy.selected || fy.isCurrent) return null;

  const back = fy.current ? (
    <button
      type="button"
      onClick={() => {}}
      className="shrink-0 text-xs sm:text-sm font-semibold underline underline-offset-2 hover:no-underline"
    >
      {t("banner.backToCurrent", { label: fy.current.label })}
    </button>
  ) : null;

  if (fy.isLocked) {
    return (
      <div
        role="status"
        className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 lg:px-10 py-2.5 bg-gray-800 text-white text-sm"
      >
        <span className="flex items-center gap-2 min-w-0">
          <MdLockOutline className="text-lg shrink-0" />
          <span className="font-semibold">{t("banner.locked", { label: fy.label })}</span>
          <span className="hidden md:inline text-gray-300">· {t("banner.lockedHint")}</span>
        </span>
        {back}
      </div>
    );
  }

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 lg:px-10 py-2 bg-amber-50 border-b border-amber-200 text-amber-900 text-sm"
    >
      <span className="flex items-center gap-2 min-w-0">
        <MdHistory className="text-lg shrink-0" />
        <span className="font-semibold">{t("banner.past", { label: fy.label })}</span>
      </span>
      {back}
    </div>
  );
}
