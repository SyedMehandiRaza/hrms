import { Link, useLocation } from "react-router-dom";
import Pagination from "../../components/Pagination";
import { useMemo, useState } from "react";
import { useTranslation, Trans } from "react-i18next";
import { toast } from "react-toastify";
import {
  MdOutlineAdd,
  MdOutlineSearch,
  MdOutlineLocationOn,
  MdOutlineVisibility,
  MdOutlineEdit,
  MdOutlineTrendingUp,
  MdOutlineAutoAwesome,
  MdOutlineArrowForward,
  MdOutlineBarChart,
  MdOutlineDelete,
  MdOutlineClear,
  MdOutlineBusiness,
  MdOutlineAssignmentTurnedIn,
} from "react-icons/md";
import EditHeadOfficeModal from "../../components/EditHeadOfficeModal";
import { HEAD_OFFICES } from "../../data/groupC";
import { matches, nextId, paginate } from "../../data/common";
import ConfirmationModal from "../../components/ConfirmationModal";
import { TableLoader } from "../../components/Loader";
import Ltr from "../../components/Ltr";
import Can from "../../components/Can";
import { MODULES, ACTIONS } from "../../constants/permissions";

const STATUS_COLORS = {
  Active: "text-green-700 bg-green-50 border-green-200",
  Unassigned: "text-gray-600 bg-gray-50 border-gray-200",
  Completed: "text-blue-700 bg-blue-50 border-blue-200",
  "On Hold": "text-amber-700 bg-amber-50 border-amber-200",
};

const PAGE_SIZE = 10;

const getOfficeId = (office) => office?.id ?? office?._id ?? office?.office_id;

// Icon/background are visual only; the workforce numbers and status come from
// the API (employees assigned to the office's project).
const ICON_BGS = [
  { icon: "🔄", bg: "bg-blue-100" },
  { icon: "🛡️", bg: "bg-purple-100" },
  { icon: "📊", bg: "bg-orange-100" },
  { icon: "🤖", bg: "bg-green-100" },
  { icon: "⚙️", bg: "bg-red-100" },
  { icon: "💳", bg: "bg-teal-100" },
];

const initialsOf = (name) =>
  String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || "?";

const decorate = (office, index) => {
  const visual = ICON_BGS[index % ICON_BGS.length];
  const projects = Array.isArray(office.project) ? office.project : [];
  return {
    ...office,
    _icon: visual.icon,
    _iconBg: visual.bg,
    _avatars: (office.members_preview || []).map(initialsOf),
    _extraCount: office.employee_count ?? 0,
    _contractEmployees: office.contract_count ?? 0,
    // An office is Active while it serves a live project.
    _status: projects.length ? "Active" : "Unassigned",
    _projectName: projects.map((p) => p.project_name).join(", "),
  };
};

// ── Avatar Stack ───────────────────────────────────────────────────────────────
const AvatarStack = ({ initials, extraCount }) => {
  const { t } = useTranslation("offices");
  const colors = ["bg-cyan-500", "bg-blue-500", "bg-violet-500", "bg-rose-400"];
  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {initials.slice(0, 2).map((init, i) => (
          <div
            key={i}
            className={`w-7 h-7 rounded-full ${colors[i % colors.length]} text-white text-[10px] font-bold flex items-center justify-center border-2 border-white`}
          >
            {init}
          </div>
        ))}
      </div>
      <span className="text-sm text-gray-700">
        {extraCount} {extraCount === 1 ? t("list.membersOne") : t("list.membersOther")}
      </span>
    </div>
  );
};

// ── Stat Card ──────────────────────────────────────────────────────────────────
function StatCard({ icon, title, value, badge, iconBg, iconColor }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex justify-between items-start mb-4">
        <div className={`w-9 h-9 rounded-lg ${iconBg} ${iconColor} flex items-center justify-center text-lg`}>
          {icon}
        </div>
        {badge && (
          <span className="text-xs bg-green-50 text-green-600 px-2.5 py-0.5 rounded-full font-medium inline-flex items-center justify-center">
            {badge}
          </span>
        )}
      </div>
      <p className="text-xs text-gray-400 font-semibold tracking-wider">{title}</p>
      <h3 className="text-3xl font-bold text-gray-900 mt-2">{value}</h3>
    </div>
  );
}

