import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import {
  MdClose,
  MdOutlineCheckBox,
  MdOutlineCheckBoxOutlineBlank,
  MdOutlineDraw,
  MdOutlineDescription,
  MdCheckCircle,
  MdOutlineFileDownload,
  MdOutlineBlock,
} from "react-icons/md";
import { getMyContract, myContractDocument, myContractPdf, rejectMyContract, saveBlob, submitMyContract } from "../../api/contracts";
import useApiQuery from "../../hooks/useApiQuery";
import { useFormat } from "../../hooks/useFormat";
import { toastApiError } from "../../utils/apiError";
import { serverErrors } from "../../utils/applyFieldErrors";
import { NC_STATUS_KEY, NC_STATUS_STYLES } from "./newContractData";
import SignaturePadModal from "./SignaturePadModal";
import ReasonDialog from "./ReasonDialog";
import PdfCanvas from "./PdfCanvas";

// Signer viewer (plan decisions 26–32, 45). While SENT/VIEWED: the original pages with the
// fillable fields on top, consent, Submit and Reject. Otherwise: the rendered PDF (values, and
// "Not final" until COMPLETED). Opening a SENT contract makes it VIEWED (server side).

const SIGNABLE = ["SENT", "VIEWED"];
const PAD_TYPES = ["SIGNATURE", "INITIALS"];
// statuses whose reason it can't be signed is shown above the document (standards §7.3)
const BLOCKED_TEXT = { EXPIRED: "viewer.blocked.expired", REVOKED: "viewer.blocked.revoked" };

const isFilled = (f, v) => {
  if (f.field_type === "CHECKBOX") return v === true;
  if (PAD_TYPES.includes(f.field_type)) return !!v;
  return typeof v === "string" && v.trim() !== "";
};

// Field value → submit body value.
const bodyValue = (f, v) => {
  if (PAD_TYPES.includes(f.field_type)) return v.type === "DRAWN" ? { type: "DRAWN", dataUrl: v.dataUrl } : { type: "TYPED", text: v.text };
  if (f.field_type === "CHECKBOX") return v === true;
  return String(v).trim();
};

