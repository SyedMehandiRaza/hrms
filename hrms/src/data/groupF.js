// Static data for the contract screens (group F):
//  - legacy contracts  (pages/contract)          → LEGACY_* (API shape)
//  - contract types    (pages/contracts)         → contract-type store
//  - Contract Studio   (pages/newContract)       → NC_SEED_* + helpers
// Nothing here talks to a backend.
import { useSyncExternalStore } from "react";
import { EMPLOYEES, PROJECTS } from "./common";

const COLORS = [
  "bg-cyan-50 text-cyan-600",
  "bg-indigo-50 text-indigo-600",
  "bg-amber-50 text-amber-600",
  "bg-rose-50 text-rose-600",
  "bg-emerald-50 text-emerald-600",
  "bg-purple-50 text-purple-600",
];

export const initialsOf = (name = "") =>
  String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "??";

export const fmtShortDate = (d) => {
  try {
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
  } catch {
    return "";
  }
};

const emp = (id) => EMPLOYEES.find((e) => e.id === id);

// ════════════════════════════════════════════════════════════════
//  Staffing companies & collaborators (recipients)
// ════════════════════════════════════════════════════════════════
export const NC_STAFFING_COMPANIES = [
  { id: 1, code: "SC-1001", name: "Gulf Manpower Services", email: "ops@gulfmanpower.ae", phone: "+971 4 335 1200", city: "Dubai", status: "ACTIVE" },
  { id: 2, code: "SC-1002", name: "Al Noor Staffing LLC", email: "contracts@alnoorstaffing.ae", phone: "+971 2 644 8810", city: "Abu Dhabi", status: "ACTIVE" },
  { id: 3, code: "SC-1003", name: "Najd Workforce Co.", email: "hr@najdworkforce.sa", phone: "+966 11 460 2299", city: "Riyadh", status: "ACTIVE" },
  { id: 4, code: "SC-1004", name: "Desert Rose Recruitment", email: "info@desertrose.qa", phone: "+974 4433 9087", city: "Doha", status: "INACTIVE" },
];

// Partner companies per project (collaborator audience).
const COLLAB_PARTNERS = {
  1: [
    { id: 101, name: "Emaar Properties", email: "procurement@emaar.ae", relation: "Parent", role: "Client" },
    { id: 102, name: "Skyline Consultants", email: "contact@skylineconsult.ae", relation: "Parent", role: "Consultant" },
    { id: 103, name: "Gulf MEP Contracting", email: "projects@gulfmep.ae", relation: "Child", role: "Sub-contractor" },
  ],
  2: [
    { id: 104, name: "Aldar Properties", email: "vendors@aldar.com", relation: "Parent", role: "Client" },
    { id: 105, name: "Capital Interiors LLC", email: "info@capitalinteriors.ae", relation: "Child", role: "Sub-contractor" },
  ],
  3: [
    { id: 106, name: "Riyadh Transit JV", email: "contracts@rtjv.sa", relation: "Parent", role: "EPC" },
    { id: 107, name: "Najd Rail Services", email: "ops@najdrail.sa", relation: "Child", role: "Sub-contractor" },
  ],
};

export const NC_COLLAB_PROJECTS = PROJECTS.filter((p) => COLLAB_PARTNERS[p.id]).map((p) => ({ id: p.id, name: p.name }));

// Recipient pool for the send wizard (same shape the API mapper produced).
export const ncRecipientsFor = (audience, projectId) => {
  if (audience === "collaborator") {
    if (!projectId) return [];
    return (COLLAB_PARTNERS[projectId] || []).map((c) => ({
      id: `COMP-${c.id}`,
      serverId: c.id,
      name: c.name,
      email: c.email,
      phone: "",
      meta: `${c.relation} · ${c.role}`,
      initials: initialsOf(c.name),
      color: COLORS[c.id % COLORS.length],
      status: "active",
    }));
  }
  if (audience === "staffing") {
    return NC_STAFFING_COMPANIES.map((s) => ({
      id: s.code,
      serverId: s.id,
      name: s.name,
      email: s.email,
      phone: s.phone,
      meta: s.city,
      initials: initialsOf(s.name),
      color: COLORS[s.id % COLORS.length],
      status: s.status === "ACTIVE" ? "active" : "pending",
    }));
  }
  return EMPLOYEES.map((e) => ({
    id: e.employee_code,
    serverId: e.id,
    name: e.full_name,
    email: e.email,
    phone: e.phone,
    meta: e.department?.name || e.designation?.name || "—",
    initials: initialsOf(e.full_name),
    color: COLORS[e.id % COLORS.length],
    status: e.status === "ACTIVE" ? "active" : "pending",
  }));
};

