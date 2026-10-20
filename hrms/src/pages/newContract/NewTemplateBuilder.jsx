import { useEffect, useRef, useState } from "react";
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
  MdOutlineCalendarToday,
  MdOutlineShortText,
} from "react-icons/md";
import {
  listContractDocuments,
  listContractTypes,
  listMergeFields,
  getContractTemplate,
  createContractTemplate,
  updateContractTemplate,
  contractDocumentFile,
} from "../../api/contracts";
import useApiQuery from "../../hooks/useApiQuery";
import { toastApiError } from "../../utils/apiError";
import { serverErrors } from "../../utils/applyFieldErrors";
import { ScreenError, ScreenLoader } from "../../components/ScreenState";
import SignaturePadModal from "./SignaturePadModal";
import PdfCanvas from "./PdfCanvas";

// Template builder (plan decisions 9–16): a saved PDF + placed fields + a contract type.
// Positions are page-relative boxes (x, y, width, height as decimals, origin top-left);
// on screen a field's x is its left edge and y its vertical centre, in percent.

// Two record types for now; the third is shown as "Coming soon" (decision 2).
const BUILDER_AUDIENCES = [
  { id: "employee", api: "EMPLOYEE", labelKey: "audiences.employee", icon: MdOutlinePerson },
  { id: "staffing", api: "STAFFING_COMPANY", labelKey: "audiences.staffing", icon: MdOutlineBusiness },
  { id: "collaborator", api: null, labelKey: "audiences.collaborator", icon: MdOutlineBusiness, comingSoon: true },
];
const AUDIENCE_BY_API = { EMPLOYEE: "employee", STAFFING_COMPANY: "staffing" };

// LEFT-side drag tools (Date and Initials are real field types, decision 45).
const ELEMENTS = [
  { id: "input", labelKey: "builder.elements.input.label", icon: MdOutlineTextFields, hintKey: "builder.elements.input.hint" },
  { id: "checkbox", labelKey: "builder.elements.checkbox.label", icon: MdOutlineCheckBox, hintKey: "builder.elements.checkbox.hint" },
  { id: "date", labelKey: "builder.elements.date.label", icon: MdOutlineCalendarToday, hintKey: "builder.elements.date.hint" },
  { id: "initials", labelKey: "builder.elements.initials.label", icon: MdOutlineShortText, hintKey: "builder.elements.initials.hint" },
  { id: "signature", labelKey: "builder.elements.signature.label", icon: MdOutlineDraw, hintKey: "builder.elements.signature.hint" },
];

const ELEM_ICON = {
  input: MdOutlineTextFields,
  checkbox: MdOutlineCheckBox,
  date: MdOutlineCalendarToday,
  initials: MdOutlineShortText,
  signature: MdOutlineDraw,
  db: MdOutlineDataObject,
};

// UI type ⇄ API field_type, and each type's default box (fractions of the page).
const API_TYPE = { input: "INPUT", checkbox: "CHECKBOX", date: "DATE", initials: "INITIALS", signature: "SIGNATURE", db: "DB_COLUMN" };
const UI_TYPE = Object.fromEntries(Object.entries(API_TYPE).map(([k, v]) => [v, k]));
const BOX = {
  input: { w: 0.3, h: 0.03 },
  db: { w: 0.3, h: 0.03 },
  checkbox: { w: 0.03, h: 0.02 },
  date: { w: 0.2, h: 0.03 },
  initials: { w: 0.1, h: 0.04 },
  signature: { w: 0.3, h: 0.06 },
};
const DEFAULT_LABEL = { input: "Input", checkbox: "Checkbox", date: "Date", initials: "Initials", signature: "Signature" };

// Keep the whole box on the page: x ∈ [0, 100 − w], y (centre) ∈ [h/2, 100 − h/2], in percent.
const clampX = (x, w) => Math.min(100 - w * 100, Math.max(0, x));
const clampY = (y, h) => Math.min(100 - h * 50, Math.max(h * 50, y));
const floor3 = (v) => Math.floor(v * 1000) / 1000;

let seq = 1;
const newId = () => `fld_${seq++}_${Math.floor(Math.random() * 1e4)}`;

