import { Navigate, useLocation } from "react-router-dom";
import Loader from "../components/Loader";
import { useSession } from "../hooks/useSession";
import { PANEL_HOME } from "../data/sessionStore";

// Gate for a panel's routes (D23).
//   loading   → the shared Loader (app start: refresh cookie → /auth/me)
//   access ended (403 AUTH_*_INACTIVE) → /access-ended (state.message)
//   anonymous → /login (state.from = where the user wanted to go)
//   other panel's URL → the user's own dashboard
const ProtectedRoute = ({ panel, children }) => {
  const { status, me, accessEnded, accessEndedMessage } = useSession();
  const location = useLocation();

  if (status === "loading") {
    return <Loader className="min-h-screen" />;
  }

  if (accessEnded) {
    return <Navigate to="/access-ended" replace state={{ message: accessEndedMessage }} />;
  }

  if (status !== "authenticated" || !me) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const ownPanel = me.account?.panel;
  if (panel && ownPanel !== panel) {
    return <Navigate to={PANEL_HOME[ownPanel] || "/login"} replace />;
  }

  return children;
};

export default ProtectedRoute;
