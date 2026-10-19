import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import {
  MdOutlineGroupAdd,
  MdOutlineMoveToInbox,
  MdOutlineSend,
  MdOutlineHowToReg,
  MdOutlineHub,
  MdOutlineContentCopy,
} from "react-icons/md";

import { INVITATIONS, invitationCounts, invitationAction } from "../../data/groupB";
import { paginate } from "../../data/common";
import InviteWizardModal from "../../components/InviteWizardModal";
import ProjectRolesManager from "./ProjectRolesManager";
import CollaborationTree from "./CollaborationTree";
import { TableLoader } from "../../components/Loader";
import Pagination from "../../components/Pagination";

const PAGE_SIZE = 10;

// Static build: row actions are applied to the in-memory invitation store.
const acceptInvitation = "accept";
const declineInvitation = "decline";
const parentApprove = "approve";
const parentReject = "reject";
const cancelInvitation = "cancel";

// Role values are API enums; labels resolve via role.<VALUE> at render.
const roleLabel = (t, r) => (r ? t(`role.${r}`, { defaultValue: r }) : r);

const STATUS_STYLE = {
  PENDING: "bg-amber-50 text-amber-700",
  ACCEPTED: "bg-green-50 text-green-700",
  DECLINED: "bg-red-50 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-500",
  EXPIRED: "bg-gray-100 text-gray-500",
};

const truncate = (s, n = 24) =>
  !s ? s : s.length > n ? s.substring(0, n) + "…" : s;

