import { useState } from "react";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import {
  MdArrowBack,
  MdOutlineFolderShared,
  MdOutlineBusiness,
  MdOutlinePlace,
  MdOutlineAdd,
  MdOutlineDelete,
} from "react-icons/md";
import DeployEmployeesModal from "./DeployEmployeesModal";
import { ROLE_LABEL, ROLE_BADGE, initials } from "./assignedMock";
import { ASSIGNABLE_EMPLOYEES, deploymentsFor } from "../../data/groupC";
import { TableLoader } from "../../components/Loader";
import ConfirmationModal from "../../components/ConfirmationModal";

const TYPE_STYLE = { FULL_TIME: "bg-cyan-50 text-cyan-700", CONTRACT: "bg-amber-50 text-amber-700" };

// Partner-side workspace for a host project assigned to me: see the project and
// deploy my own employees to it.
export default function SharedProjectWorkspace({ project, onBack }) {
  const { t } = useTranslation("collaboration");
  const [deployed, setDeployed] = useState(() => deploymentsFor(project.id));
  const loading = false;
  const [modalOpen, setModalOpen] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);

  const onDeploy = async (ids) => {
    const picked = ASSIGNABLE_EMPLOYEES.filter((e) => ids.includes(e.id));
    setDeployed((prev) => [...prev, ...picked.filter((e) => !prev.some((d) => d.id === e.id))]);
    toast.success(t("workspace.toast.deployed", { count: ids.length }));
    setModalOpen(false);
  };

  const confirmRemove = async () => {
    if (!removing) return;
    setBusy(true);
    setDeployed((prev) => prev.filter((e) => e.id !== removing.id));
    toast.success(t("workspace.toast.removed"));
    setRemoving(null);
    setBusy(false);
  };

  const badge = ROLE_BADGE[project.my_role] || "bg-gray-100 text-gray-600 border-gray-200";

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900">
        <MdArrowBack /> {t("workspace.back")}
      </button>

      {/* Project card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-xl grid place-items-center bg-cyan-50 text-cyan-600"><MdOutlineFolderShared className="text-2xl" /></span>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{project.project_name}</h2>
              <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-0.5"><MdOutlineBusiness className="text-gray-400" /> {project.owner || "—"}</p>
            </div>
          </div>
          <span className={`inline-flex px-2.5 py-1 rounded-md text-[11px] font-semibold border ${badge}`}>
            {t("workspace.you", { role: project.my_role ? t(`role.${project.my_role}`, { defaultValue: ROLE_LABEL[project.my_role] || project.my_role }) : project.my_role })}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div><p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{t("workspace.status")}</p><p className="text-sm mt-0.5"><span className="inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold bg-green-50 text-green-700">{project.status ? t(`projectStatus.${project.status}`, { defaultValue: project.status }) : "—"}</span></p></div>
          <div><p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{t("workspace.start")}</p><p className="text-sm text-gray-800 mt-0.5">{project.start_date || "—"}</p></div>
          <div className="col-span-2"><p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{t("workspace.location")}</p><p className="text-sm text-gray-800 mt-0.5 flex items-center gap-1"><MdOutlinePlace className="text-gray-400" /> {project.location || "—"}</p></div>
        </div>
      </div>

      {/* My deployed employees */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-800">{t("workspace.myEmployees")} <span className="ms-1 text-xs font-medium text-gray-400">({deployed.length})</span></h3>
          <button onClick={() => setModalOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-600 text-white text-sm font-semibold hover:bg-cyan-700">
            <MdOutlineAdd className="text-lg" /> {t("workspace.deployEmployees")}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-[#F8F9FE]">
                {["sno", "employee", "role", "type", "status", ""].map((h) => (
                  <th key={h} className="px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">{h ? t(`partner.table.${h}`) : ""}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <TableLoader colSpan={6} />
              ) : deployed.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-400">{t("workspace.empty")}</td></tr>
              ) : (
                deployed.map((e, i) => (
                  <tr key={e.id} className="hover:bg-gray-50/60">
                    <td className="px-5 py-3 text-gray-500 font-semibold">{i + 1}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-full grid place-items-center text-xs font-bold bg-gray-100 text-gray-600">{initials(e.full_name)}</span>
                        <div><div className="font-semibold text-gray-800">{e.full_name}</div><div className="text-xs text-gray-400">{e.country_emp_id || `#${e.id}`}</div></div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-700">{e.roles?.[0]?.name || "—"}</td>
                    <td className="px-5 py-3"><span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${TYPE_STYLE[e.employment_type] || "bg-gray-100 text-gray-600"}`}>{e.employment_type ? t(`employmentType.${e.employment_type}`, { defaultValue: String(e.employment_type).replace("_", "-") }) : "—"}</span></td>
                    <td className="px-5 py-3"><span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${String(e.user_status).toUpperCase() === "ACTIVE" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>{e.user_status ? t(`userStatus.${String(e.user_status).toUpperCase()}`, { defaultValue: e.user_status }) : "—"}</span></td>
                    <td className="px-5 py-3">
                      <button onClick={() => setRemoving(e)} title={t("workspace.remove")} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><MdOutlineDelete className="text-lg" /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <DeployEmployeesModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        alreadyDeployedIds={deployed.map((e) => e.id)}
        onDeploy={onDeploy}
      />

      <ConfirmationModal
        isOpen={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={confirmRemove}
        title={t("workspace.removeTitle")}
        message={removing ? t("workspace.removeMessage", { name: removing.full_name, project: project.project_name }) : ""}
        type="warning"
        confirmText={t("workspace.remove")}
        isLoading={busy}
      />
    </div>
  );
}
