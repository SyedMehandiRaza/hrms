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
} from "react-icons/md";
import { useNcDocuments, ncStore } from "./newContractStore";

// mock page-count generator (no real PDF parsing without a backend)
const guessPages = (name) => (name.toLowerCase().includes("nda") ? 2 : Math.floor(Math.random() * 4) + 2);

export default function NewDocuments() {
  const { t } = useTranslation("contractStudio");
  const navigate = useNavigate();
  const documents = useNcDocuments();
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [query, setQuery] = useState("");
  const [justAdded, setJustAdded] = useState(null);

  // keep the file locally (blob URL) so the builder can preview a real PDF
  const uploadDocument = (file, meta = {}) => {
    const ext = (file.name.split(".").pop() || "pdf").toLowerCase();
    let fileUrl = null;
    try {
      fileUrl = URL.createObjectURL(file);
    } catch {
      /* ignore */
    }
    return ncStore.addDocument({ name: file.name, fileUrl, size: (file.size / 1024 / 1024).toFixed(1), pages: meta.page_count || 1, ext });
  };

  const saveFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    let last = null;
    for (const f of files) {
      last = uploadDocument(f, { page_count: guessPages(f.name) });
    }
    setJustAdded(last?.id || null);
    toast.success(files.length > 1 ? t("documents.toast.savedMany", { count: files.length }) : t("documents.toast.savedOne"));
    setTimeout(() => setJustAdded(null), 2500);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    saveFiles(e.dataTransfer.files);
  };

  const filtered = documents.filter((d) => !query || d.name.toLowerCase().includes(query.toLowerCase()));

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
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.doc"
          multiple
          className="hidden"
          onChange={(e) => saveFiles(e.target.files)}
        />
        <div className="w-16 h-16 bg-blue-100 text-blue-500 rounded-2xl flex items-center justify-center mb-4">
          <MdCloudUpload className="text-3xl" />
        </div>
        <h3 className="text-base font-bold text-gray-900 mb-1">{t("documents.dropTitle")}</h3>
        <p className="text-sm text-gray-500 mb-4">{t("documents.dropSubtitle")}</p>
        <div className="flex gap-2">
          {["PDF", "DOCX", t("documents.chips.multiple"), t("documents.chips.maxSize")].map((chip) => (
            <span key={chip} className="px-2 py-1 bg-gray-100 text-gray-500 rounded text-[10px] font-bold tracking-wider">
              {chip}
            </span>
          ))}
        </div>
      </div>

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
          <span className="font-semibold text-gray-600">{documents.length}</span> {t("documents.savedCount")}
        </span>
      </div>

      {/* library grid */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-14 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center mb-4">
            <MdOutlineDescription className="text-3xl text-gray-300" />
          </div>
          <h3 className="text-base font-bold text-gray-900 mb-1">{t("documents.empty.title")}</h3>
          <p className="text-sm text-gray-500 max-w-sm">{t("documents.empty.description")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((d) => {
            const isNew = justAdded === d.id;
            return (
              <div
                key={d.id}
                className={`group relative bg-white border rounded-2xl p-5 transition-all hover:shadow-lg hover:shadow-gray-100 hover:-translate-y-0.5 ${
                  isNew ? "border-cyan-400 ring-2 ring-cyan-100" : "border-gray-200"
                }`}
              >
                {/* thumbnail */}
                <div className="relative h-28 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-100 flex items-center justify-center mb-4 overflow-hidden">
                  <MdOutlineInsertDriveFile className="text-4xl text-gray-300" />
                  <span
                    className={`absolute top-2 left-2 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase ${
                      d.ext === "pdf" ? "bg-rose-100 text-rose-600" : "bg-blue-100 text-blue-600"
                    }`}
                  >
                    {d.ext}
                  </span>
                  <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-semibold">
                    <MdCheckCircle className="text-xs" /> {t(`status.${d.status}`, { defaultValue: d.status })}
                  </span>
                </div>

                <h3 className="text-sm font-semibold text-gray-900 truncate" title={d.name}>
                  {d.name}
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {t("documents.meta", { pages: d.pages, size: d.size, date: d.uploadedAt })}
                </p>

                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => navigate(`/admin/new-contracts/templates/build?doc=${d.id}`)}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-[#20B2AA] hover:bg-[#1C9D96] rounded-lg py-2 transition-colors"
                  >
                    <MdOutlineDesignServices className="text-sm" /> {t("documents.makeTemplate")}
                  </button>
                  <button
                    onClick={async () => {
                      ncStore.removeDocument(d.id);
                      toast.success(t("documents.toast.deleted"));
                    }}
                    className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-rose-500 hover:border-rose-200 transition-colors"
                    title={t("actions.delete")}
                  >
                    <MdOutlineDelete className="text-base" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