const Pill = ({ children, cls }) => (
  <span
    className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls}`}
  >
    {children}
  </span>
);

const namedList = (arr, t) =>
  arr && arr.length
    ? arr
        .map((x) => `${x.name || `#${x.id}`} (${roleLabel(t, x.role)})`)
        .join(", ")
    : null;

const EmptyState = ({ icon: Icon, title, subtitle, actionLabel, onAction }) => (
  <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
      <Icon className="text-3xl text-gray-400" />
    </div>
    <h3 className="text-base font-semibold text-gray-700">{title}</h3>
    <p className="text-sm text-gray-400 mt-1 max-w-sm">{subtitle}</p>
    {actionLabel && (
      <button
        onClick={onAction}
        className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700"
      >
        <MdOutlineGroupAdd className="text-lg" />
        {actionLabel}
      </button>
    )}
  </div>
);

const TH = ({ children, className = "" }) => (
  <th
    className={`py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider ${className}`}
  >
    {children}
  </th>
);

const EMPTY = {
  received: {
    icon: MdOutlineMoveToInbox,
    titleKey: "invitations.empty.received.title",
    subtitleKey: "invitations.empty.received.subtitle",
  },
  sent: {
    icon: MdOutlineSend,
    titleKey: "invitations.empty.sent.title",
    subtitleKey: "invitations.empty.sent.subtitle",
    actionKey: "invitations.inviteCompany",
  },
  approvals: {
    icon: MdOutlineHowToReg,
    titleKey: "invitations.empty.approvals.title",
    subtitleKey: "invitations.empty.approvals.subtitle",
  },
  collaborations: {
    icon: MdOutlineHub,
    titleKey: "invitations.empty.collaborations.title",
    subtitleKey: "invitations.empty.collaborations.subtitle",
    actionKey: "invitations.inviteCompany",
  },
};

function Invitations() {
  const { t } = useTranslation("collaboration");
  const [tab, setTab] = useState("received");
  const [page, setPage] = useState(1);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [version, setVersion] = useState(0);
  const loading = false;
  const actionLoading = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const counts = useMemo(() => invitationCounts(), [version]);
  const state = useMemo(() => {
    const block = (rows) => {
      const b = paginate(rows, page, PAGE_SIZE);
      return { rows: b.rows, total: b.total, totalPages: b.totalPages };
    };
    return {
      received: block(INVITATIONS.received),
      sent: block(INVITATIONS.sent),
      approvals: block(INVITATIONS.approvals),
      collaborations: block(INVITATIONS.collaborations),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, version]);

  const TABS = [
    { key: "received", label: t("invitations.tabs.received"), count: counts.received },
    { key: "sent", label: t("invitations.tabs.sent") },
    { key: "approvals", label: t("invitations.tabs.approvals"), count: counts.approvals },
    { key: "collaborations", label: t("invitations.tabs.collaborations") },
    { key: "hierarchy", label: t("invitations.tabs.hierarchy") },
    { key: "roles", label: t("invitations.tabs.roles") },
  ];

  const current = state[tab] || { rows: [], total: 0, totalPages: 1 };
  const rows = current.rows;

  // If an action empties the current page but earlier pages still have data
  // (e.g. cancelling the last row on page 2), snap back rather than show empty.
  if (!loading && current.rows.length === 0 && current.total > 0 && page > 1) {
    setPage(1);
  }

  const switchTab = (key) => {
    setTab(key);
    setPage(1);
  };

  const refetch = () => setVersion((v) => v + 1);

  const runAction = (kind, id, okMsg) => {
    invitationAction(kind, id);
    toast.success(okMsg);
    refetch();
  };

  const copyLink = async (link) => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success(t("invitations.toast.linkCopied"));
    } catch {
      window.prompt(t("invitations.copyLinkPrompt"), link);
    }
  };

  const sr = (i) => (page - 1) * PAGE_SIZE + i + 1;
  const colSpan = { received: 7, sent: 6, approvals: 5, collaborations: 6 }[tab];

  const iconBtn = "px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50";

  return (
    <div className="p-2 sm:p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{t("invitations.title")}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {t("invitations.subtitle")}
          </p>
        </div>
        <button
          onClick={() => setWizardOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#17A2B8] hover:bg-[#138496] whitespace-nowrap"
        >
          <MdOutlineGroupAdd className="text-lg" /> {t("invitations.inviteCompany")}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 mb-5 overflow-x-auto">
        {TABS.map((tb) => (
          <button
            key={tb.key}
            onClick={() => switchTab(tb.key)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap transition-colors ${
              tab === tb.key
                ? "border-cyan-600 text-cyan-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tb.label}
            {tb.count > 0 && (
              <span className="ms-2 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                {tb.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table card */}
      {tab === "roles" ? (
        <ProjectRolesManager />
      ) : tab === "hierarchy" ? (
        <CollaborationTree />
      ) : (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col">
        {!loading && rows.length === 0 ? (
          <EmptyState
            icon={EMPTY[tab].icon}
            title={t(EMPTY[tab].titleKey)}
            subtitle={t(EMPTY[tab].subtitleKey)}
            actionLabel={EMPTY[tab].actionKey ? t(EMPTY[tab].actionKey) : undefined}
            onAction={() => setWizardOpen(true)}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left border-collapse">
                <thead>
                  <tr className="bg-[#F8F9FB] border-b border-gray-200">
                    <TH className="w-20">{t("invitations.table.sno")}</TH>
                    {tab === "received" && (
                      <>
                        <TH>{t("invitations.table.from")}</TH>
                        <TH>{t("invitations.table.role")}</TH>
                        <TH>{t("invitations.table.project")}</TH>
                        <TH>{t("invitations.table.under")}</TH>
                        <TH className="text-center">{t("invitations.table.status")}</TH>
                        <TH className="text-center w-40">{t("invitations.table.actions")}</TH>
                      </>
                    )}
                    {tab === "sent" && (
                      <>
                        <TH>{t("invitations.table.to")}</TH>
                        <TH>{t("invitations.table.role")}</TH>
                        <TH>{t("invitations.table.project")}</TH>
                        <TH className="text-center">{t("invitations.table.status")}</TH>
                        <TH className="text-center w-44">{t("invitations.table.actions")}</TH>
                      </>
                    )}
                    {tab === "approvals" && (
                      <>
                        <TH>{t("invitations.table.company")}</TH>
                        <TH>{t("invitations.table.role")}</TH>
                        <TH>{t("invitations.table.project")}</TH>
                        <TH className="text-center w-40">{t("invitations.table.actions")}</TH>
                      </>
                    )}
                    {tab === "collaborations" && (
                      <>
                        <TH>{t("invitations.table.project")}</TH>
                        <TH>{t("invitations.table.yourRole")}</TH>
                        <TH>{t("invitations.table.invitedBy")}</TH>
                        <TH>{t("invitations.table.aboveYou")}</TH>
                        <TH>{t("invitations.table.underYou")}</TH>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <TableLoader colSpan={colSpan} />
                  ) : (
                    rows.map((inv, i) => (
                      <tr key={inv.id || inv.projectId || i} className="hover:bg-gray-50/50">
                        <td className="py-4 px-6 text-sm text-gray-500">{sr(i)}</td>

                        {tab === "received" && (
                          <>
                            <td className="py-4 px-6 text-sm font-semibold text-gray-800" title={inv.invitingCompany?.name}>
                              {truncate(inv.invitingCompany?.name || t("invitations.aCompany"))}
                            </td>
                            <td className="py-4 px-6 text-sm text-gray-700">{roleLabel(t, inv.role)}</td>
                            <td className="py-4 px-6 text-sm text-gray-700" title={inv.project}>
                              {truncate(inv.project || `#${inv.projectId}`)}
                            </td>
                            <td className="py-4 px-6 text-sm text-gray-500">
                              {inv.parentCompany?.name || "—"}
                            </td>
                            <td className="py-4 px-6 text-center">
                              <Pill cls={STATUS_STYLE[inv.status] || "bg-gray-100 text-gray-500"}>{t(`status.${inv.status}`, { defaultValue: inv.status })}</Pill>
                              {inv.status === "ACCEPTED" && inv.parentApprovalStatus === "PENDING" && (
                                <div className="mt-1"><Pill cls="bg-blue-50 text-blue-600">{t("invitations.awaitingParent")}</Pill></div>
                              )}
                            </td>
                            <td className="py-4 px-6">
                              {inv.status === "PENDING" ? (
                                <div className="flex items-center justify-center gap-2">
                                  <button disabled={actionLoading} onClick={() => runAction(acceptInvitation, inv.id, t("invitations.toast.accepted"))} className={`${iconBtn} text-white bg-cyan-600 hover:bg-cyan-700`}>{t("invitations.actions.accept")}</button>
                                  <button disabled={actionLoading} onClick={() => runAction(declineInvitation, inv.id, t("invitations.toast.declined"))} className={`${iconBtn} text-gray-600 border border-gray-200 hover:bg-gray-50`}>{t("invitations.actions.decline")}</button>
                                </div>
                              ) : (
                                <div className="text-center text-xs text-gray-400">—</div>
                              )}
                            </td>
                          </>
                        )}

                        {tab === "sent" && (
                          <>
                            <td className="py-4 px-6 text-sm font-semibold text-gray-800" title={inv.invitedCompany?.name || inv.invitedEmail}>
                              {truncate(inv.invitedCompany?.name || inv.invitedEmail)}
                            </td>
                            <td className="py-4 px-6 text-sm text-gray-700">{roleLabel(t, inv.role)}</td>
                            <td className="py-4 px-6 text-sm text-gray-700" title={inv.project}>
                              {truncate(inv.project || `#${inv.projectId}`)}
                            </td>
                            <td className="py-4 px-6 text-center">
                              <Pill cls={STATUS_STYLE[inv.status] || "bg-gray-100 text-gray-500"}>{t(`status.${inv.status}`, { defaultValue: inv.status })}</Pill>
                              {inv.parentApprovalStatus && inv.parentApprovalStatus !== "NOT_REQUIRED" && (
                                <div className="mt-1"><Pill cls="bg-blue-50 text-blue-600">{t("invitations.parentStatus", { status: t(`status.${inv.parentApprovalStatus}`, { defaultValue: inv.parentApprovalStatus }) })}</Pill></div>
                              )}
                            </td>
                            <td className="py-4 px-6">
                              <div className="flex items-center justify-center gap-2">
                                {inv.inviteLink && (
                                  <button onClick={() => copyLink(inv.inviteLink)} title={t("invitations.copyLinkTitle")} className={`${iconBtn} text-cyan-700 border border-cyan-200 hover:bg-cyan-50 inline-flex items-center gap-1`}>
                                    <MdOutlineContentCopy /> {t("invitations.actions.link")}
                                  </button>
                                )}
                                {["PENDING", "ACCEPTED"].includes(inv.status) && (
                                  <button disabled={actionLoading} onClick={() => runAction(cancelInvitation, inv.id, t("invitations.toast.cancelled"))} className={`${iconBtn} text-red-600 border border-red-200 hover:bg-red-50`}>{t("invitations.actions.cancel")}</button>
                                )}
                              </div>
                            </td>
                          </>
                        )}

                        {tab === "approvals" && (
                          <>
                            <td className="py-4 px-6 text-sm font-semibold text-gray-800" title={inv.invitedCompany?.name || inv.invitedEmail}>
                              {truncate(inv.invitedCompany?.name || inv.invitedEmail)}
                            </td>
                            <td className="py-4 px-6 text-sm text-gray-700">{roleLabel(t, inv.role)}</td>
                            <td className="py-4 px-6 text-sm text-gray-700" title={inv.project}>
                              {truncate(inv.project || `#${inv.projectId}`)}
                            </td>
                            <td className="py-4 px-6">
                              <div className="flex items-center justify-center gap-2">
                                <button disabled={actionLoading} onClick={() => runAction(parentApprove, inv.id, t("invitations.toast.placementApproved"))} className={`${iconBtn} text-white bg-cyan-600 hover:bg-cyan-700`}>{t("invitations.actions.approve")}</button>
                                <button disabled={actionLoading} onClick={() => runAction(parentReject, inv.id, t("invitations.toast.placementRejected"))} className={`${iconBtn} text-gray-600 border border-gray-200 hover:bg-gray-50`}>{t("invitations.actions.reject")}</button>
                              </div>
                            </td>
                          </>
                        )}

                        {tab === "collaborations" && (
                          <>
                            <td className="py-4 px-6 text-sm font-semibold text-gray-800" title={inv.projectName}>
                              {truncate(inv.projectName || t("invitations.projectFallback", { id: inv.projectId }))}
                            </td>
                            <td className="py-4 px-6">
                              <Pill cls="bg-cyan-50 text-cyan-700">{roleLabel(t, inv.myRole)}</Pill>
                            </td>
                            <td className="py-4 px-6 text-sm text-gray-600">{inv.invitedBy?.name || "—"}</td>
                            <td className="py-4 px-6 text-sm text-gray-600">
                              {namedList(inv.parents, t) || inv.invitedBy?.name || t("invitations.projectOwnerDash")}
                            </td>
                            <td className="py-4 px-6 text-sm text-gray-600">{namedList(inv.children, t) || "—"}</td>
                          </>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {current.total > 0 && (
              <Pagination
                page={page}
                totalPages={current.totalPages}
                total={current.total}
                limit={PAGE_SIZE}
                onPage={setPage}
                label={t("invitations.paginationLabel")}
              />
            )}
          </>
        )}
      </div>
      )}

      <InviteWizardModal
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSuccess={refetch}
      />
    </div>
  );
}

export default Invitations;
