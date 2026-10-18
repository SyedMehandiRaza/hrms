import { useEffect, useState } from "react";
import Pagination from "../../components/Pagination";
import { Link } from "react-router-dom";
import {
  MdOutlineAdd,
  MdOutlineBusiness,
  MdOutlineGroups,
  MdOutlineAssignmentTurnedIn,
  MdOutlineVisibility,
  MdOutlineEdit,
  MdOutlineDelete,
  MdOutlineSearch,
  MdOutlinePeople,
  MdOutlineClear,
} from "react-icons/md";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import { STAFFING_COMPANIES } from "../../data/groupC";
import { matches, nextId, paginate } from "../../data/common";
import StaffingCompanyModal from "../../components/StaffingCompanyModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import Loader from "../../components/Loader";
import Ltr from "../../components/Ltr";
import Can from "../../components/Can";
import { MODULES, ACTIONS } from "../../constants/permissions";
import CustomDropdown from "../../components/CustomDropdown";

const PAGE_SIZE = 6;

const AVATAR_COLORS = [
  "bg-cyan-500",
  "bg-green-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-indigo-500",
];

const getId = (c) => c?.id ?? c?._id ?? c?.staffing_company_id;

const initialsOf = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "?";

const statusStyle = (status) =>
  status === "INACTIVE"
    ? "bg-gray-100 text-gray-500"
    : "bg-green-50 text-green-600";

function StatCard({ icon, title, value, badge, iconBg, iconColor }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex justify-between items-start mb-4">
        <div
          className={`w-9 h-9 rounded-lg ${iconBg} ${iconColor} flex items-center justify-center text-lg`}
        >
          {icon}
        </div>
        <span className="text-xs bg-green-50 text-green-600 px-2.5 py-0.5 rounded-full font-medium inline-flex items-center justify-center">
          {badge}
        </span>
      </div>
      <p className="text-xs text-gray-400 font-semibold tracking-wider">
        {title}
      </p>
      <h3 className="text-3xl font-bold text-gray-900 mt-2">{value}</h3>
    </div>
  );
}

