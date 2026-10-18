import { useEffect, useMemo, useState } from "react";
import { MdClose, MdOutlineSearch, MdOutlinePersonAdd } from "react-icons/md";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { ASSIGNABLE_EMPLOYEES } from "../data/groupC";
import Ltr from "./Ltr";

const getEmpId = (e) => e?.id ?? e?._id ?? e?.employee_id;

const initialsOf = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "?";

// projectId, assignedIds (array of ids already on the project), onClose, onAssigned()
export default function AssignEmployeesModal({
  // eslint-disable-next-line no-unused-vars
  projectId,
  assignedIds = [],
  onClose,
  onAssigned,
}) {
  const { t } = useTranslation("projects");
  // People serving notice or exited can't be assigned.
  const [employees] = useState(() =>
    ASSIGNABLE_EMPLOYEES.filter((e) => !["IN_NOTICE", "EXITED"].includes(e.employment_status)),
  );
  const loading = false;
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(new Set());

  const assignedSet = useMemo(
    () => new Set(assignedIds.map((x) => String(x))),
    [assignedIds]
  );

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const filtered = useMemo(() => {
    if (!search) return employees;
    const q = search.toLowerCase();
    return employees.filter(
      (e) =>
        (e.full_name || "").toLowerCase().includes(q) ||
        (e.User?.email || "").toLowerCase().includes(q)
    );
  }, [employees, search]);

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const key = String(id);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleAssign = async () => {
    const ids = Array.from(selected).map(Number);
    if (ids.length === 0) {
      toast.error(t("assign.toast.selectAtLeastOne"));
      return;
    }
    setSaving(true);
    toast.success(t("assign.toast.assigned"));
    // Static build: hand the picked people back so the caller can add them locally.
    onAssigned?.(ids, employees.filter((e) => ids.includes(Number(getEmpId(e)))));
    setSaving(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col"
        style={{ maxHeight: "90vh" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {t("modal.title")}
            </h2>
            <p className="text-sm text-gray-400 mt-0.5">
              {t("modal.subtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
          >
            <MdClose className="text-xl" />
          </button>
        </div>

        <hr className="border-gray-100 shrink-0" />

        {/* Search */}
        <div className="px-6 py-4 shrink-0">
          <div className="relative border border-gray-200 rounded-lg">
            <MdOutlineSearch className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("modal.searchPlaceholder")}
              className="w-full ps-9 pe-3 py-2.5 text-sm bg-transparent focus:outline-none text-gray-700 placeholder-gray-400"
            />
          </div>
        </div>

        {/* List */}
        <div
          className="flex-1 overflow-y-auto px-6 pb-2 custom-scrollbar"
        >
          {loading ? (
            <div className="py-16 flex items-center justify-center text-gray-400 text-sm">
              <span className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin me-3" />
              {t("modal.loadingEmployees")}
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-16 text-center text-sm text-gray-400">
              {t("modal.noEmployees")}
            </p>
          ) : (
            <div className="divide-y divide-gray-100">
              {filtered.map((emp) => {
                const id = getEmpId(emp);
                const already = assignedSet.has(String(id));
                const checked = already || selected.has(String(id));
                return (
                  <label
                    key={id}
                    className={`flex items-center gap-3 py-3 ${already ? "opacity-60 cursor-default" : "cursor-pointer hover:bg-gray-50"} px-2 rounded-lg`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={already}
                      onChange={() => toggle(id)}
                      className="w-4 h-4 accent-cyan-600 cursor-pointer disabled:cursor-default"
                    />
                    <div className="w-9 h-9 rounded-full bg-cyan-100 text-cyan-700 text-xs font-bold flex items-center justify-center shrink-0">
                      {initialsOf(emp.full_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {emp.full_name}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {emp.User?.email ? <Ltr>{emp.User.email}</Ltr> : "—"}
                        {emp.roles?.[0]?.name ? ` • ${emp.roles[0].name}` : ""}
                      </p>
                    </div>
                    {already && (
                      <span className="text-[10px] font-bold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full shrink-0">
                        {t("modal.assignedBadge")}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <hr className="border-gray-100 shrink-0" />
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 shrink-0">
          <p className="text-sm text-gray-500">
            {t("modal.selectedCount", { count: selected.size })}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-6 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-60 transition-colors"
            >
              {t("buttons.cancel")}
            </button>
            <button
              type="button"
              onClick={handleAssign}
              disabled={saving || selected.size === 0}
              className="flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-700 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {saving ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {t("buttons.assigning")}
                </>
              ) : (
                <>
                  <MdOutlinePersonAdd className="text-lg" /> {t("buttons.assignSelected")}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
