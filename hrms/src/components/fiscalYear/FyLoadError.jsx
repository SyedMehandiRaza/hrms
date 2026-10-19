import { useTranslation } from "react-i18next";
import { MdOutlineErrorOutline, MdOutlineRefresh } from "react-icons/md";

// Shown by FY-gated screens when /fiscal-years/current failed (instead of an
// endless loader). `compact` = the header switcher's small inline variant.
export default function FyLoadError({ compact = false, className = "" }) {
  const { t } = useTranslation("fiscalYear");
  const loading = false;
  const retry = () => {};

  if (compact) {
    return (
      <button
        type="button"
        onClick={retry}
        disabled={loading}
        title={t("switcher.loadFailed")}
        className={`flex items-center gap-1.5 border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold disabled:opacity-60 ${className}`}
      >
        <MdOutlineRefresh className={`text-base ${loading ? "animate-spin" : ""}`} />
        <span className="whitespace-nowrap">{t("switcher.retry")}</span>
      </button>
    );
  }

  return (
    <div role="alert" className={`flex flex-col items-center justify-center text-center gap-3 py-16 px-4 ${className}`}>
      <MdOutlineErrorOutline className="text-4xl text-red-400" />
      <p className="text-sm text-gray-600">{t("switcher.loadFailed")}</p>
      <button
        type="button"
        onClick={retry}
        disabled={loading}
        className="inline-flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
      >
        <MdOutlineRefresh className={`text-lg ${loading ? "animate-spin" : ""}`} />
        {t("switcher.retry")}
      </button>
    </div>
  );
}
