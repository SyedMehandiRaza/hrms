import { useMemo, useSyncExternalStore } from "react";
import { sessionStore } from "../data/sessionStore";
import { toCurrentUser } from "../data/session";
import * as authApi from "../api/auth";

// React side of the session store (src/data/sessionStore.js).
//
//   const { status, me, mustChangePassword, accessEnded, accessEndedMessage } = useSession();
//   const user = useCurrentUser();   // { name, email, role, layoutRole, company_name, company_logo, ... }
//
// Actions for the screen tickets:
//   startSession()          app start: refresh cookie → /auth/me, else anonymous (once)
//   establishSession(data)  after login / sign up / setup link: data = { accessToken, mustChangePassword, me? }
//   reloadMe()              re-read /auth/me (e.g. after the company profile changed)
//   endSession()            logout: POST /auth/logout, then clear (always succeeds)

const getState = () => sessionStore.getState();

export const useSession = () => useSyncExternalStore(sessionStore.subscribe, getState, getState);

const getMe = () => sessionStore.getState().me;

export const useCurrentUser = () => {
  const me = useSyncExternalStore(sessionStore.subscribe, getMe, getMe);
  return useMemo(() => toCurrentUser(me), [me]);
};

export const reloadMe = async () => {
  const me = await authApi.me();
  sessionStore.setMe(me);
  return me;
};

let startPromise = null;
export const startSession = () => {
  if (!startPromise) {
    startPromise = (async () => {
      try {
        await authApi.refresh();
        await reloadMe();
      } catch {
        // An inactive account/company already went to /access-ended (and kept
        // its message); anything else simply means "not logged in".
        if (sessionStore.getState().status === "loading") sessionStore.clear();
      }
    })();
  }
  return startPromise;
};

export const establishSession = async ({ accessToken, mustChangePassword, me }) => {
  sessionStore.setSession({ accessToken, mustChangePassword, me });
  if (!me) await reloadMe();
  return sessionStore.getState();
};

export const endSession = async () => {
  try {
    await authApi.logout();
  } catch {
    // Logout always succeeds for the user.
  }
  sessionStore.clear();
};