// ════════════════════════════════════════════════════════════════
//  Contract Studio — documents, templates, contracts
// ════════════════════════════════════════════════════════════════
export const NC_SEED_DOCUMENTS = [
  { id: "doc_1", name: "Employment Agreement - UAE.pdf", fileUrl: null, size: "1.2", pages: 3, uploadedAt: "Sep 28, 2026", status: "Saved", ext: "pdf" },
  { id: "doc_2", name: "Offer Letter.pdf", fileUrl: null, size: "0.4", pages: 1, uploadedAt: "Sep 25, 2026", status: "Saved", ext: "pdf" },
  { id: "doc_3", name: "Manpower Supply Agreement.pdf", fileUrl: null, size: "2.4", pages: 5, uploadedAt: "Sep 18, 2026", status: "Saved", ext: "pdf" },
  { id: "doc_4", name: "Mutual NDA.docx", fileUrl: null, size: "0.6", pages: 2, uploadedAt: "Sep 10, 2026", status: "Saved", ext: "docx" },
  { id: "doc_5", name: "Sub-contract Agreement - Marina Tower.pdf", fileUrl: null, size: "3.1", pages: 4, uploadedAt: "Aug 30, 2026", status: "Saved", ext: "pdf" },
  { id: "doc_6", name: "Accommodation Undertaking.docx", fileUrl: null, size: "0.3", pages: 1, uploadedAt: "Aug 12, 2026", status: "Archived", ext: "docx" },
];

export const NC_SEED_TEMPLATES = [
  {
    id: "tpl_1",
    serverId: 1,
    name: "Standard Employment Contract",
    docId: "doc_1",
    docName: "Employment Agreement - UAE.pdf",
    audience: "employee",
    pages: 3,
    fields: [
      { id: "f1_1", page: 1, type: "db", token: "employee_name", label: "Full Name", fieldKey: "", checkedValue: "", x: 30, y: 22, required: true },
      { id: "f1_2", page: 1, type: "db", token: "job_title", label: "Job Title", fieldKey: "", checkedValue: "", x: 55, y: 32, required: true },
      { id: "f1_3", page: 1, type: "db", token: "salary", label: "Monthly Salary", fieldKey: "", checkedValue: "", x: 30, y: 42, required: true },
      { id: "f1_4", page: 2, type: "input", token: null, label: "Emergency Contact", fieldKey: "emergency_contact", checkedValue: "", x: 25, y: 40, required: true },
      { id: "f1_5", page: 3, type: "checkbox", token: null, label: "I accept the terms", fieldKey: "", checkedValue: "Accepted", x: 20, y: 70, required: true },
      { id: "f1_6", page: 3, type: "signature", token: null, label: "Employee Signature", fieldKey: "", checkedValue: "", x: 20, y: 86, required: true },
    ],
    updatedAt: "Oct 02, 2026",
  },
  {
    id: "tpl_2",
    serverId: 2,
    name: "Offer Letter",
    docId: "doc_2",
    docName: "Offer Letter.pdf",
    audience: "employee",
    pages: 1,
    fields: [
      { id: "f2_1", page: 1, type: "db", token: "employee_name", label: "Full Name", fieldKey: "", checkedValue: "", x: 18, y: 20, required: true },
      { id: "f2_2", page: 1, type: "db", token: "joining_date", label: "Joining Date", fieldKey: "", checkedValue: "", x: 55, y: 30, required: true },
      { id: "f2_3", page: 1, type: "signature", token: null, label: "Candidate Signature", fieldKey: "", checkedValue: "", x: 20, y: 84, required: true },
    ],
    updatedAt: "Sep 26, 2026",
  },
  {
    id: "tpl_3",
    serverId: 3,
    name: "Manpower Supply MSA",
    docId: "doc_3",
    docName: "Manpower Supply Agreement.pdf",
    audience: "staffing",
    pages: 5,
    fields: [
      { id: "f3_1", page: 1, type: "db", token: "company_name", label: "Company Name", fieldKey: "", checkedValue: "", x: 30, y: 18, required: true },
      { id: "f3_2", page: 1, type: "db", token: "contact_person_name", label: "Contact Person", fieldKey: "", checkedValue: "", x: 30, y: 26, required: true },
      { id: "f3_3", page: 2, type: "input", token: null, label: "Trade Licence No.", fieldKey: "trade_licence", checkedValue: "", x: 30, y: 35, required: true },
      { id: "f3_4", page: 4, type: "checkbox", token: null, label: "WPS compliant", fieldKey: "", checkedValue: "Yes", x: 22, y: 60, required: false },
      { id: "f3_5", page: 5, type: "signature", token: null, label: "Authorised Signatory", fieldKey: "", checkedValue: "", x: 20, y: 82, required: true },
    ],
    updatedAt: "Sep 19, 2026",
  },
  {
    id: "tpl_4",
    serverId: 4,
    name: "Employee NDA",
    docId: "doc_4",
    docName: "Mutual NDA.docx",
    audience: "employee",
    pages: 2,
    fields: [
      { id: "f4_1", page: 1, type: "db", token: "employee_name", label: "Full Name", fieldKey: "", checkedValue: "", x: 28, y: 24, required: true },
      { id: "f4_2", page: 2, type: "signature", token: null, label: "Signature", fieldKey: "", checkedValue: "", x: 22, y: 80, required: true },
    ],
    updatedAt: "Sep 11, 2026",
  },
  {
    id: "tpl_5",
    serverId: 5,
    name: "Sub-contract Agreement",
    docId: "doc_5",
    docName: "Sub-contract Agreement - Marina Tower.pdf",
    audience: "collaborator",
    pages: 4,
    fields: [
      { id: "f5_1", page: 1, type: "db", token: "company_name", label: "Company Name", fieldKey: "", checkedValue: "", x: 30, y: 20, required: true },
      { id: "f5_2", page: 2, type: "input", token: null, label: "Contract Value (AED)", fieldKey: "contract_value", checkedValue: "", x: 30, y: 45, required: true },
      { id: "f5_3", page: 4, type: "signature", token: null, label: "Authorised Signatory", fieldKey: "", checkedValue: "", x: 20, y: 85, required: true },
    ],
    updatedAt: "Aug 31, 2026",
  },
];

