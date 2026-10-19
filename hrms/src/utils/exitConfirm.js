// Helpers shared by the Exit Detail page and the Confirm Termination /
// Resignation modal (kept out of the component files for fast refresh).

// The required checklist items still open on an exit (detail payload).
export const openRequiredItems = (exit) =>
  (exit?.checklist || []).filter((i) => i.is_required && !["DONE", "NA"].includes(i.status));

// Documents generated on confirmation, by exit type (mirrors the backend).
export const documentTypesFor = (exit) => [
  exit?.exit_type === "TERMINATION" ? "TERMINATION_LETTER" : "RELIEVING_LETTER",
  "FNF_STATEMENT",
  "CLEARANCE_CERTIFICATE",
];
