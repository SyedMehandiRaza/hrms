import { useCan } from "../hooks/usePermission";

// Conditionally render children based on a permission.
// Usage: <Can module="employee" action="create"> <AddButton/> </Can>
// `action` defaults to "read". Optional `fallback` renders when not allowed.
export default function Can({ module, action = "read", children, fallback = null }) {
  const can = useCan();
  return can(module, action) ? children : fallback;
}