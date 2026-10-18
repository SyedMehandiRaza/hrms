import { STATIC_PERMISSION } from "../data/session";

export const canManageExits = (permission) =>
  !!permission &&
  (!!permission.isSuper || (permission.approvalModules || []).includes("LEAVE"));

export default function useCanManageExits() {
  return canManageExits(STATIC_PERMISSION);
}