// recipient helper for seeded contracts
const R = (name, email, status, extra = {}) => ({ name, email, status, role: "PRIMARY_SIGNER", ...extra });

const contract = (id, serverId, templateId, audience, status, sentDate, recipients) => {
  const tpl = NC_SEED_TEMPLATES.find((t) => t.id === templateId);
  const first = recipients[0];
  return {
    id,
    serverId,
    templateId,
    name: tpl.name,
    recipient: recipients.length > 1 ? `${first.name} +${recipients.length - 1}` : first.name,
    recipientsCount: recipients.length,
    initials: initialsOf(first.name),
    color: COLORS[serverId % COLORS.length],
    module: "Contracts",
    audience,
    sentDate,
    status,
    fields: tpl.fields.length,
    pages: tpl.pages,
    recipientsList: recipients,
  };
};

const e = (id) => emp(id);
export const NC_SEED_CONTRACTS = [
  contract("CT-2026-0112", 12, "tpl_1", "employee", "Sent", "Oct 15, 2026", [R(e(12).full_name, e(12).email, "SENT", { employee_id: 12 })]),
  contract("CT-2026-0111", 11, "tpl_2", "employee", "Viewed", "Oct 13, 2026", [R(e(9).full_name, e(9).email, "VIEWED", { employee_id: 9 })]),
  contract("CT-2026-0110", 10, "tpl_3", "staffing", "Signed", "Oct 09, 2026", [
    R("Gulf Manpower Services", "ops@gulfmanpower.ae", "SUBMITTED", { staffing_company_id: 1 }),
    R("Fatima Al Zahra", "fatima.alzahra@fyinder.com", "VIEWED", { role: "APPROVER", employee_id: 2 }),
  ]),
  contract("CT-2026-0109", 9, "tpl_1", "employee", "Completed", "Oct 02, 2026", [R(e(6).full_name, e(6).email, "SUBMITTED", { employee_id: 6 })]),
  contract("CT-2026-0108", 8, "tpl_4", "employee", "Draft", "Sep 30, 2026", [R(e(3).full_name, e(3).email, "PENDING", { employee_id: 3 })]),
  contract("CT-2026-0107", 7, "tpl_5", "collaborator", "Sent", "Sep 27, 2026", [R("Gulf MEP Contracting", "projects@gulfmep.ae", "SENT")]),
  contract("CT-2026-0106", 6, "tpl_3", "staffing", "Rejected", "Sep 21, 2026", [R("Najd Workforce Co.", "hr@najdworkforce.sa", "DECLINED", { staffing_company_id: 3 })]),
  contract("CT-2026-0105", 5, "tpl_2", "employee", "Expired", "Aug 18, 2026", [R(e(10).full_name, e(10).email, "VIEWED", { employee_id: 10 })]),
  contract("CT-2026-0104", 4, "tpl_1", "employee", "Signed", "Aug 05, 2026", [R(e(7).full_name, e(7).email, "SUBMITTED", { employee_id: 7 })]),
  contract("CT-2026-0103", 3, "tpl_4", "employee", "Completed", "Jul 22, 2026", [R(e(8).full_name, e(8).email, "SUBMITTED", { employee_id: 8 })]),
  contract("CT-2026-0102", 2, "tpl_3", "staffing", "Viewed", "Jul 10, 2026", [R("Al Noor Staffing LLC", "contracts@alnoorstaffing.ae", "VIEWED", { staffing_company_id: 2 })]),
  contract("CT-2026-0101", 1, "tpl_1", "employee", "Completed", "Jun 14, 2026", [R(e(5).full_name, e(5).email, "SUBMITTED", { employee_id: 5 })]),
];

