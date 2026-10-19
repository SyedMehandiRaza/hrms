import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { MdAdd, MdOutlinePayments, MdOutlineInbox, MdOutlineSearch, MdOutlineClear } from "react-icons/md";
import { paginate } from "../../data/common";
import { listLoans } from "../../data/groupE";
import { LOAN_STATUS_STYLES, fmtMoney } from "./loanUi";
import ApplyLoanModal from "./ApplyLoanModal";
import Pagination from "../../components/Pagination";
import CustomDropdown from "../../components/CustomDropdown";
import { useTranslation } from "react-i18next";
import useFiscalYear from "../../hooks/useFiscalYear";
import useYearLock from "../../hooks/useYearLock";
import useFyResetState from "../../hooks/useFyResetState";

// Reusable "my loans" inbox — used in admin My Request and the Employee portal.
const DEFAULT_TITLE = "My Loans";
const DEFAULT_SUBTITLE = "Apply for a company loan and track your EMIs.";

export default function MyLoans({ title = DEFAULT_TITLE, subtitle = DEFAULT_SUBTITLE }) {
  const { t } = useTranslation("loans");
  const statusLabel = (s) => t(`status.${LOAN_STATUS_STYLES[s] ? s : "PENDING"}`);
  const [tick, setTick] = useState(0);
  const loaded = true;
  const [applyOpen, setApplyOpen] = useState(false);
  const fy = useFiscalYear();
  const lock = useYearLock();
  // FY-scoped list: page 1 again on a year change.
  const [page, setPage] = useFyResetState(1, fy.version);
  const [limit] = useState(10);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All Statuses");
  const [resubmitTarget, setResubmitTarget] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  // My loans (static) — search / status filter + paging on the client.
  const mine = tick >= 0
    ? listLoans({ scope: "mine", ...(search && { search }), ...(status !== "All Statuses" && { status }) })
    : [];
  const pg = paginate(mine, page, limit);
  const loans = pg.rows;
  const total = pg.total;
  const totalPages = pg.totalPages;
  const refresh = () => setTick((n) => n + 1);

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">{title === DEFAULT_TITLE ? t("page.title") : title}</h1>
          <p className="text-gray-500 mt-1 text-sm">{subtitle === DEFAULT_SUBTITLE ? t("page.subtitle") : subtitle}</p>
        </div>
        {!lock.locked && (
        <button onClick={() => setApplyOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg shadow-sm transition-all">
          <MdAdd className="text-lg" /> {t("actions.applyForLoan")}
        </button>
        )}
      </div>

      {/* ── Filters Bar ── */}
      <div className="bg-white border border-gray-200 rounded-xl px-4 py-4">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          {/* Search */}
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
              {t("filters.searchLabel")}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none">
                <MdOutlineSearch className="text-gray-400 text-lg" />
              </div>
              <input
                type="text"
                placeholder={t("filters.searchPlaceholder")}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full appearance-none border border-gray-200 rounded-lg ps-10 px-3 py-2.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          {/* Status */}
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
              {t("filters.status")}
            </label>
            <div className="relative">
              <CustomDropdown
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                options={[
                  { label: t("filters.allStatuses"), value: "All Statuses" },
                  { label: t("status.PENDING"), value: "PENDING" },
                  { label: t("status.APPROVED"), value: "APPROVED" },
                  { label: t("status.MODIFICATION_REQUESTED"), value: "MODIFICATION_REQUESTED" },
                  { label: t("status.REJECTED"), value: "REJECTED" },
                  { label: t("status.DISBURSED"), value: "DISBURSED" },
                  { label: t("status.COMPLETED"), value: "COMPLETED" },
                  { label: t("status.CANCELLED"), value: "CANCELLED" },
                ]}
              />
            </div>
          </div>

          {/* Clear Filters Button */}
          <div className="flex-shrink-0 w-full sm:w-auto h-[42px]">
            <button
              onClick={() => {
                setSearch("");
                setStatus("All Statuses");
                setPage(1);
              }}
              className="w-full sm:w-auto flex justify-center items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-2 rounded-lg font-medium text-sm transition-colors h-[42px]"
            >
              <MdOutlineClear className="text-lg" />
              {t("common.clearFilters")}
            </button>
          </div>
        </div>
      </div>

      {/* ── Loan Table ── */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {[t("table.sno"), t("table.loan"), t("table.amount"), t("table.emi"), t("table.installments"), t("table.outstanding"), t("table.status")].map((h) => (
                  <th key={h} className="text-start px-5 py-3">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {!loaded ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-gray-400">{t("common.loading")}</td>
                </tr>
              ) : loans.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center mb-4">
                        <MdOutlineInbox className="text-3xl text-gray-300" />
                      </div>
                      <h3 className="text-base font-bold text-gray-900 mb-1">{t("empty.title")}</h3>
                      <p className="text-sm text-gray-500 max-w-sm">{t("empty.description")}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                loans.map((l, index) => {
                  const st = LOAN_STATUS_STYLES[l.status] || LOAN_STATUS_STYLES.PENDING;
                  return (
                    <tr key={l.id} onClick={() => {
                        const currentPath = location.pathname.replace(/\/$/, "");
                        navigate(`${currentPath}/${l.id}`);
                      }} className="hover:bg-gray-50 transition-colors cursor-pointer">
                      <td className="px-5 py-4 text-sm text-gray-700">
                        {(page - 1) * limit + index + 1}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center"><MdOutlinePayments className="text-base" /></div>
                          <div>
                            <p className="font-bold text-gray-900 text-sm">{l.loan_number || t("common.loanFallback", { id: l.id })}</p>
                            <p className="text-[11px] text-gray-400 truncate max-w-[220px]">{l.purpose || "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-700">{fmtMoney(l.approved_amount ?? l.requested_amount)}</td>
                      <td className="px-5 py-4 text-sm text-gray-700">{l.emi_amount ? fmtMoney(l.emi_amount) : "—"}</td>
                      <td className="px-5 py-4 text-sm text-gray-700">{l.approved_installments ?? l.requested_installments}</td>
                      <td className="px-5 py-4 text-sm text-gray-700">{fmtMoney(l.outstanding_principal)}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${st.chip}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />{statusLabel(l.status)}
                          </span>
                          {l.status === "MODIFICATION_REQUESTED" && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setResubmitTarget(l); }}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-white bg-orange-500 hover:bg-orange-600 transition-colors"
                            >
                              {t("actions.updateReapply")}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden divide-y divide-gray-100">
          {!loaded ? (
            <div className="py-12 text-center text-sm text-gray-400">{t("common.loading")}</div>
          ) : loans.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center mb-4">
                <MdOutlineInbox className="text-3xl text-gray-300" />
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-1">{t("empty.title")}</h3>
              <p className="text-sm text-gray-500 max-w-sm px-4">{t("empty.description")}</p>
            </div>
          ) : (
            loans.map((l, index) => {
              const st = LOAN_STATUS_STYLES[l.status] || LOAN_STATUS_STYLES.PENDING;
              return (
                <div key={l.id} onClick={() => {
                  const currentPath = location.pathname.replace(/\/$/, "");
                  navigate(`${currentPath}/${l.id}`);
                }} className="px-4 py-4 space-y-3 cursor-pointer hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="inline-flex items-center px-2 py-0.5 mt-1 rounded text-[10px] font-bold text-gray-700 bg-gray-100 border border-gray-200">
                        #{(page - 1) * limit + index + 1}
                      </span>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center">
                          <MdOutlinePayments className="text-base" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{l.loan_number || t("common.loanFallback", { id: l.id })}</p>
                          <p className="text-[11px] text-gray-400 truncate max-w-[150px]">{l.purpose || "—"}</p>
                        </div>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold flex-shrink-0 ${st.chip}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />{statusLabel(l.status)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                    <span>{t("table.amount")} <strong className="text-gray-800">{fmtMoney(l.approved_amount ?? l.requested_amount)}</strong></span>
                    <span>{t("table.emi")} <strong className="text-gray-800">{l.emi_amount ? fmtMoney(l.emi_amount) : "—"}</strong></span>
                    <span>{t("table.installments")} <strong className="text-gray-800">{l.approved_installments ?? l.requested_installments}</strong></span>
                    <span>{t("table.outstanding")} <strong className="text-gray-800">{fmtMoney(l.outstanding_principal)}</strong></span>
                  </div>
                  {l.status === "MODIFICATION_REQUESTED" && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setResubmitTarget(l); }}
                      className="w-full px-3 py-2 rounded-lg text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 transition-colors"
                    >
                      {t("actions.updateReapply")}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {loans.length > 0 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            limit={limit}
            onPage={setPage}
            label={t("pagination.loans")}
            activeClass="bg-cyan-600 text-white"
            containerClass="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-gray-100"
          />
        )}
      </div>

      {applyOpen && <ApplyLoanModal onClose={() => setApplyOpen(false)} onCreated={refresh} />}
      {resubmitTarget && (
        <ApplyLoanModal
          loan={resubmitTarget}
          onClose={() => setResubmitTarget(null)}
          onCreated={refresh}
        />
      )}
    </div>
  );
}
