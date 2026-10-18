import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { MdEdit, MdEventAvailable, MdSearch } from "react-icons/md";

import CustomDropdown from "../CustomDropdown";
import Pagination from "../Pagination";
import ConfirmationModal from "../ConfirmationModal";
import { TableLoader } from "../Loader";
import LeaveOverrideModal from "./LeaveOverrideModal";
import { EmptyState, ErrorBox } from "./shared";
import { DATE_OPTS, primaryBtn } from "./styles";
import { closeYearLeave, getLeavePreview, YEAR_END_DEPARTMENTS, YEAR_END_LEAVE_TYPES } from "../../data/groupG";
import { useFormat } from "../../hooks/useFormat";

const LIMIT = 25;

// Year-end leave: what closing the FY's leave does per balance (carry /
// encash / lapse), per-balance overrides, then "Close leave".
export default function LeaveStep({ yearKey, readOnly, leaveClosed, onClosed }) {
  const { t } = useTranslation("fiscalYear");
  const { fmtNumber, fmtDate } = useFormat();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [leaveType, setLeaveType] = useState("");
  const [department, setDepartment] = useState("");
  const [page, setPage] = useState(1);
  const types = YEAR_END_LEAVE_TYPES;
  const departments = YEAR_END_DEPARTMENTS;
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [closing, setClosing] = useState(false);

  // debounce the search box
  useEffect(() => {
    const id = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(id);
  }, [search]);

  const query = {
    page,
    limit: LIMIT,
    ...(q ? { search: q } : {}),
    ...(leaveType ? { leave_type_id: leaveType } : {}),
    ...(department ? { department_id: department } : {}),
  };
  const [nonce, setNonce] = useState(0);
  const queryKey = `${yearKey}|${JSON.stringify(query)}|${nonce}`;
  const preview = useMemo(
    () => getLeavePreview(yearKey, query),
    // the query object is rebuilt each render; queryKey says when it changed
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryKey],
  );
  const loading = false;
  const loadError = null;
  const data = {
    rows: preview?.data || [],
    meta: preview?.meta || null,
    totals: preview?.totals || null,
  };
  const reload = () => setNonce((n) => n + 1);

  const doClose = async () => {
    setClosing(true);
    try {
      closeYearLeave(yearKey);
      toast.success(t("leaveStep.closedToast"));
      setConfirm(false);
      reload();
      onClosed?.();
    } catch {
      toast.error(t("ui.genericError"));
    } finally {
      setClosing(false);
    }
  };

  const totals = data.totals;
  const n = (v) => fmtNumber(v, { maximumFractionDigits: 2 });
  const COLS = 9;

  return (
    <div className="space-y-4">
      {leaveClosed && (
        <div className="flex items-start gap-2.5 rounded-lg bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-800">
          <MdEventAvailable className="text-lg shrink-0 mt-0.5" />
          <p>{t("leaveStep.alreadyClosed")}</p>
        </div>
      )}

      {totals && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {[
            ["employees", fmtNumber(totals.employees)],
            ["left", n(totals.left)],
            ["carry", n(totals.carry)],
            ["encash", n(totals.encash)],
            ["lapse", n(totals.lapse)],
            ["encash_amount", n(totals.encash_amount)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-gray-200 bg-white px-3 py-2.5">
              <p className="text-[11px] text-gray-500">{t(`leaveStep.totals.${k}`)}</p>
              <p className="text-base font-bold text-gray-900 mt-0.5">{v}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-2">
        <div className="relative flex-1">
          <MdSearch className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            maxLength={100}
            placeholder={t("leaveStep.search")}
            className="w-full border border-gray-200 rounded-lg ps-9 pe-3 py-2.5 text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-none focus:border-transparent"
          />
        </div>
        <div className="lg:w-52">
          <CustomDropdown
            value={leaveType}
            onChange={(e) => {
              setLeaveType(e.target.value);
              setPage(1);
            }}
            options={[
              { value: "", label: t("leaveStep.allLeaveTypes") },
              ...types.map((x) => ({ value: String(x.id), label: x.leave_name || x.name })),
            ]}
          />
        </div>
        <div className="lg:w-52">
          <CustomDropdown
            value={department}
            isSearchable
            onChange={(e) => {
              setDepartment(e.target.value);
              setPage(1);
            }}
            options={[
              { value: "", label: t("leaveStep.allDepartments") },
              ...departments.map((d) => ({ value: String(d.id), label: d.name || d.department_name })),
            ]}
          />
        </div>
      </div>

      <ErrorBox message={loadError} />

      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                {["employee", "leaveType", "left", "carry", "encash", "lapse", "expires", "override", "actions"].map((c) => (
                  <th key={c} className="px-4 py-3 text-start font-semibold whitespace-nowrap">
                    {t(`leaveStep.cols.${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <TableLoader colSpan={COLS} />
              ) : !data.rows.length ? (
                <tr>
                  <td colSpan={COLS}>
                    <EmptyState title={t("leaveStep.empty")} hint={leaveClosed ? t("leaveStep.emptyClosed") : undefined} />
                  </td>
                </tr>
              ) : (
                data.rows.map((r) => (
                  <tr key={r.balance_id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900">{r.employee?.full_name}</p>
                      {r.employee?.country_emp_id && <p className="text-xs text-gray-400">{r.employee.country_emp_id}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{r.leave_type?.name || "—"}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{n(r.left)}</td>
                    <td className="px-4 py-3 text-emerald-700">{n(r.carry)}</td>
                    <td className="px-4 py-3 text-cyan-700">
                      {n(r.encash)}
                      {r.encash_amount > 0 && <span className="block text-[11px] text-gray-400">{n(r.encash_amount)}</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{n(r.lapse)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {r.carry_expires_on ? fmtDate(r.carry_expires_on, DATE_OPTS) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {r.override ? (
                        <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-violet-50 text-violet-700" title={r.override.reason}>
                          {t("leaveStep.overridden")}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">{t("leaveStep.byPolicy")}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {!readOnly && !leaveClosed && (
                        <button
                          type="button"
                          onClick={() => setEditing(r)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 hover:text-cyan-800"
                        >
                          <MdEdit /> {t("leaveStep.override")}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {data.meta && data.meta.total > 0 && (
          <Pagination
            page={data.meta.page}
            totalPages={data.meta.totalPages}
            total={data.meta.total}
            limit={data.meta.limit}
            onPage={setPage}
            label={t("leaveStep.balancesLabel")}
          />
        )}
      </div>

      {!readOnly && !leaveClosed && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-3">
          <p className="text-sm text-gray-600">{t("leaveStep.closeHint")}</p>
          <button type="button" onClick={() => setConfirm(true)} className={`${primaryBtn} shrink-0`}>
            {t("leaveStep.closeLeave")}
          </button>
        </div>
      )}

      {editing && (
        <LeaveOverrideModal
          yearKey={yearKey}
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={() => reload()}
        />
      )}
      <ConfirmationModal
        isOpen={confirm}
        onClose={() => !closing && setConfirm(false)}
        onConfirm={doClose}
        isLoading={closing}
        type="status"
        title={t("leaveStep.confirmTitle")}
        message={t("leaveStep.confirmMessage")}
        confirmText={t("leaveStep.closeLeave")}
        cancelText={t("ui.cancel")}
      />
    </div>
  );
}