// Recipient inbox (MyContracts): employee portal vs staffing-company portal.
const inbox = (c, status, myRecipientId) => ({ ...c, status, myRecipientId });
export const NC_SEED_MY_CONTRACTS = {
  employee: [
    inbox({ ...contract("CT-2026-0120", 20, "tpl_1", "employee", "Sent", "Oct 16, 2026", [R("Sara Khan", "sara.khan@fyinder.com", "SENT", { employee_id: 4 })]), module: "Company" }, "Sent", 2001),
    inbox({ ...contract("CT-2026-0118", 18, "tpl_4", "employee", "Viewed", "Oct 08, 2026", [R("Sara Khan", "sara.khan@fyinder.com", "VIEWED", { employee_id: 4 })]), module: "Company" }, "Viewed", 2002),
    inbox({ ...contract("CT-2026-0098", 98, "tpl_2", "employee", "Signed", "Mar 02, 2026", [R("Sara Khan", "sara.khan@fyinder.com", "SUBMITTED", { employee_id: 4 })]), module: "Company" }, "Signed", 2003),
    inbox({ ...contract("CT-2025-0044", 44, "tpl_1", "employee", "Completed", "Jun 01, 2025", [R("Sara Khan", "sara.khan@fyinder.com", "SUBMITTED", { employee_id: 4 })]), module: "Company" }, "Completed", 2004),
  ],
  staffing: [
    inbox({ ...contract("CT-2026-0110", 10, "tpl_3", "staffing", "Signed", "Oct 09, 2026", [R("Gulf Manpower Services", "ops@gulfmanpower.ae", "SUBMITTED", { staffing_company_id: 1 })]), module: "Company" }, "Signed", 3001),
    inbox({ ...contract("CT-2026-0121", 21, "tpl_3", "staffing", "Sent", "Oct 14, 2026", [R("Gulf Manpower Services", "ops@gulfmanpower.ae", "SENT", { staffing_company_id: 1 })]), module: "Company" }, "Sent", 3002),
    inbox({ ...contract("CT-2026-0090", 90, "tpl_3", "staffing", "Completed", "Feb 11, 2026", [R("Gulf Manpower Services", "ops@gulfmanpower.ae", "SUBMITTED", { staffing_company_id: 1 })]), module: "Company" }, "Completed", 3003),
  ],
};

