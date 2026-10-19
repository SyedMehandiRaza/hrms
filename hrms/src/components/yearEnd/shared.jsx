import { useTranslation } from "react-i18next";
import { MdClose, MdErrorOutline, MdInbox, MdRefresh } from "react-icons/md";

import { secondaryBtn } from "./styles";

// Shared building blocks for the Financial Year screens.

export function CardHeader({ icon: Icon, title, subtitle, actions }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 px-5 sm:px-6 py-4 border-b border-gray-100">
      <div className="flex items-start gap-3 min-w-0">
        {Icon && (
          <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0">
            <Icon className="text-xl" />
          </div>
        )}
        <div className="min-w-0">
          <h2 className="text-base font-bold text-gray-900">{title}</h2>
          {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function LoadError({ onRetry, message }) {
  const { t } = useTranslation("fiscalYear");
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-4">
      <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center">
        <MdErrorOutline className="text-2xl" />
      </div>
      <p className="text-sm text-gray-600">{message || t("ui.loadError")}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className={secondaryBtn}>
          <MdRefresh /> {t("ui.retry")}
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon: Icon = MdInbox, title, hint }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-2 text-center px-4">
      <Icon className="text-4xl text-gray-300" />
      <p className="text-sm font-semibold text-gray-600">{title}</p>
      {hint && <p className="text-xs text-gray-400 max-w-sm">{hint}</p>}
    </div>
  );
}

// Modal shell: header, scrollable body, footer.
export function Modal({ title, subtitle, onClose, children, footer, size = "max-w-md", onSubmit }) {
  const { t } = useTranslation("fiscalYear");
  const Wrapper = onSubmit ? "form" : "div";
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <Wrapper
        {...(onSubmit ? { onSubmit, noValidate: true } : {})}
        className={`w-full ${size} bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]`}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-gray-900">{title}</h3>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors" aria-label={t("ui.close")}>
            <MdClose className="text-xl" />
          </button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto">{children}</div>
        {footer && (
          <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-2 bg-gray-50/50">{footer}</div>
        )}
      </Wrapper>
    </div>
  );
}

// A refusal / general error from the server, shown inside a modal or a step.
export function ErrorBox({ message, className = "" }) {
  if (!message) return null;
  return (
    <div role="alert" className={`flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2.5 text-sm text-red-700 ${className}`}>
      <MdErrorOutline className="text-lg shrink-0 mt-0.5" />
      <p>{message}</p>
    </div>
  );
}
