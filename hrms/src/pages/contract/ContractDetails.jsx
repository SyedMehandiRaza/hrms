import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import {
  MdCheck,
  MdOutlineChevronRight,
  MdOutlineEditCalendar,
  MdOutlineEventNote,
  MdOutlineGroup,
  MdOutlineHistory,
  MdOutlineSearchOff,
} from "react-icons/md";

import Ltr from "../../components/Ltr";
import ConfirmationModal from "../../components/ConfirmationModal";
import Can from "../../components/Can";
import { MODULES, ACTIONS } from "../../constants/permissions";
import useFiscalYear from "../../hooks/useFiscalYear";
import { useFormat } from "../../hooks/useFormat";
import { legacyContractById, updateLegacyContract } from "../../data/groupF";
import { ContractStatusBadge, ExpiredBadge } from "./ContractStatusBadge";
import ContractTermModal from "./ContractTermModal";
import { TERM_LOCKED_STATUSES } from "./contractHelpers";

const card = "bg-white border border-gray-200 rounded-xl";
const caption = "text-[10px] font-bold text-gray-400 uppercase tracking-wider";

export default function ContractDetails() {
  const { id } = useParams();
  const { t } = useTranslation("contracts");
  const { fmtDate } = useFormat();
  const today = useFiscalYear().today;

  const [modal, setModal] = useState(null); // "term" | "approve"
  const [approving, setApproving] = useState(false);
  // bumped after a local edit so the contract is re-read
  const [, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);
  const contract = legacyContractById(id);
  const error = contract ? null : { code: 404 };

  const approve = async () => {
    setApproving(true);
    try {
      const now = new Date().toISOString();
      updateLegacyContract(id, {
        status: "APPROVED",
        approved_at: now,
        activities: [...(contract.activities || []), { id: Date.now(), action: "APPROVED", description: "Approved by Ahmed Al Mansoori", created_at: now }],
      });
      toast.success(t("details.approved"));
      setModal(null);
      reload();
    } finally {
      setApproving(false);
    }
  };

  if (error || !contract) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-24 px-4 gap-3">
        <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center">
          <MdOutlineSearchOff className="text-2xl text-gray-400" />
        </div>
        <p className="text-sm text-gray-600 max-w-md">{error?.code === 404 ? t("details.notFound") : error?.message || t("details.loadFailed")}</p>
        <Link to="/admin/contracts" className="text-sm font-semibold text-cyan-600 hover:text-cyan-700">
          {t("details.backToList")}
        </Link>
      </div>
    );
  }

  const termLocked = TERM_LOCKED_STATUSES.includes(contract.status);
  const recipients = contract.recipients || [];
  const activities = contract.activities || [];
  const dateOrDash = (v) => (v ? fmtDate(v) : "—");
  const dateTime = (v) => fmtDate(v, { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-6 pb-10 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm flex-wrap mb-2">
            <Link to="/admin/contracts" className="text-gray-400 hover:text-cyan-600 transition-colors">
              {t("title")}
            </Link>
            <MdOutlineChevronRight className="text-gray-300 rtl:rotate-180" />
            <span className="text-cyan-600 font-semibold truncate">{contract.name}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-gray-900 break-words">{contract.name}</h1>
            <ContractStatusBadge status={contract.status} />
            <ExpiredBadge contract={contract} today={today} />
          </div>
          <p className="text-sm text-gray-500">
            {contract.reference_no && (
              <>
                <Ltr>{contract.reference_no}</Ltr>
                {" · "}
              </>
            )}
            {t("details.createdOn", { date: dateOrDash(contract.created_at) })}
          </p>
        </div>
        {/* both writes need contract UPDATE (PATCH term / approve) */}
        <Can module={MODULES.CONTRACT} action={ACTIONS.UPDATE}>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setModal("term")}
            disabled={termLocked}
            title={termLocked ? t("term.lockedHint") : undefined}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <MdOutlineEditCalendar className="text-lg text-gray-400" />
            {t("term.editDates")}
          </button>
          {contract.status === "SUBMITTED" && (
            <button
              type="button"
              onClick={() => setModal("approve")}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#20B2AA] hover:bg-[#1C9D96] rounded-lg transition-colors"
            >
              <MdCheck className="text-lg" />
              {t("details.approveContract")}
            </button>
          )}
        </div>
        </Can>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6 min-w-0">
          {/* Term */}
          <section className={`${card} p-6`}>
            <div className="flex items-center gap-2 mb-5">
              <MdOutlineEventNote className="text-lg text-cyan-600" />
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">{t("details.contractDates")}</h2>
            </div>
            <dl className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                ["term.startDate", contract.start_date],
                ["term.endDate", contract.end_date],
                ["term.renewalDue", contract.renewal_due],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className={`${caption} mb-1.5`}>{t(k)}</dt>
                  <dd className="text-sm font-bold text-gray-900">{v ? fmtDate(v) : t("term.notSet")}</dd>
                </div>
              ))}
            </dl>
            <dl className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-6 pt-5 border-t border-gray-100">
              {[
                ["details.sentOn", contract.sent_at],
                ["details.submittedOn", contract.submitted_at],
                ["details.approvedOn", contract.approved_at],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className={`${caption} mb-1.5`}>{t(k)}</dt>
                  <dd className="text-sm font-medium text-gray-700">{dateOrDash(v)}</dd>
                </div>
              ))}
            </dl>
            {contract.notes && (
              <div className="mt-6 pt-5 border-t border-gray-100">
                <p className={`${caption} mb-1.5`}>{t("details.notes")}</p>
                <p className="text-sm text-gray-700 whitespace-pre-line break-words">{contract.notes}</p>
              </div>
            )}
          </section>

          {/* Recipients */}
          <section className={`${card} p-6`}>
            <div className="flex items-center gap-2 mb-5">
              <MdOutlineGroup className="text-lg text-cyan-600" />
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">{t("details.recipients")}</h2>
            </div>
            {recipients.length === 0 ? (
              <p className="text-sm text-gray-400">{t("details.noRecipients")}</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {recipients.map((r) => (
                  <li key={r.id} className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{r.recipient_name || "—"}</p>
                      {r.recipient_email && (
                        <p className="text-xs text-gray-500 truncate">
                          <Ltr>{r.recipient_email}</Ltr>
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {r.role && (
                        <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 font-medium">
                          {t(`details.role.${r.role}`, { defaultValue: r.role })}
                        </span>
                      )}
                      {r.status && (
                        <span className="px-2 py-0.5 rounded-md bg-cyan-50 text-cyan-700 font-semibold">
                          {t(`details.recipientStatus.${r.status}`, { defaultValue: r.status })}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Activity */}
        <section className={`${card} p-6 min-w-0`}>
          <div className="flex items-center gap-2 mb-5">
            <MdOutlineHistory className="text-lg text-cyan-600" />
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">{t("details.lifecycle.title")}</h2>
          </div>
          {activities.length === 0 ? (
            <p className="text-sm text-gray-400">{t("details.noActivity")}</p>
          ) : (
            <ol className="relative">
              {activities.map((a, i) => (
                <li key={a.id} className="relative ps-6 pb-5 last:pb-0">
                  {i < activities.length - 1 && <span className="absolute start-[5px] top-3 bottom-0 w-px bg-gray-200" />}
                  <span className="absolute start-0 top-1.5 w-[11px] h-[11px] rounded-full border-2 border-cyan-500 bg-white" />
                  <p className="text-sm font-semibold text-gray-900">{t(`details.action.${a.action}`, { defaultValue: a.action })}</p>
                  {a.description && <p className="text-xs text-gray-500 mt-0.5 break-words">{a.description}</p>}
                  <p className="text-[11px] text-gray-400 mt-0.5">{dateTime(a.created_at)}</p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {modal === "term" && <ContractTermModal contract={contract} onClose={() => setModal(null)} onSaved={reload} />}
      <ConfirmationModal
        isOpen={modal === "approve"}
        onClose={() => !approving && setModal(null)}
        onConfirm={approve}
        type="success"
        title={t("details.approveTitle")}
        message={t("details.approveMessage", { name: contract.name })}
        confirmText={t("details.approveContract")}
        isLoading={approving}
      />
    </div>
  );
}