export default function ContractViewer({ contractId, onClose, onChanged }) {
  const { t } = useTranslation("contractStudio");
  const { fmtDate } = useFormat();

  const detailQuery = useApiQuery(() => getMyContract(contractId), [contractId]);
  const c = detailQuery.data;
  const signing = !!c && SIGNABLE.includes(c.status);
  // the list shows the new status (SENT → VIEWED) once the contract was opened
  const loadedStatus = c?.status;
  useEffect(() => {
    if (loadedStatus) onChanged?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedStatus]);

  // signing: the original pages under the fields; otherwise the rendered PDF
  const fileQuery = useApiQuery(
    () => (c ? (signing ? myContractDocument(contractId) : myContractPdf(contractId)) : null),
    [contractId, c?.status, signing],
  );
  const fileUrl = useMemo(() => (fileQuery.data ? URL.createObjectURL(fileQuery.data) : null), [fileQuery.data]);
  useEffect(() => () => fileUrl && URL.revokeObjectURL(fileUrl), [fileUrl]);

  const [activePage, setActivePage] = useState(1);
  const [pages, setPages] = useState(1);
  const [pageAspect, setPageAspect] = useState(1 / 1.3);
  const [values, setValues] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [consent, setConsent] = useState(false);
  const [signFor, setSignFor] = useState(null); // field id whose pad is open
  const [captured, setCaptured] = useState({}); // field_type → last pad result (sign once → reuse)
  const [busy, setBusy] = useState(null); // "submit" | "download"
  const [rejecting, setRejecting] = useState(false);
  const inFlight = useRef(false);

  const fields = useMemo(() => c?.fields || [], [c]);
  const signerFields = useMemo(() => fields.filter((f) => f.field_type !== "DB_COLUMN"), [fields]);
  const pageFields = fields.filter((f) => (f.page_no || 1) === activePage);
  const missingRequired = signerFields.filter((f) => f.is_required && !isFilled(f, values[f.id]));
  const pendingPads = signerFields.filter((f) => PAD_TYPES.includes(f.field_type) && !values[f.id]);

  const setVal = (id, v) => {
    setValues((prev) => ({ ...prev, [id]: v }));
    setFieldErrors((prev) => ({ ...prev, [id]: undefined }));
  };

  const fieldById = (id) => fields.find((f) => f.id === id);
  const handlePadClick = (f) => {
    if (captured[f.field_type]) setVal(f.id, captured[f.field_type]);
    else setSignFor(f.id);
  };
  const onPadSaved = (result) => {
    const f = fieldById(signFor);
    if (f) {
      setCaptured((prev) => ({ ...prev, [f.field_type]: result }));
      setVal(f.id, result);
    }
    setSignFor(null);
  };

  // A request failed: field errors go under their fields, anything else is toasted and the
  // contract reloads with its real state (expired, revoked, already signed …).
  const failed = (err) => {
    const byField = serverErrors(err).filter((e) => fieldById(e.field));
    if (byField.length) {
      setFieldErrors(Object.fromEntries(byField.map((e) => [e.field, e.message])));
      toast.error(byField[0].message);
      return;
    }
    toastApiError(err);
    if (err?.response?.status !== 400) detailQuery.reload();
  };

  const submit = async () => {
    if (inFlight.current || missingRequired.length) return;
    inFlight.current = true; // a double click signs once
    setBusy("submit");
    try {
      const body = {};
      signerFields.forEach((f) => {
        const v = values[f.id];
        if (isFilled(f, v) || (f.field_type === "CHECKBOX" && v === false)) body[f.id] = bodyValue(f, v);
      });
      await submitMyContract(contractId, { fields: body, consent });
      toast.success(t("viewer.toast.signedSubmitted"));
      detailQuery.reload();
    } catch (err) {
      failed(err);
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  };

  const download = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy("download");
    try {
      saveBlob(await myContractPdf(contractId), `${c.number || c.name}.pdf`);
    } catch (err) {
      toastApiError(err, t("viewer.toast.pdfFailed"));
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  };

  // could not open it at all (someone else's contract, a wrong link …)
  const openError = detailQuery.error && !c ? detailQuery.error : null;
  useEffect(() => {
    if (!openError) return;
    toastApiError(openError);
    onClose?.();
  }, [openError, onClose]);
  if (openError) return null;

  const statusKey = c ? NC_STATUS_KEY[c.status] : null;
  const st = NC_STATUS_STYLES[statusKey] || NC_STATUS_STYLES.Draft;
  const done = ["SUBMITTED", "COMPLETED"].includes(c?.status);

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
              <h3 className="text-base font-bold text-gray-900 truncate">{c?.name || t("common.loading")}</h3>
              {c && <p className="text-[11px] text-gray-400">{t("viewer.idModule", { id: c.number || "—", module: c.contract_type?.name || "—" })}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {c && (
              <button
                onClick={download}
                disabled={!!busy}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-60"
              >
                <MdOutlineFileDownload className="text-base" /> {busy === "download" ? t("actions.preparing") : t("actions.download")}
              </button>
            )}
            {c && (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${st.chip}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                {t(`status.${statusKey}`, { defaultValue: c.status })}
              </span>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
              <MdClose className="text-xl" />
            </button>
          </div>
        </div>

        {c && BLOCKED_TEXT[c.status] && (
          <div className="px-5 py-2.5 border-b border-rose-100 bg-rose-50 text-sm text-rose-700">{t(BLOCKED_TEXT[c.status])}</div>
        )}

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_280px] min-h-0">
          {/* document */}
          <div className="bg-gray-100 p-4 sm:p-6 overflow-auto">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 flex-wrap">
                {Array.from({ length: pages }).map((_, i) => {
                  const p = i + 1;
                  const padOnPage = signing && pendingPads.some((f) => (f.page_no || 1) === p);
                  return (
                    <button
                      key={p}
                      onClick={() => setActivePage(p)}
                      className={`relative px-2.5 py-1 rounded-md text-xs font-semibold ${
                        activePage === p ? "bg-cyan-600 text-white" : "bg-white text-gray-500 border border-gray-200"
                      }`}
                    >
                      {t("viewer.page", { page: p })}
                      {padOnPage && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500" />}
                    </button>
                  );
                })}
              </div>
              <span className="text-xs text-gray-400">{t("viewer.fieldsCount", { count: pageFields.length })}</span>
            </div>

            <div style={{ aspectRatio: pageAspect }} className="relative mx-auto bg-white shadow-lg rounded-sm w-full max-w-[620px] overflow-hidden">
              {fileUrl ? (
                <PdfCanvas
                  key={fileUrl}
                  src={fileUrl}
                  page={activePage}
                  onLoaded={(numPages, aspect) => {
                    if (numPages) setPages(numPages);
                    if (aspect) setPageAspect(aspect);
                  }}
                  className="absolute inset-0 w-full h-full pointer-events-none"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400">
                  {fileQuery.error ? t("viewer.toast.pdfFailed") : t("common.loading")}
                </div>
              )}

              {signing &&
                fileUrl &&
                pageFields.map((f) => (
                  <FieldWidget
                    key={f.id}
                    f={f}
                    value={values[f.id]}
                    error={fieldErrors[f.id]}
                    disabled={busy === "submit"}
                    onInput={(v) => setVal(f.id, v)}
                    onToggle={() => setVal(f.id, values[f.id] !== true)}
                    onSign={() => handlePadClick(f)}
                  />
                ))}
            </div>
          </div>

          {/* side panel */}
          <aside className="border-t lg:border-t-0 lg:border-l border-gray-100 flex flex-col min-h-0">
            <div className="p-4 border-b border-gray-100">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">{t("viewer.sent")}</p>
              <p className="text-sm text-gray-700">{c?.sent_at ? fmtDate(c.sent_at) : "—"}</p>
            </div>
            <div className="p-4 flex-1 overflow-auto space-y-4">
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">{t("viewer.signBy")}</p>
                <p className="text-sm text-gray-700">{c?.sign_by ? fmtDate(c.sign_by) : "—"}</p>
              </div>
              {signing && signerFields.length > 0 && (
                <ul className="space-y-1.5">
                  {signerFields.map((f) => (
                    <li key={f.id}>
                      <button onClick={() => setActivePage(f.page_no || 1)} className="w-full flex items-center justify-between gap-2 text-xs text-start">
                        <span className="truncate text-gray-700">
                          {f.label || t(`viewer.fieldTypes.${f.field_type}`)}
                          {f.is_required && <span className="text-red-500"> *</span>}
                        </span>
                        {isFilled(f, values[f.id]) ? <MdCheckCircle className="text-emerald-500 shrink-0" /> : <span className="text-[10px] text-gray-400 shrink-0">{t("viewer.page", { page: f.page_no || 1 })}</span>}
                      </button>
                      {fieldErrors[f.id] && <p className="text-red-500 text-[11px]">{fieldErrors[f.id]}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* actions */}
            <div className="p-4 border-t border-gray-100 space-y-2">
              {c && (
                <button
                  onClick={download}
                  disabled={!!busy}
                  className="sm:hidden w-full flex items-center justify-center gap-2 text-sm font-semibold text-gray-700 border border-gray-200 rounded-lg py-2.5 hover:bg-gray-50 disabled:opacity-60"
                >
                  <MdOutlineFileDownload /> {busy === "download" ? t("actions.preparing") : t("actions.download")}
                </button>
              )}

              {signing ? (
                <>
                  {pendingPads.length > 0 && (
                    <button
                      onClick={() => setActivePage(pendingPads[0].page_no || 1)}
                      className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-cyan-700 border border-cyan-300 rounded-lg py-2 hover:bg-cyan-50"
                    >
                      <MdOutlineDraw /> {t("viewer.signaturesLeft", { count: pendingPads.length })}
                    </button>
                  )}
                  <label className="flex items-start gap-2 text-[11px] text-gray-600 cursor-pointer">
                    <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 accent-cyan-600" />
                    <span>{t("viewer.consent")}</span>
                  </label>
                  <button
                    onClick={submit}
                    disabled={!!busy || missingRequired.length > 0}
                    className="w-full flex items-center justify-center gap-2 bg-[#20B2AA] hover:bg-[#1C9D96] disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-lg text-sm font-bold transition-colors"
                  >
                    {busy === "submit" ? t("viewer.submitting") : t("viewer.submit")}
                  </button>
                  {missingRequired.length > 0 && (
                    <p className="text-[11px] text-gray-400 text-center">{t("viewer.toast.requiredMissing", { count: missingRequired.length })}</p>
                  )}
                  <button
                    onClick={() => setRejecting(true)}
                    disabled={!!busy}
                    className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-rose-600 border border-rose-200 rounded-lg py-2.5 hover:bg-rose-50 disabled:opacity-60"
                  >
                    <MdOutlineBlock /> {t("viewer.reject")}
                  </button>
                </>
              ) : done ? (
                <div className="flex items-center justify-center gap-2 text-sm font-semibold text-emerald-600 py-2">
                  <MdCheckCircle /> {c.status === "COMPLETED" ? t("viewer.approved") : t("viewer.submitted")}
                </div>
              ) : (
                <button onClick={onClose} className="w-full text-sm font-semibold text-gray-600 hover:text-gray-900 py-2.5 border border-gray-200 rounded-lg">
                  {t("actions.close")}
                </button>
              )}
            </div>
          </aside>
        </div>
      </div>

      {signFor != null && (
        <SignaturePadModal
          initialText={fieldById(signFor)?.field_type === "SIGNATURE" ? c?.recipient?.name || "" : ""}
          onClose={() => setSignFor(null)}
          onSave={onPadSaved}
        />
      )}
      {rejecting && (
        <ReasonDialog
          title={t("viewer.rejectTitle")}
          subtitle={c?.name}
          submitLabel={t("viewer.reject")}
          busyLabel={t("viewer.rejecting")}
          onClose={() => setRejecting(false)}
          onSubmit={async (reason) => {
            await rejectMyContract(contractId, reason);
            setRejecting(false);
            toast.success(t("viewer.toast.rejected"));
            detailQuery.reload();
          }}
          onError={(err) => {
            setRejecting(false);
            failed(err);
          }}
        />
      )}
    </div>
  );
}

// ── one fillable field on the page (positions and sizes are page fractions) ──
function FieldWidget({ f, value, error, disabled, onInput, onToggle, onSign }) {
  const { t } = useTranslation("contractStudio");
  const style = {
    left: `${f.pos_x * 100}%`,
    top: `${f.pos_y * 100}%`,
    width: f.width ? `${f.width * 100}%` : undefined,
    height: f.height ? `${f.height * 100}%` : undefined,
  };
  const ring = error ? "ring-2 ring-red-400" : "";

  if (f.field_type === "DB_COLUMN") {
    return (
      <div style={style} className="absolute flex items-center overflow-hidden whitespace-nowrap text-[12px] text-black">
        {f.value ?? ""}
      </div>
    );
  }

  if (f.field_type === "CHECKBOX") {
    const checked = value === true;
    return (
      <button
        style={{ left: style.left, top: style.top }}
        onClick={disabled ? undefined : onToggle}
        title={f.label || t("viewer.widget.iAccept")}
        className={`absolute flex items-center gap-1 px-1 py-0.5 rounded-md border-2 text-[11px] font-semibold shadow-sm cursor-pointer hover:border-cyan-400 ${
          checked ? "bg-emerald-50 text-emerald-700 border-emerald-300" : "bg-white text-gray-700 border-gray-400"
        } ${ring}`}
      >
        {checked ? <MdOutlineCheckBox className="text-base" /> : <MdOutlineCheckBoxOutlineBlank className="text-base" />}
      </button>
    );
  }

  if (f.field_type === "SIGNATURE" || f.field_type === "INITIALS") {
    if (value) {
      return (
        <button
          style={style}
          onClick={disabled ? undefined : onSign}
          className="absolute flex items-center justify-center px-1 rounded-md border-2 border-emerald-300 bg-emerald-50 shadow-sm overflow-hidden"
        >
          {value.dataUrl ? (
            <img src={value.dataUrl} alt={t("viewer.widget.signatureAlt")} className="max-h-full" />
          ) : (
            <span className="text-[13px] text-gray-800 truncate" style={{ fontFamily: "'Segoe Script','Brush Script MT',cursive" }}>
              {value.text || t("viewer.widget.signed")}
            </span>
          )}
        </button>
      );
    }
    return (
      <button
        style={style}
        onClick={disabled ? undefined : onSign}
        className={`absolute flex items-center justify-center gap-1 px-1 rounded-md border-2 border-dashed text-[11px] font-semibold shadow-sm bg-violet-50 text-violet-700 border-violet-400 cursor-pointer hover:bg-violet-100 animate-pulse ${ring}`}
      >
        <MdOutlineDraw className="text-sm shrink-0" /> <span className="truncate">{t("viewer.widget.clickToSign")}</span>
      </button>
    );
  }

  // INPUT and DATE
  return (
    <input
      style={style}
      type={f.field_type === "DATE" ? "date" : "text"}
      value={value || ""}
      disabled={disabled}
      maxLength={f.field_type === "DATE" ? undefined : 500}
      onChange={(e) => onInput(e.target.value)}
      placeholder={f.label || t("viewer.widget.typeHere")}
      className={`absolute px-1.5 rounded-md border-2 border-dashed border-gray-400 bg-white/90 text-[11px] text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 ${ring}`}
    />
  );
}
