import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import {
  MdAdd,
  MdArrowBack,
  MdOutlineClear,
  MdOutlineDelete,
  MdOutlineEdit,
  MdOutlineInfo,
  MdOutlineRefresh,
  MdOutlineTrendingUp,
  MdOutlineUndo,
  MdOutlineVisibility,
  MdSearch,
  MdCheckCircleOutline,
} from "react-icons/md";
import Pagination from "../../components/Pagination";
import CustomDropdown from "../../components/CustomDropdown";
import ConfirmationModal from "../../components/ConfirmationModal";
import Loader from "../../components/Loader";
import Can from "../../components/Can";
import Ltr from "../../components/Ltr";
import IncrementModal from "../../components/payroll/IncrementModal";
import { MODULES, ACTIONS } from "../../constants/permissions";
import useFiscalYear from "../../hooks/useFiscalYear";
import useYearLock from "../../hooks/useYearLock";
import useFyResetState from "../../hooks/useFyResetState";
import { useFormat } from "../../hooks/useFormat";
import FyLoadError from "../../components/fiscalYear/FyLoadError";
import { INCREMENT_KINDS, INCREMENT_STATUSES } from "../../utils/fyValidation/payroll";
import { paginate } from "../../data/common";
import {
  applyIncrementBatch,
  deleteIncrementBatch,
  getIncrementBatch,
  listIncrementBatches,
  previewIncrementBatch,
  revertIncrementBatch,
  toggleIncrementLine,
} from "../../data/groupE";

const LIMIT = 10;
const pad = (n) => String(n).padStart(2, "0");
const money = (n) =>
  n === null || n === undefined
    ? "—"
    : Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const periodOf = (b) => `${b.effective_year}-${pad(b.effective_month)}`;

const STATUS_STYLE = {
  DRAFT: "bg-gray-100 text-gray-700",
  APPLIED: "bg-green-100 text-green-700",
  REVERTED: "bg-amber-100 text-amber-700",
};

