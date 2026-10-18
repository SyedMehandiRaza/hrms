// ─────────────────────────────────────────────────────────────────────────────
// MOCK data + helpers for the partner-side "Assigned to me" tab (Projects page).
// A partner company sees host projects it was invited onto and deploys its OWN
// employees. Replace ASSIGNED_PROJECTS / MY_EMPLOYEES with real API calls (the
// /collaboration endpoints) when the backend is wired.
// ─────────────────────────────────────────────────────────────────────────────

export const ROLE_LABEL = { OWNER: "Owner", CONSULTANT: "Consultant", EPC: "EPC", SUBCONTRACTOR: "Sub-Contractor" };
export const ROLE_BADGE = {
  OWNER: "bg-indigo-50 text-indigo-700 border-indigo-200",
  CONSULTANT: "bg-cyan-50 text-cyan-700 border-cyan-200",
  EPC: "bg-amber-50 text-amber-700 border-amber-200",
  SUBCONTRACTOR: "bg-violet-50 text-violet-700 border-violet-200",
};
export const initials = (n) =>
  (n || "?").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

// Host projects another company assigned to me (I'm a non-owner participant).
export const ASSIGNED_PROJECTS = [
  { id: 101, name: "Project Gamma", owner: "Hacker Kernel up", myRole: "CONSULTANT", location: "Dubai, UAE", status: "Active", start: "01 Jan 2026" },
  { id: 102, name: "Marina Towers", owner: "BuildCo Contracting", myRole: "EPC", location: "Abu Dhabi, UAE", status: "Active", start: "15 Feb 2026" },
  { id: 103, name: "Metro Line 3", owner: "UrbanRail JV", myRole: "SUBCONTRACTOR", location: "Riyadh, KSA", status: "Planning", start: "01 Apr 2026" },
];

// My own roster (the employees I can deploy).
export const MY_EMPLOYEES = [
  { id: 1, name: "Aarav Sharma", code: "EMP-0001", designation: "Site Engineer", department: "Civil", employment_type: "FULL_TIME", status: "ACTIVE" },
  { id: 2, name: "Sara Khan", code: "EMP-0002", designation: "Safety Officer", department: "HSE", employment_type: "FULL_TIME", status: "ACTIVE" },
  { id: 3, name: "Imran Ali", code: "EMP-0003", designation: "Foreman", department: "Civil", employment_type: "CONTRACT", status: "ACTIVE" },
  { id: 4, name: "Neha Patel", code: "EMP-0004", designation: "Surveyor", department: "Planning", employment_type: "FULL_TIME", status: "ACTIVE" },
  { id: 5, name: "David Brown", code: "EMP-0005", designation: "Electrician", department: "Electrical", employment_type: "CONTRACT", status: "ACTIVE" },
  { id: 6, name: "Lina Iqbal", code: "EMP-0006", designation: "QA/QC Engineer", department: "Mechanical", employment_type: "FULL_TIME", status: "ACTIVE" },
  { id: 7, name: "Omar Rao", code: "EMP-0007", designation: "Welder", department: "Mechanical", employment_type: "CONTRACT", status: "ACTIVE" },
  { id: 8, name: "Priya Nair", code: "EMP-0008", designation: "Supervisor", department: "Civil", employment_type: "FULL_TIME", status: "ACTIVE" },
  { id: 9, name: "Yusuf Hassan", code: "EMP-0009", designation: "Draftsman", department: "Planning", employment_type: "FULL_TIME", status: "INACTIVE" },
  { id: 10, name: "Grace Miller", code: "EMP-0010", designation: "Site Engineer", department: "Electrical", employment_type: "CONTRACT", status: "ACTIVE" },
  { id: 11, name: "Karan Verma", code: "EMP-0011", designation: "Foreman", department: "Civil", employment_type: "FULL_TIME", status: "ACTIVE" },
  { id: 12, name: "Maya Sheikh", code: "EMP-0012", designation: "Safety Officer", department: "HSE", employment_type: "CONTRACT", status: "ACTIVE" },
];
