import { useTranslation } from "react-i18next";
import Sidebar from "../components/Sidebar";

function PageTemplate({ title, description }) {
  const { t } = useTranslation("shared");
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 lg:ms-0">
        <div className="p-6 lg:p-10 mt-12 lg:mt-0">
          <h1 className="text-3xl lg:text-4xl font-bold text-gray-900">
            {title}
          </h1>
          <p className="text-gray-600 mt-2">{description}</p>

          <div className="bg-white p-8 rounded-lg border border-gray-200 mt-6">
            <p className="text-gray-600">
              {t("pageTemplate.content", { title })}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default PageTemplate;