export default function SalaryIncrements() {
  const { t } = useTranslation("payroll");
  const fy = useFiscalYear();
  const lock = useYearLock();
  const { fmtDate } = useFormat();
  const statusLabel = (s) => t(`increments.status.${s}`, { defaultValue: s });
  const monthText = (b) => `${t(`months.${b.effective_month}`)} ${b.effective_year}`;
  const valueText = (b) =>
    b.type === "PERCENT" ? `${Number(b.value)}%` : `+${money(b.value)}`;

  // ── list (FY = the header's year, sent explicitly) ──
  const [page, setPage] = useFyResetState(1, fy.version);
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState(""); // "" | BULK | SINGLE (one employee, from Employee → Payroll)
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState(""); // the search sent to the server (debounced)
  const searchTimer = useRef(null);
  const onSearch = (value) => {
    setSearch(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setQuery(value.trim());
      setPage(1);
    }, 350);
  };
  useEffect(() => () => clearTimeout(searchTimer.current), []);
  const [tick, setTick] = useState(0);
  const loading = false;
  // The FY's batches from the static store — status / kind / search + paging.
  const all = fy.selected && tick >= 0
    ? listIncrementBatches({ fy: fy.selected, ...(status ? { status } : {}), ...(kind ? { kind } : {}), ...(query ? { search: query } : {}) })
    : [];
  const pg = paginate(all, page, LIMIT);
  const list = { rows: pg.rows, total: pg.total, total_pages: pg.totalPages };
  const load = () => setTick((n) => n + 1);

  // ── detail ──
  // the open batch belongs to one FY → closed when the header year changes
  const [detail, setDetail] = useFyResetState(null, fy.version);
  const detailLoading = false;
  const [busy, setBusy] = useState(null); // "preview" | "apply" | "revert" | "delete" | lineId
  const [actionError, setActionError] = useState("");
  const [lineErrors, setLineErrors] = useState({}); // { [lineId]: message } (never set in the static build)
  const [confirm, setConfirm] = useState(null); // "apply" | "revert" | "delete"
  const [modal, setModal] = useState(null); // { batch } | { batch: null }

  const openDetail = async (id) => {
    setActionError("");
    setLineErrors({});
    setDetail(getIncrementBatch(id));
  };

  const runPreview = async (id) => {
    setBusy("preview");
    setActionError("");
    try {
      const d = previewIncrementBatch(id);
      setDetail(d);
      setLineErrors({});
      toast.success(t("increments.toast.previewed", { count: d?.totals?.employees ?? 0 }));
    } finally {
      setBusy(null);
    }
  };

  const toggleLine = async (line) => {
    if (!detail) return;
    setBusy(line.id);
    setLineErrors((m) => ({ ...m, [line.id]: undefined }));
    try {
      setDetail(toggleIncrementLine(detail.id, line.id, !line.excluded));
      load();
    } finally {
      setBusy(null);
    }
  };

  const doConfirm = async () => {
    if (!detail || !confirm) return;
    const kind = confirm;
    setBusy(kind);
    setActionError("");
    try {
      if (kind === "delete") {
        deleteIncrementBatch(detail.id);
        toast.success(t("increments.toast.deleted"));
        setDetail(null);
      } else if (kind === "apply") {
        const d = applyIncrementBatch(detail.id);
        setDetail(d);
        toast.success(t("increments.toast.applied", { count: d?.applied_count ?? 0 }));
      } else {
        const d = revertIncrementBatch(detail.id);
        setDetail(d);
        toast.success(t("increments.toast.reverted", { count: d?.reverted_count ?? 0 }));
      }
      load();
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  };

  const onSaved = async (saved) => {
    setModal(null);
    toast.success(t("increments.toast.saved"));
    load();
    if (saved?.id) {
      setDetail(saved);
      setActionError("");
      setLineErrors({});
      // The terms changed → (re)build the lines straight away.
      await runPreview(saved.id);
    }
  };

  const rows = list.rows;

  // ── Detail view ──
  if (detail || detailLoading) {
    if (!detail) return <Loader className="py-24" />;
    const b = detail;
    const batchLocked = lock.isLockedDate(periodOf(b));
    const lockTitle = batchLocked ? lock.titleFor(periodOf(b)) : undefined;
    const isDraft = b.status === "DRAFT";
    const lines = b.lines || [];
    const tot = b.totals || {};
    return (
      <div className="space-y-5">
        <button
          onClick={() => setDetail(null)}
          className="inline-flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-gray-900"
        >
          <MdArrowBack className="rtl:rotate-180" /> {t("increments.detail.back")}
        </button>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-[#f8f9fc] flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900">{b.title}</h2>
                {b.kind === "SINGLE" && (
                  <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-cyan-50 text-cyan-700 border border-cyan-100">
                    {t("increments.kind.SINGLE")}
                  </span>
                )}
                <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${STATUS_STYLE[b.status] || "bg-gray-100 text-gray-600"}`}>
                  {statusLabel(b.status)}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {t("increments.detail.meta", {
                  value: valueText(b),
                  applies: b.type === "AMOUNT" ? t("increments.appliesTo.BASIC_ONLY") : t(`increments.appliesTo.${b.applies_to}`),
                  month: monthText(b),
                })}
              </p>
              {b.kind === "SINGLE" && (
                <p className="text-sm text-gray-600 mt-1">
                  {t("increments.detail.singleMeta", { date: fmtDate(b.effective_date), reason: b.reason || "—" })}
                </p>
              )}
              {b.applied_at && (
                <p className="text-xs text-gray-400 mt-1">{t("increments.detail.appliedOn", { date: fmtDate(b.applied_at) })}</p>
              )}
              {b.reverted_at && (
                <p className="text-xs text-gray-400 mt-1">{t("increments.detail.revertedOn", { date: fmtDate(b.reverted_at) })}</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isDraft && (
                <>
                  <Can module={MODULES.PAYROLL} action={ACTIONS.UPDATE}>
                    <button
                      onClick={() => setModal({ batch: b })}
                      disabled={!!busy || batchLocked}
                      title={lockTitle}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <MdOutlineEdit className="text-base" /> {t("increments.detail.edit")}
                    </button>
                    <button
                      onClick={() => runPreview(b.id)}
                      disabled={!!busy || batchLocked}
                      title={lockTitle}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-cyan-700 bg-cyan-50 border border-cyan-100 hover:bg-cyan-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <MdOutlineRefresh className={`text-base ${busy === "preview" ? "animate-spin" : ""}`} />
                      {lines.length ? t("increments.detail.refreshPreview") : t("increments.detail.preview")}
                    </button>
                    <button
                      onClick={() => setConfirm("apply")}
                      disabled={!!busy || batchLocked || !tot.included}
                      title={lockTitle || (!tot.included ? t("increments.detail.applyHint") : undefined)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <MdCheckCircleOutline className="text-base" /> {t("increments.detail.apply")}
                    </button>
                  </Can>
                  <Can module={MODULES.PAYROLL} action={ACTIONS.DELETE}>
                    <button
                      onClick={() => setConfirm("delete")}
                      disabled={!!busy}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-red-600 bg-white border border-red-200 hover:bg-red-50 disabled:opacity-50"
                    >
                      <MdOutlineDelete className="text-base" /> {t("increments.detail.delete")}
                    </button>
                  </Can>
                </>
              )}
              {b.status === "APPLIED" && (
                <Can module={MODULES.PAYROLL} action={ACTIONS.UPDATE}>
                  <button
                    onClick={() => setConfirm("revert")}
                    disabled={!!busy || batchLocked}
                    title={lockTitle}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <MdOutlineUndo className="text-base" /> {t("increments.detail.revert")}
                  </button>
                </Can>
              )}
            </div>
          </div>

          {actionError && (
            <div className="mx-5 mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700" role="alert">
              <MdOutlineInfo className="text-lg flex-shrink-0 mt-0.5" />
              <span>{actionError}</span>
            </div>
          )}

          {/* Totals */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-5">
            {[
              { k: "employees", v: tot.employees ?? 0 },
              { k: "included", v: tot.included ?? 0 },
              { k: "oldGross", v: money(tot.old_gross) },
              { k: "newGross", v: money(tot.new_gross) },
            ].map((c) => (
              <div key={c.k} className="border border-gray-100 rounded-lg px-3 py-2.5">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t(`increments.detail.totals.${c.k}`)}</p>
                <p className="text-base font-bold text-gray-900 mt-0.5"><Ltr>{c.v}</Ltr></p>
              </div>
            ))}
          </div>

          {Array.isArray(b.skipped_no_salary) && b.skipped_no_salary.length > 0 && (
            <p className="mx-5 -mt-2 mb-3 text-xs text-amber-700">
              {t("increments.detail.skippedNoSalary", { count: b.skipped_no_salary.length })}
            </p>
          )}

          {/* Lines */}
          <div className="overflow-x-auto border-t border-gray-100">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-[#f8f9fc]">
                  {[
                    t("increments.detail.table.include"),
                    t("increments.detail.table.employee"),
                    t("increments.detail.table.oldGross"),
                    t("increments.detail.table.newGross"),
                    t("increments.detail.table.difference"),
                  ].map((h) => (
                    <th key={h} className="px-5 py-3 text-start text-[10px] font-bold text-gray-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {busy === "preview" ? (
                  <tr><td colSpan={5}><Loader className="py-10" /></td></tr>
                ) : lines.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-gray-500">
                      {isDraft ? t("increments.detail.noLinesDraft") : t("increments.detail.noLines")}
                    </td>
                  </tr>
                ) : (
                  lines.map((l) => (
                    <tr key={l.id} className={l.excluded ? "bg-gray-50/70 text-gray-400" : "hover:bg-gray-50/50"}>
                      <td className="px-5 py-3 align-top">
                        <input
                          type="checkbox"
                          checked={!l.excluded}
                          onChange={() => toggleLine(l)}
                          disabled={!isDraft || batchLocked || busy === l.id || !!(busy && typeof busy === "string")}
                          title={lockTitle || (l.excluded ? t("increments.detail.include") : t("increments.detail.exclude"))}
                          aria-label={l.excluded ? t("increments.detail.include") : t("increments.detail.exclude")}
                          className="w-4 h-4 accent-cyan-600 cursor-pointer disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="px-5 py-3 align-top">
                        <div className={`font-semibold ${l.excluded ? "text-gray-400 line-through" : "text-gray-900"}`}>
                          {l.employee_name || t("increments.detail.employeeFallback", { id: l.employee_id })}
                        </div>
                        {l.employee_code && <div className="text-xs text-gray-400"><Ltr>{l.employee_code}</Ltr></div>}
                        {lineErrors[l.id] && <p className="text-red-500 text-xs mt-1">{lineErrors[l.id]}</p>}
                      </td>
                      <td className="px-5 py-3 align-top"><Ltr>{money(l.old_gross)}</Ltr></td>
                      <td className="px-5 py-3 align-top font-semibold"><Ltr>{money(l.new_gross)}</Ltr></td>
                      <td className={`px-5 py-3 align-top font-semibold ${l.excluded ? "" : "text-green-700"}`}>
                        <Ltr>{l.difference === null || l.difference === undefined ? "—" : `+${money(l.difference)}`}</Ltr>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <ConfirmationModal
          isOpen={!!confirm}
          onClose={() => (busy ? null : setConfirm(null))}
          onConfirm={doConfirm}
          type={confirm === "delete" ? "delete" : confirm === "apply" ? "success" : "warning"}
          title={confirm ? t(`increments.confirm.${confirm}.title`) : ""}
          message={
            confirm
              ? t(`increments.confirm.${confirm}.message`, { title: b.title, count: tot.included ?? 0, month: monthText(b) })
              : ""
          }
          confirmText={confirm ? t(`increments.confirm.${confirm}.confirm`) : ""}
          isLoading={!!busy}
        />

        {modal && (
          <IncrementModal key={`edit-${b.id}`} batch={modal.batch} onClose={() => setModal(null)} onSaved={onSaved} />
        )}
      </div>
    );
  }

  // ── List view ──
  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <MdOutlineTrendingUp className="text-cyan-600" /> {t("increments.title")}
          </h1>
          <p className="text-gray-500 mt-1 text-sm">{t("increments.subtitle", { label: fy.label })}</p>
        </div>
        {!lock.locked && (
          <Can module={MODULES.PAYROLL} action={ACTIONS.CREATE}>
            <button
              onClick={() => setModal({ batch: null })}
              className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm transition-colors w-max"
            >
              <MdAdd className="text-lg" /> {t("increments.new")}
            </button>
          </Can>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <MdSearch className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 text-xl" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={t("increments.searchPlaceholder")}
            className="w-full h-[42px] border border-gray-200 text-gray-700 text-sm rounded-lg ps-10 pe-3 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>
        <div className="w-full md:w-48">
          <CustomDropdown
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setPage(1);
            }}
            options={[
              { value: "", label: t("increments.allKinds") },
              ...INCREMENT_KINDS.map((k) => ({ value: k, label: t(`increments.kind.${k}`) })),
            ]}
          />
        </div>
        <div className="w-full md:w-48">
          <CustomDropdown
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            options={[
              { value: "", label: t("increments.allStatuses") },
              ...INCREMENT_STATUSES.map((s) => ({ value: s, label: statusLabel(s) })),
            ]}
          />
        </div>
        <button
          onClick={() => {
            clearTimeout(searchTimer.current);
            setSearch("");
            setQuery("");
            setStatus("");
            setKind("");
            setPage(1);
          }}
          className="flex items-center justify-center gap-2 bg-cyan-600 text-white px-4 text-sm font-medium rounded-lg hover:bg-cyan-700 h-[42px]"
        >
          <MdOutlineClear className="text-lg" /> {t("increments.clearFilters")}
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-[#F8F9FE]">
                {[
                  t("increments.table.sn"),
                  t("increments.table.title"),
                  t("increments.table.increment"),
                  t("increments.table.appliesTo"),
                  t("increments.table.effective"),
                  t("increments.table.employees"),
                  t("increments.table.status"),
                  t("increments.table.action"),
                ].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-start text-[11px] font-bold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {fy.failed ? (
                <tr><td colSpan={8}><FyLoadError /></td></tr>
              ) : loading || !fy.loaded ? (
                <tr><td colSpan={8}><Loader className="py-12" /></td></tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center">
                    <MdOutlineTrendingUp className="text-4xl text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">{search || status || kind ? t("increments.emptyFiltered") : t("increments.empty", { label: fy.label })}</p>
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => (
                  <tr key={r.id} className="hover:bg-gray-50/60 cursor-pointer" onClick={() => openDetail(r.id)}>
                    <td className="px-5 py-3.5 text-gray-500">{(page - 1) * LIMIT + i + 1}</td>
                    <td className="px-5 py-3.5 font-semibold text-gray-900">
                      {r.title}
                      {r.kind === "SINGLE" && (
                        <span className="ms-2 inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-cyan-50 text-cyan-700 border border-cyan-100 align-middle">
                          {t("increments.kind.SINGLE")}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-gray-700"><Ltr>{valueText(r)}</Ltr></td>
                    <td className="px-5 py-3.5 text-gray-600">
                      {r.type === "AMOUNT" ? t("increments.appliesTo.BASIC_ONLY") : t(`increments.appliesTo.${r.applies_to}`)}
                    </td>
                    <td className="px-5 py-3.5 text-gray-700 whitespace-nowrap">{monthText(r)}</td>
                    <td className="px-5 py-3.5 text-gray-700">
                      {r.line_count
                        ? t("increments.table.employeesValue", { included: r.line_count - (r.excluded_count || 0), total: r.line_count })
                        : "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${STATUS_STYLE[r.status] || "bg-gray-100 text-gray-600"}`}>
                        {statusLabel(r.status)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openDetail(r.id);
                        }}
                        title={t("increments.view")}
                        className="p-1.5 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg"
                      >
                        <MdOutlineVisibility className="text-lg" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          limit={LIMIT}
          total={list.total}
          totalPages={list.total_pages || 1}
          onPage={setPage}
          label={t("increments.paginationLabel")}
          activeClass="bg-cyan-600 text-white"
        />
      </div>

      {modal && (
        <IncrementModal key="create" batch={modal.batch} onClose={() => setModal(null)} onSaved={onSaved} />
      )}
    </div>
  );
}
