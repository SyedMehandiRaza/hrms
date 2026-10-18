// Shared UI helpers for the loan module.

export const LOAN_STATUS_STYLES = {
  PENDING: { label: "Pending", chip: "bg-amber-50 text-amber-600", dot: "bg-amber-500" },
  APPROVED: { label: "Approved", chip: "bg-cyan-50 text-cyan-600", dot: "bg-cyan-500" },
  DISBURSED: { label: "Disbursed", chip: "bg-cyan-50 text-cyan-600", dot: "bg-cyan-500" },
  ACTIVE: { label: "Active", chip: "bg-emerald-50 text-emerald-600", dot: "bg-emerald-500" },
  COMPLETED: { label: "Completed", chip: "bg-emerald-50 text-emerald-600", dot: "bg-emerald-500" },
  CLOSED: { label: "Closed", chip: "bg-gray-100 text-gray-500", dot: "bg-gray-400" },
  FORECLOSED: { label: "Foreclosed", chip: "bg-indigo-50 text-indigo-600", dot: "bg-indigo-500" },
  REJECTED: { label: "Rejected", chip: "bg-rose-50 text-rose-600", dot: "bg-rose-500" },
  MODIFICATION_REQUESTED: { label: "Needs Changes", chip: "bg-orange-50 text-orange-600", dot: "bg-orange-500" },
  CANCELLED: { label: "Cancelled", chip: "bg-gray-100 text-gray-500", dot: "bg-gray-400" },
};

export const INSTALLMENT_STATUS_STYLES = {
  PENDING: { chip: "bg-gray-100 text-gray-500", dot: "bg-gray-400" },
  PAID: { chip: "bg-emerald-50 text-emerald-600", dot: "bg-emerald-500" },
  PARTIALLY_PAID: { chip: "bg-amber-50 text-amber-600", dot: "bg-amber-500" },
  SKIPPED: { chip: "bg-indigo-50 text-indigo-600", dot: "bg-indigo-500" },
  OVERDUE: { chip: "bg-rose-50 text-rose-600", dot: "bg-rose-500" },
};

export const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

export const fmtMoney = (n, currency = "₹") => {
  const v = Number(n || 0);
  return `${currency}${v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// EMI preview: amount / installments, last EMI absorbs the remainder (mirrors backend)
export const previewEmi = (amount, installments) => {
  const a = Number(amount || 0);
  const n = Number(installments || 0);
  if (!a || !n) return { emi: 0, last: 0 };
  const emi = round2(a / n);
  const last = round2(a - emi * (n - 1));
  return { emi, last };
};

export const fmtDate = (d) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
  } catch {
    return "—";
  }
};

// The payroll month an installment belongs to ("YYYY-MM") — what the backend
// checks against closed / locked periods. Falls back to the due date's month.
export const installmentPeriod = (i) =>
  i?.period_year && i?.period_month
    ? `${i.period_year}-${String(i.period_month).padStart(2, "0")}`
    : i?.due_date
      ? String(i.due_date).slice(0, 7)
      : undefined;
