import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import {
  MdClose,
  MdOutlineCheckBox,
  MdOutlineCheckBoxOutlineBlank,
  MdOutlineDraw,
  MdOutlineDescription,
  MdCheckCircle,
  MdOutlinePerson,
  MdOutlineFileDownload,
  MdOutlineVerified,
  MdKeyboardArrowDown,
} from "react-icons/md";
import { ncContractDetail } from "../../data/groupF";
import { ncStore } from "./newContractStore";
import { NC_STATUS_STYLES } from "./newContractData";
import SignaturePadModal from "./SignaturePadModal";
import PdfCanvas from "./PdfCanvas";

// seed the field values a recipient already filled in
const seedValues = (d) => {
  const seed = {};
  (d?.fields || []).forEach((f) => {
    if (f.value != null && f.value !== "") {
      if (f.field_type === "CHECKBOX") seed[f.id] = true;
      else if (f.field_type === "SIGNATURE") seed[f.id] = { dataUrl: String(f.value).startsWith("data:") ? f.value : null, text: String(f.value).startsWith("data:") ? null : f.value };
      else seed[f.id] = f.value;
    }
  });
  return seed;
};

const RECIP_STATUS = {
  PENDING: { chip: "bg-gray-100 text-gray-500", dot: "bg-gray-400" },
  SENT: { chip: "bg-indigo-50 text-indigo-600", dot: "bg-indigo-500" },
  VIEWED: { chip: "bg-sky-50 text-sky-600", dot: "bg-sky-500" },
  SIGNED: { chip: "bg-emerald-50 text-emerald-600", dot: "bg-emerald-500" },
  SUBMITTED: { chip: "bg-emerald-50 text-emerald-600", dot: "bg-emerald-500" },
  DECLINED: { chip: "bg-rose-50 text-rose-600", dot: "bg-rose-500" },
};

