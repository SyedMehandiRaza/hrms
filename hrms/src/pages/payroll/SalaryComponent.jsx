import { useEffect, useState } from "react";
import Pagination from "../../components/Pagination";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import {
  MdOutlineAdd,
  MdOutlineSearch,
  MdOutlineVisibility,
  MdOutlineEdit,
  MdOutlineDeleteOutline,
  MdOutlineLock,
  MdOutlineClear
} from "react-icons/md";
import SalaryComponentModal from "../../components/SalaryComponentModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import Can from "../../components/Can";
import { MODULES, ACTIONS } from "../../constants/permissions";
import { matches, paginate } from "../../data/common";
import { SALARY_COMPONENTS, deactivateSalaryComponent } from "../../data/groupE";
import CustomDropdown from "../../components/CustomDropdown";

const LIMIT = 5;

const TYPE_STYLES = {
  EARNING: "text-blue-600 bg-blue-50 border-blue-100",
  DEDUCTION: "text-gray-600 bg-gray-100 border-gray-200",
};
const STATUS_STYLES = {
  ACTIVE: "text-green-600 bg-green-50 border-green-100",
  INACTIVE: "text-gray-500 bg-gray-100 border-gray-200",
};



const SalaryComponent = () => {
  const { t } = useTranslation("payroll");
  const loading = false;
  const deleteLoading = false;
  const [tick, setTick] = useState(0);

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [type, setType] = useState("All");
  const [status, setStatus] = useState("All Statuses");
  const [page, setPage] = useState(1);
  const [modalState, setModalState] = useState({ isOpen: false, mode: "create", data: null });
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, item: null });

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Search / type / status filters + paging on the static list.
  const filtered = tick >= 0
    ? SALARY_COMPONENTS.filter(
      (c) =>
        matches(c, debouncedSearch, ["name", "description"]) &&
        (type === "All" || c.type === type) &&
        (status === "All Statuses" || (status === "ACTIVE") === !!c.is_active),
    )
    : [];
  const pg = paginate(filtered, page, LIMIT);
  const list = pg.rows;
  const pagination = { total: pg.total, total_pages: pg.totalPages };
  const load = () => setTick((n) => n + 1);

  const handleClearFilters = () => {
    setSearchInput("");
    setDebouncedSearch("");
    setType("All");
    setStatus("All Statuses");
    setPage(1);
  };

  const openModal = (mode, comp = null) => {
    const data = comp
      ? {
        id: comp.id,
        name: comp.name,
        type: comp.type,
        status: comp.is_active ? "ACTIVE" : "INACTIVE",
        description: comp.description || "",
      }
      : null;
    setModalState({ isOpen: true, mode, data });
  };
  const closeModal = () => setModalState((m) => ({ ...m, isOpen: false }));

  const handleConfirmDelete = () => {
    const item = deleteModal.item;
    if (!item) return;
    deactivateSalaryComponent(item.id);
    toast.success(t("components.toast.deactivated"));
    setDeleteModal({ isOpen: false, item: null });
    load();
  };

  const total = pagination?.total ?? 0;
  const totalPages = pagination?.total_pages ?? 1;

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
            {t("components.title")}
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            {t("components.subtitle")}
          </p>
        </div>

        <Can module={MODULES.PAYROLL} action={ACTIONS.CREATE}>
          <button
            onClick={() => openModal("create")}
            className="flex items-center gap-2 bg-[#17a2b8] hover:bg-[#138496] text-white px-4 py-2.5 rounded-lg font-medium text-sm transition-colors flex-shrink-0 self-start"
          >
            <MdOutlineAdd className="text-lg" />
            {t("components.create")}
          </button>
        </Can>
      </div>

      {/* ── Filters Bar ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <form
          onSubmit={(e) => e.preventDefault()}
          className="flex flex-col sm:flex-row flex-wrap gap-4 items-end"
        >
          {/* Search */}
          <div className="flex-1 min-w-[200px] flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              {t("components.search")}
            </label>
            <div className="relative">
              <MdOutlineSearch className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t("components.searchPlaceholder")}
                className="w-full ps-9 pe-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition h-[42px]"
              />
            </div>
          </div>

          {/* Type */}
          <div className="flex flex-col gap-1.5 min-w-[150px]">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              {t("components.type")}
            </label>
            <div className="relative">
              <CustomDropdown
                value={type}
                onChange={(e) => { setType(e.target.value); setPage(1); }}
                options={[
                  { label: t("components.all"), value: "All" },
                  { label: t("componentType.EARNING"), value: "EARNING" },
                  { label: t("componentType.DEDUCTION"), value: "DEDUCTION" }
                ]}
              />
            </div>
          </div>

          {/* Status */}
          <div className="flex flex-col gap-1.5 min-w-[150px]">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              {t("components.status")}
            </label>
            <div className="relative">
              <CustomDropdown
                value={status}
                onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                options={[
                  { label: t("components.allStatuses"), value: "All Statuses" },
                  { label: t("componentStatus.ACTIVE"), value: "ACTIVE" },
                  { label: t("componentStatus.INACTIVE"), value: "INACTIVE" }
                ]}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 h-[42px]">
            <button
              type="button"
              onClick={handleClearFilters}
              className="w-full sm:w-auto flex justify-center items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-2 rounded-lg font-medium text-sm transition-colors h-[42px]"
            >
              <MdOutlineClear className="text-lg" />
              {t("components.clearFilters")}
            </button>
          </div>
        </form>
      </div>

      {/* ── Table ── */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#f8f9fa]">
              <tr className="border-b border-gray-200">
                <th className="text-start px-6 py-4 text-[12px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">{t("components.table.sn")}</th>
                <th className="text-start px-6 py-4 text-[12px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">{t("components.table.name")}</th>
                <th className="text-start px-6 py-4 text-[12px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">{t("components.table.type")}</th>
                <th className="text-start px-6 py-4 text-[12px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">{t("components.table.status")}</th>
                <th className="text-start px-6 py-4 text-[12px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">{t("components.table.actions")}</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {loading && list.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-400">
                    {t("components.loading")}
                  </td>
                </tr>
              ) : list.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-400">
                    {t("components.empty")}
                  </td>
                </tr>
              ) : (
                list.map((comp, index) => {
                  const statusLabel = comp.is_active ? "ACTIVE" : "INACTIVE";
                  return (
                    <tr key={comp.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                        {String((page - 1) * LIMIT + index + 1).padStart(2, "0")}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-gray-800 whitespace-nowrap">
                        <span className="inline-flex items-center gap-2">
                          {comp.name}
                          {comp.is_system && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-gray-100 text-gray-500">
                              {t("components.default")}
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${TYPE_STYLES[comp.type]}`}>
                          {t(`componentType.${comp.type}`, { defaultValue: comp.type })}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLES[statusLabel]}`}>
                          {t(`componentStatus.${statusLabel}`)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-4 text-gray-400">
                          <button onClick={() => openModal("view", comp)} className="hover:text-cyan-600 transition-colors" title={t("components.view")}>
                            <MdOutlineVisibility className="text-lg" />
                          </button>
                          {comp.is_system ? (
                            <span className="text-gray-300" title={t("components.locked")}>
                              <MdOutlineLock className="text-lg" />
                            </span>
                          ) : (
                            <>
                              <Can module={MODULES.PAYROLL} action={ACTIONS.UPDATE}>
                                <button onClick={() => openModal("edit", comp)} className="hover:text-cyan-600 transition-colors" title={t("components.edit")}>
                                  <MdOutlineEdit className="text-lg" />
                                </button>
                              </Can>
                              <Can module={MODULES.PAYROLL} action={ACTIONS.DELETE}>
                                <button onClick={() => setDeleteModal({ isOpen: true, item: comp })} className="hover:text-red-500 transition-colors" title={t("components.delete")}>
                                  <MdOutlineDeleteOutline className="text-lg" />
                                </button>
                              </Can>
                            </>
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

        {/* Footer Pagination */}
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          limit={LIMIT}
          onPage={setPage}
          label={t("components.paginationLabel")}
          activeClass="bg-[#17a2b8] text-white"
          containerClass="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-gray-100"
        />
      </div>

      {/* ── Modal ── */}
      <SalaryComponentModal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        mode={modalState.mode}
        initialData={modalState.data}
        onSuccess={load}
      />

      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, item: null })}
        onConfirm={handleConfirmDelete}
        loading={deleteLoading}
        title={t("components.deleteConfirm.title")}
        message={t("components.deleteConfirm.message", { name: deleteModal.item?.name || t("components.deleteConfirm.thisComponent") })}
        type="delete"
      />
    </div>
  );
};

export default SalaryComponent;