export const NC_ACTIVITY_FEED = [
  { id: 1, icon: "sent", tone: "cyan", text: "Standard Employment Contract sent to Bilal Ahmed", time: "Oct 15, 2026" },
  { id: 2, icon: "viewed", tone: "sky", text: "Offer Letter viewed by Imran Sheikh", time: "Oct 14, 2026" },
  { id: 3, icon: "signed", tone: "emerald", text: "Manpower Supply MSA signed by Gulf Manpower Services", time: "Oct 10, 2026" },
  { id: 4, icon: "signed", tone: "emerald", text: "Standard Employment Contract approved for Maria Santos", time: "Oct 04, 2026" },
  { id: 5, icon: "rejected", tone: "rose", text: "Manpower Supply MSA declined by Najd Workforce Co.", time: "Sep 23, 2026" },
  { id: 6, icon: "rejected", tone: "rose", text: "Offer Letter expired for Joseph Mathew", time: "Sep 17, 2026" },
];

// Stats in the API's shape, derived from the current contract list.
export const ncStatsOf = (contracts) => {
  const by = (s) => contracts.filter((c) => c.status === s).length;
  return {
    total: contracts.length,
    draft: by("Draft"),
    pending: by("Sent") + by("Viewed") + by("Pending"),
    submitted: by("Signed"),
    approved: 0,
    completed: by("Completed"),
    rejected: by("Rejected"),
    expired: by("Expired"),
    byStatus: { VIEWED: by("Viewed") },
  };
};

// Sample values for DB-column merge fields, per recipient.
const dbValue = (token, r, audience) => {
  const e = r.employee_id ? emp(r.employee_id) : null;
  const s = r.staffing_company_id ? NC_STAFFING_COMPANIES.find((x) => x.id === r.staffing_company_id) : null;
  const map = {
    employee_name: e?.full_name || r.name,
    employee_email: e?.email || r.email,
    job_title: e?.designation?.name || "Site Supervisor",
    department: e?.department?.name || "Operations",
    joining_date: e?.date_of_joining || "2026-11-01",
    salary: e ? `AED ${e.gross_salary.toLocaleString("en-US")}` : "AED 12,000",
    company_name: s?.name || r.name,
    contact_person_name: audience === "staffing" ? "Rashid Al Hammadi" : "Imran Ali",
  };
  return map[token] ?? r.name;
};

const FT = { input: "INPUT", checkbox: "CHECKBOX", signature: "SIGNATURE", db: "DB_COLUMN" };
const DONE_RECIP = ["SIGNED", "SUBMITTED"];

// Full contract detail (recipients + fields) in the API's shape, personalised
// for one recipient (defaults to the first).
export const ncContractDetail = (c, recipientId) => {
  const tpl = c.template || NC_SEED_TEMPLATES.find((t) => t.id === c.templateId) || NC_SEED_TEMPLATES[0];
  const list = c.recipientsList || [];
  const recipients = list.map((r, i) => ({
    id: c.serverId * 100 + i + 1,
    recipient_name: r.name,
    recipient_email: r.email,
    role: r.role,
    status: r.status,
    employee_id: r.employee_id || null,
    staffing_company_id: r.staffing_company_id || null,
  }));
  const current = recipients.find((r) => String(r.id) === String(recipientId)) || recipients[0];
  const src = list[recipients.indexOf(current)] || list[0] || {};
  const done = current && DONE_RECIP.includes(current.status);
  const fields = tpl.fields.map((f, i) => {
    let value = null;
    if (f.type === "db") value = dbValue(f.token, src, c.audience);
    else if (done && f.type === "input") value = f.fieldKey === "contract_value" ? "AED 1,250,000" : f.fieldKey === "trade_licence" ? "DED-784512" : "+971 50 412 7788";
    else if (done && f.type === "checkbox") value = f.checkedValue || "Yes";
    else if (done && f.type === "signature") value = src.name;
    return {
      id: c.serverId * 1000 + i + 1,
      field_type: FT[f.type] || "INPUT",
      page_no: f.page,
      pos_x: f.x,
      pos_y: f.y,
      label: f.label,
      db_column: f.token,
      checked_value: f.checkedValue || null,
      is_required: f.required !== false,
      value,
    };
  });
  return { id: c.serverId, page_count: tpl.pages, document: null, recipients, fields };
};