// API template field → builder field.
const fromApi = (f) => {
  const type = UI_TYPE[f.field_type] || "input";
  const w = f.width ?? BOX[type].w;
  const h = f.height ?? BOX[type].h;
  return {
    id: f.id || newId(),
    page: f.page_no,
    type,
    x: f.pos_x * 100,
    y: (f.pos_y + h / 2) * 100,
    w,
    h,
    required: f.is_required,
    label: f.label || "",
    token: f.db_column || undefined,
    source: f.db_source || undefined,
    fieldKey: f.field_key || "",
    checkedValue: f.checked_value || "",
  };
};

// Builder field → API template field.
const toApi = (f) => ({
  field_type: API_TYPE[f.type],
  page_no: f.page,
  pos_x: floor3(Math.min(f.x / 100, 1 - f.w)),
  pos_y: floor3(Math.max(0, Math.min(f.y / 100 - f.h / 2, 1 - f.h))),
  width: f.w,
  height: f.h,
  label: f.label || "",
  is_required: !!f.required,
  ...(f.type === "db" ? { db_source: f.source, db_column: f.token } : {}),
  ...(f.type === "input" ? { field_key: f.fieldKey || "" } : {}),
  ...(f.type === "checkbox" ? { checked_value: f.checkedValue || "" } : {}),
});

const MB = 1024 * 1024;

// Loads the documents, types and (when editing) the template, then renders the builder
// with its starting state.
export default function NewTemplateBuilder() {
  const [params] = useSearchParams();
  const editingId = params.get("id");
  const presetDocId = params.get("doc");

  const docsQuery = useApiQuery(() => listContractDocuments({ limit: 100, status: "SAVED" }), []);
  const typesQuery = useApiQuery(() => listContractTypes({ limit: 100, status: "ACTIVE" }), []);
  const templateQuery = useApiQuery(() => (editingId ? getContractTemplate(editingId) : Promise.resolve(null)), [editingId]);

  const loadError = docsQuery.error || typesQuery.error || templateQuery.error;
  if (loadError) {
    return (
      <ScreenError
        error={loadError}
        onRetry={() => {
          docsQuery.reload();
          typesQuery.reload();
          templateQuery.reload();
        }}
      />
    );
  }
  if (!docsQuery.data || !typesQuery.data || (editingId && !templateQuery.data)) return <ScreenLoader />;

  const documents = docsQuery.data.items;
  let initial = { name: "", docId: null, docName: null, pages: 3, contractTypeId: "", audience: "employee", fields: [] };
  if (editingId) {
    const tpl = templateQuery.data;
    initial = {
      name: tpl.name,
      docId: tpl.document?.id || null,
      docName: tpl.document?.name || null,
      pages: tpl.document?.page_count || tpl.page_count || 1,
      contractTypeId: tpl.contract_type?.id || "",
      audience: AUDIENCE_BY_API[tpl.audience_type] || "employee",
      fields: (tpl.fields || []).map(fromApi),
    };
  } else if (presetDocId) {
    const doc = documents.find((d) => d.id === presetDocId);
    if (doc) initial = { ...initial, docId: doc.id, docName: doc.name, pages: doc.page_count || 1, name: `${doc.name} Template` };
  }
  return <TemplateBuilder key={editingId || presetDocId || "new"} editingId={editingId} initial={initial} documents={documents} types={typesQuery.data.items} />;
}

