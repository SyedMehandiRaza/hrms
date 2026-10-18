import { useState } from "react";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import { MdOutlineReceiptLong, MdOutlineFileDownload, MdOutlineInbox } from "react-icons/md";

import Loader, { Spinner } from "../Loader";
import { useFormat } from "../../hooks/useFormat";
import { MY_ANNUAL_STATEMENTS } from "../../data/groupA";

// "My annual statements" — the logged-in employee's annual pay statement for
// every financial year (GET /me/annual-statements). Links are short-lived
// signed URLs, so a download re-fetches the list for a fresh one.
//   <MyAnnualStatementsCard />
export default function MyAnnualStatementsCard({ className = "" }) {
  const { t } = useTranslation("fiscalYear");
  const { fmtDate } = useFormat();
  const [state] = useState({ loading: false, rows: MY_ANNUAL_STATEMENTS, failed: false });
  const [busy, setBusy] = useState(null); // "<id>:pdf" | "<id>:csv"

  // Static build: no file behind the link — just confirm the action.
  const download = (row, kind) => {
    setBusy(null);
    toast.success(`${t("statements.download")}: ${row.label || row.year_key} (${kind.toUpperCase()})`);
  };

  return (
    <section className={`bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 ${className}`}>
      <h2 className="text-lg font-bold text-gray-800 mb-1 flex items-center gap-2">
        <MdOutlineReceiptLong className="text-cyan-600" />
        {t("statements.title")}
      </h2>
      <p className="text-xs text-gray-500 mb-4 pb-3 border-b border-gray-100">{t("statements.subtitle")}</p>

      {state.loading ? (
        <Loader label={t("statements.loading")} className="py-8" />
      ) : state.rows.length === 0 ? (
        <div className="flex flex-col items-center text-center py-6">
          <MdOutlineInbox className="text-3xl text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">{state.failed ? t("statements.loadFailed") : t("statements.empty")}</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 max-h-72 overflow-y-auto -mx-1 px-1">
          {state.rows.map((r) => (
            <li key={r.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">{r.label || r.year_key}</p>
                <p className="text-[11px] text-gray-400">
                  {r.generated_at ? t("statements.generatedOn", { date: fmtDate(r.generated_at) }) : null}
                  {r.version > 1 ? ` · ${t("statements.version", { version: r.version })}` : null}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {r.csv_download_url && (
                  <button
                    type="button"
                    onClick={() => download(r, "csv")}
                    disabled={!!busy}
                    className="px-2.5 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  >
                    {busy === `${r.id}:csv` ? <Spinner size="sm" /> : "CSV"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => download(r, "pdf")}
                  disabled={!!busy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg disabled:opacity-50"
                >
                  {busy === `${r.id}:pdf` ? (
                    <Spinner size="sm" className="border-white border-t-transparent" />
                  ) : (
                    <MdOutlineFileDownload className="text-sm" />
                  )}
                  {t("statements.download")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
