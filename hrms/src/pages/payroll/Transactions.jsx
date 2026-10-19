import { useState } from "react";
import { MdOutlinePayments, MdAdd, MdSearch, MdOutlineDelete, MdOutlineClear } from "react-icons/md";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import Pagination from "../../components/Pagination";
import CustomDropdown from "../../components/CustomDropdown";
import CustomMonthPicker from "../../components/CustomMonthPicker";
import ConfirmationModal from "../../components/ConfirmationModal";
import CreateTransactionModal from "../../components/CreateTransactionModal";
import Can from "../../components/Can";
import { MODULES, ACTIONS } from "../../constants/permissions";
import useFiscalYear from "../../hooks/useFiscalYear";
import useYearLock from "../../hooks/useYearLock";
import useFyResetState from "../../hooks/useFyResetState";
import { paginate } from "../../data/common";
import { TRANSACTIONS, removeTransaction } from "../../data/groupE";

const txPeriod = (r) => `${r.period_year}-${String(r.period_month).padStart(2, "0")}`;
const money = (n) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const LIMIT = 10;

export default function Transactions() {
  const { t } = useTranslation("payroll");
  const fy = useFiscalYear();
  const lock = useYearLock();
  // Month + page start over (month → the FY's default) when the year changes.
  const [month, setMonth] = useFyResetState(fy.defaultMonth, fy.version);
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useFyResetState(1, fy.version);
  const [tick, setTick] = useState(0);
  const loading = false;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Month + type filter, then the page (the API filtered + paged server-side).
  const [y, m] = (month || "").split("-").map(Number);
  const filtered = tick >= 0
    ? TRANSACTIONS.filter((r) => r.period_year === y && r.period_month === m && (!typeFilter || r.type === typeFilter))
    : [];
  const pg = paginate(filtered, page, LIMIT);
  const data = { rows: pg.rows, total: pg.total, total_pages: pg.totalPages };
  const load = () => setTick((n) => n + 1);

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      removeTransaction(toDelete.id);
      toast.success(t("transactions.toast.removed"));
      setToDelete(null);
      load();
    } finally {
      setDeleting(false);
    }
  };

  const rows = search
    ? data.rows.filter((r) => (r.employee_name || "").toLowerCase().includes(search.toLowerCase()))
    : data.rows;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MdOutlinePayments className="text-cyan-600" /> {t("transactions.title")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t("transactions.subtitle")}
          </p>
        </div>
        {!lock.locked && (
        <Can module={MODULES.PAYROLL} action={ACTIONS.CREATE}>
          <button onClick={() => setIsModalOpen(true)} className="flex items-center w-max gap-2 px-4 py-2.5 bg-cyan-600 text-white text-sm font-medium rounded-lg hover:bg-cyan-700">
            <MdAdd className="text-lg" /> {t("transactions.add")}
          </button>
        </Can>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 sm:p-5 border border-gray-200 rounded-xl flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <MdSearch className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 text-xl" />
          <input type="text" placeholder={t("transactions.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full h-[42px] border border-gray-200 text-gray-700 text-sm rounded-lg ps-10 pe-3 focus:outline-none focus:ring-1 focus:ring-cyan-500" />
        </div>
        <div className="flex gap-4">
          <CustomMonthPicker
            value={month}
            onChange={(val) => {
              setMonth(val);
              setPage(1);
            }}
            className="h-[42px]"
          />
          <div className="w-44">
            <CustomDropdown value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              options={[{ label: t("transactions.allTypes"), value: "" }, { label: t("transactions.earningAdd"), value: "EARNING" }, { label: t("transactions.deduction"), value: "DEDUCTION" }]} />
          </div>
          <button
            onClick={() => {
              setSearch("");
              setMonth(fy.defaultMonth);
              setTypeFilter("");
              setPage(1);
            }}
            className="flex items-center gap-2 bg-cyan-600 text-white px-4 py-2 text-sm font-medium rounded-lg hover:bg-cyan-700 h-[42px]"
          >
            <MdOutlineClear className="text-lg" />
            {t("transactions.clearFilters")}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-[#F8F9FE]">
                {[t("transactions.table.sn"), t("transactions.table.employee"), t("transactions.table.project"), t("transactions.table.month"), t("transactions.table.type"), t("transactions.table.label"), t("transactions.table.amount"), t("transactions.table.action")].map((h) => (
                  <th key={h} className="px-5 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-sm">
              {loading ? (
                <tr><td colSpan={8} className="px-5 py-8 text-center text-gray-400">{t("transactions.loading")}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-8 text-center text-gray-500">{t("transactions.empty")}</td></tr>
              ) : (
                rows.map((r, i) => (
                  <tr key={r.id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-4 text-gray-600 font-semibold">{(page - 1) * LIMIT + i + 1}</td>
                    <td className="px-5 py-4">
                      <div className="font-semibold text-gray-900">{r.employee_name || `#${r.employee_id}`}</div>
                      {r.employee_code && <div className="text-xs text-gray-400">{r.employee_code}</div>}
                    </td>
                    <td className="px-5 py-4 text-gray-600">{r.project_name || t("transactions.all")}</td>
                    <td className="px-5 py-4 text-gray-600">{t(`monthsShort.${r.period_month}`)} {r.period_year}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${r.type === "DEDUCTION" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                        {r.is_advance ? t("transactions.badge.advance") : r.type === "DEDUCTION" ? t("transactions.badge.deduct") : t("transactions.badge.earning")}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-700">{r.label}</td>
                    <td className={`px-5 py-4 font-semibold ${r.type === "DEDUCTION" ? "text-red-600" : "text-gray-900"}`}>
                      {r.type === "DEDUCTION" ? "−" : "+"}{money(r.amount)}
                    </td>
                    <td className="px-5 py-4">
                      <Can module={MODULES.PAYROLL} action={ACTIONS.DELETE} fallback={<span className="text-gray-300">—</span>}>
                        <button
                          onClick={() => setToDelete(r)}
                          disabled={lock.isLockedDate(txPeriod(r))}
                          title={lock.isLockedDate(txPeriod(r)) ? lock.titleFor(txPeriod(r)) : t("transactions.remove")}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-400"
                        >
                          <MdOutlineDelete className="text-[18px]" />
                        </button>
                      </Can>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} limit={LIMIT} total={data.total} totalPages={data.total_pages || 1} onPage={setPage}
          label={t("transactions.paginationLabel")} activeClass="bg-cyan-600 text-white"
          containerClass="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-gray-100 bg-gray-50/50" />
      </div>

      <CreateTransactionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={load} defaultMonth={month} />

      <ConfirmationModal
        isOpen={!!toDelete}
        onClose={() => (deleting ? null : setToDelete(null))}
        onConfirm={confirmDelete}
        type="delete"
        title={t("transactions.deleteConfirm.title")}
        message={toDelete ? t("transactions.deleteConfirm.message", { label: toDelete.label, amount: money(toDelete.amount), name: toDelete.employee_name || t("transactions.deleteConfirm.employeeFallback") }) : ""}
        confirmText={t("transactions.deleteConfirm.confirm")}
        isLoading={deleting}
      />
    </div>
  );
}
