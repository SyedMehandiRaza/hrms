import { useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import {
  MdOutlineChevronRight,
  MdOutlineArrowBack,
  MdOutlineDescription,
  MdOutlineInsertDriveFile,
  MdOutlinePerson,
  MdOutlineBusiness,
  MdOutlineTextFields,
  MdOutlineCheckBox,
  MdOutlineDraw,
  MdOutlineDataObject,
  MdOutlineDragIndicator,
  MdClose,
  MdOutlineDelete,
  MdOutlineSearch,
  MdOutlineSave,
  MdKeyboardArrowDown,
  MdOutlineTune,
  MdOutlineWidgets,
} from "react-icons/md";
import { NC_MERGE_FIELDS } from "./newContractData";
import { useNcDocuments, ncStore } from "./newContractStore";
import SignaturePadModal from "./SignaturePadModal";
import PdfCanvas from "./PdfCanvas";

// Only two record types for now — data-driven, so more can be added later.
const BUILDER_AUDIENCES = [
  { id: "employee", label: "Employee", labelKey: "audiences.employee", icon: MdOutlinePerson },
  { id: "staffing", label: "Staffing Company", labelKey: "audiences.staffing", icon: MdOutlineBusiness },
  { id: "collaborator", label: "Collaborating Company", labelKey: "audiences.collaborator", icon: MdOutlineBusiness },
];

// LEFT-side drag tools (exactly the three from the plan).
const ELEMENTS = [
  { id: "input", labelKey: "builder.elements.input.label", icon: MdOutlineTextFields, hintKey: "builder.elements.input.hint" },
  { id: "checkbox", labelKey: "builder.elements.checkbox.label", icon: MdOutlineCheckBox, hintKey: "builder.elements.checkbox.hint" },
  { id: "signature", labelKey: "builder.elements.signature.label", icon: MdOutlineDraw, hintKey: "builder.elements.signature.hint" },
];

const ELEM_ICON = {
  input: MdOutlineTextFields,
  checkbox: MdOutlineCheckBox,
  signature: MdOutlineDraw,
  db: MdOutlineDataObject,
};

let seq = 1;
const newId = () => `fld_${seq++}_${Math.floor(Math.random() * 1e4)}`;

export default function NewTemplateBuilder() {
  const { t } = useTranslation("contractStudio");
  const navigate = useNavigate();
  const documents = useNcDocuments();
  const [params] = useSearchParams();

  // ── init from ?id (edit) or ?doc (new from a saved document) ──
  const editingId = params.get("id");
  const initial = useMemo(() => {
    if (editingId) {
      const t = ncStore.getTemplate(editingId);
      if (t) return t;
    }
    const docId = params.get("doc");
    const doc = docId ? ncStore.getDocument(docId) : null;
    return {
      id: null,
      name: doc ? `${doc.name.replace(/\.[^.]+$/, "")} Template` : "",
      docId: doc?.id || null,
      docName: doc?.name || null,
      audience: "employee",
      pages: doc?.pages || 3,
      fields: [],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const serverId = initial.serverId || null;
  const [name, setName] = useState(initial.name);
  const [docId, setDocId] = useState(initial.docId);
  const [docName, setDocName] = useState(initial.docName);
  const [audience, setAudience] = useState(initial.audience);
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [pages, setPages] = useState(initial.pages);
  const [fields, setFields] = useState(initial.fields);
  const [activePage, setActivePage] = useState(1);
  const [pageAspect, setPageAspect] = useState(1 / 1.3); // real ratio once the PDF loads

  const [colQuery, setColQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [dropHint, setDropHint] = useState(false);
  const [signOpen, setSignOpen] = useState(false);

  const canvasRef = useRef(null);
  const dragRef = useRef(null);
  const dndPayload = useRef(null);

  const columns = NC_MERGE_FIELDS[audience] || [];
  const pageFields = fields.filter((f) => f.page === activePage);
  const selected = fields.find((f) => f.id === selectedId);
  const audMeta = BUILDER_AUDIENCES.find((a) => a.id === audience);
  const audLabel = audMeta ? t(audMeta.labelKey) : undefined;

  // the actual selected document (for a real preview instead of the mock)
  const selectedDoc = documents.find((d) => d.id === docId);
  const previewUrl = selectedDoc?.fileUrl || null;
  const previewIsPdf = previewUrl && (selectedDoc?.ext || "pdf").toLowerCase() === "pdf";

  // ── pick a source document (stage A) ──
  const chooseDoc = (d) => {
    setDocId(d.id);
    setDocName(d.name);
    setPages(d.pages || 3);
    if (!name) setName(`${d.name.replace(/\.[^.]+$/, "")} Template`);
  };

  // ── build a field object from a drag payload ──
  const makeField = (payload, x, y) => {
    const base = {
      id: newId(),
      page: activePage,
      type: payload.type,
      x: Math.min(94, Math.max(2, x)),
      y: Math.min(96, Math.max(2, y)),
      required: true,
    };
    if (payload.type === "db") {
      // A record column dropped onto a blank (e.g. Full Name, Email).
      base.token = payload.token;
      base.label = payload.label;
    } else if (payload.type === "input") {
      base.label = "Input";
      base.fieldKey = ""; // the "name of that input" — configured on the right
      base.placeholder = "";
    } else if (payload.type === "checkbox") {
      base.label = "Checkbox";
      base.checkedValue = "Yes"; // "value associated with that checkbox"
    } else if (payload.type === "signature") {
      base.label = "Signature";
    }
    return base;
  };

  // ── placement: DRAG-AND-DROP ONLY, dropped exactly where released ──
  const placeAt = (payload, clientX, clientY) => {
    if (!payload || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    const f = makeField(payload, x, y);
    setFields((prev) => [...prev, f]);
    setSelectedId(f.id);
  };
  const onCanvasDrop = (e) => {
    e.preventDefault();
    setDropHint(false);
    const p = dndPayload.current;
    dndPayload.current = null;
    placeAt(p, e.clientX, e.clientY);
  };
  const onCanvasClick = () => setSelectedId(null);

  // ── reposition an already-placed field ──
  const startReposition = (e, f) => {
    e.stopPropagation();
    setSelectedId(f.id);
    dragRef.current = f.id;
    const move = (ev) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = ((ev.clientX - rect.left) / rect.width) * 100;
      const y = ((ev.clientY - rect.top) / rect.height) * 100;
      setFields((prev) =>
        prev.map((p) =>
          p.id === dragRef.current ? { ...p, x: Math.min(94, Math.max(2, x)), y: Math.min(96, Math.max(2, y)) } : p
        )
      );
    };
    const up = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const patch = (id, p) => setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...p } : f)));
  const remove = (id) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  // ── save ──
  const handleSave = async () => {
    if (!name.trim()) return toast.error(t("builder.toast.nameRequired"));
    if (!docId) return toast.error(t("builder.toast.docRequired"));
    if (fields.length === 0) return toast.error(t("builder.toast.fieldRequired"));
    const record = { name: name.trim(), docId, docName, audience, pages, fields };
    const id = initial.id || editingId;
    if (id && ncStore.getTemplate(id)) ncStore.updateTemplate(id, record);
    else ncStore.addTemplate(record);
    toast.success(serverId || initial.id ? t("builder.toast.updated") : t("builder.toast.saved"));
    navigate("/admin/new-contracts/templates");
  };

  const changeAudience = (id) => {
    setAudience(id);
    setAudienceOpen(false);
  };

  return (
    <div className="pb-10">
      {/* breadcrumb + actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-1.5 text-sm mb-2">
            <Link to="/admin/new-contracts/templates" className="text-gray-400 hover:text-cyan-600 transition-colors">
              {t("builder.breadcrumb.templates")}
            </Link>
            <MdOutlineChevronRight className="text-gray-300" />
            <span className="text-cyan-600 font-semibold">{initial.id ? t("builder.breadcrumb.editTemplate") : t("builder.breadcrumb.configureDocument")}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{name.trim() || t("builder.untitled")}</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/admin/new-contracts/templates")}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors"
          >
            <MdOutlineArrowBack /> {t("actions.cancel")}
          </button>
          {docId && (
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-[#20B2AA] to-cyan-500 hover:from-[#1C9D96] hover:to-cyan-600 rounded-lg shadow-sm shadow-cyan-200 transition-all"
            >
              <MdOutlineSave className="text-lg" /> {t("builder.save")}
            </button>
          )}
        </div>
      </div>

      {/* ── STAGE A: pick a saved document ── */}
      {!docId ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-1">
            <MdOutlineDescription className="text-xl text-[#20B2AA]" />
            <h2 className="text-base font-bold text-gray-900">{t("builder.selectDoc.title")}</h2>
          </div>
          <p className="text-sm text-gray-500 mb-5">{t("builder.selectDoc.subtitle")}</p>

          {documents.length === 0 ? (
            <div className="border border-dashed border-gray-300 rounded-xl p-10 text-center">
              <p className="text-sm text-gray-500 mb-4">{t("builder.selectDoc.empty")}</p>
              <button
                onClick={() => navigate("/admin/new-contracts/documents")}
                className="text-sm font-semibold text-[#20B2AA] hover:text-[#1C9D96]"
              >
                {t("builder.selectDoc.goToDocuments")}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {documents.map((d) => (
                <button
                  key={d.id}
                  onClick={() => chooseDoc(d)}
                  className="group text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-cyan-300 hover:shadow-md transition-all"
                >
                  <div className="h-24 rounded-lg bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-100 flex items-center justify-center mb-3 relative">
                    <MdOutlineInsertDriveFile className="text-3xl text-gray-300" />
                    <span
                      className={`absolute top-2 left-2 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                        d.ext === "pdf" ? "bg-rose-100 text-rose-600" : "bg-blue-100 text-blue-600"
                      }`}
                    >
                      {d.ext}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 truncate">{d.name}</p>
                  <p className="text-[11px] text-gray-400">{t("builder.selectDoc.meta", { pages: d.pages, size: d.size })}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ── STAGE B: the configurator ── */
        <>
          {/* template name + source doc */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-4 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{t("builder.templateName")}</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("builder.templateNamePlaceholder")}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#20B2AA] focus:bg-white transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{t("builder.sourceDocument")}</label>
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
                <MdOutlineInsertDriveFile className="text-rose-400" />
                <span className="truncate max-w-[180px]">{docName}</span>
                <button
                  onClick={() => { setDocId(null); setDocName(null); }}
                  className="text-gray-300 hover:text-rose-500"
                  title={t("builder.changeDocument")}
                >
                  <MdClose />
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[200px_1fr_320px] gap-4">
            {/* ══ LEFT: drag tools ══ */}
            <aside className="bg-white border border-gray-200 rounded-2xl p-4 h-fit xl:sticky xl:top-4">
              <div className="flex items-center gap-2 mb-1">
                <MdOutlineWidgets className="text-cyan-600" />
                <h3 className="text-sm font-bold text-gray-900">{t("builder.elements.title")}</h3>
              </div>
              <p className="text-[11px] text-gray-400 mb-4">{t("builder.elements.hint")}</p>
              <div className="space-y-2.5">
                {ELEMENTS.map((el) => {
                  const Icon = el.icon;
                  return (
                    <div
                      key={el.id}
                      draggable
                      onDragStart={(e) => { dndPayload.current = { type: el.id }; e.dataTransfer.effectAllowed = "copy"; }}
                      onDragEnd={() => { dndPayload.current = null; setDropHint(false); }}
                      className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-white cursor-grab active:cursor-grabbing hover:border-cyan-300 hover:bg-gray-50 transition-all"
                    >
                      <span className="w-9 h-9 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center text-lg">
                        <Icon />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{t(el.labelKey)}</p>
                        <p className="text-[11px] text-gray-400">{t(el.hintKey)}</p>
                      </div>
                      <MdOutlineDragIndicator className="text-gray-300" />
                    </div>
                  );
                })}
              </div>

              {/* pages */}
              <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mt-6 mb-2">{t("builder.pages")}</h3>
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: pages }).map((_, i) => {
                  const p = i + 1;
                  const count = fields.filter((f) => f.page === p).length;
                  return (
                    <button
                      key={p}
                      onClick={() => setActivePage(p)}
                      className={`relative rounded-lg border-2 aspect-[3/4] flex flex-col items-center justify-center transition-all ${
                        activePage === p ? "border-cyan-500 ring-2 ring-cyan-100" : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <MdOutlineDescription className="text-lg text-gray-300" />
                      <span className="text-[10px] text-gray-400">{t("builder.pageShort", { page: p })}</span>
                      {count > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-cyan-600 text-white text-[9px] font-bold flex items-center justify-center">
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </aside>

            {/* ══ CENTER: document preview ══ */}
            <div className="bg-gray-100 border border-gray-200 rounded-2xl p-4 sm:p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-500 truncate max-w-[60%]">
                  {docName ? docName : t("builder.preview")} · {t("builder.pageOf", { page: activePage, total: pages })}
                </span>
                <span className="text-xs text-gray-400">{t("builder.fieldsPlaced", { count: pageFields.length })}</span>
              </div>

              <div
                ref={canvasRef}
                onClick={onCanvasClick}
                onDragOver={(e) => { e.preventDefault(); if (!dropHint) setDropHint(true); }}
                onDragLeave={(e) => { if (e.target === canvasRef.current) setDropHint(false); }}
                onDrop={onCanvasDrop}
                style={{ aspectRatio: pageAspect }}
                className={`relative mx-auto bg-white shadow-lg rounded-sm w-full max-w-[640px] overflow-hidden select-none transition-shadow cursor-default ${
                  dropHint ? "ring-2 ring-cyan-400 ring-offset-2" : ""
                }`}
              >
                {/* Real uploaded document rendered by PDF.js; mock as a fallback */}
                {previewIsPdf ? (
                  <PdfCanvas
                    src={previewUrl}
                    page={activePage}
                    onLoaded={(numPages, aspect) => {
                      if (numPages) setPages(numPages);
                      if (aspect) setPageAspect(aspect);
                    }}
                    className="absolute inset-0 w-full h-full pointer-events-none"
                  />
                ) : (
                  <MockDoc audience={audience} />
                )}

                {dropHint && (
                  <div className="absolute inset-0 z-30 bg-cyan-500/5 border-2 border-dashed border-cyan-400 rounded-sm flex items-center justify-center pointer-events-none">
                    <span className="text-xs font-semibold text-cyan-700 bg-white/90 px-3 py-1.5 rounded-full shadow-sm">{t("builder.dropHere")}</span>
                  </div>
                )}

                {pageFields.map((f) => (
                  <PlacedField
                    key={f.id}
                    f={f}
                    selected={selectedId === f.id}
                    onSelect={() => setSelectedId(f.id)}
                    onDragStart={(e) => startReposition(e, f)}
                    onRemove={() => remove(f.id)}
                  />
                ))}

                {pageFields.length === 0 && (
                  <div className="absolute inset-x-0 bottom-6 flex justify-center pointer-events-none">
                    <span className="text-[11px] text-gray-400 bg-white/80 px-3 py-1 rounded-full border border-gray-200">
                      {t("builder.canvasHint")}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* ══ RIGHT: configuration ══ */}
            <aside className="space-y-4 xl:sticky xl:top-4 h-fit">
              {/* For whom */}
              <div className="bg-white border border-gray-200 rounded-2xl p-4">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                  {t("builder.whoFor")}
                </label>
                <div className="relative">
                  <button
                    onClick={() => setAudienceOpen((v) => !v)}
                    className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800 hover:bg-gray-100 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      {audMeta && <audMeta.icon className="text-cyan-600 text-lg" />}
                      {audLabel}
                    </span>
                    <MdKeyboardArrowDown className={`text-lg text-gray-400 transition-transform ${audienceOpen ? "rotate-180" : ""}`} />
                  </button>
                  {audienceOpen && (
                    <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                      {BUILDER_AUDIENCES.map((a) => {
                        const Icon = a.icon;
                        return (
                          <button
                            key={a.id}
                            onClick={() => changeAudience(a.id)}
                            className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-gray-50 ${
                              audience === a.id ? "text-cyan-600 bg-cyan-50/50" : "text-gray-700"
                            }`}
                          >
                            <Icon className="text-lg" /> {t(a.labelKey)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
                  {t("builder.whoForHint")}
                </p>
              </div>

              {/* DB columns */}
              <div className="bg-white border border-gray-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <MdOutlineDataObject className="text-cyan-600" />
                  <h3 className="text-sm font-bold text-gray-900">{t("builder.columnsTitle", { audience: audLabel ?? "" })}</h3>
                </div>
                <div className="relative mb-3">
                  <MdOutlineSearch className="absolute start-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    value={colQuery}
                    onChange={(e) => setColQuery(e.target.value)}
                    placeholder={t("builder.searchColumns")}
                    className="w-full ps-8 pe-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div className="space-y-1.5 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                  {columns
                    .filter((c) => !colQuery || c.label.toLowerCase().includes(colQuery.toLowerCase()) || c.token.includes(colQuery.toLowerCase()))
                    .map((c) => (
                      <div
                        key={c.token}
                        draggable
                        onDragStart={(e) => { dndPayload.current = { type: "db", token: c.token, label: c.label }; e.dataTransfer.effectAllowed = "copy"; }}
                        onDragEnd={() => { dndPayload.current = null; setDropHint(false); }}
                        className="flex items-center gap-2 p-2.5 rounded-lg border border-gray-200 cursor-grab active:cursor-grabbing hover:border-cyan-300 hover:bg-gray-50 transition-all"
                      >
                        <MdOutlineDragIndicator className="text-gray-300 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{c.label}</p>
                          {/* the "name with blank" look */}
                          <p className="text-[10px] text-gray-400 truncate">
                            <span className="font-mono">{`{{${c.token}}}`}</span> · <span className="italic">{t("builder.blank")}</span>
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Field configuration */}
              <div className="bg-white border border-gray-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <MdOutlineTune className="text-cyan-600" />
                  <h3 className="text-sm font-bold text-gray-900">{t("builder.fieldSettings")}</h3>
                </div>

                {!selected ? (
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    {t("builder.selectFieldHint")}
                  </p>
                ) : (
                  <FieldConfig
                    field={selected}
                    onPatch={(p) => patch(selected.id, p)}
                    onRemove={() => remove(selected.id)}
                    onTestSignature={() => setSignOpen(true)}
                  />
                )}
              </div>
            </aside>
          </div>
        </>
      )}

      {/* digital signature capture popup (demo of the recipient's first-time sign) */}
      {signOpen && (
        <SignaturePadModal
          onClose={() => setSignOpen(false)}
          onSave={() => {
            setSignOpen(false);
            toast.success(t("builder.toast.signatureCaptured"));
          }}
        />
      )}
    </div>
  );
}

// ── configuration form per field type ──
function FieldConfig({ field, onPatch, onRemove, onTestSignature }) {
  const { t } = useTranslation("contractStudio");
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-cyan-700 bg-cyan-50 px-2 py-1 rounded uppercase tracking-wider">
          {t(`builder.config.typeBadge.${field.type}`, { defaultValue: field.type === "db" ? "Column" : field.type })}
        </span>
        <button onClick={onRemove} className="text-gray-300 hover:text-rose-500" title={t("builder.config.removeField")}>
          <MdOutlineDelete className="text-base" />
        </button>
      </div>

      {/* INPUT: name of the input + label */}
      {field.type === "input" && (
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">{t("builder.config.labelShownOnDoc")}</label>
            <input
              value={field.label || ""}
              onChange={(e) => onPatch({ label: e.target.value })}
              className="w-full text-xs px-2.5 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder={t("builder.config.labelPlaceholder")}
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">{t("builder.config.inputName")}</label>
            <input
              value={field.fieldKey || ""}
              onChange={(e) => onPatch({ fieldKey: e.target.value })}
              className="w-full text-xs px-2.5 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder={t("builder.config.inputNamePlaceholder")}
            />
            <p className="text-[10px] text-gray-400 mt-1">{t("builder.config.inputHint")}</p>
          </div>
        </div>
      )}

      {/* CHECKBOX: value associated with it */}
      {field.type === "checkbox" && (
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">{t("builder.config.label")}</label>
            <input
              value={field.label || ""}
              onChange={(e) => onPatch({ label: e.target.value })}
              className="w-full text-xs px-2.5 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder={t("builder.config.checkboxLabelPlaceholder")}
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">{t("builder.config.valueWhenChecked")}</label>
            <input
              value={field.checkedValue || ""}
              onChange={(e) => onPatch({ checkedValue: e.target.value })}
              className="w-full text-xs px-2.5 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder={t("builder.config.valuePlaceholder")}
            />
            <p className="text-[10px] text-gray-400 mt-1">{t("builder.config.checkboxHint")}</p>
          </div>
        </div>
      )}

      {/* SIGNATURE */}
      {field.type === "signature" && (
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">{t("builder.config.label")}</label>
            <input
              value={field.label || ""}
              onChange={(e) => onPatch({ label: e.target.value })}
              className="w-full text-xs px-2.5 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder={t("builder.config.signatureLabelPlaceholder")}
            />
          </div>
          <div className="text-[11px] text-gray-500 bg-blue-50 border border-blue-100 rounded-lg p-2.5 leading-relaxed">
            {t("builder.config.signatureInfo")}
          </div>
          <button
            onClick={onTestSignature}
            className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-cyan-700 border border-cyan-300 rounded-lg py-2 hover:bg-cyan-50 transition-colors"
          >
            <MdOutlineDraw /> {t("builder.config.previewSignature")}
          </button>
        </div>
      )}

      {/* DB column */}
      {field.type === "db" && (
        <div className="space-y-3">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">{t("builder.config.boundColumn")}</p>
            <p className="font-mono text-xs text-cyan-700 bg-cyan-50 rounded px-2 py-1.5">{`{{${field.token}}}`}</p>
            <p className="text-[10px] text-gray-400 mt-1">{t("builder.config.boundColumnHint")}</p>
          </div>
        </div>
      )}

      {/* required toggle (all types) */}
      <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer mt-4 pt-3 border-t border-gray-100">
        <input type="checkbox" checked={!!field.required} onChange={(e) => onPatch({ required: e.target.checked })} className="accent-cyan-600" />
        {t("builder.config.requiredField")}
      </label>
    </div>
  );
}

// ── a placed field rendered on the document ──
function PlacedField({ f, selected, onSelect, onDragStart, onRemove }) {
  const { t } = useTranslation("contractStudio");
  const Icon = ELEM_ICON[f.type];
  const isDb = f.type === "db";

  let body;
  if (isDb) {
    body = <span className="whitespace-nowrap">{f.label}: <span className="opacity-60">______</span></span>;
  } else if (f.type === "checkbox") {
    body = (
      <span className="flex items-center gap-1 whitespace-nowrap">
        <span className="w-3 h-3 border border-current rounded-[3px] inline-block" />
        {f.label}
      </span>
    );
  } else if (f.type === "signature") {
    body = <span className="whitespace-nowrap italic">✎ {f.label}</span>;
  } else {
    body = <span className="whitespace-nowrap">{f.label || t("builder.inputFallback")}: <span className="opacity-60">______</span></span>;
  }

  const style = isDb
    ? "bg-cyan-100 text-cyan-700 border-cyan-300"
    : f.type === "signature"
    ? "bg-violet-50 text-violet-700 border-violet-300 border-dashed"
    : "bg-white text-gray-700 border-gray-400 border-dashed";

  return (
    <div
      onMouseDown={onDragStart}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      style={{ left: `${f.x}%`, top: `${f.y}%` }}
      className={`absolute -translate-y-1/2 group flex items-center gap-1.5 px-2 py-1.5 rounded-md border-2 text-[11px] font-semibold cursor-grab active:cursor-grabbing shadow-sm ${style} ${
        selected ? "ring-2 ring-offset-1 ring-gray-900/40 z-20" : "z-10"
      }`}
    >
      <MdOutlineDragIndicator className="opacity-50 -ml-0.5 flex-shrink-0" />
      <Icon className="text-sm flex-shrink-0" />
      {body}
      {f.required && <span className="text-rose-500">*</span>}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="opacity-0 group-hover:opacity-100 hover:text-rose-600 transition-opacity"
      >
        <MdClose className="text-sm" />
      </button>
    </div>
  );
}

// ── plain document (no prefilled data; you attach fields to the blanks) ──
function MockDoc({ audience }) {
  const isEmp = audience === "employee";
  const title = isEmp ? "EMPLOYMENT AGREEMENT" : "MASTER SERVICE AGREEMENT";
  const party = isEmp ? "the Employee" : "the Service Provider";
  const blank = "________________________";
  return (
    <div className="p-8 sm:p-10 text-gray-800 pointer-events-none">
      <div className="w-16 h-6 bg-gray-200 rounded mb-8" />
      <h2 className="text-lg font-bold tracking-tight mb-4">{title}</h2>
      <p className="text-[11px] leading-relaxed text-gray-600 mb-3">
        This Agreement is made and entered into by and between{" "}
        <span className="font-semibold text-cyan-700">LegalFlow Enterprise Solutions</span> (the "Company") and {party}.
      </p>
      <p className="text-[11px] leading-relaxed text-gray-600 mb-1">Name: <span className="text-gray-400">{blank}</span></p>
      <p className="text-[11px] leading-relaxed text-gray-600 mb-1">Email: <span className="text-gray-400">{blank}</span></p>
      <p className="text-[11px] leading-relaxed text-gray-600 mb-4">Phone: <span className="text-gray-400">{blank}</span></p>
      <h3 className="text-xs font-bold mb-2">1. TERM</h3>
      <p className="text-[11px] leading-relaxed text-gray-600 mb-4">
        The engagement shall commence on the effective date and continue until terminated by either party as provided in Section 8.
      </p>
      <h3 className="text-xs font-bold mb-2">2. TERMS &amp; CONDITIONS</h3>
      <p className="text-[11px] leading-relaxed text-gray-600 mb-2">
        {party} agrees to the terms set out in this Agreement and the attached schedules.
      </p>
      <p className="text-[11px] leading-relaxed text-gray-600 mb-8">Accept terms: <span className="text-gray-400">☐</span></p>
      <div className="grid grid-cols-2 gap-6 mt-8 pt-6 border-t border-gray-200">
        <div>
          <div className="h-8 border-b border-gray-300 mb-1" />
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Recipient Signature</p>
        </div>
        <div>
          <div className="h-8 border-b border-gray-300 mb-1" />
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">Company Representative</p>
        </div>
      </div>
    </div>
  );
}
