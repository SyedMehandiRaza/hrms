// Shared contract helpers (list + detail + forms).
// Backend statuses: DRAFT SENT VIEWED SUBMITTED APPROVED REJECTED EXPIRED COMPLETED.
export const CONTRACT_STATUSES = ["DRAFT", "SENT", "VIEWED", "SUBMITTED", "APPROVED", "REJECTED", "EXPIRED", "COMPLETED"];

// A finished contract's dates can't change (PATCH /contracts/:id/term → 409).
export const TERM_LOCKED_STATUSES = ["COMPLETED", "EXPIRED"];

// A contract whose end date is before today (company time) is expired, even
// before the nightly job flips its status. Finished ones stay as they are.
const FINAL = ["COMPLETED", "REJECTED"];
export const isContractExpired = (contract, today) => {
  if (!contract) return false;
  if (contract.status === "EXPIRED") return true;
  if (FINAL.includes(contract.status)) return false;
  const end = contract.end_date ? String(contract.end_date).slice(0, 10) : "";
  return !!end && !!today && end < today;
};

const day = (v) => (v ? String(v).slice(0, 10) : "");
// { start_date, end_date, renewal_due } of a contract as "YYYY-MM-DD" / "".
export const termOf = (c) => ({
  start_date: day(c?.start_date),
  end_date: day(c?.end_date),
  renewal_due: day(c?.renewal_due),
});
