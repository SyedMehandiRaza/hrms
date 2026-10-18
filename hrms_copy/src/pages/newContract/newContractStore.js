// ────────────────────────────────────────────────────────────────
//  Contract Studio — in-memory store for the static UI build.
//  A tiny external store (useSyncExternalStore) seeded with static data
//  so uploaded documents, saved templates and sent contracts stay in sync
//  across the Contract Studio pages during a session. No backend, no storage.
// ────────────────────────────────────────────────────────────────
import { useSyncExternalStore } from "react";
import {
  NC_SEED_DOCUMENTS,
  NC_SEED_TEMPLATES,
  NC_SEED_CONTRACTS,
  NC_SEED_MY_CONTRACTS,
} from "../../data/groupF";

let state = {
  documents: NC_SEED_DOCUMENTS,
  templates: NC_SEED_TEMPLATES,
  contracts: NC_SEED_CONTRACTS,
  myContracts: NC_SEED_MY_CONTRACTS,
};
const listeners = new Set();

function commit(next) {
  state = next;
  listeners.forEach((l) => l());
}

function subscribe(l) {
  listeners.add(l);
  return () => listeners.delete(l);
}
function getSnapshot() {
  return state;
}

const uid = (p) => `${p}_${Date.now()}_${Math.floor(Math.random() * 1e4)}`;
const today = () => new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });

const patchMine = (fn) =>
  Object.fromEntries(Object.entries(state.myContracts).map(([k, list]) => [k, list.map(fn)]));

// ── actions ──
export const ncStore = {
  addDocument(doc) {
    const record = { id: uid("doc"), status: "Saved", uploadedAt: today(), ...doc };
    commit({ ...state, documents: [record, ...state.documents] });
    return record;
  },
  removeDocument(id) {
    commit({
      ...state,
      documents: state.documents.filter((d) => d.id !== id),
      // detach templates that used this doc (keep the template, drop the link)
      templates: state.templates.map((t) => (t.docId === id ? { ...t, docId: null } : t)),
    });
  },
  getDocument(id) {
    return state.documents.find((d) => d.id === id) || null;
  },
  addTemplate(tpl) {
    const record = { id: uid("tpl"), fields: [], updatedAt: today(), ...tpl };
    commit({ ...state, templates: [record, ...state.templates] });
    return record;
  },
  updateTemplate(id, patch) {
    commit({
      ...state,
      templates: state.templates.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: today() } : t)),
    });
  },
  removeTemplate(id) {
    commit({ ...state, templates: state.templates.filter((t) => t.id !== id) });
  },
  getTemplate(id) {
    return state.templates.find((t) => t.id === id) || null;
  },
  addContracts(list) {
    commit({ ...state, contracts: [...list, ...state.contracts] });
  },
  removeContract(id) {
    commit({ ...state, contracts: state.contracts.filter((c) => c.id !== id) });
  },
  // updates the sender's list and any recipient inbox row with that id
  updateContractStatus(id, status) {
    const apply = (c) => {
      if (c.id !== id) return c;
      // a signature marks the signer's own row as submitted too
      const recipientsList =
        status === "Signed"
          ? (c.recipientsList || []).map((r, i) => (i === 0 ? { ...r, status: "SUBMITTED" } : r))
          : c.recipientsList;
      return { ...c, status, recipientsList };
    };
    commit({ ...state, contracts: state.contracts.map(apply), myContracts: patchMine(apply) });
  },
  // recipient opened a contract: Sent → Viewed
  markViewed(id) {
    commit({
      ...state,
      myContracts: patchMine((c) => (c.id === id && c.status === "Sent" ? { ...c, status: "Viewed" } : c)),
    });
  },
};

// ── hooks ──
export function useNcDocuments() {
  return useSyncExternalStore(subscribe, () => getSnapshot().documents);
}
export function useNcTemplates() {
  return useSyncExternalStore(subscribe, () => getSnapshot().templates);
}
export function useNcContracts() {
  return useSyncExternalStore(subscribe, () => getSnapshot().contracts);
}
export function useNcMyContracts(kind = "employee") {
  return useSyncExternalStore(subscribe, () => getSnapshot().myContracts[kind] || []);
}
