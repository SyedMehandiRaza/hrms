// ────────────────────────────────────────────────────────────────
//  New Contract (Contract Studio) — MOCK DATA ONLY
//  This whole module is self-contained demo data. No API calls.
//  Kept separate from the legacy /admin/contracts feature.
// ────────────────────────────────────────────────────────────────

// Audience types the wizard can target. Selecting one swaps the
// available merge fields (auto-populated HRMS columns).
export const NC_AUDIENCES = [
  {
    id: "employee",
    label: "Employee",
    desc: "Employment agreements, offer letters, NDAs for staff.",
    icon: "person",
    accent: "cyan",
  },
  {
    id: "staffing",
    label: "Staffing Company",
    desc: "Master service & supply agreements for agencies.",
    icon: "business",
    accent: "indigo",
  },
  {
    id: "vendor",
    label: "Vendor",
    desc: "Procurement, SOW and purchase contracts.",
    icon: "inventory",
    accent: "amber",
  },
  {
    id: "client",
    label: "Client",
    desc: "Service agreements & proposals for customers.",
    icon: "handshake",
    accent: "rose",
  },
];

// Merge fields (HRMS columns) per audience. Column names mirror the
// real backend models so the demo feels authentic.
export const NC_MERGE_FIELDS = {
  employee: [
    { token: "employee_name", label: "Full Name", sample: "Rahul Menon" },
    { token: "employee_email", label: "Email", sample: "rahul.menon@fyinder.com" },
    { token: "employee_phone", label: "Phone", sample: "+971 50 412 7788" },
    { token: "employee_id", label: "Employee ID", sample: "EMP-0003" },
    { token: "job_title", label: "Job Title", sample: "Software Engineer" },
    { token: "department", label: "Department", sample: "Engineering" },
    { token: "joining_date", label: "Joining Date", sample: "16 Jan 2023" },
    { token: "salary", label: "Annual Salary", sample: "AED 17,500" },
    { token: "employment_type", label: "Employment Type", sample: "Full-Time" },
    { token: "gender", label: "Gender", sample: "Male" },
    { token: "dob", label: "Date of Birth", sample: "12 Apr 1990" },
    { token: "nationality", label: "Nationality", sample: "India" },
    { token: "address", label: "Address", sample: "Al Barsha 1, Dubai" },
    { token: "shift", label: "Shift", sample: "General (9–6)" },
  ],
  staffing: [
    { token: "company_name", label: "Company Name", sample: "Gulf Manpower Services" },
    { token: "company_code", label: "Company Code", sample: "SC-1001" },
    { token: "company_email", label: "Company Email", sample: "ops@gulfmanpower.ae" },
    { token: "company_phone", label: "Company Phone", sample: "+971 4 335 1200" },
    { token: "contact_person_name", label: "Contact Person", sample: "Rashid Al Hammadi" },
    { token: "contact_person_email", label: "Contact Email", sample: "rashid@gulfmanpower.ae" },
    { token: "contact_person_phone", label: "Contact Phone", sample: "+971 55 218 6604" },
    { token: "city", label: "City", sample: "Dubai" },
    { token: "address", label: "Address", sample: "Al Quoz Industrial 3, Dubai" },
    { token: "status", label: "Status", sample: "Active" },
  ],
  vendor: [
    { token: "vendor_name", label: "Vendor Name", sample: "Al Futtaim Supplies" },
    { token: "vendor_code", label: "Vendor Code", sample: "VND-1180" },
    { token: "vendor_email", label: "Vendor Email", sample: "billing@alfuttaimsupplies.ae" },
    { token: "vendor_phone", label: "Vendor Phone", sample: "+971 4 706 1100" },
    { token: "tax_id", label: "Tax ID", sample: "TRN 100384729100003" },
    { token: "category", label: "Category", sample: "IT Hardware" },
    { token: "address", label: "Address", sample: "Jebel Ali Free Zone, Dubai" },
  ],
  client: [
    { token: "client_name", label: "Client Name", sample: "Emaar Properties" },
    { token: "client_email", label: "Client Email", sample: "legal@emaar.ae" },
    { token: "client_phone", label: "Client Phone", sample: "+971 4 367 3333" },
    { token: "account_manager", label: "Account Manager", sample: "Omar Haddad" },
    { token: "contract_value", label: "Contract Value", sample: "AED 880,000" },
    { token: "billing_address", label: "Billing Address", sample: "Downtown Dubai" },
  ],
  collaborator: [
    { token: "company_name", label: "Company Name", sample: "Skyline Consultants" },
    { token: "company_email", label: "Company Email", sample: "contact@skylineconsult.ae" },
    { token: "company_phone", label: "Company Phone", sample: "+971 4 451 2290" },
    { token: "contact_person_name", label: "Contact Person", sample: "Imran Ali" },
    { token: "address", label: "Address", sample: "22 Riverside, Dubai" },
  ],
};

// Draggable field widgets (interactive placeholders on the document).
export const NC_FIELD_TYPES = [
  { id: "input", label: "Text Input", icon: "text", hint: "Single line answer" },
  { id: "checkbox", label: "Checkbox", icon: "check", hint: "Yes / No consent" },
  { id: "date", label: "Date", icon: "date", hint: "Date picker" },
  { id: "signature", label: "Signature", icon: "sign", hint: "Draw or type sign" },
  { id: "initials", label: "Initials", icon: "initials", hint: "Short initials" },
];

// Recipients come from the static employee / staffing-company pool
// (static pool: ncRecipientsFor in src/data/groupF.js).

export const NC_RECIPIENT_ROLES = ["Primary Signer", "Approver", "Viewer (CC)", "Witness"];

