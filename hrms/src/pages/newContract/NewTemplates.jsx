import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import {
  MdAdd,
  MdOutlineSearch,
  MdOutlineLayers,
  MdOutlineEdit,
  MdOutlineDelete,
  MdOutlineContentCopy,
  MdOutlineSend,
  MdOutlinePerson,
  MdOutlineBusiness,
  MdOutlineTextFields,
  MdOutlineCheckBox,
  MdOutlineDraw,
  MdOutlineDataObject,
  MdOutlineDesignServices,
} from "react-icons/md";
import { useNcTemplates, ncStore } from "./newContractStore";

const AUD_META = {
  employee: { labelKey: "audiences.employee", icon: MdOutlinePerson, chip: "bg-cyan-50 text-cyan-600" },
  staffing: { labelKey: "audiences.staffing", icon: MdOutlineBusiness, chip: "bg-indigo-50 text-indigo-600" },
};

const FIELD_META = {
  text: { icon: MdOutlineTextFields, labelKey: "fieldTypes.text" },
  input: { icon: MdOutlineTextFields, labelKey: "fieldTypes.input" },
  checkbox: { icon: MdOutlineCheckBox, labelKey: "fieldTypes.checkbox" },
  signature: { icon: MdOutlineDraw, labelKey: "fieldTypes.signature" },
  db: { icon: MdOutlineDataObject, labelKey: "fieldTypes.db" },
};

function countByType(fields) {
  const c = {};
  for (const f of fields) c[f.type] = (c[f.type] || 0) + 1;
  return c;
}

export default function NewTemplates() {
  const { t } = useTranslation("contractStudio");
  const navigate = useNavigate();
  const templates = useNcTemplates();
  const [query, setQuery] = useState("");

  const filtered = templates.filter(
    (tpl) => !query || tpl.name.toLowerCase().includes(query.toLowerCase()) || (tpl.docName || "").toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-10">
      {/* header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">{t("templates.title")}</h1>
          <p className="text-gray-500 mt-1 text-sm">
            {t("templates.subtitle")}
          </p>
        </div>
        <button
          onClick={() => navigate("/admin/new-contracts/templates/build")}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-[#20B2AA] to-cyan-500 hover:from-[#1C9D96] hover:to-cyan-600 rounded-lg shadow-sm shadow-cyan-200 transition-all"
        >
          <MdAdd className="text-lg" />
          {t("actions.createTemplate")}
        </button>
      </div>

      {/* toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <MdOutlineSearch className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("templates.searchPlaceholder")}
            className="w-full ps-10 pe-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
          />
        </div>
        <span className="text-sm text-gray-400">
          <span className="font-semibold text-gray-600">{templates.length}</span> {t("templates.count")}
        </span>
      </div>

      {/* empty */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-14 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center mb-4">
            <MdOutlineDesignServices className="text-3xl text-gray-300" />
          </div>
          <h3 className="text-base font-bold text-gray-900 mb-1">{t("templates.empty.title")}</h3>
          <p className="text-sm text-gray-500 max-w-sm mb-5">
            {t("templates.empty.description")}
          </p>
          <button
            onClick={() => navigate("/admin/new-contracts/templates/build")}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#20B2AA] hover:bg-[#1C9D96] rounded-lg transition-colors"
          >
            <MdAdd className="text-lg" /> {t("actions.createTemplate")}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((tpl) => {
            const aud = AUD_META[tpl.audience] || AUD_META.employee;
            const AudIcon = aud.icon;
            const counts = countByType(tpl.fields || []);
            return (
              <div
                key={tpl.id}
                className="group bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-lg hover:shadow-gray-100 hover:-translate-y-0.5 transition-all"
              >
                {/* preview banner */}
                <div className="relative h-24 bg-gradient-to-br from-gray-50 to-gray-100 border-b border-gray-100 flex items-center justify-center">
                  <MdOutlineLayers className="text-4xl text-gray-300" />
                  <span className={`absolute top-2.5 left-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${aud.chip}`}>
                    <AudIcon className="text-xs" /> {t(aud.labelKey)}
                  </span>
                  <span className="absolute top-2.5 right-2.5 text-[10px] font-medium text-gray-400 bg-white/80 px-1.5 py-0.5 rounded">
                    {t("templates.pagesShort", { count: tpl.pages || 1 })}
                  </span>
                </div>

                <div className="p-5">
                  <h3 className="text-sm font-semibold text-gray-900 truncate">{tpl.name}</h3>
                  <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                    {tpl.docName || t("templates.documentDetached")} · {t("templates.updatedOn", { date: tpl.updatedAt })}
                  </p>

                  {/* field chips */}
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {Object.entries(counts).map(([type, n]) => {
                      const fm = FIELD_META[type];
                      if (!fm) return null;
                      const Icon = fm.icon;
                      return (
                        <span key={type} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-50 border border-gray-200 text-[11px] font-medium text-gray-600">
                          <Icon className="text-xs text-cyan-600" /> {n} {t(fm.labelKey)}
                        </span>
                      );
                    })}
                    {(tpl.fields || []).length === 0 && (
                      <span className="text-[11px] text-gray-400">{t("templates.noFields")}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                    <button
                      onClick={() => navigate(`/admin/new-contracts/templates/build?id=${tpl.id}`)}
                      className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-cyan-700 bg-cyan-50 hover:bg-cyan-100 rounded-lg py-2 transition-colors"
                    >
                      <MdOutlineEdit className="text-sm" /> {t("actions.edit")}
                    </button>
                    <button
                      onClick={() => navigate(`/admin/new-contracts/create?template=${tpl.id}`)}
                      className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-[#20B2AA] hover:bg-[#1C9D96] rounded-lg py-2 transition-colors"
                      title={t("templates.sendTitle")}
                    >
                      <MdOutlineSend className="text-sm" /> {t("actions.send")}
                    </button>
                    <button
                      onClick={async () => {
                        const copy = ncStore.addTemplate({
                          name: `${tpl.name} (copy)`, docId: tpl.docId, docName: tpl.docName, audience: tpl.audience, pages: tpl.pages,
                          fields: (tpl.fields || []).map((f) => ({ ...f })),
                        });
                        toast.success(t("templates.toast.duplicated"));
                        if (copy?.id) navigate(`/admin/new-contracts/templates/build?id=${copy.id}`);
                      }}
                      className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-gray-700 transition-colors"
                      title={t("actions.duplicate")}
                    >
                      <MdOutlineContentCopy className="text-base" />
                    </button>
                    <button
                      onClick={async () => {
                        ncStore.removeTemplate(tpl.id);
                        toast.success(t("templates.toast.deleted"));
                      }}
                      className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-rose-500 hover:border-rose-200 transition-colors"
                      title={t("actions.delete")}
                    >
                      <MdOutlineDelete className="text-base" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
