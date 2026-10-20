import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import {
  MdClose,
  MdOutlineDescription,
  MdOutlinePerson,
  MdOutlineFileDownload,
  MdOutlineVerified,
  MdOutlineEdit,
  MdOutlineSend,
  MdOutlineDelete,
  MdOutlineBlock,
} from "react-icons/md";
import { approveContract, contractPdf, deleteDraft, editDraft, getContract, revokeContract, saveBlob, sendDraft } from "../../api/contracts";
import useApiQuery from "../../hooks/useApiQuery";
import { useCan } from "../../hooks/usePermission";
import { useFormat } from "../../hooks/useFormat";
import { MODULES } from "../../constants/permissions";
import { toastApiError } from "../../utils/apiError";
import { serverErrors } from "../../utils/applyFieldErrors";
import ConfirmationModal from "../../components/ConfirmationModal";
import { NC_AUDIENCE_ID, NC_STATUS_KEY, NC_STATUS_STYLES } from "./newContractData";
import { TERM_KEYS, termsBody, termsOf, validateTerms } from "./contractTerms";
import ContractTermInputs from "./ContractTermInputs";
import ReasonDialog from "./ReasonDialog";
import PdfCanvas from "./PdfCanvas";

// HR viewer (plan decisions 22, 33–34, 39, 42, 45): the server-rendered PDF (live values and a
// "Not final" watermark until COMPLETED), the recipient's status and the activity log, with
// Edit terms / Send / Delete on drafts, Revoke on SENT/VIEWED/SUBMITTED and Approve on SUBMITTED.

const RECIP_STATUS = {
  PENDING: { chip: "bg-gray-100 text-gray-500", dot: "bg-gray-400" },
  SENT: { chip: "bg-indigo-50 text-indigo-600", dot: "bg-indigo-500" },
  VIEWED: { chip: "bg-sky-50 text-sky-600", dot: "bg-sky-500" },
  SIGNED: { chip: "bg-emerald-50 text-emerald-600", dot: "bg-emerald-500" },
  SUBMITTED: { chip: "bg-emerald-50 text-emerald-600", dot: "bg-emerald-500" },
  DECLINED: { chip: "bg-rose-50 text-rose-600", dot: "bg-rose-500" },
  COMPLETED: { chip: "bg-emerald-50 text-emerald-600", dot: "bg-emerald-500" },
  EXPIRED: { chip: "bg-rose-50 text-rose-500", dot: "bg-rose-400" },
  REVOKED: { chip: "bg-orange-50 text-orange-600", dot: "bg-orange-500" },
};
const REVOCABLE = ["SENT", "VIEWED", "SUBMITTED"];

