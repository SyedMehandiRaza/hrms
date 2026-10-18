import React from "react";
import { MdOutlineChevronLeft, MdOutlineChevronRight } from "react-icons/md";
import { Trans, useTranslation } from "react-i18next";

export default function Pagination({
  page,
  totalPages,
  total,
  limit,
  onPage,
  label,
  activeClass = "bg-[#17a2b8] text-white",
  containerClass = "flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-gray-100 bg-gray-50/50 mt-auto",
}) {
  const { t } = useTranslation("common");
  label = label ?? t("ui.entries");
  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);
  const pages = [];

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    if (page <= 3) {
      pages.push(1, 2, 3, 4, "...", totalPages);
    } else if (page >= totalPages - 2) {
      pages.push(1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, "...", page - 1, page, page + 1, "...", totalPages);
    }
  }

  return (
    <div className={containerClass}>
      <p className="text-sm text-gray-400 order-2 sm:order-1">
        {/* One whole sentence so Arabic word order stays natural. */}
        <Trans
          t={t}
          i18nKey="ui.showing"
          values={{ start, end, total, label }}
          components={{ b: <span className="font-semibold text-gray-600" /> }}
        />
      </p>
      <div className="flex items-center gap-1 order-1 sm:order-2">
        <button
          onClick={() => onPage(Math.max(1, page - 1))}
          disabled={page === 1}
          className="w-8 h-8 flex items-center justify-center border border-gray-200 rounded-md text-gray-400 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <MdOutlineChevronLeft className="rtl:rotate-180" />
        </button>
        {pages.map((n, i) =>
          n === "..." ? (
            <span key={`e${i}`} className="px-1 text-gray-400 text-sm">
              ...
            </span>
          ) : (
            <button
              key={n}
              onClick={() => onPage(n)}
              className={`w-8 h-8 flex items-center justify-center rounded-md text-sm font-medium transition-colors ${
                page === n ? activeClass : "border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {n}
            </button>
          ),
        )}
        <button
          onClick={() => onPage(Math.min(totalPages, page + 1))}
          disabled={page === totalPages || totalPages === 0}
          className="w-8 h-8 flex items-center justify-center border border-gray-200 rounded-md text-gray-400 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <MdOutlineChevronRight className="rtl:rotate-180" />
        </button>
      </div>
    </div>
  );
}
