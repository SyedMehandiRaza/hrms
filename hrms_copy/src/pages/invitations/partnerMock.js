// ─────────────────────────────────────────────────────────────────────────────
// Shared UI helpers + MOCK data for the partner-company drill-in (Hierarchy tab).
// The mock generators are deterministic per company/employee so the screen looks
// stable while we design. Replace mockEmployees / mockOverview / mockAttendance
// with real API calls when the backend is wired (Phase 2).
// ─────────────────────────────────────────────────────────────────────────────

export const ROLE = {
  OWNER: { label: "Owner", badge: "bg-indigo-50 text-indigo-700 border-indigo-200", dot: "bg-indigo-500", avatar: "bg-indigo-100 text-indigo-700" },
  CONSULTANT: { label: "Consultant", badge: "bg-cyan-50 text-cyan-700 border-cyan-200", dot: "bg-cyan-500", avatar: "bg-cyan-100 text-cyan-700" },
  EPC: { label: "EPC", badge: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500", avatar: "bg-amber-100 text-amber-700" },
  SUBCONTRACTOR: { label: "Sub-Contractor", badge: "bg-violet-50 text-violet-700 border-violet-200", dot: "bg-violet-500", avatar: "bg-violet-100 text-violet-700" },
};
export const roleOf = (r) =>
  ROLE[r] || { label: r || "—", badge: "bg-gray-100 text-gray-600 border-gray-200", dot: "bg-gray-400", avatar: "bg-gray-100 text-gray-600" };

export const initials = (name) =>
  (name || "?").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

// ── deterministic pseudo-random seeded by a string ──
const seeded = (str) => {
  let h = 0;
  for (let i = 0; i < String(str).length; i++) h = (Math.imul(31, h) + String(str).charCodeAt(i)) | 0;
  let s = Math.abs(h) || 1;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
};
const pick = (arr, rnd) => arr[Math.floor(rnd() * arr.length)];

const FIRST = ["Aarav", "Sara", "Imran", "Neha", "David", "Lina", "Omar", "Priya", "Yusuf", "Grace", "Karan", "Maya", "Bilal", "Anya"];
const LAST = ["Khan", "Sharma", "Ali", "Patel", "Brown", "Iqbal", "Rao", "Nair", "Hassan", "Miller", "Sheikh", "Verma"];
const DESIG = ["Site Engineer", "Foreman", "Electrician", "Safety Officer", "Surveyor", "Welder", "Supervisor", "Draftsman", "QA/QC Engineer"];
const DEPT = ["Civil", "Electrical", "Mechanical", "HSE", "Planning"];
const TYPE = ["FULL_TIME", "CONTRACT"];
const NAT = ["United Arab Emirates", "India", "Pakistan", "Egypt", "Philippines"];
const slug = (s) => String(s || "company").toLowerCase().replace(/[^a-z0-9]+/g, "");

// A stable roster for a company.
export const mockEmployees = (company) => {
  const key = `${company?.name}-${company?.employer_id}`;
  const rnd = seeded(key);
  const n = 5 + Math.floor(rnd() * 6); // 5–10
  return Array.from({ length: n }).map((_, i) => {
    const name = `${pick(FIRST, rnd)} ${pick(LAST, rnd)}`;
    return {
      id: (company?.employer_id || 0) * 1000 + i + 1,
      name,
      code: `EMP-${String((company?.employer_id || 0) * 100 + i + 1).padStart(4, "0")}`,
      designation: pick(DESIG, rnd),
      department: pick(DEPT, rnd),
      employment_type: pick(TYPE, rnd),
      status: rnd() > 0.15 ? "ACTIVE" : "INACTIVE",
      email: `${name.toLowerCase().replace(/\s+/g, ".")}@${slug(company?.name)}.com`,
      phone: `+971 5${Math.floor(rnd() * 9)} ${Math.floor(rnd() * 900 + 100)} ${Math.floor(rnd() * 9000 + 1000)}`,
      nationality: pick(NAT, rnd),
      gender: rnd() > 0.5 ? "Male" : "Female",
    };
  });
};

export const mockOverview = (emp, company) => ({
  ...emp,
  company: company?.name,
  join_date: "12 Mar 2024",
});

// Only the projects the viewer assigned to THIS company (not all my projects).
const PROJECT_NAMES = ["Project Gamma", "Marina Towers", "Metro Line 3", "Airport Expansion", "Downtown Mall"];
export const mockSharedProjects = (company) => {
  const rnd = seeded(`shared-${company?.name}-${company?.employer_id}`);
  const n = 1 + Math.floor(rnd() * 2); // 1–2 shared projects
  const seen = new Set();
  const out = [];
  while (out.length < n) {
    const name = PROJECT_NAMES[Math.floor(rnd() * PROJECT_NAMES.length)];
    if (!seen.has(name)) { seen.add(name); out.push({ id: (company?.employer_id || 0) * 10 + out.length + 1, name }); }
  }
  return out;
};

// Only the employees this company DEPLOYED to the given shared project (a subset
// of its roster; may be empty for some projects).
export const mockDeployedEmployees = (company, projectId) => {
  const all = mockEmployees(company);
  const rnd = seeded(`deployed-${company?.employer_id}-${projectId}`);
  return all.filter(() => rnd() > 0.45);
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_STATUS = [
  { key: "PRESENT", label: "Present", cls: "bg-green-50 text-green-700" },
  { key: "PRESENT", label: "Present", cls: "bg-green-50 text-green-700" },
  { key: "PRESENT", label: "Present", cls: "bg-green-50 text-green-700" },
  { key: "LEAVE", label: "Paid Leave", cls: "bg-blue-50 text-blue-700" },
  { key: "ABSENT", label: "Absent", cls: "bg-red-50 text-red-700" },
  { key: "WEEKOFF", label: "Week Off", cls: "bg-gray-100 text-gray-500" },
];

export const mockAttendance = (emp) => {
  const rnd = seeded(`${emp?.name}-${emp?.id}`);
  const working_days = 26;
  const present = 18 + Math.floor(rnd() * 7);
  const paid_leave = Math.floor(rnd() * 3);
  const absent = Math.max(0, working_days - present - paid_leave - 2);
  const worked_hours = present * 8 + Math.floor(rnd() * 20);
  const now = new Date();
  const days = Array.from({ length: 10 }).map((_, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const st = pick(DAY_STATUS, rnd);
    return {
      date: `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]}`,
      in: st.key === "PRESENT" ? "09:0" + Math.floor(rnd() * 9) : "—",
      out: st.key === "PRESENT" ? "18:1" + Math.floor(rnd() * 9) : "—",
      status: st.label,
      cls: st.cls,
    };
  });
  return { summary: { working_days, present, absent, paid_leave, worked_hours }, days };
};
