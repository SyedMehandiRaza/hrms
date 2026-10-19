import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AppRoutes from "./routes/AppRoutes";
import { ToastContainer } from "react-toastify";
import { useTranslation } from "react-i18next";
import { setNavigator } from "./api/client";
import { startSession } from "./hooks/useSession";
import ForcedPasswordChangeModal from "./components/ForcedPasswordChangeModal";

function App() {
  const { i18n } = useTranslation();
  const isArabic = i18n.language === "ar";
  const navigate = useNavigate();

  // The API client redirects (/login, /access-ended) through react-router.
  useEffect(() => {
    setNavigator(navigate);
  }, [navigate]);

  // Reload keeps a logged-in user logged in: refresh cookie → /auth/me.
  useEffect(() => {
    startSession();
  }, []);

  return (
    <>
      <AppRoutes />

      {/* Temporary password → forced change over every panel (D21, ADR 0003). */}
      <ForcedPasswordChangeModal />

      <ToastContainer
        position={isArabic ? "top-left" : "top-right"}
        rtl={isArabic}
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        pauseOnHover
        draggable
        theme="light"
        limit={1}
      />
    </>
  );
}

export default App;
