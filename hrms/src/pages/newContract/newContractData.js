// Contract Studio display constants: status chip styles and API value → UI key maps.

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

// API audience → audiences.* string key.
export const NC_AUDIENCE_ID = { EMPLOYEE: "employee", STAFFING_COMPANY: "staffing" };