function StaffingCompanies() {
  const { t } = useTranslation("staffing");
  // Static build: companies live in local state; filters/paging are client-side.
  const [companies, setCompanies] = useState(STAFFING_COMPANIES);
  const loading = false;
  const deleteLoading = false;

  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null); // { mode, company }
  const [deleteModal, setDeleteModal] = useState(null); // company object

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState(""); // ACTIVE | INACTIVE

  // Debounce search input
  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(id);
  }, [searchInput]);

  const pageData = paginate(
    companies
      .filter((c) => matches(c, debouncedSearch, ["name", "code", "contact_person_name", "city", "email"]))
      .filter((c) => !status || c.status === status),
    page,
    PAGE_SIZE,
  );
  const list = pageData.rows;

  const totalPages = Math.max(1, pageData.totalPages);
  const currentPage = Math.min(page, totalPages);
  const total = pageData.total;
  const paginated = list;

  // Stat cards use company-wide counts.
  const statsTotal = companies.length;
  const activeCount = companies.filter((c) => c.status === "ACTIVE").length;
  const inactiveCount = Math.max(0, statsTotal - activeCount);
  const summary = { total_employees: companies.reduce((s, c) => s + (c.total_employees || 0), 0) };

  // Merge a created/edited company into the local list.
  const handleSaved = (saved) => {
    setCompanies((prev) =>
      saved.id && prev.some((c) => getId(c) === saved.id)
        ? prev.map((c) => (getId(c) === saved.id ? { ...c, ...saved } : c))
        : [{ total_employees: 0, ...saved, id: nextId(prev) }, ...prev],
    );
  };

  const handleDelete = (company) => {
    setDeleteModal(company);
  };

  const confirmDelete = async () => {
    if (!deleteModal) return;
    const id = getId(deleteModal);
    if (id == null) return;

    setCompanies((prev) => prev.filter((c) => getId(c) !== id));
    toast.success(t("list.toast.deleted"));
    setDeleteModal(null);
    const goTo = paginated.length === 1 && page > 1 ? page - 1 : page;
    if (goTo !== page) setPage(goTo);
  };

  const handleClearFilters = () => {
    setStatus("");
    setSearchInput("");
    setPage(1);
  };

  return (
    <div className="space-y-6 pb-8">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
            {t("list.title")}
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            {t("list.subtitle")}
          </p>
        </div>

        <Can module={MODULES.STAFFING_COMPANY} action={ACTIONS.CREATE}>
          <button
            onClick={() => setModal({ mode: "create" })}
            className="bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-3 rounded-lg flex items-center gap-2 text-sm font-medium shadow-sm"
          >
            <MdOutlineAdd className="text-lg" />
            {t("list.addCompany")}
          </button>
        </Can>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon={<MdOutlineBusiness />}
          title={t("list.stats.totalAgencies")}
          value={statsTotal}
          badge={t("list.stats.live")}
          iconBg="bg-cyan-100"
          iconColor="text-cyan-600"
        />
        <StatCard
          icon={<MdOutlineGroups />}
          title={t("list.stats.activeAgencies")}
          value={activeCount}
          badge={t("list.stats.live")}
          iconBg="bg-violet-100"
          iconColor="text-violet-600"
        />
        <StatCard
          icon={<MdOutlineAssignmentTurnedIn />}
          title={t("list.stats.inactiveAgencies")}
          value={inactiveCount}
          badge={t("list.stats.live")}
          iconBg="bg-amber-100"
          iconColor="text-amber-600"
        />
        <StatCard
          icon={<MdOutlinePeople />}
          title={t("list.stats.totalEmployees", { defaultValue: "Total Employees" })}
          value={summary?.total_employees ?? 0}
          badge={t("list.stats.live", { defaultValue: "Live" })}
          iconBg="bg-blue-100"
          iconColor="text-blue-600"
        />
      </div>

      {/* ── Filters Bar ── */}
      <div className="bg-white border border-gray-200 rounded-xl px-4 py-4">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Status */}
          <div className="flex flex-col gap-1 min-w-[120px]">
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              {t("list.filters.status")}
            </label>
            <div className="relative">
              <CustomDropdown
                value={status}
                onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                options={[
                  { label: t("list.filters.allStatus"), value: "" },
                  { label: t("list.filters.active"), value: "ACTIVE" },
                  { label: t("list.filters.inactive"), value: "INACTIVE" }
                ]}
              />
            </div>
          </div>

          {/* Search */}
          <div className="flex-1 min-w-[180px] flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider opacity-0 select-none">
              {t("list.filters.search")}
            </label>
            <div className="relative h-[42px]">
              <MdOutlineSearch className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t("list.filters.searchPlaceholder")}
                className="w-full h-full ps-9 pe-4 border border-gray-200 rounded-lg text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
              />
            </div>
          </div>

          <div className="flex-shrink-0 flex items-end">
            <button
              onClick={handleClearFilters}
              className="w-full sm:w-auto flex justify-center items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-2 rounded-lg font-medium text-sm transition-colors h-[42px]"
            >
              <MdOutlineClear className="text-lg" />
              {t("list.filters.clearFilters")}
            </button>
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <Loader label={t("list.loading")} />
        ) : list.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-center">
            <MdOutlineBusiness className="text-5xl text-gray-300" />
            <p className="text-gray-500 text-sm">
              {t("list.empty")}
            </p>
            <Can module={MODULES.STAFFING_COMPANY} action={ACTIONS.CREATE}>
              <button
                onClick={() => setModal({ mode: "create" })}
                className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                {t("list.addCompany")}
              </button>
            </Can>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {[
                      t("list.table.sn"),
                      t("list.table.company"),
                      t("list.table.contactPerson"),
                      t("list.table.phone"),
                      t("list.table.city"),
                      t("list.table.totalEmployees", { defaultValue: "Total Employees" }),
                      t("list.table.status"),
                      t("list.table.actions"),
                    ].map((h) => (
                      <th
                        key={h}
                        className="text-start px-6 py-4 text-xs font-semibold text-gray-400"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginated.map((item, idx) => (
                    <tr key={getId(item)} className="hover:bg-gray-50">
                      <td className="px-6 py-5 text-sm text-gray-700">
                        {(currentPage - 1) * PAGE_SIZE + idx + 1}
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          {item.company_image ? (
                            <img
                              src={item.company_image}
                              alt={item.name}
                              className="w-10 h-10 rounded-md object-cover border border-gray-100"
                            />
                          ) : (
                            <div
                              className={`w-10 h-10 rounded-md ${AVATAR_COLORS[idx % AVATAR_COLORS.length]} text-white font-semibold flex items-center justify-center`}
                            >
                              {initialsOf(item.name)}
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-gray-900 text-sm">
                              {item.name}
                            </p>
                            <p className="text-xs text-gray-400">
                              {item.code ? <Ltr>{item.code}</Ltr> : "—"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <p className="text-sm text-gray-800">
                          {item.contact_person_name || "—"}
                        </p>
                        <p className="text-xs text-gray-400">
                          {item.contact_person_email || item.email ? (
                            <Ltr>
                              {item.contact_person_email || item.email}
                            </Ltr>
                          ) : (
                            "—"
                          )}
                        </p>
                      </td>
                      <td className="px-6 py-5 text-sm text-gray-700">
                        {item.phone || item.contact_person_phone ? (
                          <Ltr>{item.phone || item.contact_person_phone}</Ltr>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-6 py-5 text-sm text-gray-700">
                        {item.city || "—"}
                      </td>
                      <td className="px-6 py-5 text-sm text-gray-700 font-semibold">
                        {item.total_employees ?? 0}
                      </td>
                      <td className="px-6 py-5">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusStyle(item.status)}`}
                        >
                          {item.status === "INACTIVE"
                            ? t("list.status.inactive")
                            : t("list.status.active")}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex gap-3 text-gray-400">
                          <Link
                            title={t("list.actions.view")}
                            to={`/admin/staffing-companies/company-detail/${item.id}`}
                            className="hover:text-cyan-600"
                          >
                            <MdOutlineVisibility className="text-lg" />
                          </Link>
                          <Can
                            module={MODULES.STAFFING_COMPANY}
                            action={ACTIONS.UPDATE}
                          >
                            <button
                              title={t("list.actions.edit")}
                              onClick={() =>
                                setModal({ mode: "edit", company: item })
                              }
                              className="hover:text-gray-700"
                            >
                              <MdOutlineEdit className="text-lg" />
                            </button>
                          </Can>
                          <Can
                            module={MODULES.STAFFING_COMPANY}
                            action={ACTIONS.DELETE}
                          >
                            <button
                              title={t("list.actions.delete")}
                              disabled={deleteLoading}
                              onClick={() => handleDelete(item)}
                              className="hover:text-red-500 disabled:opacity-50"
                            >
                              <MdOutlineDelete className="text-lg" />
                            </button>
                          </Can>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="lg:hidden divide-y divide-gray-100">
              {paginated.map((item, idx) => (
                <div key={getId(item)} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {item.company_image ? (
                        <img
                          src={item.company_image}
                          alt={item.name}
                          className="w-10 h-10 rounded-md object-cover border border-gray-100"
                        />
                      ) : (
                        <div
                          className={`w-10 h-10 rounded-md ${AVATAR_COLORS[idx % AVATAR_COLORS.length]} text-white flex items-center justify-center`}
                        >
                          {initialsOf(item.name)}
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-gray-900 text-sm">
                          {item.name}
                        </p>
                        <p className="text-xs text-gray-400">
                          {item.code ? <Ltr>{item.code}</Ltr> : "—"}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusStyle(item.status)}`}
                    >
                      {item.status === "INACTIVE"
                        ? t("list.status.inactive")
                        : t("list.status.active")}
                    </span>
                  </div>

                  <div>
                    <p className="text-sm text-gray-700">
                      {item.contact_person_name || "—"}
                    </p>
                    <p className="text-xs text-gray-400">
                      {item.contact_person_email || item.email ? (
                        <Ltr>{item.contact_person_email || item.email}</Ltr>
                      ) : (
                        "—"
                      )}
                    </p>
                  </div>

                  <div className="text-sm text-gray-600">
                    {item.phone || item.contact_person_phone ? (
                      <Ltr>{item.phone || item.contact_person_phone}</Ltr>
                    ) : (
                      "—"
                    )}{" "}
                    • {item.city || "—"}
                  </div>

                  <div className="flex items-center justify-between text-sm text-gray-600 border-t border-gray-100 pt-3">
                    <span className="text-gray-400 font-semibold text-[10px] uppercase tracking-wider">
                      {t("list.table.totalEmployees", { defaultValue: "Total Employees" })}
                    </span>
                    <span className="font-semibold text-gray-900">{item.total_employees ?? 0}</span>
                  </div>

                  <div className="flex gap-4 pt-2">
                    <Link
                      to={`/admin/staffing-companies/company-detail/${item.id}`}
                      className="text-cyan-600"
                    >
                      <MdOutlineVisibility />
                    </Link>
                    <Can
                      module={MODULES.STAFFING_COMPANY}
                      action={ACTIONS.UPDATE}
                    >
                      <button
                        onClick={() => setModal({ mode: "edit", company: item })}
                        className="text-gray-600"
                      >
                        <MdOutlineEdit />
                      </button>
                    </Can>
                    <Can
                      module={MODULES.STAFFING_COMPANY}
                      action={ACTIONS.DELETE}
                    >
                      <button
                        disabled={deleteLoading}
                        onClick={() => handleDelete(item)}
                        className="text-red-500 disabled:opacity-50"
                      >
                        <MdOutlineDelete />
                      </button>
                    </Can>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <Pagination
              page={currentPage}
              totalPages={totalPages}
              total={total}
              limit={PAGE_SIZE}
              onPage={setPage}
              label={t("list.paginationLabel")}
              activeClass="bg-cyan-600 text-white"
              containerClass="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-gray-100"
            />
          </>
        )}
      </div>

      {modal && (
        <StaffingCompanyModal
          mode={modal.mode}
          company={modal.company}
          onClose={() => {
            setModal(null);
          }}
          onSaved={handleSaved}
        />
      )}

      <ConfirmationModal
        isOpen={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        onConfirm={confirmDelete}
        title={t("confirmModal.title", "Confirm Delete")}
        message={t("confirmModal.deleteCompanyMessage", { name: deleteModal?.name })}
        type="delete"
        isLoading={deleteLoading}
      />
    </div>
  );
}

export default StaffingCompanies;
