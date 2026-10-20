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
  MdOutlineDesignServices,
  MdOutlineArchive,
  MdOutlineUnarchive,
} from "react-icons/md";
import {
  listContractTemplates,
  duplicateContractTemplate,
  removeContractTemplate,
  setContractTemplateStatus,
} from "../../api/contracts";
import useApiQuery from "../../hooks/useApiQuery";
import { useCan } from "../../hooks/usePermission";
import { MODULES } from "../../constants/permissions";
import { ScreenError, ScreenLoader } from "../../components/ScreenState";
import { toastApiError } from "../../utils/apiError";
import { serverErrors } from "../../utils/applyFieldErrors";

// Templates (plan decisions 9–16): ACTIVE or ARCHIVED, edited in the builder.

const AUD_META = {
  EMPLOYEE: { labelKey: "audiences.employee", icon: MdOutlinePerson, chip: "bg-cyan-50 text-cyan-600" },
  STAFFING_COMPANY: { labelKey: "audiences.staffing", icon: MdOutlineBusiness, chip: "bg-indigo-50 text-indigo-600" },
};

const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) : "");

export default function NewTemplates() {
  const { t } = useTranslation("contractStudio");
  const navigate = useNavigate();
  const can = useCan();
  const canCreate = can(MODULES.CONTRACT, "create");
  const canUpdate = can(MODULES.CONTRACT, "update");
  const canDelete = can(MODULES.CONTRACT, "delete");
  const [query, setQuery] = useState("");

  const { data, loading, error, reload } = useApiQuery(() => listContractTemplates({ limit: 100, search: query.trim() }), [query.trim()]);
  const templates = data?.items || [];

  const duplicate = async (tpl) => {
    try {
      await duplicateContractTemplate(tpl.id);
      toast.success(t("templates.toast.duplicated"));
      reload();
    } catch (err) {
      // e.g. 409 "This document is archived and can't be used for templates."
      toastApiError(err);
    }
  };

  const toggleArchive = async (tpl) => {
    try {
      await setContractTemplateStatus(tpl.id, tpl.status === "ARCHIVED" ? "ACTIVE" : "ARCHIVED");
      reload();
    } catch (err) {
      const [first] = serverErrors(err);
      if (first) toast.error(first.message);
      else toastApiError(err);
    }
  };

  const remove = async (tpl) => {
    try {
      await removeContractTemplate(tpl.id);
      toast.success(t("templates.toast.deleted"));
      reload();
    } catch (err) {
      // 409 "This template is used by contracts and can't be deleted. Archive it instead."
      toastApiError(err);
    }
  };

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
        {canCreate && (
          <button
            onClick={() => navigate("/admin/new-contracts/templates/build")}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-[#20B2AA] to-cyan-500 hover:from-[#1C9D96] hover:to-cyan-600 rounded-lg shadow-sm shadow-cyan-200 transition-all"
          >
            <MdAdd className="text-lg" />
            {t("actions.createTemplate")}
          </button>
        )}
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
          <span className="font-semibold text-gray-600">{data?.total ?? 0}</span> {t("templates.count")}
        </span>
      </div>

      {loading && !data ? (
        <ScreenLoader />
      ) : error ? (
        <ScreenError error={error} onRetry={reload} />
      ) : templates.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-14 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center mb-4">
            <MdOutlineDesignServices className="text-3xl text-gray-300" />
          </div>
          <h3 className="text-base font-bold text-gray-900 mb-1">{t("templates.empty.title")}</h3>
          <p className="text-sm text-gray-500 max-w-sm mb-5">
            {t("templates.empty.description")}
          </p>
          {canCreate && (
            <button
              onClick={() => navigate("/admin/new-contracts/templates/build")}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#20B2AA] hover:bg-[#1C9D96] rounded-lg transition-colors"
            >
              <MdAdd className="text-lg" /> {t("actions.createTemplate")}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((tpl) => {
            const aud = AUD_META[tpl.audience_type] || AUD_META.EMPLOYEE;
            const AudIcon = aud.icon;
            const archived = tpl.status === "ARCHIVED";
            return (
              <div
                key={tpl.id}
                data-testid="template-card"
                className="group bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-lg hover:shadow-gray-100 hover:-translate-y-0.5 transition-all"
              >
                {/* preview banner */}
                <div className="relative h-24 bg-gradient-to-br from-gray-50 to-gray-100 border-b border-gray-100 flex items-center justify-center">
                  <MdOutlineLayers className="text-4xl text-gray-300" />
                  <span className={`absolute top-2.5 left-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${aud.chip}`}>
                    <AudIcon className="text-xs" /> {t(aud.labelKey)}
                  </span>
                  <span className="absolute top-2.5 right-2.5 text-[10px] font-medium text-gray-400 bg-white/80 px-1.5 py-0.5 rounded">
                    {t("templates.pagesShort", { count: tpl.page_count || 1 })}
                  </span>
                  {archived && (
                    <span className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-200 text-gray-600">
                      {t("status.Archived")}
                    </span>
                  )}
                </div>

                <div className="p-5">
                  <h3 className="text-sm font-semibold text-gray-900 truncate">{tpl.name}</h3>
                  <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                    {tpl.document?.name || t("templates.documentDetached")} · {t("templates.updatedOn", { date: formatDate(tpl.updated_at) })}
                  </p>

                  {/* type + field count chips */}
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {tpl.contract_type && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-50 border border-gray-200 text-[11px] font-medium text-gray-600">
                        {tpl.contract_type.name}
                      </span>
                    )}
                    {tpl.field_count > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-50 border border-gray-200 text-[11px] font-medium text-gray-600">
                        {t("builder.fieldsPlaced", { count: tpl.field_count })}
                      </span>
                    ) : (
                      <span className="text-[11px] text-gray-400">{t("templates.noFields")}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                    {canUpdate && (
                      <button
                        onClick={() => navigate(`/admin/new-contracts/templates/build?id=${tpl.id}`)}
                        className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-cyan-700 bg-cyan-50 hover:bg-cyan-100 rounded-lg py-2 transition-colors"
                      >
                        <MdOutlineEdit className="text-sm" /> {t("actions.edit")}
                      </button>
                    )}
                    {canCreate && !archived && (
                      <button
                        onClick={() => navigate(`/admin/new-contracts/create?template=${tpl.id}`)}
                        className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-[#20B2AA] hover:bg-[#1C9D96] rounded-lg py-2 transition-colors"
                        title={t("templates.sendTitle")}
                      >
                        <MdOutlineSend className="text-sm" /> {t("actions.send")}
                      </button>
                    )}
                    {(!canUpdate || !canCreate || archived) && <span className="flex-1" />}
                    {canCreate && (
                      <button
                        onClick={() => duplicate(tpl)}
                        className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-gray-700 transition-colors"
                        title={t("actions.duplicate")}
                        aria-label={t("actions.duplicate")}
                      >
                        <MdOutlineContentCopy className="text-base" />
                      </button>
                    )}
                    {canUpdate && (
                      <button
                        onClick={() => toggleArchive(tpl)}
                        className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-amber-500 hover:border-amber-200 transition-colors"
                        title={archived ? t("templates.unarchive") : t("templates.archive")}
                        aria-label={archived ? t("templates.unarchive") : t("templates.archive")}
                      >
                        {archived ? <MdOutlineUnarchive className="text-base" /> : <MdOutlineArchive className="text-base" />}
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => remove(tpl)}
                        className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-rose-500 hover:border-rose-200 transition-colors"
                        title={t("actions.delete")}
                        aria-label={t("actions.delete")}
                      >
                        <MdOutlineDelete className="text-base" />
                      </button>
                    )}
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
