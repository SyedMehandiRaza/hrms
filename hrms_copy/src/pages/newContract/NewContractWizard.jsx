import React, { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useTranslation, Trans } from "react-i18next";
import {
  MdOutlineChevronRight,
  MdOutlineArrowBack,
  MdOutlineArrowForward,
  MdCheck,
  MdClose,
  MdOutlineLayers,
  MdOutlinePerson,
  MdOutlineBusiness,
  MdOutlineInventory2,
  MdOutlineHandshake,
  MdOutlineSearch,
  MdOutlineSend,
  MdOutlineAdd,
  MdOutlineDescription,
  MdOutlineDataObject,
  MdOutlineDraw,
  MdOutlineVerifiedUser,
  MdOutlineMailOutline,
  MdOutlineEventNote,
} from "react-icons/md";
import { NC_RECIPIENT_ROLES } from "./newContractData";
import { useNcTemplates, ncStore } from "./newContractStore";
import { ncRecipientsFor, ncBuildSentContracts, NC_COLLAB_PROJECTS } from "../../data/groupF";
import { ContractTermFields } from "../contract/ContractTermModal";
import { validateContractTerm } from "../../utils/fyValidation/misc";
import { useFormat } from "../../hooks/useFormat";

const EMPTY_TERM = { start_date: "", end_date: "", renewal_due: "" };

const STEPS = [
  { id: 1, labelKey: "wizard.steps.chooseTemplate" },
  { id: 2, labelKey: "wizard.steps.recipients" },
  { id: 3, labelKey: "wizard.steps.reviewSend" },
];

const AUD = {
  employee: { label: "Employee", labelKey: "audiences.employee", plural: "Employees", icon: MdOutlinePerson, chip: "bg-cyan-50 text-cyan-600" },
  staffing: { label: "Staffing Company", labelKey: "audiences.staffing", plural: "Staffing", icon: MdOutlineBusiness, chip: "bg-indigo-50 text-indigo-600" },
  vendor: { label: "Vendor", labelKey: "audiences.vendor", plural: "Vendors", icon: MdOutlineInventory2, chip: "bg-amber-50 text-amber-600" },
  client: { label: "Client", labelKey: "audiences.client", plural: "Clients", icon: MdOutlineHandshake, chip: "bg-rose-50 text-rose-600" },
  collaborator: { label: "Collaborating Company", labelKey: "audiences.collaborator", plural: "Companies", icon: MdOutlineHandshake, chip: "bg-teal-50 text-teal-600" },
};

// Display labels for the recipient role values (the values themselves are mapped to the API).
const ROLE_LABEL_KEY = {
  "Primary Signer": "roles.primarySigner",
  Approver: "roles.approver",
  "Viewer (CC)": "roles.viewerCc",
  Witness: "roles.witness",
};

const SIGNER_COLORS = [
  { chip: "bg-cyan-100 text-cyan-700 border-cyan-300", solid: "bg-cyan-500" },
  { chip: "bg-violet-100 text-violet-700 border-violet-300", solid: "bg-violet-500" },
  { chip: "bg-amber-100 text-amber-700 border-amber-300", solid: "bg-amber-500" },
  { chip: "bg-emerald-100 text-emerald-700 border-emerald-300", solid: "bg-emerald-500" },
];

