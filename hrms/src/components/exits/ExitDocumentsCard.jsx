import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import {
  MdOutlineDescription,
  MdOutlineFileDownload,
  MdOutlineOpenInNew,
  MdOutlineRefresh,
  MdOutlineMarkEmailRead,
} from "react-icons/md";

import { regenerateExitDocument, sendExitDocuments } from "../../data/groupG";
import { useFormat } from "../../hooks/useFormat";

// Letters, FnF statement and clearance certificate of a confirmed exit.
export default function ExitDocumentsCard({ exit, onChanged }) {
  const { t } = useTranslation("exits");
  const { fmtDate } = useFormat();
  const [busy, setBusy] = useState(null); // doc_type being regenerated | "send"
  const docs = exit?.documents || [];
  const confirmed = !!exit?.confirmation?.confirmed;
  const locked = exit?.status === "CANCELLED";

  const regenerate = async (type) => {
    setBusy(type);
    try {
      regenerateExitDocument(exit.id, type);
      toast.success(t("documents.regenerated"));
      onChanged?.();
    } catch {
      toast.error(t("common.genericError"));
    } finally {
      setBusy(null);
    }
  };

  const send = async () => {
    setBusy("send");
    try {
      sendExitDocuments(exit.id);
      toast.success(t("documents.sent"));
      onChanged?.();
    } catch {
      toast.error(t("common.genericError"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="bg-white border border-gray-200 rounded-xl">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MdOutlineDescription className="text-lg text-cyan-600" />
          <h2 className="text-sm font-bold text-gray-900">{t("documents.title")}</h2>
        </div>
        {confirmed && docs.length > 0 && !locked && (
          <button
            type="button"
            onClick={send}
            disabled={!!busy}
            className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-600 hover:text-cyan-700 disabled:opacity-50"
          >
            <MdOutlineMarkEmailRead className="text-sm" />
            {busy === "send" ? t("documents.sending") : t("documents.send")}
          </button>
        )}
      </div>
      <div className="p-5">
        {!confirmed || docs.length === 0 ? (
          <p className="text-xs text-gray-400">{t("documents.empty")}</p>
        ) : (
          <ul className="space-y-3">
            {docs.map((d) => (
              <li key={d.id} className="rounded-lg border border-gray-100 px-3 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{t(`documents.type.${d.doc_type}`)}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {t("documents.version", { version: d.version })}
                      {" · "}
                      {t("documents.generatedOn", { date: fmtDate(d.generated_at) })}
                      {" · "}
                      {d.sent_at ? t("documents.sentOn", { date: fmtDate(d.sent_at) }) : t("documents.notSent")}
                    </p>
                  </div>
                  {d.doc_type === "FNF_STATEMENT" && (
                    <span
                      className={`shrink-0 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                        d.is_final ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}
                    >
                      {d.is_final ? t("documents.final") : t("documents.provisional")}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-2">
                  <a href={d.url} onClick={(e) => { e.preventDefault(); toast.info(t("documents.view")); }} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-600 hover:text-cyan-700">
                    <MdOutlineOpenInNew className="text-sm" />
                    {t("documents.view")}
                  </a>
                  <a href={d.download_url} onClick={(e) => { e.preventDefault(); toast.success(t("documents.download")); }} className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-600 hover:text-cyan-700">
                    <MdOutlineFileDownload className="text-sm" />
                    {t("documents.download")}
                  </a>
                  {!locked && (
                    <button
                      type="button"
                      onClick={() => regenerate(d.doc_type)}
                      disabled={!!busy}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-800 disabled:opacity-50"
                    >
                      <MdOutlineRefresh className={`text-sm ${busy === d.doc_type ? "animate-spin" : ""}`} />
                      {t("documents.regenerate")}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
