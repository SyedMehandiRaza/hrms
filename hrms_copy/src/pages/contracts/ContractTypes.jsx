import { useState, useEffect } from "react";
import Pagination from "../../components/Pagination";
import {
  MdOutlineSearch,
  MdOutlineRemoveRedEye,
  MdOutlineEdit,
  MdOutlineDeleteOutline,
  MdAdd,
  MdOutlineClear
} from "react-icons/md";
import ConfirmationModal from "../../components/ConfirmationModal";
import CreateContractTypeModal from "../../components/CreateContractTypeModal";
import SuccessModal from "../../components/SuccessModal";
import CustomDropdown from "../../components/CustomDropdown";

import { contractTypesStore, useContractTypes } from "../../data/groupF";
import { matches } from "../../data/common";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";

export default function ContractTypes() {
  const { t } = useTranslation("contracts");
  const contractTypes = useContractTypes();
  const loading = false;

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusInput, setStatusInput] = useState("all");
  const [page, setPage] = useState(1);
  const LIMIT = 10;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // client-side search + status filter
  const list = contractTypes.filter(
    (item) =>
      matches(item, debouncedSearch, ["name", "code", "description"]) &&
      (statusInput === "all" || (statusInput === "active") === !!item.is_active)
  );

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  
  const [modalState, setModalState] = useState({
    isOpen: false,
    mode: "create",
    data: null,
  });

  const handleDeleteClick = (id) => {
    setItemToDelete(id);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (itemToDelete) {
      try {
        contractTypesStore.remove(itemToDelete);
        toast.success(t("types.toasts.deleted"));
      } catch (error) {
        toast.error(error || t("types.toasts.deleteFailed"));
      }
    }
    setDeleteModalOpen(false);
    setItemToDelete(null);
  };

  const openModal = (mode, data = null) => {
    setModalState({ isOpen: true, mode, data });
  };

  const closeModal = () => {
    setModalState({ isOpen: false, mode: "create", data: null });
  };

  return (
    <div className="space-y-5">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
            {t("types.title")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t("types.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 self-start">
          <button
            onClick={() => openModal('create')}
            className="flex items-center gap-2 bg-[#14a0b3] hover:bg-cyan-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm"
          >
            <MdAdd className="text-lg" />
            {t("typeModal.createTitle")}
          </button>
        </div>
      </div>

      {/* ── Filters Section ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col lg:flex-row items-end gap-4">
        <div className="flex-1 w-full space-y-1.5">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">{t("list.search")}</label>
          <div className="relative">
            <MdOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t("types.searchPlaceholder")}
              className="w-full h-[42px] bg-[#f8fafc] border border-gray-200 text-gray-900 text-sm rounded-lg pl-10 pr-4 focus:ring-2 focus:ring-[#14a0b3] focus:border-[#14a0b3] outline-none transition-all"
            />
          </div>
        </div>

        <div className="w-full lg:w-48 space-y-1.5">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">{t("list.table.status")}</label>
          <CustomDropdown
            value={statusInput}
            onChange={(e) => { setStatusInput(e.target.value); setPage(1); }}
            options={[
              { label: t("list.allStatuses"), value: "all" },
              { label: t("types.active"), value: "active" },
              { label: t("types.inactive"), value: "inactive" },
            ]}
          />
        </div>

        <div className="flex w-full lg:w-auto items-center gap-3 h-[42px]">
          <button
            onClick={() => {
              setSearchInput("");
              setDebouncedSearch("");
              setStatusInput("all");
              setPage(1);
            }}
            className="w-full sm:w-auto flex justify-center items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-2 rounded-lg font-medium text-sm transition-colors h-[42px]"
          >
            <MdOutlineClear className="text-lg" />
            {t("list.clearFilters")}
          </button>
        </div>
      </div>

      {/* ── Contract Types Table ── */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-gray-100 bg-[#f4faff]">
                <th className="text-start px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-widest w-[5%]">{t("list.table.sno")}</th>
                <th className="text-start px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-widest w-[25%]">{t("types.table.contractType")}</th>
                <th className="text-start px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-widest w-[15%]">{t("types.table.code")}</th>
                <th className="text-start px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-widest w-[30%]">{t("types.table.description")}</th>
                <th className="text-start px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-widest w-[10%]">{t("list.table.status")}</th>
                <th className="text-center px-6 py-4 text-[11px] font-bold text-gray-500 uppercase tracking-widest w-[15%]">{t("types.table.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                    {t("types.loading")}
                  </td>
                </tr>
              ) : list.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                    {t("types.empty")}
                  </td>
                </tr>
              ) : (
                list.map((item, index) => {
                  const statusLabel = item.is_active ? 'ACTIVE' : 'INACTIVE';

                  return (
                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="text-[14px] font-medium text-gray-600">{String(index + 1).padStart(2, '0')}</span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-[14px] font-bold text-gray-900" title={item.name}>
                          {item.name?.length > 20 ? `${item.name.substring(0, 20)}...` : item.name}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[14px] font-medium text-gray-600">{item.code || "-"}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[14px] font-medium text-gray-600" title={item.description}>
                          {item.description?.length > 20 ? `${item.description.substring(0, 20)}...` : (item.description || "-")}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider ${item.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                          {t(`statusLabels.${statusLabel}`, { defaultValue: statusLabel })}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openModal('view', {
                              name: item.name,
                              description: item.description,
                              status: statusLabel,
                              code: item.code || '',
                              id: item.id
                            })}
                            className="p-1 text-gray-400 hover:text-[#14a0b3] transition-colors"
                          >
                            <MdOutlineRemoveRedEye className="text-[18px]" />
                          </button>
                          <button
                            onClick={() => openModal('edit', {
                              name: item.name,
                              description: item.description,
                              status: statusLabel,
                              code: item.code || '',
                              id: item.id
                            })}
                            className="p-1 text-amber-500 hover:text-amber-600 transition-colors"
                          >
                            <MdOutlineEdit className="text-[18px]" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(item.id)}
                            className="p-1 text-red-500 hover:text-red-600 transition-colors cursor-pointer"
                          >
                            <MdOutlineDeleteOutline className="text-[18px]" />
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

        {/* Pagination Footer */}
        <Pagination
          page={page}
          totalPages={Math.ceil(list.length / LIMIT) || 1}
          total={list.length}
          limit={LIMIT}
          onPage={setPage}
          label={t("types.title")}
          activeClass="bg-[#14a0b3] text-white"
          containerClass="px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white border-t border-gray-100"
        />
      </div>

      <ConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setItemToDelete(null);
        }}
        onConfirm={confirmDelete}
        title={t("types.deleteTitle")}
        message={t("types.deleteMessage")}
        type="delete"
      />

      <CreateContractTypeModal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        onSuccess={() => {
          closeModal();
          setShowSuccessModal(true);
        }}
        mode={modalState.mode}
        initialData={modalState.data}
      />

      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title={t("types.createdTitle")}
        message={t("types.createdMessage")}
      />
    </div>
  );
}
