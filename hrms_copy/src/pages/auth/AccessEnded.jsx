import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MdOutlineLockClock, MdArrowBack } from "react-icons/md";

// Public page shown when the backend answers errName "AccessEnded" (the
// employee has exited). The session is already cleared by the api interceptor,
// so this page works logged-out.
export default function AccessEnded() {
  const { t } = useTranslation("exits");
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-10 sm:px-10 text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-cyan-50 border border-cyan-100 flex items-center justify-center">
          <MdOutlineLockClock className="text-cyan-600 text-3xl" />
        </div>
        <h1 className="mt-6 text-xl sm:text-2xl font-bold text-gray-900">{t("access.title")}</h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-500">{t("access.body")}</p>
        <button
          type="button"
          onClick={() => navigate("/login", { replace: true })}
          className="mt-8 w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2"
        >
          <MdArrowBack className="text-base rtl:rotate-180" />
          {t("access.backToSignIn")}
        </button>
      </div>
    </div>
  );
}
