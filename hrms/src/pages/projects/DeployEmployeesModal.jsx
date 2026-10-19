import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { MdClose, MdOutlineSearch, MdCheck } from "react-icons/md";
import { initials } from "./assignedMock";
import { ASSIGNABLE_EMPLOYEES } from "../../data/groupC";

// Pick my OWN employees to deploy to a host project.
export default function DeployEmployeesModal({ open, onClose, alreadyDeployedIds = [], onDeploy }) {
  const { t } = useTranslation("collaboration");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState(new Set());
  const employees = ASSIGNABLE_EMPLOYEES;
  const loading = false;
  const [submitting, setSubmitting] = useState(false);

  const deployedSet = useMemo(() => new Set(alreadyDeployedIds.map(String)), [alreadyDeployedIds]);
  const rows = useMemo(
    () => employees.filter((e) => !query || (e.full_name || "").toLowerCase().includes(query.toLowerCase()) || (e.country_emp_id || "").toLowerCase().includes(query.toLowerCase())),
    [employees, query],
  );

  if (!open) return null;

  const toggle = (id) => {
    if (deployedSet.has(String(id))) return;
    setPicked((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const confirm = async () => {
    if (picked.size === 0) return;
    setSubmitting(true);
    try {
      await onDeploy(Array.from(picked));
      setPicked(new Set());
      setQuery("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-gray-900">{t("deploy.title")}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{t("deploy.subtitle")}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded"><MdClose className="text-xl" /></button>
        </div>

        <div className="px-5 py-3 border-b border-gray-100">
          <div className="relative">
            <MdOutlineSearch className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("deploy.searchPlaceholder")}
              className="w-full h-[40px] ps-10 pe-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2 min-h-[160px]">
          {loading ? (
            <p className="text-center text-sm text-gray-400 py-8">{t("deploy.loading")}</p>
          ) : rows.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">{t("deploy.empty")}</p>
          ) : (
            rows.map((e) => {
              const isDeployed = deployedSet.has(String(e.id));
              const isPicked = picked.has(e.id);
              return (
                <button
                  key={e.id}
                  onClick={() => toggle(e.id)}
                  disabled={isDeployed}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${isDeployed ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-50"}`}
                >
                  <span className={`w-5 h-5 rounded border grid place-items-center flex-shrink-0 ${isPicked ? "bg-cyan-600 border-cyan-600 text-white" : "border-gray-300 text-transparent"}`}><MdCheck className="text-sm" /></span>
                  <span className="w-8 h-8 rounded-full grid place-items-center text-xs font-bold bg-gray-100 text-gray-600 flex-shrink-0">{initials(e.full_name)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-gray-800 text-sm truncate">{e.full_name}</span>
                    <span className="block text-xs text-gray-400 truncate">{e.country_emp_id || `#${e.id}`}{e.roles?.[0]?.name ? ` · ${e.roles[0].name}` : ""}</span>
                  </span>
                  {isDeployed && <span className="text-[10px] font-bold uppercase text-green-600">{t("deploy.deployedBadge")}</span>}
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-gray-100">
          <span className="text-xs text-gray-500">{t("deploy.selected", { count: picked.size })}</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">{t("deploy.cancel")}</button>
            <button onClick={confirm} disabled={picked.size === 0 || submitting} className="px-4 py-2 rounded-lg bg-cyan-600 text-white text-sm font-semibold hover:bg-cyan-700 disabled:opacity-50">
              {submitting ? t("deploy.deploying") : picked.size > 0 ? t("deploy.deployCount", { count: picked.size }) : t("deploy.deploy")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