// The private PDF is fetched with the session and shown through a blob URL.
function DocPreview({ docId, page, onLoaded }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let alive = true;
    let objectUrl = null;
    contractDocumentFile(docId)
      .then((blob) => {
        if (!alive) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((err) => alive && toastApiError(err));
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [docId]);
  if (!url) return null;
  return <PdfCanvas src={url} page={page} onLoaded={onLoaded} className="absolute inset-0 w-full h-full pointer-events-none" />;
}

function TemplateBuilder({ editingId, initial, documents, types }) {
  const { t } = useTranslation("contractStudio");
  const navigate = useNavigate();

  const [name, setName] = useState(initial.name);
  const [docId, setDocId] = useState(initial.docId);
  const [docName, setDocName] = useState(initial.docName);
  const [contractTypeId, setContractTypeId] = useState(initial.contractTypeId);
  const [audience, setAudience] = useState(initial.audience);
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [pages, setPages] = useState(initial.pages);
  const [fields, setFields] = useState(initial.fields);
  const [activePage, setActivePage] = useState(1);
  const [pageAspect, setPageAspect] = useState(1 / 1.3); // real ratio once the PDF loads
  const [saving, setSaving] = useState(false);

  const [colQuery, setColQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [dropHint, setDropHint] = useState(false);
  const [signOpen, setSignOpen] = useState(false);

  const canvasRef = useRef(null);
  const dragRef = useRef(null);
  const dndPayload = useRef(null);

  const audMeta = BUILDER_AUDIENCES.find((a) => a.id === audience);
  const audLabel = audMeta ? t(audMeta.labelKey) : undefined;
  const catalogue = useApiQuery(() => (audMeta?.api ? listMergeFields(audMeta.api) : Promise.resolve([])), [audMeta?.api]);
  // The audience's own group, then the Contract group (decision 11).
  const columns = (catalogue.data || []).flatMap((g) => g.fields.map((f) => ({ ...f, source: g.source, group: g.group })));
  const pageFields = fields.filter((f) => f.page === activePage);
  const selected = fields.find((f) => f.id === selectedId);

  // ── pick a source document (stage A) ──
  const chooseDoc = (d) => {
    setDocId(d.id);
    setDocName(d.name);
    setPages(d.page_count || 1);
    setActivePage(1);
    if (!name) setName(`${d.name} Template`);
  };

  // ── build a field object from a drag payload ──
  const makeField = (payload, x, y) => {
    const box = BOX[payload.type];
    const base = {
      id: newId(),
      page: activePage,
      type: payload.type,
      x: clampX(x, box.w),
      y: clampY(y, box.h),
      w: box.w,
      h: box.h,
      required: true,
    };
    if (payload.type === "db") {
      // A record column dropped onto a blank (e.g. Full Name, Email).
      base.token = payload.token;
      base.source = payload.source;
      base.label = payload.label;
    } else {
      base.label = DEFAULT_LABEL[payload.type];
      if (payload.type === "input") base.fieldKey = ""; // the "name of that input" — configured on the right
      if (payload.type === "checkbox") base.checkedValue = "Yes"; // "value associated with that checkbox"
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
      setFields((prev) => prev.map((p) => (p.id === dragRef.current ? { ...p, x: clampX(x, p.w), y: clampY(y, p.h) } : p)));
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

  // ── save (decision 12): the same rules as the API, which checks them again ──
  const handleSave = async () => {
    if (saving) return;
    if (!name.trim()) return toast.error(t("builder.toast.nameRequired"));
    if (!docId) return toast.error(t("builder.toast.docRequired"));
    if (fields.length === 0) return toast.error(t("builder.toast.fieldRequired"));
    if (!fields.some((f) => f.type === "signature" && f.required)) return toast.error(t("builder.toast.signatureRequired"));
    if (!contractTypeId) return toast.error(t("builder.toast.typeRequired"));
    const body = {
      name: name.trim(),
      audienceType: audMeta?.api,
      documentId: docId,
      contractTypeId,
      fields: fields.map(toApi),
    };
    setSaving(true);
    try {
      if (editingId) await updateContractTemplate(editingId, body);
      else await createContractTemplate(body);
      toast.success(editingId ? t("builder.toast.updated") : t("builder.toast.saved"));
      navigate("/admin/new-contracts/templates");
    } catch (err) {
      const messages = [...new Set(serverErrors(err).map((e) => e.message))];
      if (messages.length) messages.forEach((m) => toast.error(m));
      else toastApiError(err);
    } finally {
      setSaving(false);
    }
  };

  const changeAudience = (a) => {
    if (a.comingSoon) return;
    setAudience(a.id);
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
            <span className="text-cyan-600 font-semibold">{editingId ? t("builder.breadcrumb.editTemplate") : t("builder.breadcrumb.configureDocument")}</span>
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
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-[#20B2AA] to-cyan-500 hover:from-[#1C9D96] hover:to-cyan-600 rounded-lg shadow-sm shadow-cyan-200 transition-all disabled:opacity-60"
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
                    <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-rose-100 text-rose-600">pdf</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 truncate">{d.name}</p>
                  <p className="text-[11px] text-gray-400">
                    {t("builder.selectDoc.meta", { pages: d.page_count, size: ((d.file_size_bytes || 0) / MB).toFixed(1) })}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ── STAGE B: the configurator ── */
        <>
          {/* template name + contract type + source doc */}
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
            <div className="sm:w-56">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                {t("builder.contractType")} <span className="text-red-500">*</span>
              </label>
              <select
                value={contractTypeId}
                onChange={(e) => setContractTypeId(e.target.value)}
                data-testid="contract-type-select"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#20B2AA] focus:bg-white transition-colors"
              >
                <option value="">{t("builder.contractTypePlaceholder")}</option>
                {types.map((ty) => (
                  <option key={ty.id} value={ty.id}>
                    {ty.name} ({ty.code})
                  </option>
                ))}
              </select>
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
                      data-testid={`element-${el.id}`}
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
                data-testid="builder-canvas"
                onClick={onCanvasClick}
                onDragOver={(e) => { e.preventDefault(); if (!dropHint) setDropHint(true); }}
                onDragLeave={(e) => { if (e.target === canvasRef.current) setDropHint(false); }}
                onDrop={onCanvasDrop}
                style={{ aspectRatio: pageAspect }}
                className={`relative mx-auto bg-white shadow-lg rounded-sm w-full max-w-[640px] overflow-hidden select-none transition-shadow cursor-default ${
                  dropHint ? "ring-2 ring-cyan-400 ring-offset-2" : ""
                }`}
              >
                {/* The real uploaded document rendered by PDF.js */}
                <DocPreview
                  key={docId}
                  docId={docId}
                  page={activePage}
                  onLoaded={(numPages, aspect) => {
                    if (numPages) setPages(numPages);
                    if (aspect) setPageAspect(aspect);
                  }}
                />

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
                            onClick={() => changeAudience(a)}
                            disabled={a.comingSoon}
                            className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left ${
                              a.comingSoon ? "text-gray-300 cursor-not-allowed" : audience === a.id ? "text-cyan-600 bg-cyan-50/50 hover:bg-gray-50" : "text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            <Icon className="text-lg" /> {t(a.labelKey)}
                            {a.comingSoon && (
                              <span className="ms-auto px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-[9px] font-bold uppercase tracking-wider">
                                {t("audiences.comingSoon")}
                              </span>
                            )}
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
                        key={`${c.source}.${c.token}`}
                        draggable
                        data-testid={`column-${c.token}`}
                        onDragStart={(e) => { dndPayload.current = { type: "db", token: c.token, source: c.source, label: c.label }; e.dataTransfer.effectAllowed = "copy"; }}
                        onDragEnd={() => { dndPayload.current = null; setDropHint(false); }}
                        className="flex items-center gap-2 p-2.5 rounded-lg border border-gray-200 cursor-grab active:cursor-grabbing hover:border-cyan-300 hover:bg-gray-50 transition-all"
                      >
                        <MdOutlineDragIndicator className="text-gray-300 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{c.label}</p>
                          {/* the "name with blank" look */}
                          <p className="text-[10px] text-gray-400 truncate">
                            <span className="font-mono">{`{{${c.token}}}`}</span> · <span className="italic">{c.group}</span>
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

      {/* signature capture preview (nothing is stored; signatures live on contracts only) */}
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

      {/* DATE / INITIALS: a label only */}
      {(field.type === "date" || field.type === "initials") && (
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">{t("builder.config.label")}</label>
            <input
              value={field.label || ""}
              onChange={(e) => onPatch({ label: e.target.value })}
              className="w-full text-xs px-2.5 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
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
  } else if (f.type === "signature" || f.type === "initials") {
    body = <span className="whitespace-nowrap italic">✎ {f.label}</span>;
  } else {
    body = <span className="whitespace-nowrap">{f.label || t("builder.inputFallback")}: <span className="opacity-60">______</span></span>;
  }

  const style = isDb
    ? "bg-cyan-100 text-cyan-700 border-cyan-300"
    : f.type === "signature" || f.type === "initials"
    ? "bg-violet-50 text-violet-700 border-violet-300 border-dashed"
    : "bg-white text-gray-700 border-gray-400 border-dashed";

  return (
    <div
      onMouseDown={onDragStart}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      data-testid="placed-field"
      data-type={f.type}
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
