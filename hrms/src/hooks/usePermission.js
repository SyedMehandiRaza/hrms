import { useCallback, useSyncExternalStore } from "react";
import { sessionStore } from "../data/sessionStore";

// can(module, action = "read") from the real permissions of GET /auth/me
// ({ module_key: { read, create, update, delete } }). The API already sends
// every flag true for ADMIN (the owner bypasses role checks); the explicit
// check below only covers module keys the API does not list.
//
//   const can = useCan();
//   can(MODULES.DEPARTMENT, "create")

const getMe = () => sessionStore.getState().me;

export const canWith = (me, module, action = "read") => {
  if (!me) return false;
  if (me.account?.access_level === "ADMIN") return true;
  return me.permissions?.[module]?.[action] === true;
};

export const useCan = () => {
  const me = useSyncExternalStore(sessionStore.subscribe, getMe, getMe);
  return useCallback((module, action = "read") => canWith(me, module, action), [me]);
};
