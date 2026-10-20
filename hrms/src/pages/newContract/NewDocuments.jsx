import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import {
  MdCloudUpload,
  MdOutlineInsertDriveFile,
  MdOutlineSearch,
  MdOutlineDelete,
  MdOutlineDesignServices,
  MdCheckCircle,
  MdOutlineDescription,
  MdOutlineEdit,
  MdOutlineArchive,
  MdOutlineUnarchive,
} from "react-icons/md";
import { listContractDocuments, uploadContractDocuments, updateContractDocument, removeContractDocument } from "../../api/contracts";
import useApiQuery from "../../hooks/useApiQuery";
import { useCan } from "../../hooks/usePermission";
import { MODULES } from "../../constants/permissions";
import { ScreenError, ScreenLoader } from "../../components/ScreenState";
import { toastApiError } from "../../utils/apiError";
import { serverErrors } from "../../utils/applyFieldErrors";

// Contract documents (plan decisions 6–8): PDF only, saved to the private library; rename
// and archive only (documents are immutable).

const MB = 1024 * 1024;
const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) : "");

export default function NewDocuments() {
  const { t } = useTranslation("contractStudio");
  const navigate = useNavigate();
  const can = useCan();
  const canCreate = can(MODULES.CONTRACT, "create");
  const canUpdate = can(MODULES.CONTRACT, "update");
  const canDelete = can(MODULES.CONTRACT, "delete");
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [query, setQuery] = useState("");
  const [justAdded, setJustAdded] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [renaming, setRenaming] = useState(null); // { id, name, error }

  const { data, loading, error, reload } = useApiQuery(() => listContractDocuments({ limit: 100, search: query.trim() }), [query.trim()]);
  const documents = data?.items || [];

  const saveFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length || uploading) return;
    setUploading(true);
    try {
      const { items, errors } = await uploadContractDocuments(files);
      // One message per refused file ("Upload a PDF file up to 20 MB and 50 pages."); the others are saved.
      errors.forEach((e) => toast.error(`${e.fileName}: ${e.message}`));
      if (items.length) {
        toast.success(items.length > 1 ? t("documents.toast.savedMany", { count: items.length }) : t("documents.toast.savedOne"));
        setJustAdded(items[items.length - 1].id);
        setTimeout(() => setJustAdded(null), 2500);
      }
      reload();
    } catch (err) {
      // e.g. 400 "You can upload at most 10 files at a time."
      toastApiError(err);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (canCreate) saveFiles(e.dataTransfer.files);
  };

  const saveName = async () => {
    const name = renaming.name.trim();
    if (!name) return setRenaming({ ...renaming, error: t("documents.validation.nameRequired") });
    if (name.length > 255) return setRenaming({ ...renaming, error: t("documents.validation.nameMax") });
    try {
      await updateContractDocument(renaming.id, { name });
      setRenaming(null);
      reload();
    } catch (err) {
      const [first] = serverErrors(err);
      if (first) setRenaming({ ...renaming, error: first.message });
      else toastApiError(err);
    }
  };

  const toggleArchive = async (d) => {
    try {
      await updateContractDocument(d.id, { status: d.status === "ARCHIVED" ? "SAVED" : "ARCHIVED" });
      reload();
    } catch (err) {
      toastApiError(err);
    }
  };

  const remove = async (d) => {
    try {
      await removeContractDocument(d.id);
      toast.success(t("documents.toast.deleted"));
      reload();
    } catch (err) {
      // 409 "This document is used by a template or contract and can't be deleted. Archive it instead."
      toastApiError(err);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      {/* header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">{t("documents.title")}</h1>
        <p className="text-gray-500 mt-1 text-sm">
          {t("documents.subtitle")}
        </p>
      </div>

      {/* uploader */}
      {canCreate && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`flex flex-col items-center justify-center text-center rounded-2xl border-2 border-dashed p-10 cursor-pointer transition-colors ${
            dragOver ? "border-[#20B2AA] bg-cyan-50/50" : "border-gray-300 bg-white hover:bg-gray-50"
          } ${uploading ? "opacity-60 pointer-events-none" : ""}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf"
            multiple
            className="hidden"
            data-testid="document-input"
            onChange={(e) => saveFiles(e.target.files)}
          />
          <div className="w-16 h-16 bg-blue-100 text-blue-500 rounded-2xl flex items-center justify-center mb-4">
            <MdCloudUpload className="text-3xl" />
          </div>
          <h3 className="text-base font-bold text-gray-900 mb-1">{t("documents.dropTitle")}</h3>
          <p className="text-sm text-gray-500 mb-4">{t("documents.dropSubtitle")}</p>
          <div className="flex gap-2">
            {["PDF", t("documents.chips.multiple"), t("documents.chips.maxSize")].map((chip) => (
              <span key={chip} className="px-2 py-1 bg-gray-100 text-gray-500 rounded text-[10px] font-bold tracking-wider">
                {chip}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* library toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <MdOutlineSearch className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("documents.searchPlaceholder")}
            className="w-full ps-10 pe-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
          />
        </div>
        <span className="text-sm text-gray-400">
          <span className="font-semibold text-gray-600">{data?.total ?? 0}</span> {t("documents.savedCount")}
        </span>
      </div>

      {/* library grid */}
      {loading && !data ? (
        <ScreenLoader />
      ) : error ? (
        <ScreenError error={error} onRetry={reload} />
      ) : documents.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-14 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center mb-4">
            <MdOutlineDescription className="text-3xl text-gray-300" />
          </div>
          <h3 className="text-base font-bold text-gray-900 mb-1">{t("documents.empty.title")}</h3>
          <p className="text-sm text-gray-500 max-w-sm">{t("documents.empty.description")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {documents.map((d) => {
            const isNew = justAdded === d.id;
            const archived = d.status === "ARCHIVED";
            const isRenaming = renaming?.id === d.id;
            return (
              <div
                key={d.id}
                data-testid="document-card"
                className={`group relative bg-white border rounded-2xl p-5 transition-all hover:shadow-lg hover:shadow-gray-100 hover:-translate-y-0.5 ${
                  isNew ? "border-cyan-400 ring-2 ring-cyan-100" : "border-gray-200"
                }`}
              >
                {/* thumbnail */}
                <div className="relative h-28 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-100 flex items-center justify-center mb-4 overflow-hidden">
                  <MdOutlineInsertDriveFile className="text-4xl text-gray-300" />
                  <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase bg-rose-100 text-rose-600">pdf</span>
                  <span
                    className={`absolute bottom-2 right-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                      archived ? "bg-gray-100 text-gray-500" : "bg-emerald-50 text-emerald-600"
                    }`}
                  >
                    <MdCheckCircle className="text-xs" /> {t(`status.${archived ? "Archived" : "Saved"}`)}
                  </span>
                </div>

                {isRenaming ? (
                  <div>
                    <input
                      autoFocus
                      value={renaming.name}
                      onChange={(e) => setRenaming({ ...renaming, name: e.target.value, error: null })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveName();
                        if (e.key === "Escape") setRenaming(null);
                      }}
                      className={`w-full border rounded-md px-2 py-1 text-sm ${renaming.error ? "border-red-500" : "border-gray-200"}`}
                    />
                    {renaming.error && <p className="text-red-500 text-xs mt-1">{renaming.error}</p>}
                    <div className="flex gap-2 mt-2">
                      <button onClick={saveName} className="text-xs font-semibold text-white bg-[#20B2AA] hover:bg-[#1C9D96] rounded-md px-3 py-1">
                        {t("documents.saveName")}
                      </button>
                      <button onClick={() => setRenaming(null)} className="text-xs font-semibold text-gray-500 hover:text-gray-700 px-2 py-1">
                        {t("actions.cancel")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <h3 className="text-sm font-semibold text-gray-900 truncate" title={d.name}>
                    {d.name}
                  </h3>
                )}
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {t("documents.meta", { pages: d.page_count, size: ((d.file_size_bytes || 0) / MB).toFixed(1), date: formatDate(d.created_at) })}
                </p>

                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                  {canCreate && !archived && (
                    <button
                      onClick={() => navigate(`/admin/new-contracts/templates/build?doc=${d.id}`)}
                      className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-[#20B2AA] hover:bg-[#1C9D96] rounded-lg py-2 transition-colors"
                    >
                      <MdOutlineDesignServices className="text-sm" /> {t("documents.makeTemplate")}
                    </button>
                  )}
                  {(!canCreate || archived) && <span className="flex-1" />}
                  {canUpdate && (
                    <button
                      onClick={() => setRenaming({ id: d.id, name: d.name, error: null })}
                      className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-[#20B2AA] hover:border-cyan-200 transition-colors"
                      title={t("documents.rename")}
                      aria-label={t("documents.rename")}
                    >
                      <MdOutlineEdit className="text-base" />
                    </button>
                  )}
                  {canUpdate && (
                    <button
                      onClick={() => toggleArchive(d)}
                      className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-amber-500 hover:border-amber-200 transition-colors"
                      title={archived ? t("documents.unarchive") : t("documents.archive")}
                      aria-label={archived ? t("documents.unarchive") : t("documents.archive")}
                    >
                      {archived ? <MdOutlineUnarchive className="text-base" /> : <MdOutlineArchive className="text-base" />}
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => remove(d)}
                      className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-rose-500 hover:border-rose-200 transition-colors"
                      title={t("actions.delete")}
                      aria-label={t("actions.delete")}
                    >
                      <MdOutlineDelete className="text-base" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
