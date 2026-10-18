// Shared loading indicators for consistent API-fetch states across the app.
// Spinner style matches the app's de-facto cyan loader.
import { useTranslation } from "react-i18next";

/**
 * Inline spinner. Use inside buttons, cards, or anywhere a small spinner fits.
 * @param {("sm"|"md"|"lg")} [size]
 * @param {string} [className]
 */
export function Spinner({ size = "md", className = "" }) {
  const { t } = useTranslation("common");
  const dim =
    size === "sm" ? "w-4 h-4" : size === "lg" ? "w-8 h-8" : "w-5 h-5";
  return (
    <span
      role="status"
      aria-label={t("ui.loadingAria")}
      className={`${dim} border-2 border-cyan-500 border-t-transparent rounded-full animate-spin ${className}`}
    />
  );
}

/**
 * Centered block loader for a content area (cards, panels).
 * @param {string} [label]
 * @param {string} [className]
 */
export default function Loader({ label, className = "" }) {
  const { t } = useTranslation("common");
  label = label ?? t("ui.loading");
  return (
    <div
      className={`flex items-center justify-center py-12 text-sm text-gray-400 ${className}`}
    >
      <Spinner className="me-3" />
      {label}
    </div>
  );
}

/**
 * Full-width loader row for a table body. Render inside <tbody>.
 * @param {number} colSpan - number of columns the table has
 * @param {string} [label]
 */
export function TableLoader({ colSpan = 1, label }) {
  const { t } = useTranslation("common");
  label = label ?? t("ui.loading");
  return (
    <tr>
      <td colSpan={colSpan} className="py-12 text-center">
        <span className="inline-flex items-center text-sm text-gray-400">
          <Spinner className="me-3" />
          {label}
        </span>
      </td>
    </tr>
  );
}