// One contract per recipient, as the send endpoint created them.
let sentSeq = 130;
export const ncBuildSentContracts = (template, recipients) =>
  recipients.map((r) => {
    sentSeq += 1;
    return {
      id: `CT-2026-0${sentSeq}`,
      serverId: sentSeq,
      templateId: template.id,
      template: { fields: template.fields || [], pages: template.pages || 1 },
      name: template.name,
      recipient: r.name,
      recipientsCount: 1,
      initials: initialsOf(r.name),
      color: r.color || COLORS[0],
      module: "Contracts",
      audience: template.audience,
      sentDate: fmtShortDate(new Date()),
      status: "Sent",
      fields: (template.fields || []).length,
      pages: template.pages,
      recipientsList: [
        {
          name: r.name,
          email: r.email,
          status: "SENT",
          role: { "Primary Signer": "PRIMARY_SIGNER", Approver: "APPROVER", "Viewer (CC)": "VIEWER", Witness: "WITNESS" }[r.role] || "PRIMARY_SIGNER",
          employee_id: template.audience === "employee" ? r.serverId : null,
          staffing_company_id: template.audience === "staffing" ? r.serverId : null,
        },
      ],
    };
  });

// ════════════════════════════════════════════════════════════════
//  Legacy contracts (/admin/contracts) — API shape
// ════════════════════════════════════════════════════════════════
export const LEGACY_CONTRACT_TEMPLATES = [
  { id: 1, name: "Standard Employment Contract", status: "ACTIVE" },
  { id: 2, name: "Offer Letter", status: "ACTIVE" },
  { id: 4, name: "Employee NDA", status: "ACTIVE" },
  { id: 6, name: "Probation Extension Letter", status: "ACTIVE" },
];

const lr = (id, empId, role, status) => {
  const p = emp(empId);
  return { id, employee_id: empId, recipient_name: p.full_name, recipient_email: p.email, role, status };
};
const act = (id, action, description, created_at) => ({ id, action, description, created_at });

