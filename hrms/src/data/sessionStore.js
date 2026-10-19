// Who is logged in (D12, D23). A tiny useSyncExternalStore store, like the
// other stores in src/data. The access token lives here, in memory only: it is
// never written to localStorage/sessionStorage. A page reload gets a fresh one
// from the httpOnly refresh cookie (see startSession in hooks/useSession.js).
//
//   status            : "loading" (app start) | "authenticated" | "anonymous"
//   accessToken       : the Bearer token, or null
//   me                : GET /auth/me data { user, account, company, mustChangePassword, permissions }
//   mustChangePassword: the account still has a temporary password (403
//                       AUTH_PASSWORD_CHANGE_REQUIRED or the login/me flag)
//   accessEnded       : the session ended with 403 AUTH_ACCOUNT_INACTIVE /
//                       AUTH_COMPANY_INACTIVE (route guards send to /access-ended)
//   accessEndedMessage: that answer's server message (shown on /access-ended)

const INITIAL = {
  status: "loading",
  accessToken: null,
  me: null,
  mustChangePassword: false,
  accessEnded: false,
  accessEndedMessage: null,
};

let state = INITIAL;
const listeners = new Set();

const set = (patch) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

export const sessionStore = {
  getState: () => state,
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  getAccessToken: () => state.accessToken,
  setAccessToken(accessToken) {
    if (accessToken !== state.accessToken) set({ accessToken });
  },

  // A new logged-in session (after login, sign up or the setup link).
  // `me` may come later (setMe) — the status stays "loading" until it does.
  setSession({ accessToken, me = null, mustChangePassword }) {
    set({
      ...INITIAL,
      accessToken,
      me,
      status: me ? "authenticated" : "loading",
      mustChangePassword: !!(mustChangePassword ?? me?.mustChangePassword),
    });
  },

  // Fresh /auth/me data (e.g. after the company name or logo changed).
  setMe(me) {
    set({ me, status: "authenticated", mustChangePassword: !!me?.mustChangePassword });
  },

  setMustChangePassword(value) {
    if (!!value !== state.mustChangePassword) set({ mustChangePassword: !!value });
  },

  // Logged out / refresh failed. Drops the token and the user.
  clear() {
    set({ ...INITIAL, status: "anonymous" });
  },

  // 403 AUTH_ACCOUNT_INACTIVE / AUTH_COMPANY_INACTIVE: like clear(), but the
  // route guards send the user to /access-ended with the server message.
  endAccess(message = null) {
    set({ ...INITIAL, status: "anonymous", accessEnded: true, accessEndedMessage: message });
  },
};

// Calls `callback(flag)` whenever mustChangePassword changes (ticket 20's modal).
// Returns the unsubscribe function.
export const subscribeMustChangePassword = (callback) => {
  let last = state.mustChangePassword;
  return sessionStore.subscribe(() => {
    if (state.mustChangePassword !== last) {
      last = state.mustChangePassword;
      callback(last);
    }
  });
};

// Panel → its dashboard (the account.panel values of /auth/me).
export const PANEL_HOME = {
  admin: "/admin/dashboard",
  employee: "/employee/dashboard",
  "staffing-company": "/staffing-company/dashboard",
};