export default function NewContractWizard() {
  const { t } = useTranslation("contractStudio");
  const navigate = useNavigate();
  const templates = useNcTemplates();
  const [params] = useSearchParams();

  const [step, setStep] = useState(1);
  const [templateId, setTemplateId] = useState(params.get("template") || null);
  const [selected, setSelected] = useState([]); // recipients
  const [query, setQuery] = useState("");
  const [signingOrder, setSigningOrder] = useState(false);
  const [sending, setSending] = useState(false);

  const [projectId, setProjectId] = useState("");

  // Contract term — same fields + rules as /admin/contracts/create.
  const { fmtDate } = useFormat();
  const [term, setTerm] = useState(EMPTY_TERM);
  const [termErrors, setTermErrors] = useState({});
  const [termTouched, setTermTouched] = useState(false);
  const changeTerm = (field, value) => {
    const next = { ...term, [field]: value };
    setTerm(next);
    // live re-check once the user tried to continue; drop a server error on edit
    setTermErrors(termTouched ? validateContractTerm(t, next) : { ...termErrors, [field]: undefined });
  };

  const template = templates.find((t) => t.id === templateId) || null;
  const audience = template?.audience || "employee";
  const aud = AUD[audience] || AUD.employee;
  const audLabel = t(aud.labelKey);
  const roleLabel = (role) => (ROLE_LABEL_KEY[role] ? t(ROLE_LABEL_KEY[role]) : role);

  // Collaborator audience: the projects this company is on (to pick from).
  const collabProjects = audience === "collaborator" ? NC_COLLAB_PROJECTS : [];

  // Recipients for this audience (scoped to a project for collaborators).
  const pool = useMemo(() => ncRecipientsFor(audience, projectId), [audience, projectId]);

  const recipientList = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pool.filter(
      (r) => !q || r.name.toLowerCase().includes(q) || String(r.id).toLowerCase().includes(q) || String(r.meta).toLowerCase().includes(q)
    );
  }, [pool, query]);

  const toggle = (r) =>
    setSelected((prev) => {
      const exists = prev.find((x) => x.id === r.id);
      if (exists) return prev.filter((x) => x.id !== r.id);
      return [...prev, { ...r, role: NC_RECIPIENT_ROLES[0], colorIdx: prev.length % SIGNER_COLORS.length }];
    });
  const setRole = (id, role) => setSelected((prev) => prev.map((x) => (x.id === id ? { ...x, role } : x)));
  const selectAll = () =>
    setSelected((prev) => {
      const next = [...prev];
      recipientList.forEach((r) => {
        if (!next.find((x) => x.id === r.id)) next.push({ ...r, role: NC_RECIPIENT_ROLES[0], colorIdx: next.length % SIGNER_COLORS.length });
      });
      return next;
    });

  // pick a template resets any recipients (audience may change)
  const chooseTemplate = (t) => {
    setTemplateId(t.id);
    setSelected([]);
    setProjectId("");
  };

  const canNext =
    step === 1
      ? !!templateId
      : step === 2
        ? (audience !== "collaborator" || !!projectId) && selected.length > 0
        : true;
  const goNext = () => {
    if (!canNext) {
      toast.error(step === 1 ? t("wizard.toast.pickTemplate") : t("wizard.toast.selectRecipient"));
      return;
    }
    if (step === 2) {
      // never advance with term errors — they show under their inputs
      setTermTouched(true);
      const errs = validateContractTerm(t, term);
      setTermErrors(errs);
      if (Object.keys(errs).length) return;
    }
    setStep((s) => Math.min(3, s + 1));
  };
  const goBack = () => (step === 1 ? navigate("/admin/new-contracts") : setStep((s) => s - 1));

  const handleSend = async () => {
    if (!template || selected.length === 0) return;
    const errs = validateContractTerm(t, term);
    if (Object.keys(errs).length) {
      setTermTouched(true);
      setTermErrors(errs);
      setStep(2);
      return;
    }
    setSending(true);
    try {
      // one contract per recipient, as the send endpoint did
      ncStore.addContracts(ncBuildSentContracts(template, selected));
      toast.success(t("wizard.toast.sent", { count: selected.length }));
      navigate("/admin/new-contracts");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="pb-10">
      {/* breadcrumb */}
      <div className="mb-6">
        <div className="flex items-center gap-1.5 text-sm mb-2">
          <Link to="/admin/new-contracts" className="text-gray-400 hover:text-cyan-600 transition-colors">{t("wizard.breadcrumb.contracts")}</Link>
          <MdOutlineChevronRight className="text-gray-300" />
          <span className="text-cyan-600 font-semibold">{t("wizard.breadcrumb.sendContract")}</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{template ? template.name : t("wizard.title")}</h1>
        <p className="text-sm text-gray-500 mt-1">{t("wizard.subtitle")}</p>
      </div>

      {/* stepper */}
      <div className="bg-white border border-gray-200 rounded-2xl px-4 sm:px-6 py-4 mb-6">
        <div className="flex items-center">
          {STEPS.map((s, i) => {
            const done = step > s.id;
            const active = step === s.id;
            return (
              <React.Fragment key={s.id}>
                <button onClick={() => s.id < step && setStep(s.id)} className={`flex items-center gap-2.5 ${s.id < step ? "cursor-pointer" : "cursor-default"}`}>
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                    done ? "bg-cyan-600 text-white" : active ? "bg-cyan-50 text-cyan-600 ring-2 ring-cyan-500" : "bg-gray-100 text-gray-400"
                  }`}>
                    {done ? <MdCheck /> : s.id}
                  </span>
                  <span className={`hidden sm:block text-sm font-semibold ${active ? "text-gray-900" : done ? "text-gray-600" : "text-gray-400"}`}>{t(s.labelKey)}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <div className="flex-1 mx-2 sm:mx-4 h-0.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full bg-cyan-500 transition-all duration-500 ${step > s.id ? "w-full" : "w-0"}`} />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* ── STEP 1: choose template ── */}
      {step === 1 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <MdOutlineLayers className="text-xl text-[#20B2AA]" />
              <h2 className="text-base font-bold text-gray-900">{t("wizard.template.title")}</h2>
            </div>
            <button
              onClick={() => navigate("/admin/new-contracts/templates/build")}
              className="flex items-center gap-1.5 text-sm font-semibold text-cyan-600 hover:text-cyan-700"
            >
              <MdOutlineAdd /> {t("wizard.template.newTemplate")}
            </button>
          </div>

          {templates.length === 0 ? (
            <div className="border border-dashed border-gray-300 rounded-xl p-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center mx-auto mb-4">
                <MdOutlineDescription className="text-3xl text-gray-300" />
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-1">{t("wizard.template.emptyTitle")}</h3>
              <p className="text-sm text-gray-500 max-w-sm mx-auto mb-5">{t("wizard.template.emptyDescription")}</p>
              <button
                onClick={() => navigate("/admin/new-contracts/templates/build")}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#20B2AA] hover:bg-[#1C9D96] rounded-lg"
              >
                <MdOutlineAdd /> {t("actions.createTemplate")}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((tpl) => {
                const a = AUD[tpl.audience] || AUD.employee;
                const AudIcon = a.icon;
                const on = templateId === tpl.id;
                const dbCount = (tpl.fields || []).filter((f) => f.type === "db").length;
                const signCount = (tpl.fields || []).filter((f) => f.type === "signature").length;
                return (
                  <button
                    key={tpl.id}
                    onClick={() => chooseTemplate(tpl)}
                    className={`text-left rounded-2xl border-2 p-4 transition-all ${
                      on ? "border-cyan-400 ring-2 ring-cyan-100 bg-cyan-50/30" : "border-gray-200 hover:border-cyan-300 hover:shadow-md"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${a.chip}`}>
                        <AudIcon className="text-xs" /> {t(a.labelKey)}
                      </span>
                      {on && <MdCheck className="text-cyan-600 text-lg" />}
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900 truncate">{tpl.name}</h3>
                    <p className="text-[11px] text-gray-400 mt-0.5 truncate">{tpl.docName || t("wizard.template.noDocument")}</p>
                    <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100 text-[11px] text-gray-500">
                      <span className="inline-flex items-center gap-1"><MdOutlineDataObject className="text-cyan-500" /> {t("wizard.template.columns", { count: dbCount })}</span>
                      <span className="inline-flex items-center gap-1"><MdOutlineDraw className="text-violet-500" /> {t("wizard.template.sign", { count: signCount })}</span>
                      <span className="ml-auto">{t("common.fieldsCount", { count: (tpl.fields || []).length })}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── STEP 2: recipients ── */}
      {step === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-900 mb-1">{t("wizard.recipients.title")}</h2>
                <p className="text-sm text-gray-500"><Trans t={t} i18nKey="wizard.recipients.subtitle" values={{ audience: audLabel }} components={{ b: <b /> }} /></p>
              </div>
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${aud.chip}`}>
                <aud.icon className="text-sm" /> {audLabel}
              </span>
            </div>

            {audience === "collaborator" && (
              <div className="p-4 border-b border-gray-100">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{t("wizard.recipients.project")}</label>
                <select
                  value={projectId}
                  onChange={(e) => { setProjectId(e.target.value); setSelected([]); }}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">{t("wizard.recipients.selectProject")}</option>
                  {collabProjects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-400 mt-1">{t("wizard.recipients.projectHint")}</p>
              </div>
            )}

            <div className="p-4">
              <div className="relative">
                <MdOutlineSearch className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg pointer-events-none" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("wizard.recipients.filterPlaceholder")}
                  className="w-full ps-10 pe-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
                />
              </div>
            </div>

            {/* select-all */}
            <div className="flex items-center justify-between px-5 pb-3">
              <span className="text-xs text-gray-400">
                <span className="font-semibold text-gray-600">{recipientList.length}</span> {t("wizard.recipients.shown")} ·{" "}
                <span className="font-semibold text-cyan-600">{selected.length}</span> {t("wizard.recipients.selected")}
              </span>
              <div className="flex items-center gap-2">
                <button onClick={selectAll} className="text-xs font-semibold text-cyan-600 hover:text-cyan-700">{t("wizard.recipients.selectAll")}</button>
                <span className="text-gray-200">|</span>
                <button onClick={() => setSelected([])} className="text-xs font-semibold text-gray-400 hover:text-gray-600">{t("actions.clear")}</button>
              </div>
            </div>

            <div className="max-h-[460px] overflow-y-auto custom-scrollbar divide-y divide-gray-50">
              {recipientList.map((r) => {
                const on = selected.some((x) => x.id === r.id);
                return (
                  <button key={r.id} onClick={() => toggle(r)} className={`w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors ${on ? "bg-cyan-50/50" : "hover:bg-gray-50"}`}>
                    <span className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${on ? "bg-cyan-600 border-cyan-600 text-white" : "border-gray-300"}`}>
                      {on && <MdCheck className="text-sm" />}
                    </span>
                    <span className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${r.color}`}>{r.initials}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{r.name}</p>
                      <p className="text-[11px] text-gray-400">{r.id} · {r.email}</p>
                    </div>
                    <span className="hidden sm:inline text-[11px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{r.meta}</span>
                  </button>
                );
              })}
              {recipientList.length === 0 && (
                <div className="px-5 py-12 text-center text-sm text-gray-400">
                  {t("wizard.recipients.noRecords", { audience: audLabel.toLowerCase() })}
                </div>
              )}
            </div>
          </div>

          {/* selected panel */}
          <aside className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-900">{t("wizard.recipients.selectedTitle")}</h3>
                <span className="text-xs font-bold text-white bg-cyan-600 rounded-full px-2 py-0.5">{selected.length}</span>
              </div>
              {selected.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center mx-auto mb-3">
                    <MdOutlinePerson className="text-2xl text-gray-300" />
                  </div>
                  <p className="text-xs text-gray-400">{t("wizard.recipients.noneSelected")}</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[360px] overflow-y-auto custom-scrollbar pr-1">
                  {selected.map((r) => (
                    <div key={r.id} className="p-3 rounded-xl border border-gray-200">
                      <div className="flex items-center gap-2.5 mb-2.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${SIGNER_COLORS[r.colorIdx].solid}`} />
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold ${r.color}`}>{r.initials}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{r.name}</p>
                          <p className="text-[11px] text-gray-400 truncate">{r.email}</p>
                        </div>
                        <button onClick={() => toggle(r)} className="text-gray-300 hover:text-rose-500"><MdClose /></button>
                      </div>
                      <select
                        value={r.role}
                        onChange={(e) => setRole(r.id, e.target.value)}
                        className="w-full text-xs px-2.5 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      >
                        {NC_RECIPIENT_ROLES.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-gray-900 mb-3">{t("wizard.recipients.signingLogic")}</h3>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-gray-600">{t("wizard.recipients.signInOrder")}</span>
                <span onClick={() => setSigningOrder((v) => !v)} className={`relative w-10 rounded-full transition-colors ${signingOrder ? "bg-cyan-600" : "bg-gray-200"}`} style={{ height: "22px" }}>
                  <span className={`absolute top-0.5 left-0.5 w-[18px] h-[18px] rounded-full bg-white shadow transition-transform ${signingOrder ? "translate-x-[18px]" : ""}`} />
                </span>
              </label>
              <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">{t("wizard.recipients.signInOrderHint")}</p>
            </div>
          </aside>

          {/* contract term — start / end / renewal due (optional) */}
          <section className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl p-5 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <MdOutlineEventNote className="text-xl text-[#20B2AA]" />
              <h3 className="text-base font-bold text-gray-900">{t("contracts:details.contractDates")}</h3>
            </div>
            <p className="text-xs text-gray-500 mb-4">{t("contracts:term.hint")}</p>
            <ContractTermFields values={term} errors={termErrors} onChange={changeTerm} disabled={sending} />
          </section>
        </div>
      )}

      {/* ── STEP 3: review & send ── */}
      {step === 3 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <section className="bg-white border border-gray-200 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-5">
                <MdOutlineVerifiedUser className="text-xl text-[#20B2AA]" />
                <h2 className="text-base font-bold text-gray-900">{t("wizard.review.title")}</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ReviewItem label={t("wizard.review.template")} value={template?.name || "—"} />
                <ReviewItem label={t("wizard.review.for")} value={audLabel} />
                <ReviewItem label={t("wizard.review.document")} value={template?.docName || "—"} />
                <ReviewItem label={t("wizard.review.fields")} value={String((template?.fields || []).length)} />
                <ReviewItem label={t("wizard.review.recipients")} value={String(selected.length)} />
                <ReviewItem label={t("wizard.review.signing")} value={signingOrder ? t("wizard.review.inOrder") : t("wizard.review.parallel")} />
                <ReviewItem
                  label={t("contracts:details.contractDates")}
                  value={
                    term.start_date
                      ? term.end_date
                        ? `${fmtDate(term.start_date)} – ${fmtDate(term.end_date)}`
                        : t("contracts:details.indefiniteRange", { start: fmtDate(term.start_date) })
                      : "—"
                  }
                />
                <ReviewItem label={t("contracts:term.renewalDue")} value={term.renewal_due ? fmtDate(term.renewal_due) : "—"} />
              </div>
            </section>

            <section className="bg-white border border-gray-200 rounded-2xl p-6">
              <h3 className="text-sm font-bold text-gray-900 mb-4">{t("wizard.review.recipients")}</h3>
              <div className="space-y-2.5 max-h-[340px] overflow-y-auto custom-scrollbar pr-1">
                {selected.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100">
                    <span className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold ${r.color}`}>{r.initials}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{r.name}</p>
                      <p className="text-[11px] text-gray-400 truncate">{r.email}</p>
                    </div>
                    <span className="text-[11px] font-semibold text-cyan-700 bg-cyan-50 px-2.5 py-1 rounded-full">{roleLabel(r.role)}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* send panel */}
          <aside className="space-y-4">
            <div className="bg-[#1e293b] text-white rounded-2xl p-6 shadow-md border border-slate-700 lg:sticky lg:top-4">
              <h2 className="text-lg font-bold mb-5">{t("wizard.review.readyToSend")}</h2>
              <div className="space-y-3 mb-6">
                <div className="flex justify-between items-center pb-3 border-b border-slate-600/50">
                  <span className="text-sm text-slate-400">{t("wizard.review.recipients")}</span>
                  <span className="text-sm font-semibold">{selected.length}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-slate-600/50">
                  <span className="text-sm text-slate-400">{t("wizard.review.fields")}</span>
                  <span className="text-sm font-semibold">{(template?.fields || []).length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-400">{t("wizard.review.delivery")}</span>
                  <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-300 text-[10px] font-bold tracking-wider rounded">{t("wizard.review.deliveryValue")}</span>
                </div>
              </div>
              <button
                onClick={handleSend}
                disabled={sending}
                className="w-full flex items-center justify-center gap-2 bg-[#20B2AA] hover:bg-[#1C9D96] disabled:opacity-70 text-white py-3 rounded-lg text-sm font-bold transition-colors"
              >
                {sending ? (
                  <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> {t("wizard.review.sending")}</>
                ) : (
                  <><MdOutlineSend className="text-lg" /> {t("wizard.review.sendToPortal")}</>
                )}
              </button>
              <div className="flex items-start gap-2 mt-5 text-slate-400">
                <MdOutlineMailOutline className="text-lg flex-shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">{t("wizard.review.deliveryNote")}</p>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* footer nav */}
      <div className="flex items-center justify-between mt-6 bg-white border border-gray-200 rounded-2xl px-5 py-4">
        <button onClick={goBack} className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors">
          <MdOutlineArrowBack /> {step === 1 ? t("actions.cancel") : t("actions.back")}
        </button>
        {step < 3 ? (
          <button
            onClick={goNext}
            className={`flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white rounded-lg transition-all ${
              canNext ? "bg-gradient-to-r from-[#20B2AA] to-cyan-500 hover:from-[#1C9D96] hover:to-cyan-600 shadow-sm shadow-cyan-200" : "bg-gray-300 cursor-not-allowed"
            }`}
          >
            {t("actions.continue")} <MdOutlineArrowForward />
          </button>
        ) : (
          <button onClick={handleSend} disabled={sending} className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-[#20B2AA] hover:bg-[#1C9D96] rounded-lg transition-colors disabled:opacity-70">
            <MdOutlineSend /> {t("actions.send")}
          </button>
        )}
      </div>
    </div>
  );
}

function ReviewItem({ label, value }) {
  return (
    <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm font-semibold text-gray-900 truncate">{value}</p>
    </div>
  );
}
