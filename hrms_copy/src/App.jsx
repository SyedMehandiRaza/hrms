import AppRoutes from "./routes/AppRoutes";
import { ToastContainer } from "react-toastify";
import { useTranslation } from "react-i18next";

function App() {
  const { i18n } = useTranslation();
  const isArabic = i18n.language === "ar";

  return (
    <>
      <AppRoutes />

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