export const LEGACY_CONTRACTS = [
  {
    id: 1, reference_no: "CT-2026-0101", name: "Standard Employment Contract", status: "COMPLETED", template_id: 1,
    start_date: "2026-06-15", end_date: "2028-06-14", renewal_due: "2028-04-15",
    sent_at: "2026-06-14T09:10:00Z", submitted_at: "2026-06-16T11:20:00Z", approved_at: "2026-06-17T08:05:00Z",
    created_at: "2026-06-14T09:00:00Z", updated_at: "2026-06-17T08:05:00Z", notes: "Two-year limited contract as per UAE Labour Law.",
    recipients: [lr(11, 5, "PRIMARY_SIGNER", "SUBMITTED")],
    activities: [
      act(1, "CREATED", "Contract created from Standard Employment Contract", "2026-06-14T09:00:00Z"),
      act(2, "SENT", "Sent to Youssef Nasser", "2026-06-14T09:10:00Z"),
      act(3, "SUBMITTED", "Signed and submitted by Youssef Nasser", "2026-06-16T11:20:00Z"),
      act(4, "APPROVED", "Approved by Ahmed Al Mansoori", "2026-06-17T08:05:00Z"),
    ],
  },
  {
    id: 2, reference_no: "CT-2026-0104", name: "Standard Employment Contract", status: "SUBMITTED", template_id: 1,
    start_date: "2026-09-01", end_date: "2028-08-31", renewal_due: "2028-07-01",
    sent_at: "2026-08-05T10:00:00Z", submitted_at: "2026-08-07T14:30:00Z", approved_at: null,
    created_at: "2026-08-05T09:45:00Z", updated_at: "2026-08-07T14:30:00Z", notes: "",
    recipients: [lr(21, 7, "PRIMARY_SIGNER", "SUBMITTED"), lr(22, 2, "APPROVER", "VIEWED")],
    activities: [
      act(5, "CREATED", "Contract created", "2026-08-05T09:45:00Z"),
      act(6, "SENT", "Sent to Khalid Al Otaibi", "2026-08-05T10:00:00Z"),
      act(7, "VIEWED", "Viewed by Khalid Al Otaibi", "2026-08-06T07:12:00Z"),
      act(8, "SUBMITTED", "Signed and submitted by Khalid Al Otaibi", "2026-08-07T14:30:00Z"),
    ],
  },
  {
    id: 3, reference_no: "CT-2026-0111", name: "Offer Letter", status: "VIEWED", template_id: 2,
    start_date: "2026-11-01", end_date: null, renewal_due: null,
    sent_at: "2026-10-13T08:30:00Z", submitted_at: null, approved_at: null,
    created_at: "2026-10-13T08:20:00Z", updated_at: "2026-10-14T06:40:00Z", notes: "",
    recipients: [lr(31, 9, "PRIMARY_SIGNER", "VIEWED")],
    activities: [
      act(9, "SENT", "Sent to Imran Sheikh", "2026-10-13T08:30:00Z"),
      act(10, "VIEWED", "Viewed by Imran Sheikh", "2026-10-14T06:40:00Z"),
    ],
  },
  {
    id: 4, reference_no: "CT-2026-0112", name: "Standard Employment Contract", status: "SENT", template_id: 1,
    start_date: "2026-11-01", end_date: "2028-10-31", renewal_due: "2028-09-01",
    sent_at: "2026-10-15T12:00:00Z", submitted_at: null, approved_at: null,
    created_at: "2026-10-15T11:50:00Z", updated_at: "2026-10-15T12:00:00Z", notes: "Includes housing and transport allowances.",
    recipients: [lr(41, 12, "PRIMARY_SIGNER", "SENT")],
    activities: [act(11, "SENT", "Sent to Bilal Ahmed", "2026-10-15T12:00:00Z")],
  },
  {
    id: 5, reference_no: "CT-2026-0108", name: "Employee NDA", status: "DRAFT", template_id: 4,
    start_date: "", end_date: null, renewal_due: null,
    sent_at: null, submitted_at: null, approved_at: null,
    created_at: "2026-09-30T13:15:00Z", updated_at: "2026-09-30T13:15:00Z", notes: "",
    recipients: [lr(51, 3, "PRIMARY_SIGNER", "PENDING")],
    activities: [act(12, "CREATED", "Draft created", "2026-09-30T13:15:00Z")],
  },
  {
    id: 6, reference_no: "CT-2026-0105", name: "Offer Letter", status: "EXPIRED", template_id: 2,
    start_date: "2026-08-20", end_date: "2026-09-15", renewal_due: null,
    sent_at: "2026-08-18T09:00:00Z", submitted_at: null, approved_at: null,
    created_at: "2026-08-18T08:50:00Z", updated_at: "2026-09-16T00:00:00Z", notes: "",
    recipients: [lr(61, 10, "PRIMARY_SIGNER", "VIEWED")],
    activities: [
      act(13, "SENT", "Sent to Joseph Mathew", "2026-08-18T09:00:00Z"),
      act(14, "VIEWED", "Viewed by Joseph Mathew", "2026-08-19T10:00:00Z"),
      act(15, "EXPIRED", "Contract expired before signature", "2026-09-16T00:00:00Z"),
    ],
  },
  {
    id: 7, reference_no: "CT-2026-0098", name: "Probation Extension Letter", status: "SENT", template_id: 6,
    start_date: "2026-07-01", end_date: "2026-09-30", renewal_due: "2026-09-15",
    sent_at: "2026-06-28T09:00:00Z", submitted_at: null, approved_at: null,
    created_at: "2026-06-28T08:40:00Z", updated_at: "2026-06-28T09:00:00Z", notes: "Probation extended by three months.",
    recipients: [lr(71, 11, "PRIMARY_SIGNER", "SENT")],
    activities: [
      act(16, "SENT", "Sent to Layla Hassan", "2026-06-28T09:00:00Z"),
      act(17, "REMINDED", "Reminder sent to Layla Hassan", "2026-07-05T09:00:00Z"),
    ],
  },
  {
    id: 8, reference_no: "CT-2026-0095", name: "Employee NDA", status: "REJECTED", template_id: 4,
    start_date: "2026-05-01", end_date: "2027-04-30", renewal_due: null,
    sent_at: "2026-04-25T09:00:00Z", submitted_at: null, approved_at: null,
    created_at: "2026-04-25T08:30:00Z", updated_at: "2026-04-27T15:00:00Z", notes: "",
    recipients: [lr(81, 6, "PRIMARY_SIGNER", "DECLINED")],
    activities: [
      act(18, "SENT", "Sent to Maria Santos", "2026-04-25T09:00:00Z"),
      act(19, "DECLINED", "Declined by Maria Santos", "2026-04-27T15:00:00Z"),
    ],
  },
  {
    id: 9, reference_no: "CT-2026-0090", name: "Standard Employment Contract", status: "APPROVED", template_id: 1,
    start_date: "2026-02-15", end_date: "2028-02-14", renewal_due: "2027-12-15",
    sent_at: "2026-02-10T09:00:00Z", submitted_at: "2026-02-11T12:00:00Z", approved_at: "2026-02-12T08:00:00Z",
    created_at: "2026-02-10T08:45:00Z", updated_at: "2026-02-12T08:00:00Z", notes: "",
    recipients: [lr(91, 8, "PRIMARY_SIGNER", "SUBMITTED")],
    activities: [
      act(20, "SENT", "Sent to Ayesha Siddiqui", "2026-02-10T09:00:00Z"),
      act(21, "SUBMITTED", "Signed and submitted by Ayesha Siddiqui", "2026-02-11T12:00:00Z"),
      act(22, "APPROVED", "Approved by Ahmed Al Mansoori", "2026-02-12T08:00:00Z"),
    ],
  },
];