export default function ContractViewer({ contract, canSign = false, canApprove = false, onClose, onSigned, onApproved }) {
  const { t } = useTranslation("contractStudio");
  // the admin view defaults to the first recipient's version
  const [selectedRecipientId, setSelectedRecipientId] = useState(() =>
    canSign ? null : ncContractDetail(contract).recipients[0]?.id ?? null
  );
  // contract detail personalized for the chosen recipient (admin) or the
  // recipient themself (portal)
  const detail = useMemo(() => ncContractDetail(contract, selectedRecipientId), [contract, selectedRecipientId]);
  const loading = false;
  const [activePage, setActivePage] = useState(1);
  const [signFor, setSignFor] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [approving, setApproving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [values, setValues] = useState(() => seedValues(detail));
  const [valuesFor, setValuesFor] = useState(detail);
  if (valuesFor !== detail) {
    // switched recipient: show that recipient's own values
    setValuesFor(detail);
    setValues(seedValues(detail));
  }
  const [pages, setPages] = useState(detail.page_count || contract.pages || 1);
  const [pageAspect, setPageAspect] = useState(1 / 1.3);
  const [capturedSig, setCapturedSig] = useState(null); // sign once → reuse
  const [recipPickerOpen, setRecipPickerOpen] = useState(false);

  const fields = detail?.fields || [];
  const recipients = detail?.recipients || [];
  const docUrl = detail?.document?.file_url || contract.fileUrl || null;
  const isPdf = docUrl && (detail?.document?.file_type || "PDF") === "PDF";
  const st = NC_STATUS_STYLES[contract.status] || NC_STATUS_STYLES.Draft;
  const alreadyDone = ["Signed", "Submitted", "Completed", "Approved"].includes(contract.status);

  // the recipient whose version we're viewing / signing as
  const currentRecipient = useMemo(() => {
    const rs = detail?.recipients || [];
    return rs.find((r) => String(r.id) === String(selectedRecipientId || contract.myRecipientId)) || rs[0] || null;
  }, [detail, selectedRecipientId, contract.myRecipientId]);

  const pageFields = useMemo(
    () => (detail?.fields || []).filter((f) => (f.page_no || 1) === activePage),
    [detail, activePage]
  );
  const pendingSignatures = fields.filter((f) => f.field_type === "SIGNATURE" && !values[f.id]);
  const missingRequired = fields.filter(
    (f) =>
      f.is_required &&
      ((f.field_type === "SIGNATURE" && !values[f.id]) ||
        (f.field_type === "CHECKBOX" && !values[f.id]) ||
        (f.field_type === "INPUT" && !String(values[f.id] || "").trim()))
  );
  const canSubmit = canSign && !alreadyDone && missingRequired.length === 0;

  const setVal = (id, v) => setValues((prev) => ({ ...prev, [id]: v }));

  // click a signature field: first time opens the pad; after that (or if a base
  // signature exists) it just copies the captured signature — no re-signing.
  const handleSignClick = (fieldId) => {
    if (capturedSig) setVal(fieldId, capturedSig);
    else setSignFor(fieldId);
  };

  const onSignatureSaved = (result) => {
    setCapturedSig(result);
    if (signFor != null) setVal(signFor, result);
    setSignFor(null);
  };

  const doSubmit = async () => {
    if (!canSubmit) {
      toast.error(t("viewer.toast.requiredMissing", { count: missingRequired.length }));
      return;
    }
    setSubmitting(true);
    try {
      ncStore.updateContractStatus(contract.id, "Signed");
      toast.success(t("viewer.toast.signedSubmitted"));
      onSigned?.();
      onClose?.();
    } finally {
      setSubmitting(false);
    }
  };

  const doApprove = async () => {
    setApproving(true);
    try {
      ncStore.updateContractStatus(contract.id, "Completed");
      toast.success(t("viewer.toast.approved"));
      onApproved?.();
      onClose?.();
    } finally {
      setApproving(false);
    }
  };

  const doDownload = async () => {
    setDownloading(true);
    try {
      // static build: no signed-PDF generation
      toast.success(t("actions.download"));
    } finally {
      setDownloading(false);
    }
  };

  const goToNextSignature = () => {
    const next = pendingSignatures[0];
    if (next) setActivePage(next.page_no || 1);
  };

  const canDownload = isPdf && docUrl;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-6">
      <div className="w-full max-w-5xl h-[92vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center">
              <MdOutlineDescription className="text-lg" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-gray-900 truncate">{contract.name}</h3>
              <p className="text-[11px] text-gray-400">{t("viewer.idModule", { id: contract.id, module: t(`modules.${contract.module || "Company"}`, { defaultValue: contract.module || "Company" }) })}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {canDownload && (
              <button
                onClick={doDownload}
                disabled={downloading}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-60"
              >
                <MdOutlineFileDownload className="text-base" /> {downloading ? t("actions.preparing") : t("actions.download")}
              </button>
            )}
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${st.chip}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
              {t(`status.${contract.status}`, { defaultValue: contract.status })}
            </span>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
              <MdClose className="text-xl" />
            </button>
          </div>
        </div>

        {/* admin recipient selector */}
        {!canSign && recipients.length > 1 && (
          <div className="px-5 py-2.5 border-b border-gray-100 bg-gray-50/60 flex items-center gap-2">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{t("viewer.viewingAs")}</span>
            <div className="relative">
              <button
                onClick={() => setRecipPickerOpen((v) => !v)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 hover:bg-gray-50"
              >
                {currentRecipient?.recipient_name || t("viewer.recipientFallback")}
                <MdKeyboardArrowDown className={`text-gray-400 transition-transform ${recipPickerOpen ? "rotate-180" : ""}`} />
              </button>
              {recipPickerOpen && (
                <div className="absolute z-20 mt-1 w-64 max-h-60 overflow-auto bg-white border border-gray-200 rounded-lg shadow-lg">
                  {recipients.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => {
                        setSelectedRecipientId(r.id);
                        setRecipPickerOpen(false);
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 ${
                        String(r.id) === String(currentRecipient?.id) ? "text-cyan-600 bg-cyan-50/50" : "text-gray-700"
                      }`}
                    >
                      <span className="truncate">{r.recipient_name || t("viewer.recipientFallback")}</span>
                      <span className="text-[10px] text-gray-400">{t(`recipientStatus.${r.status}`, { defaultValue: r.status })}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <span className="text-[11px] text-gray-400">{t("viewer.ownDataHint")}</span>
          </div>
        )}

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_280px] min-h-0">
          {/* document */}
          <div className="bg-gray-100 p-4 sm:p-6 overflow-auto">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 flex-wrap">
                {Array.from({ length: pages }).map((_, i) => {
                  const p = i + 1;
                  const sigOnPage = fields.some((f) => f.field_type === "SIGNATURE" && (f.page_no || 1) === p && !values[f.id]);
                  return (
                    <button
                      key={p}
                      onClick={() => setActivePage(p)}
                      className={`relative px-2.5 py-1 rounded-md text-xs font-semibold ${
                        activePage === p ? "bg-cyan-600 text-white" : "bg-white text-gray-500 border border-gray-200"
                      }`}
                    >
                      {t("viewer.page", { page: p })}
                      {sigOnPage && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500" />}
                    </button>
                  );
                })}
              </div>
              <span className="text-xs text-gray-400">{t("viewer.fieldsCount", { count: pageFields.length })}</span>
            </div>

            <div
              style={{ aspectRatio: pageAspect }}
              className="relative mx-auto bg-white shadow-lg rounded-sm w-full max-w-[620px] overflow-hidden"
            >
              {loading ? (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400">{t("common.loading")}</div>
              ) : isPdf && docUrl ? (
                <PdfCanvas
                  src={docUrl}
                  page={activePage}
                  onLoaded={(numPages, aspect) => {
                    if (numPages) setPages(numPages);
                    if (aspect) setPageAspect(aspect);
                  }}
                  className="absolute inset-0 w-full h-full pointer-events-none"
                />
              ) : (
                <PlaceholderDoc name={contract.name} />
              )}

              {!loading &&
                pageFields.map((f) => (
                  <FieldWidget
                    key={f.id}
                    f={f}
                    value={values[f.id]}
                    canSign={canSign && !alreadyDone}
                    onInput={(v) => setVal(f.id, v)}
                    onToggle={() => setVal(f.id, !values[f.id])}
                    onSign={() => handleSignClick(f.id)}
                  />
                ))}
            </div>
          </div>

          {/* side panel */}
          <aside className="border-t lg:border-t-0 lg:border-l border-gray-100 flex flex-col min-h-0">
            <div className="p-4 border-b border-gray-100">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">{t("viewer.sent")}</p>
              <p className="text-sm text-gray-700">{contract.sentDate || "—"}</p>
            </div>

            <div className="p-4 flex-1 overflow-auto">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">{t("viewer.recipients")}</p>
              {recipients.length === 0 ? (
                <p className="text-xs text-gray-400">{contract.serverId ? t("viewer.noRecipients") : t("viewer.previewOffline")}</p>
              ) : (
                <div className="space-y-2.5">
                  {recipients.map((r) => {
                    const rs = RECIP_STATUS[r.status] || RECIP_STATUS.PENDING;
                    return (
                      <div key={r.id} className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center">
                          <MdOutlinePerson className="text-base" />
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{r.recipient_name || t("viewer.recipientFallback")}</p>
                          <p className="text-[11px] text-gray-400 truncate">{r.recipient_email || (r.role && t(`roles.api.${r.role}`, { defaultValue: r.role }))}</p>
                        </div>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${rs.chip}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${rs.dot}`} />
                          {t(`recipientStatus.${r.status}`, { defaultValue: r.status })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* actions */}
            <div className="p-4 border-t border-gray-100 space-y-2">
              {canDownload && (
                <button
                  onClick={doDownload}
                  disabled={downloading}
                  className="sm:hidden w-full flex items-center justify-center gap-2 text-sm font-semibold text-gray-700 border border-gray-200 rounded-lg py-2.5 hover:bg-gray-50 disabled:opacity-60"
                >
                  <MdOutlineFileDownload /> {downloading ? t("actions.preparing") : t("actions.download")}
                </button>
              )}

              {canSign && !alreadyDone ? (
                <>
                  {pendingSignatures.length > 0 && (
                    <button
                      onClick={goToNextSignature}
                      className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-cyan-700 border border-cyan-300 rounded-lg py-2 hover:bg-cyan-50"
                    >
                      <MdOutlineDraw /> {t("viewer.signaturesLeft", { count: pendingSignatures.length })}
                    </button>
                  )}
                  <button
                    onClick={doSubmit}
                    disabled={submitting || !canSubmit}
                    className="w-full flex items-center justify-center gap-2 bg-[#20B2AA] hover:bg-[#1C9D96] disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-lg text-sm font-bold transition-colors"
                  >
                    {submitting ? t("viewer.submitting") : t("viewer.submit")}
                  </button>
                  {!canSubmit && missingRequired.length > 0 && (
                    <p className="text-[11px] text-gray-400 text-center">
                      {t("viewer.requiredLeft", { count: missingRequired.length })}
                    </p>
                  )}
                </>
              ) : canApprove && ["Signed", "Submitted"].includes(contract.status) ? (
                <button
                  onClick={doApprove}
                  disabled={approving}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white py-2.5 rounded-lg text-sm font-bold transition-colors"
                >
                  <MdOutlineVerified /> {approving ? t("viewer.approving") : t("viewer.approve")}
                </button>
              ) : alreadyDone ? (
                <div className="flex items-center justify-center gap-2 text-sm font-semibold text-emerald-600 py-2">
                  <MdCheckCircle /> {contract.status === "Completed" ? t("viewer.approved") : t("viewer.submitted")}
                </div>
              ) : (
                <button
                  onClick={onClose}
                  className="w-full text-sm font-semibold text-gray-600 hover:text-gray-900 py-2.5 border border-gray-200 rounded-lg"
                >
                  {t("actions.close")}
                </button>
              )}
            </div>
          </aside>
        </div>
      </div>

      {signFor != null && (
        <SignaturePadModal onClose={() => setSignFor(null)} onSave={onSignatureSaved} />
      )}
    </div>
  );
}

// ── a single interactive field on the document ──
function FieldWidget({ f, value, canSign, onInput, onToggle, onSign }) {
  const { t } = useTranslation("contractStudio");
  const style = { left: `${f.pos_x}%`, top: `${f.pos_y}%` };

  if (f.field_type === "DB_COLUMN") {
    const raw = value ?? f.value ?? f.label ?? "";
    const text = String(raw).replace(/[{}]/g, "");
    return (
      <div style={style} className="absolute -translate-y-1/2 whitespace-nowrap text-[12px] text-black">
        {text}
      </div>
    );
  }

  if (f.field_type === "CHECKBOX") {
    const checked = !!value;
    return (
      <button
        style={style}
        onClick={canSign ? onToggle : undefined}
        className={`absolute -translate-y-1/2 flex items-center gap-1.5 px-2 py-1 rounded-md border-2 text-[11px] font-semibold shadow-sm ${
          checked ? "bg-emerald-50 text-emerald-700 border-emerald-300" : "bg-white text-gray-700 border-gray-400"
        } ${canSign ? "cursor-pointer hover:border-cyan-400" : ""}`}
      >
        {checked ? <MdOutlineCheckBox className="text-base" /> : <MdOutlineCheckBoxOutlineBlank className="text-base" />}
        <span className="whitespace-nowrap">{f.label || t("viewer.widget.iAccept")}</span>
      </button>
    );
  }

  if (f.field_type === "SIGNATURE") {
    if (value) {
      return (
        <div style={style} className="absolute -translate-y-1/2 flex items-center px-2 py-1 rounded-md border-2 border-emerald-300 bg-emerald-50 shadow-sm">
          {value.dataUrl ? (
            <img src={value.dataUrl} alt={t("viewer.widget.signatureAlt")} className="h-6" />
          ) : (
            <span className="text-[13px] text-gray-800" style={{ fontFamily: "'Segoe Script','Brush Script MT',cursive" }}>
              {value.text || t("viewer.widget.signed")}
            </span>
          )}
        </div>
      );
    }
    return (
      <button
        style={style}
        onClick={canSign ? onSign : undefined}
        className={`absolute -translate-y-1/2 flex items-center gap-1 px-2.5 py-1.5 rounded-md border-2 border-dashed text-[11px] font-semibold shadow-sm ${
          canSign ? "bg-violet-50 text-violet-700 border-violet-400 cursor-pointer hover:bg-violet-100 animate-pulse" : "bg-white text-gray-500 border-gray-400"
        }`}
      >
        <MdOutlineDraw className="text-sm" /> {canSign ? t("viewer.widget.clickToSign") : f.label || t("viewer.widget.signature")}
      </button>
    );
  }

  // INPUT
  return (
    <input
      style={style}
      value={value || ""}
      onChange={(e) => onInput(e.target.value)}
      readOnly={!canSign}
      placeholder={f.label || t("viewer.widget.typeHere")}
      className="absolute -translate-y-1/2 px-2 py-1 rounded-md border-2 border-dashed border-gray-400 bg-white text-[11px] text-gray-800 shadow-sm w-32 focus:outline-none focus:ring-2 focus:ring-cyan-400"
    />
  );
}

function PlaceholderDoc({ name }) {
  const { t } = useTranslation("contractStudio");
  return (
    <div className="p-8 sm:p-10 text-gray-800">
      <div className="w-16 h-6 bg-gray-200 rounded mb-8" />
      <h2 className="text-lg font-bold tracking-tight mb-4 uppercase">{name}</h2>
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-2 bg-gray-100 rounded" style={{ width: `${90 - (i % 3) * 12}%` }} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-6 mt-12 pt-6 border-t border-gray-200">
        <div>
          <div className="h-8 border-b border-gray-300 mb-1" />
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">{t("viewer.placeholderDoc.recipientSignature")}</p>
        </div>
        <div>
          <div className="h-8 border-b border-gray-300 mb-1" />
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">{t("viewer.placeholderDoc.companyRepresentative")}</p>
        </div>
      </div>
    </div>
  );
}