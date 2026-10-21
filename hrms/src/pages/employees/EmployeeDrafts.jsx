import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  MdOutlineSearch,
  MdOutlineDelete,
  MdOutlinePlayArrow,
} from "react-icons/md";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { TableLoader } from "../../components/Loader";
import Ltr from "../../components/Ltr";
import ConfirmationModal from "../../components/ConfirmationModal";
import Pagination from "../../components/Pagination";
import { ScreenError } from "../../components/ScreenState";
import useApiQuery from "../../hooks/useApiQuery";
import { listEmployeeDrafts, removeEmployeeDraft } from "../../api/employees";
import { toastApiError } from "../../utils/apiError";

const LIMIT = 10;
const TOTAL_STEPS = 5;

const formatDateTime = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
};

// Saved "Add Employee" wizards of the company. Resume opens the wizard at the
// saved step; the draft disappears once the employee is created from it.
// onCountChange(total) keeps the tab badge on the Employees page in sync.
export default function EmployeeDrafts({ onCountChange }) {
  const { t } = useTranslation("employees");
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  // Debounce the search box; reset to page 1 when the term settles.
  useEffect(() => {
    const id = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(id);
  }, [searchInput]);

  // The company's drafts (newest saved first, D53); the search box filters them by name / email.
  const { data, loading, error, reload: load } = useApiQuery(() => listEmployeeDrafts({ limit: 100 }), []);
  const block = useMemo(() => {
    const q = search.toLowerCase();
    const all = (data?.items || []).filter((d) => !q || [d.full_name, d.email].some((v) => String(v || "").toLowerCase().includes(q)));
    return { rows: all.slice((page - 1) * LIMIT, page * LIMIT), total: all.length, totalPages: Math.ceil(all.length / LIMIT) };
  }, [data, search, page]);
  const rows = block.rows;
  const total = block.total;
  const totalPages = Math.max(1, block.totalPages);

  // Keep the tab badge on the Employees page in sync.
  useEffect(() => {
    if (!search) onCountChange?.(total);
  }, [search, total, onCountChange]);

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await removeEmployeeDraft(deleting.id);
      toast.success(t("drafts.deleted"));
    } catch (err) {
      toastApiError(err);
    }
    setBusy(false);
    setDeleting(null);
    // Step back a page if the last row of this page was removed.
    if (rows.length === 1 && page > 1) setPage((p) => p - 1);
    else load();
  };

  const resume = (draft) =>
    navigate(`/admin/employees/add-employee?draft=${draft.id}`);


  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="bg-white border border-gray-200 rounded-xl px-4 py-4">
        <div className="relative max-w-sm">
          <MdOutlineSearch className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t("drafts.searchPlaceholder")}
            className="w-full ps-9 pe-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-cyan-400"
          />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {[
                  "drafts.table.name",
                  "drafts.table.progress",
                  "drafts.table.lastSaved",
                  "drafts.table.savedBy",
                  "drafts.table.actions",
                ].map((key) => (
                  <th
                    key={key}
                    className="text-start px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap"
                  >
                    {t(key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <TableLoader colSpan={5} label={t("drafts.loading")} />
              ) : error ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6">
                    <ScreenError error={error} onRetry={load} />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-14 text-center text-sm text-gray-400"
                  >
                    {search ? t("drafts.noMatch") : t("drafts.empty")}
                  </td>
                </tr>
              ) : (
                rows.map((d) => {
                  const step = Math.min(
                    Math.max(Number(d.current_step) || 1, 1),
                    TOTAL_STEPS,
                  );
                  return (
                    <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <p className="text-sm font-semibold text-gray-900">
                          {d.full_name || (
                            <span className="italic text-gray-400">
                              {t("drafts.untitled")}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-400">
                          <Ltr>{d.email || "—"}</Ltr>
                        </p>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <p className="text-sm text-gray-700">
                          {t("drafts.stepOf", { step, total: TOTAL_STEPS })}
                        </p>
                        <div className="mt-1.5 h-1.5 w-28 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-cyan-500 rounded-full"
                            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600 whitespace-nowrap">
                        {formatDateTime(d.last_saved_at)}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600 whitespace-nowrap">
                        {d.saved_by?.name || "—"}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => resume(d)}
                            className="flex items-center gap-1 text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-700 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            <MdOutlinePlayArrow className="text-base rtl:rotate-180" />
                            {t("drafts.resume")}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleting(d)}
                            title={t("drafts.delete")}
                            aria-label={t("drafts.delete")}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <MdOutlineDelete className="text-lg" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination */}
        <Pagination
          page={page}
          limit={LIMIT}
          total={total}
          totalPages={totalPages}
          onPage={setPage}
        />
      </div>

      <ConfirmationModal
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title={t("drafts.deleteTitle")}
        message={
          deleting
            ? t("drafts.deleteMessage", {
                name: deleting.full_name || t("drafts.untitled"),
              })
            : ""
        }
        type="delete"
        confirmText={t("drafts.delete")}
        isLoading={busy}
      />
    </div>
  );
}