export const legacyContractById = (id) => LEGACY_CONTRACTS.find((c) => String(c.id) === String(id)) || null;

// In-memory edits so the list and the detail page agree during a session.
export const updateLegacyContract = (id, patch) => {
  const i = LEGACY_CONTRACTS.findIndex((c) => String(c.id) === String(id));
  if (i < 0) return null;
  LEGACY_CONTRACTS[i] = { ...LEGACY_CONTRACTS[i], ...patch, updated_at: new Date().toISOString() };
  return LEGACY_CONTRACTS[i];
};

export const addLegacyContract = (data) => {
  const id = LEGACY_CONTRACTS.reduce((m, c) => Math.max(m, c.id), 0) + 1;
  const now = new Date().toISOString();
  const row = {
    id,
    reference_no: `CT-2026-0${200 + id}`,
    status: "SENT",
    sent_at: now,
    submitted_at: null,
    approved_at: null,
    created_at: now,
    updated_at: now,
    activities: [act(1000 + id, "SENT", `Sent to ${data.recipients?.[0]?.recipient_name || "employee"}`, now)],
    ...data,
  };
  LEGACY_CONTRACTS.unshift(row);
  return row;
};

export const legacyStatsOf = (rows) => {
  const by = (s) => rows.filter((c) => c.status === s).length;
  return {
    total: rows.length,
    pending: by("SENT") + by("VIEWED"),
    submitted: by("SUBMITTED"),
    approved: by("APPROVED"),
    completed: by("COMPLETED"),
    expired: by("EXPIRED"),
    rejected: by("REJECTED"),
  };
};

// ════════════════════════════════════════════════════════════════
//  Contract types (/admin/contract-types) — tiny in-memory store so the
//  list and its create/edit modal share the same rows.
// ════════════════════════════════════════════════════════════════
let contractTypes = [
  { id: 1, name: "Unlimited Contract", code: "UNL", description: "Open-ended employment contract with no fixed end date.", is_active: true },
  { id: 2, name: "Limited Contract", code: "LTD", description: "Fixed-term contract (up to 3 years) under UAE Labour Law.", is_active: true },
  { id: 3, name: "Part-time", code: "PT", description: "Reduced hours contract for part-time staff.", is_active: true },
  { id: 4, name: "Temporary Work", code: "TMP", description: "Short assignments for a specific project or season.", is_active: true },
  { id: 5, name: "Freelance / Consultant", code: "FRL", description: "Independent consultants on a service agreement.", is_active: false },
  { id: 6, name: "Internship", code: "INT", description: "Training contract for students and graduates.", is_active: true },
  { id: 7, name: "Manpower Supply", code: "MPS", description: "Outsourced labour supplied by a staffing company.", is_active: false },
];
const typeListeners = new Set();
const emitTypes = () => typeListeners.forEach((l) => l());

export const contractTypesStore = {
  create({ name, code, description, status }) {
    const id = contractTypes.reduce((m, r) => Math.max(m, r.id), 0) + 1;
    contractTypes = [...contractTypes, { id, name, code, description, is_active: status === "ACTIVE" }];
    emitTypes();
  },
  update(id, { name, code, description, is_active }) {
    contractTypes = contractTypes.map((r) => (r.id === id ? { ...r, name, code, description, is_active } : r));
    emitTypes();
  },
  remove(id) {
    contractTypes = contractTypes.filter((r) => r.id !== id);
    emitTypes();
  },
};

export const useContractTypes = () =>
  useSyncExternalStore(
    (l) => {
      typeListeners.add(l);
      return () => typeListeners.delete(l);
    },
    () => contractTypes,
  );