// Dashboard stat tiles.
export const NC_STATS = [
  { key: "total", label: "Total Contracts", value: "1,240", delta: "+12% from last month", deltaTone: "up", icon: "total", tint: "cyan" },
  { key: "pending", label: "Pending Signature", value: "450", delta: "Needs action", deltaTone: "warn", icon: "pending", tint: "amber" },
  { key: "signed", label: "Signed Contracts", value: "600", delta: "84% completion rate", deltaTone: "good", icon: "signed", tint: "emerald" },
  { key: "completed", label: "Completed", value: "580", delta: "Archived & closed", deltaTone: "muted", icon: "completed", tint: "indigo" },
];

export const NC_MINI_STATS = [
  { label: "Drafts", value: "15", tone: "muted" },
  { label: "Viewed", value: "120", tone: "info" },
  { label: "Rejected", value: "5", tone: "bad" },
  { label: "Expired", value: "10", tone: "warn" },
];

export const NC_STATUS_STYLES = {
  Draft: { chip: "bg-gray-100 text-gray-500", dot: "bg-gray-400" },
  Pending: { chip: "bg-amber-50 text-amber-600", dot: "bg-amber-500" },
  Sent: { chip: "bg-indigo-50 text-indigo-600", dot: "bg-indigo-500" },
  Viewed: { chip: "bg-sky-50 text-sky-600", dot: "bg-sky-500" },
  Signed: { chip: "bg-emerald-50 text-emerald-600", dot: "bg-emerald-500" },
  Completed: { chip: "bg-emerald-50 text-emerald-600", dot: "bg-emerald-500" },
  Rejected: { chip: "bg-rose-50 text-rose-600", dot: "bg-rose-500" },
  Expired: { chip: "bg-rose-50 text-rose-500", dot: "bg-rose-400" },
  Submitted: { chip: "bg-emerald-50 text-emerald-600", dot: "bg-emerald-500" },
  Revoked: { chip: "bg-orange-50 text-orange-600", dot: "bg-orange-500" },
};

// API contract status → display key (status.* strings and NC_STATUS_STYLES).
export const NC_STATUS_KEY = {
  DRAFT: "Draft",
  SENT: "Sent",
  VIEWED: "Viewed",
  SUBMITTED: "Submitted",
  COMPLETED: "Completed",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
  REVOKED: "Revoked",
};

// API audience → NC_AUDIENCES id.
export const NC_AUDIENCE_ID = { EMPLOYEE: "employee", STAFFING_COMPANY: "staffing" };

export const NC_CONTRACTS = [
  { id: "OFF-24-0091", name: "Offer Letter — John Doe", recipient: "John Doe", initials: "JD", color: "bg-indigo-50 text-indigo-600", module: "Employees", audience: "employee", sentDate: "Oct 24, 2023", status: "Pending", fields: 6 },
  { id: "VND-99120", name: "Vendor Master Agreement", recipient: "Orbit Supplies", initials: "OS", color: "bg-amber-50 text-amber-600", module: "Vendors", audience: "vendor", sentDate: "Oct 22, 2023", status: "Signed", fields: 9 },
  { id: "SOW-44211", name: "Consulting Services SOW", recipient: "David Wilson", initials: "DW", color: "bg-cyan-50 text-cyan-600", module: "Consultants", audience: "client", sentDate: "Oct 20, 2023", status: "Expired", fields: 4 },
  { id: "NDA-00219", name: "NDA — Stealth Project", recipient: "Mary Major", initials: "MM", color: "bg-rose-50 text-rose-600", module: "Partnerships", audience: "client", sentDate: "Oct 19, 2023", status: "Signed", fields: 3 },
  { id: "EMP-77120", name: "Employment Agreement", recipient: "Alex Johnson", initials: "AJ", color: "bg-emerald-50 text-emerald-600", module: "Employees", audience: "employee", sentDate: "Oct 18, 2023", status: "Viewed", fields: 8 },
  { id: "MSA-51002", name: "Staffing Supply MSA", recipient: "Vertex Staffing", initials: "VS", color: "bg-indigo-50 text-indigo-600", module: "Staffing", audience: "staffing", sentDate: "Oct 16, 2023", status: "Draft", fields: 11 },
  { id: "SRV-88001", name: "Service Agreement", recipient: "Emaar Properties", initials: "MC", color: "bg-rose-50 text-rose-600", module: "Clients", audience: "client", sentDate: "Oct 14, 2023", status: "Rejected", fields: 5 },
];

export const NC_ACTIVITY = [
  { id: 1, icon: "signed", tone: "emerald", text: "Offer Letter signed by David Wilson", time: "2 hours ago" },
  { id: 2, icon: "viewed", tone: "sky", text: "Vendor Agreement viewed by XYZ Corp", time: "5 hours ago" },
  { id: 3, icon: "sent", tone: "cyan", text: "Consulting SOW sent to Sarah Jenkins", time: "Yesterday at 4:30 PM" },
  { id: 4, icon: "rejected", tone: "rose", text: "Lease Agreement declined by Property Group B", time: "Oct 23, 2023" },
  { id: 5, icon: "signed", tone: "emerald", text: "NDA signed by Mary Major", time: "Oct 22, 2023" },
];

// Templates shown in the wizard's "start from" strip.
export const NC_TEMPLATES = [
  { id: "t1", name: "Employment Agreement", pages: 3, tag: "employee", uses: 128 },
  { id: "t2", name: "Offer Letter", pages: 1, tag: "employee", uses: 340 },
  { id: "t3", name: "Master Service Agreement", pages: 5, tag: "staffing", uses: 54 },
  { id: "t4", name: "Mutual NDA", pages: 2, tag: "client", uses: 96 },
  { id: "t5", name: "Purchase Order", pages: 1, tag: "vendor", uses: 210 },
];