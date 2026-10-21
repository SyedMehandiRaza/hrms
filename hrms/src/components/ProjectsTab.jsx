import { useState } from "react";
import Pagination from "./Pagination";
import { useTranslation } from "react-i18next";
import {
  MdOutlineWorkOutline,
  MdClose,
} from "react-icons/md";
import Loader, { TableLoader } from "./Loader";
import Ltr from "./Ltr";
import { useFormat } from "../hooks/useFormat";
import useApiQuery from "../hooks/useApiQuery";
import { getProject } from "../api/projects";

// A page of a list held in memory.
const paginate = (list, page, size) => ({
  rows: list.slice((page - 1) * size, page * size),
  total: list.length,
  totalPages: Math.max(1, Math.ceil(list.length / size)),
});

const PROJECT_STATUS_KEY = { ACTIVE: "status.active", ON_HOLD: "status.onHold", COMPLETED: "status.completed" };

const PAGE_SIZE = 5;
const HISTORY_SIZE = 8;

const ACTION = {
  ASSIGNED: { labelKey: "employeeProjects.history.actions.assigned", cls: "bg-green-50 text-green-700", dot: "bg-green-500" },
  REMOVED: { labelKey: "employeeProjects.history.actions.removed", cls: "bg-red-50 text-red-600", dot: "bg-red-500" },
  MOVED_IN: { labelKey: "employeeProjects.history.actions.movedIn", cls: "bg-blue-50 text-blue-700", dot: "bg-blue-500" },
  MOVED_OUT: { labelKey: "employeeProjects.history.actions.movedOut", cls: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
};

const projectInitial = (name) => (name ? name.charAt(0).toUpperCase() : "P");

// `projects`: the employee detail's { current, past, history } (GET /employees/:id). An item:
// { id, name, code, is_main, start_date, end_date }; a history row: { project, previous_project,
// action, effective_date, actioned_at }.
export default function ProjectsTab({ projects }) {
  const { t } = useTranslation("projects");
  const { fmtDate } = useFormat();

  const current = projects?.current || [];
  const currentLoading = !projects;

  const [page, setPage] = useState(1);
  const pastBlock = paginate(projects?.past || [], page, PAGE_SIZE);
  const past = pastBlock.rows;
  const pastLoading = !projects;
  const total = pastBlock.total;
  const totalPages = pastBlock.totalPages;

  // The assignment row picked; its project's location and status come from GET /projects/:id.
  const [detail, setDetail] = useState(null);
  const { data: detailProject, loading: projectLoading } = useApiQuery(
    () => (detail ? getProject(detail.id).catch(() => null) : Promise.resolve(null)),
    [detail?.id],
  );
  const detailLoading = !!detail && projectLoading;

  const [historyPage, setHistoryPage] = useState(1);
  const historyBlock = paginate(projects?.history || [], historyPage, HISTORY_SIZE);
  const history = historyBlock.rows;
  const historyLoading = !projects;
  const historyPages = historyBlock.totalPages;

  const openDetail = (assignment) => {
    setDetail({ ...assignment, is_active: !assignment.end_date });
  };

  return (
    <div className="space-y-6">
      {/* Current project(s) */}
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
          {t("employeeProjects.currentProject")}{current.length > 0 && (
            <span className="text-cyan-600"> ({current.length})</span>
          )}
        </p>

        {currentLoading ? (
          <Loader label={t("detail.loading")} />
        ) : current.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl px-5 py-8 text-center text-sm text-gray-400">
            {t("employeeProjects.noActiveProject")}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {current.map((a) => (
              <button
                key={a.id}
                onClick={() => openDetail(a)}
                className="flex items-center gap-3 bg-white border border-gray-200 hover:border-cyan-300 hover:bg-cyan-50/30 rounded-xl px-4 py-3 text-left transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-cyan-100 text-cyan-700 font-bold flex items-center justify-center shrink-0">
                  {projectInitial(a.name)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">
                    {a.name || "—"}
                    {a.is_main && (
                      <span className="ms-2 inline-flex px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-700 text-[10px] font-bold uppercase align-middle">
                        {t("employeeProjects.main")}
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-gray-400">
                    <Ltr>{a.code || "—"}</Ltr> •{" "}
                    {t("employeeProjects.since")} {fmtDate(a.start_date)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Past projects */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-sm font-bold text-gray-900">{t("employeeProjects.pastProjects")}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {t("employeeProjects.pastProjectsHelper")}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {[
                  { key: "sn", label: t("employeeProjects.table.sn") },
                  { key: "project", label: t("employeeProjects.table.project") },
                  { key: "code", label: t("employeeProjects.table.code") },
                  { key: "from", label: t("employeeProjects.table.from") },
                  { key: "to", label: t("employeeProjects.table.to") },
                  { key: "action", label: t("employeeProjects.table.action") },
                ].map((h) => (
                  <th
                    key={h.key}
                    className="text-start px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider"
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pastLoading ? (
                <TableLoader colSpan={6} label={t("detail.loading")} />
              ) : past.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-12 text-center text-sm text-gray-400"
                  >
                    {t("employeeProjects.empty")}
                  </td>
                </tr>
              ) : (
                past.map((a, index) => (
                  <tr
                    key={`${a.id}-${a.end_date}`}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-5 py-4 text-sm text-gray-700">
                      {(page - 1) * PAGE_SIZE + index + 1}
                    </td>
                    <td className="px-5 py-4 text-sm font-bold text-gray-900">
                      {a.name || "—"}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-700">
                      <Ltr>{a.code || "—"}</Ltr>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-700">
                      {fmtDate(a.start_date)}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-700">
                      {fmtDate(a.end_date)}
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => openDetail(a)}
                        className="text-cyan-600 hover:text-cyan-700 text-sm font-medium"
                      >
                        {t("buttons.view")}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <Pagination
          page={page}
          limit={PAGE_SIZE}
          total={total}
          totalPages={totalPages}
          onPage={setPage}
          label={t("employeeProjects.paginationProjects")}
          activeClass="bg-[#14a0b3] text-white"
          containerClass="px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white border-t border-gray-100"
        />
      </div>

      {/* Project history timeline */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-sm font-bold text-gray-900">{t("employeeProjects.history.title")}</p>
          <p className="text-xs text-gray-400 mt-0.5">{t("employeeProjects.history.subtitle")}</p>
        </div>
        <div className="px-5 py-4">
          {historyLoading ? (
            <Loader label={t("detail.loading")} />
          ) : history.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-6">{t("employeeProjects.history.empty")}</p>
          ) : (
            <ol className="relative border-s border-gray-200 ms-2">
              {history.map((h, i) => (
                <li key={`${h.actioned_at}-${h.action}-${i}`} className="ms-4 pb-5 last:pb-0">
                  <span className={`absolute -start-1.5 mt-1 w-3 h-3 rounded-full ${ACTION[h.action]?.dot || "bg-gray-300"}`} />
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${ACTION[h.action]?.cls || "bg-gray-100 text-gray-600"}`}>
                      {ACTION[h.action] ? t(ACTION[h.action].labelKey) : h.action}
                    </span>
                    <span className="text-sm font-semibold text-gray-800">{h.project?.name || "—"}</span>
                    {h.previous_project && <span className="text-xs text-gray-400">{t("employeeProjects.history.fromProject", { name: h.previous_project.name })}</span>}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {/* The date the move counts from (D55); the record time can be later. */}
                    {fmtDate(h.effective_date || h.actioned_at)}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
        {historyPages > 1 && (
          <Pagination
            page={historyPage}
            limit={HISTORY_SIZE}
            total={historyPages * HISTORY_SIZE}
            totalPages={historyPages}
            onPage={setHistoryPage}
            label={t("employeeProjects.paginationEvents")}
            activeClass="bg-[#14a0b3] text-white"
            containerClass="px-6 py-4 flex items-center justify-between gap-3 bg-white border-t border-gray-100"
          />
        )}
      </div>

      {/* Assignment detail modal */}
      {detail !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <MdOutlineWorkOutline className="text-cyan-600 text-xl" />
                <p className="text-base font-bold text-gray-900">
                  {t("employeeProjects.assignmentDetail")}
                </p>
              </div>
              <button
                onClick={() => setDetail(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <MdClose className="text-xl" />
              </button>
            </div>

            <div className="px-5 py-5">
              {detailLoading ? (
                <Loader label={t("detail.loading")} />
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-bold text-gray-900">
                      {detail.name || "—"}
                    </p>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                        detail.is_active
                          ? "text-green-700 bg-green-50 border-green-200"
                          : "text-gray-600 bg-gray-50 border-gray-200"
                      }`}
                    >
                      {detail.is_active ? t("status.active") : t("status.past")}
                    </span>
                  </div>
                  {[
                    {
                      key: "projectCode",
                      label: t("employeeProjects.projectCode"),
                      value: detail.code,
                      ltr: true,
                    },
                    {
                      key: "location",
                      label: t("employeeProjects.location"),
                      value: detailProject?.location,
                    },
                    {
                      key: "status",
                      label: t("employeeProjects.status"),
                      value: detailProject?.status
                        ? t(PROJECT_STATUS_KEY[detailProject.status] || "status.active")
                        : null,
                    },
                    {
                      key: "from",
                      label: t("employeeProjects.fromLabel"),
                      value: fmtDate(detail.start_date),
                    },
                    {
                      key: "to",
                      label: t("employeeProjects.toLabel"),
                      value: detail.is_active
                        ? t("employeeProjects.present")
                        : fmtDate(detail.end_date),
                    },
                  ].map(({ key, label, value, ltr }) => (
                    <div key={key} className="flex justify-between gap-4">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        {label}
                      </span>
                      <span className="text-sm text-gray-800 text-end">
                        {value ? (ltr ? <Ltr>{value}</Ltr> : value) : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