function HeadOffices() {
  const { t } = useTranslation("offices");
  const location = useLocation();
  // Static build: offices live in local state (a just-created one arrives via
  // the navigation state from the create page).
  const [offices, setOffices] = useState(() => {
    const created = location.state?.createdOffice;
    return created
      ? [{ project: [], members_preview: [], employee_count: 0, contract_count: 0, ...created, id: nextId(HEAD_OFFICES) }, ...HEAD_OFFICES]
      : HEAD_OFFICES;
  });
  const loading = false;

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filteredOffices = offices.filter((o) =>
    matches(o, search.trim(), ["office_name", "office_location", "office_email"]),
  );
  const { rows: list, total, totalPages } = paginate(filteredOffices, page, PAGE_SIZE);
  const summary = {
    total_offices: offices.length,
    active_offices: offices.filter((o) => (o.project || []).length > 0).length,
    total_locations: new Set(offices.map((o) => o.office_location)).size,
    total_projects: offices.reduce((s, o) => s + (o.project || []).length, 0),
  };

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedOffice, setSelectedOffice] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [officeToDelete, setOfficeToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Merge an edited office back into the local list.
  const reloadOffices = (saved) => {
    if (!saved) return;
    setOffices((prev) => prev.map((o) => (getOfficeId(o) === getOfficeId(saved) ? { ...o, ...saved } : o)));
  };

  // Decorate the current backend page with visual-only fields.
  const decorated = useMemo(
    () => list.map((office, index) => decorate(office, index)),
    [list],
  );

  const handleFilter = (setter) => (e) => {
    setter(e.target.value);
    setPage(1);
  };

  const handleClearFilters = () => {
    setSearch("");
    setPage(1);
  };

  const handleEdit = (office) => {
    setSelectedOffice(office);
    setIsEditOpen(true);
  };

  const handleView = (office) => {
    setSelectedOffice(office);
    setIsViewOpen(true);
  };

  const handleDelete = (office) => {
    setOfficeToDelete(office);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!officeToDelete) return;
    setIsDeleting(true);
    const deleteId = getOfficeId(officeToDelete);
    setOffices((prev) => prev.filter((o) => getOfficeId(o) !== deleteId));
    toast.success(t("list.toast.deleteSuccess"));
    setIsDeleteModalOpen(false);
    setOfficeToDelete(null);
    // Step back a page if this one emptied.
    if (list.length === 1 && page > 1) setPage((p) => p - 1);
    setIsDeleting(false);
  };

  return (
    <>
      <div className="space-y-6">
        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
              {t("list.title")}
            </h1>
            <p className="text-gray-500 mt-1 text-sm">
              {t("list.subtitle")}
            </p>
          </div>
          <Can module={MODULES.OFFICE} action={ACTIONS.CREATE}>
            <Link
              to="/admin/head-offices/create-head-office"
              className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm transition-colors flex-shrink-0 self-start"
            >
              <MdOutlineAdd className="text-lg" />
              {t("list.createButton")}
            </Link>
          </Can>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title={t("list.stats.totalOffices")}
            value={summary?.total_offices ?? 0}
            badge={t("list.stats.live")}
            icon={<MdOutlineBusiness />}
            iconBg="bg-cyan-100"
            iconColor="text-cyan-600"
          />
          <StatCard
            title={t("list.stats.activeOffices")}
            value={summary?.active_offices ?? 0}
            badge={t("list.stats.live")}
            icon={<MdOutlineTrendingUp />}
            iconBg="bg-green-100"
            iconColor="text-green-600"
          />
          <StatCard
            title={t("list.stats.totalLocations")}
            value={summary?.total_locations ?? 0}
            icon={<MdOutlineLocationOn />}
            iconBg="bg-blue-100"
            iconColor="text-blue-600"
          />
          <StatCard
            title={t("list.stats.totalLinkedProjects")}
            value={summary?.total_projects ?? 0}
            badge={t("list.statusOptions.active")}
            icon={<MdOutlineAssignmentTurnedIn />}
            iconBg="bg-violet-100"
            iconColor="text-violet-600"
          />
        </div>

        {/* ── Filters ── */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex flex-wrap gap-4 items-end">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                {t("list.filters.searchLabel")}
              </p>
              <div className="relative border border-gray-200 rounded-lg h-[42px]">
                <MdOutlineSearch className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
                <input
                  type="text"
                  value={search}
                  onChange={handleFilter(setSearch)}
                  placeholder={t("list.filters.searchPlaceholder")}
                  className="w-full h-full rounded-lg ps-9 pe-3 py-2 text-sm bg-transparent focus:outline-none text-gray-700 placeholder-gray-400"
                />
              </div>
            </div>

            {/* Clear Filters */}
            <div className="flex-shrink-0 w-full sm:w-auto">
              <button
                onClick={handleClearFilters}
                className="w-full sm:w-auto flex justify-center items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-2 rounded-lg font-medium text-sm transition-colors h-[42px]"
              >
                <MdOutlineClear className="text-lg" />
                {t("list.filters.clear")}
              </button>
            </div>
          </div>
        </div>

        {/* ── Table (desktop) / Cards (mobile) ── */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  {[
                    t("list.table.sn"),
                    t("list.table.name"),
                    t("list.table.location"),
                    t("list.table.totalEmployees"),
                    t("list.table.contractEmployees"),
                    t("list.table.status"),
                    t("list.table.actions"),
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-start px-6 py-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading && decorated.length === 0 ? (
                  <TableLoader colSpan={7} label={t("list.loading")} />
                ) : decorated.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-12 text-center text-gray-400 text-sm"
                    >
                      {t("list.empty")}
                    </td>
                  </tr>
                ) : (
                  decorated.map((office, index) => {
                    const officeId = getOfficeId(office);
                    return (
                      <tr
                        key={officeId}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {(page - 1) * PAGE_SIZE + index + 1}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {office.office_image ? (
                              <img
                                src={office.office_image}
                                alt={office.office_name}
                                className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                              />
                            ) : (
                              <div
                                className={`w-10 h-10 ${office._iconBg} rounded-lg flex items-center justify-center text-lg flex-shrink-0`}
                              >
                                {office._icon}
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-semibold text-gray-900">
                                {office?.office_name
                                  ? office.office_name.length > 20
                                    ? `${office.office_name.substring(0, 20)}...`
                                    : office.office_name
                                  : "—"}
                              </p>
                              <p className="text-xs text-gray-400">
                                {t("list.idLabel")}{" "}
                                <Ltr>{officeId}</Ltr>
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5 text-sm text-gray-600">
                            <MdOutlineLocationOn className="text-gray-400 flex-shrink-0" />
                            {office?.office_location
                              ? office.office_location.length > 20
                                ? `${office.office_location.slice(0, 20)}...`
                                : office.office_location
                              : "—"}
                          </div>
                          {office._projectName && (
                            <p className="text-xs text-gray-400 mt-1">
                              {t("list.projectLabel")} {office._projectName}
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <AvatarStack
                            initials={office._avatars}
                            extraCount={office._extraCount}
                          />
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {office._contractEmployees}{" "}
                          {office._contractEmployees !== 1
                            ? t("list.contractorOther")
                            : t("list.contractorOne")}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_COLORS[office._status]}`}
                          >
                            {office._status === "Active"
                              ? t("list.statusOptions.active")
                              : t("list.statusOptions.unassigned")}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => handleView(office)}
                              className="p-1.5 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-md transition-colors"
                            >
                              <MdOutlineVisibility className="text-xl" />
                            </button>
                            <Can module={MODULES.OFFICE} action={ACTIONS.UPDATE}>
                              <button
                                onClick={() => handleEdit(office)}
                                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                              >
                                <MdOutlineEdit className="text-xl" />
                              </button>
                            </Can>

                            <Can module={MODULES.OFFICE} action={ACTIONS.DELETE}>
                              <button
                                onClick={() => handleDelete(office)}
                                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                              >
                                <MdOutlineDelete className="text-xl" />
                              </button>
                            </Can>
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
          <div className="lg:hidden divide-y divide-gray-100">
            {loading ? (
              <div className="px-4 py-12 text-center text-gray-400 text-sm">
                {t("list.loadingMobile")}
              </div>
            ) : decorated.length === 0 ? (
              <div className="px-4 py-12 text-center text-gray-400 text-sm">
                {t("list.empty")}
              </div>
            ) : (
              decorated.map((office) => {
                const officeId = getOfficeId(office);
                return (
                  <div key={officeId} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {office.office_image ? (
                          <img
                            src={office.office_image}
                            alt={office.office_name}
                            className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                          />
                        ) : (
                          <div
                            className={`w-10 h-10 ${office._iconBg} rounded-lg flex items-center justify-center text-lg flex-shrink-0`}
                          >
                            {office._icon}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {office.office_name || "—"}
                          </p>
                          <p className="text-xs text-gray-400">
                            {t("list.idLabel")} <Ltr>{officeId}</Ltr>
                          </p>
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border flex-shrink-0 ${STATUS_COLORS[office._status]}`}
                      >
                        {office._status === "Active"
                              ? t("list.statusOptions.active")
                              : t("list.statusOptions.unassigned")}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <MdOutlineLocationOn className="text-gray-400" />
                      {office.office_location || "—"}
                    </div>
                    {office._projectName && (
                      <p className="text-xs text-gray-400">
                        {t("list.projectLabel")} {office._projectName}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <AvatarStack
                        initials={office._avatars}
                        extraCount={office._extraCount}
                      />
                      <span className="text-xs text-gray-500">
                        {office._contractEmployees}{" "}
                        {office._contractEmployees !== 1
                          ? t("list.contractorOther")
                          : t("list.contractorOne")}
                      </span>
                    </div>
                    <div className="flex gap-2 pt-1">
                      {/* <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-cyan-600 bg-cyan-50 hover:bg-cyan-100 rounded-md transition-colors font-medium">
                        <MdOutlineVisibility /> View
                      </button> */}
                      <Can module={MODULES.OFFICE} action={ACTIONS.UPDATE}>
                        <button
                          onClick={() => handleEdit(office)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors font-medium"
                        >
                          <MdOutlineEdit /> {t("list.editAction")}
                        </button>
                      </Can>
                      <Can module={MODULES.OFFICE} action={ACTIONS.DELETE}>
                        <button
                          onClick={() => handleDelete(office)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors font-medium"
                        >
                          <MdOutlineDelete /> {t("list.deleteAction")}
                        </button>
                      </Can>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination Footer */}
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            limit={PAGE_SIZE}
            onPage={setPage}
            label={t("list.paginationLabel")}
            activeClass="bg-cyan-600 text-white"
            containerClass="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 lg:px-6 py-4 border-t border-gray-100"
          />
        </div>

        {/* ── Bottom Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Workforce Efficiency */}
          <div className="bg-cyan-600 rounded-xl p-6 relative overflow-hidden">
            <div className="absolute bottom-0 end-0 opacity-10">
              <MdOutlineTrendingUp className="text-[120px] text-white" />
            </div>
            <p className="text-cyan-100 text-sm font-semibold mb-2">
              {t("list.cards.efficiencyTitle")}
            </p>
            <p className="text-cyan-100 text-xs mb-6 leading-relaxed">
              {t("list.cards.efficiencyDescription")}
            </p>
            <p className="text-white text-5xl font-bold">
              <Ltr>94.2%</Ltr>
            </p>
          </div>

          {/* Regional Distribution */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-1">
              <MdOutlineBarChart className="text-gray-400 text-2xl" />
              <span className="text-xs font-semibold text-green-600">
                <Ltr>{t("list.cards.regionalTrend")}</Ltr>
              </span>
            </div>
            <p className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-4">
              {t("list.cards.regionalTitle")}
            </p>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs text-gray-600 mb-1.5">
                  <span className="font-medium">
                    <Ltr>AMER</Ltr>
                  </span>
                  <span className="font-semibold">
                    <Ltr>65%</Ltr>
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full w-[65%] bg-blue-500 rounded-full" />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-gray-600 mb-1.5">
                  <span className="font-medium">
                    <Ltr>EMEA</Ltr>
                  </span>
                  <span className="font-semibold">
                    <Ltr>25%</Ltr>
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full w-[25%] bg-violet-500 rounded-full" />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-gray-600 mb-1.5">
                  <span className="font-medium">
                    <Ltr>APAC</Ltr>
                  </span>
                  <span className="font-semibold">
                    <Ltr>10%</Ltr>
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full w-[10%] bg-teal-500 rounded-full" />
                </div>
              </div>
            </div>
          </div>

          {/* Strategic Insight */}
          <div className="bg-gray-900 rounded-xl p-6 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center">
                <MdOutlineAutoAwesome className="text-cyan-400 text-xl" />
              </div>
              <div>
                <p className="text-white text-sm font-bold">
                  {t("list.cards.strategicTitle")}
                </p>
                <p className="text-gray-400 text-[10px] uppercase tracking-wider font-semibold">
                  {t("list.cards.strategicSubtitle")}
                </p>
              </div>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed mb-5">
              <Trans
                t={t}
                i18nKey="list.cards.strategicBody"
                components={{ hl: <span className="text-white font-semibold" /> }}
              />
            </p>
            <button className="flex items-center gap-1.5 text-white text-sm font-medium hover:text-cyan-400 transition-colors">
              {t("list.cards.viewRecommendation")}{" "}
              <MdOutlineArrowForward className="rtl:rotate-180" />
            </button>
          </div>
        </div>
      </div>

      {(isEditOpen || isViewOpen) && (
        <EditHeadOfficeModal
          office={selectedOffice}
          isViewMode={isViewOpen}
          onSaved={reloadOffices}
          onClose={() => {
            setIsEditOpen(false);
            setIsViewOpen(false);
          }}
        />
      )}

      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setOfficeToDelete(null);
        }}
        onConfirm={confirmDelete}
        title={t("list.deleteModal.title")}
        message={t("list.deleteModal.message", { name: officeToDelete?.office_name })}
        confirmText={isDeleting ? t("list.deleteModal.deleting") : t("list.deleteAction")}
        confirmVariant="danger"
        loading={isDeleting}
      />
    </>
  );
}

export default HeadOffices;