export default function HrContractViewer({ contractId, onClose, onChanged }) {
  const { t } = useTranslation("contractStudio");
  const { fmtDate } = useFormat();
  const can = useCan();
  const canCreate = can(MODULES.CONTRACT, "create");
  const canUpdate = can(MODULES.CONTRACT, "update");
  const canDelete = can(MODULES.CONTRACT, "delete");

  const detailQuery = useApiQuery(() => getContract(contractId), [contractId]);
  const c = detailQuery.data;
  // the PDF follows the contract: reload it whenever the contract changed
  const pdfQuery = useApiQuery(() => (c ? contractPdf(contractId) : null), [contractId, c?.status, c?.updated_at]);
  const pdfUrl = useMemo(() => (pdfQuery.data ? URL.createObjectURL(pdfQuery.data) : null), [pdfQuery.data]);
  useEffect(() => () => pdfUrl && URL.revokeObjectURL(pdfUrl), [pdfUrl]);

  const [activePage, setActivePage] = useState(1);
  const [pages, setPages] = useState(1);
  const [pageAspect, setPageAspect] = useState(1 / 1.3);
  const [busy, setBusy] = useState(null); // "send" | "approve" | "delete" while a request runs
  const inFlight = useRef(false);
  const [dialog, setDialog] = useState(null); // "edit" | "revoke" | "delete"

  const refresh = () => {
    detailQuery.reload();
    onChanged?.();
  };

  // An action failed: show the server's message, then reload the real state.
  const failed = (err) => {
    toastApiError(err);
    setDialog(null);
    refresh();
  };

  const run = async (name, request, success) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(name);
    try {
      await request();
      toast.success(success);
      refresh();
    } catch (err) {
      failed(err);
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  };

  const doDelete = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy("delete");
    try {
      await deleteDraft(contractId);
      toast.success(t("viewer.toast.draftDeleted"));
      onChanged?.();
      onClose?.();
    } catch (err) {
      failed(err);
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  };

  const doDownload = () => {
    if (pdfQuery.data) saveBlob(pdfQuery.data, `${c.number || c.name}.pdf`);
  };

  // could not open it at all (e.g. 404 for a deleted draft or a wrong link)
  const openError = detailQuery.error && !c ? detailQuery.error : null;
  useEffect(() => {
    if (!openError) return;
    toastApiError(openError);
    onClose?.();
  }, [openError, onClose]);
  if (openError) return null;

  const statusKey = c ? NC_STATUS_KEY[c.status] : null;
  const st = NC_STATUS_STYLES[statusKey] || NC_STATUS_STYLES.Draft;
  const recipient = c?.recipient;
  const rs = RECIP_STATUS[recipient?.status] || RECIP_STATUS.PENDING;
  const isDraft = c?.status === "DRAFT";

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
              {c && (
                <p className="text-[11px] text-gray-400">
                  {t("viewer.idModule", { id: c.number || "—", module: c.contract_type?.name || "—" })}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {pdfQuery.data && (
              <button
                onClick={doDownload}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100"
              >
                <MdOutlineFileDownload className="text-base" /> {t("actions.download")}
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

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_280px] min-h-0">
          {/* document */}
          <div className="bg-gray-100 p-4 sm:p-6 overflow-auto">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 flex-wrap">
                {Array.from({ length: pages }).map((_, i) => (
                  <button
                    key={i + 1}
                    onClick={() => setActivePage(i + 1)}
                    className={`relative px-2.5 py-1 rounded-md text-xs font-semibold ${
                      activePage === i + 1 ? "bg-cyan-600 text-white" : "bg-white text-gray-500 border border-gray-200"
                    }`}
                  >
                    {t("viewer.page", { page: i + 1 })}
                  </button>
                ))}
              </div>
              {c && <span className="text-xs text-gray-400">{t("viewer.fieldsCount", { count: c.fields.length })}</span>}
            </div>

            <div style={{ aspectRatio: pageAspect }} className="relative mx-auto bg-white shadow-lg rounded-sm w-full max-w-[620px] overflow-hidden">
              {pdfUrl ? (
                <PdfCanvas
                  src={pdfUrl}
                  page={activePage}
                  onLoaded={(numPages, aspect) => {
                    if (numPages) setPages(numPages);
                    if (aspect) setPageAspect(aspect);
                  }}
                  className="absolute inset-0 w-full h-full pointer-events-none"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400">
                  {pdfQuery.error ? t("viewer.toast.pdfFailed") : t("common.loading")}
                </div>
              )}
            </div>
          </div>

          {/* side panel */}
          <aside className="border-t lg:border-t-0 lg:border-l border-gray-100 flex flex-col min-h-0">
            <div className="p-4 border-b border-gray-100">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">{t("viewer.sent")}</p>
              <p className="text-sm text-gray-700">{c?.sent_at ? fmtDate(c.sent_at) : "—"}</p>
            </div>

            <div className="p-4 flex-1 overflow-auto space-y-5">
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">{t("viewer.recipients")}</p>
                {!recipient ? (
                  <p className="text-xs text-gray-400">{c ? t("viewer.noRecipients") : t("common.loading")}</p>
                ) : (
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center">
                      <MdOutlinePerson className="text-base" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{recipient.name || t("viewer.recipientFallback")}</p>
                      <p className="text-[11px] text-gray-400 truncate">{t(`audiences.${NC_AUDIENCE_ID[recipient.type]}`, { defaultValue: recipient.type })}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${rs.chip}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${rs.dot}`} />
                      {t(`recipientStatus.${recipient.status}`, { defaultValue: recipient.status })}
                    </span>
                  </div>
                )}
              </div>

              {c && (
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">{t("viewer.activity")}</p>
                  <ul className="space-y-3">
                    {c.activity.map((a) => (
                      <li key={a.id} className="text-xs">
                        <p className="font-semibold text-gray-800">
                          {t(`viewer.activityActions.${a.action}`, { defaultValue: a.action })}
                          <span className="font-normal text-gray-400"> · {a.actor?.name || t("viewer.system")}</span>
                        </p>
                        <p className="text-[11px] text-gray-400">{fmtDate(a.created_at)}</p>
                        {a.meta?.reason && <p className="text-[11px] text-gray-600 mt-0.5">{t("viewer.reasonLine", { reason: a.meta.reason })}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* actions */}
            <div className="p-4 border-t border-gray-100 space-y-2">
              {pdfQuery.data && (
                <button
                  onClick={doDownload}
                  className="sm:hidden w-full flex items-center justify-center gap-2 text-sm font-semibold text-gray-700 border border-gray-200 rounded-lg py-2.5 hover:bg-gray-50"
                >
                  <MdOutlineFileDownload /> {t("actions.download")}
                </button>
              )}

              {isDraft && canCreate && (
                <button
                  onClick={() => run("send", () => sendDraft(contractId), t("wizard.toast.sent", { count: 1 }))}
                  disabled={!!busy}
                  className="w-full flex items-center justify-center gap-2 bg-[#20B2AA] hover:bg-[#1C9D96] disabled:opacity-60 text-white py-2.5 rounded-lg text-sm font-bold transition-colors"
                >
                  <MdOutlineSend /> {busy === "send" ? t("viewer.sending") : t("actions.send")}
                </button>
              )}
              {isDraft && canUpdate && (
                <button
                  onClick={() => setDialog("edit")}
                  disabled={!!busy}
                  className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-gray-700 border border-gray-200 rounded-lg py-2.5 hover:bg-gray-50 disabled:opacity-60"
                >
                  <MdOutlineEdit /> {t("viewer.editTerms")}
                </button>
              )}
              {isDraft && canDelete && (
                <button
                  onClick={() => setDialog("delete")}
                  disabled={!!busy}
                  className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-rose-600 border border-rose-200 rounded-lg py-2.5 hover:bg-rose-50 disabled:opacity-60"
                >
                  <MdOutlineDelete /> {t("actions.delete")}
                </button>
              )}
              {c?.status === "SUBMITTED" && canUpdate && (
                <button
                  onClick={() => run("approve", () => approveContract(contractId), t("viewer.toast.approved"))}
                  disabled={!!busy}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white py-2.5 rounded-lg text-sm font-bold transition-colors"
                >
                  <MdOutlineVerified /> {busy === "approve" ? t("viewer.approving") : t("viewer.approve")}
                </button>
              )}
              {REVOCABLE.includes(c?.status) && canUpdate && (
                <button
                  onClick={() => setDialog("revoke")}
                  disabled={!!busy}
                  className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-rose-600 border border-rose-200 rounded-lg py-2.5 hover:bg-rose-50 disabled:opacity-60"
                >
                  <MdOutlineBlock /> {t("viewer.revoke")}
                </button>
              )}
              <button
                onClick={onClose}
                className="w-full text-sm font-semibold text-gray-600 hover:text-gray-900 py-2.5 border border-gray-200 rounded-lg"
              >
                {t("actions.close")}
              </button>
            </div>
          </aside>
        </div>
      </div>

      {dialog === "edit" && c && (
        <EditTermsDialog
          contract={c}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            toast.success(t("viewer.toast.draftUpdated"));
            refresh();
          }}
          onError={failed}
        />
      )}
      {dialog === "revoke" && (
        <ReasonDialog
          title={t("viewer.revokeTitle")}
          subtitle={c?.name}
          submitLabel={t("viewer.revoke")}
          busyLabel={t("viewer.revoking")}
          onClose={() => setDialog(null)}
          onSubmit={async (reason) => {
            await revokeContract(contractId, reason);
            setDialog(null);
            toast.success(t("viewer.toast.revoked"));
            refresh();
          }}
          onError={failed}
        />
      )}
      <ConfirmationModal
        isOpen={dialog === "delete"}
        type="delete"
        title={t("viewer.deleteTitle")}
        message={t("viewer.deleteMessage", { name: c?.name })}
        confirmText={t("actions.delete")}
        cancelText={t("actions.cancel")}
        isLoading={busy === "delete"}
        onClose={() => setDialog(null)}
        onConfirm={doDelete}
      />
    </div>
  );
}

// Draft terms (PUT /contracts/:id). Field errors show under their inputs.
function EditTermsDialog({ contract, onClose, onSaved, onError }) {
  const { t } = useTranslation("contractStudio");
  const [term, setTerm] = useState(() => termsOf(contract));
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);

  const change = (field, value) => {
    const next = { ...term, [field]: value };
    setTerm(next);
    setErrors(touched ? validateTerms(t, next) : { ...errors, [field]: undefined });
  };

  const save = async () => {
    if (inFlight.current) return;
    setTouched(true);
    const errs = validateTerms(t, term);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    inFlight.current = true;
    setSaving(true);
    try {
      await editDraft(contract.id, termsBody(term));
      onSaved();
    } catch (err) {
      const fieldErrs = serverErrors(err).filter((e) => TERM_KEYS.includes(e.field));
      if (fieldErrs.length) setErrors(Object.fromEntries(fieldErrs.map((e) => [e.field, e.message])));
      else onError(err);
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-5 border-b border-gray-200 flex justify-between items-start">
          <div>
            <h2 className="text-[17px] font-bold text-gray-900">{t("viewer.editTerms")}</h2>
            <p className="text-[13px] text-gray-500 mt-1 font-medium">{contract.name}</p>
          </div>
          <button onClick={onClose} disabled={saving} className="text-gray-400 hover:text-gray-600 transition-colors p-1">
            <MdClose size={20} />
          </button>
        </div>
        <div className="p-5 overflow-auto">
          <ContractTermInputs values={term} errors={errors} onChange={change} disabled={saving} />
        </div>
        <div className="p-4 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-5 py-2.5 border border-gray-300 bg-white text-gray-700 font-bold text-[13px] rounded-lg hover:bg-gray-50 transition-colors"
          >
            {t("actions.cancel")}
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-5 py-2.5 bg-[#20B2AA] hover:bg-[#1C9D96] text-white font-bold text-[13px] rounded-lg transition-colors disabled:opacity-60"
          >
            {saving ? t("viewer.saving") : t("viewer.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
