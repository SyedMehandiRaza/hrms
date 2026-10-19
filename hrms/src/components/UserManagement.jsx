import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import Pagination from "./Pagination";
import {
  MdOutlineClear,
  MdOutlineMoreVert,
  MdOutlineSearch,
} from "react-icons/md";
import CustomDropdown from "./CustomDropdown";
import { MANAGED_USERS } from "../data/groupA";

const INITIAL_ROLES = Array.from(
  new Set(MANAGED_USERS.map((u) => u.roles?.[0]?.name || "Employee")),
).sort();

const PAGE_SIZE = 5;

const ROLE_STYLES = {
  Admin: "text-cyan-700 bg-cyan-50 border border-cyan-200",
  "HR Manager": "text-gray-700 bg-gray-100 border border-gray-200",
  Manager: "text-gray-700 bg-gray-100 border border-gray-200",
};

function UserManagement() {
  const { t } = useTranslation("employees");
  // Filter/status values stay English (used for comparisons); only labels are translated.
  const statusText = (s) =>
    s === "Active" ? t("status.active") : t("status.inactive");
  const [search, setSearch] = useState("");
  const [roleFilter, setRole] = useState("All Roles");
  const [statusFilter, setStatus] = useState("All Status");
  const [page, setPage] = useState(1);
  const [availableRoles] = useState(INITIAL_ROLES);

  const [allUsers] = useState(MANAGED_USERS);
  const loading = false;

  const filteredUsers = useMemo(() => {
    return allUsers.filter((u) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        (u.full_name && u.full_name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.country_emp_id && u.country_emp_id.toLowerCase().includes(q));

      const roleName = u.roles?.[0]?.name || "Employee";
      const matchRole = roleFilter === "All Roles" || roleName === roleFilter;

      const statusLabel = u.user_status === "ACTIVE" ? "Active" : "Inactive";
      const matchStatus = statusFilter === "All Status" || statusLabel === statusFilter;

      return matchSearch && matchRole && matchStatus;
    });
  }, [allUsers, search, roleFilter, statusFilter]);

  const totalCount = filteredUsers.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const paginatedUsers = filteredUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const onFilter = (setter) => (e) => {
    setter(e.target.value);
    setPage(1);
  };
  
  const clearFilters = () => {
    setSearch("");
    setRole("All Roles");
    setStatus("All Status");
    setPage(1);
  };

  return (
    <div className="space-y-5">
      {/* Filters Row */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
              {t("userManagement.filters.search")}
            </label>
            <div className="relative">
              <MdOutlineSearch className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
              <input
                type="text"
                value={search}
                onChange={onFilter(setSearch)}
                placeholder={t("userManagement.filters.searchPlaceholder")}
                className="w-full ps-9 pe-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition h-[42px]"
              />
            </div>
          </div>
          {/* Role */}
          <div className="w-full sm:w-48">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
              {t("userManagement.filters.role")}
            </label>
            <CustomDropdown
              value={roleFilter}
              onChange={onFilter(setRole)}
              options={[
                { label: t("list.filters.allRoles"), value: "All Roles" },
                ...availableRoles.map(r => ({ label: r, value: r }))
              ]}
            />
          </div>
          {/* Status */}
          <div className="w-full sm:w-48">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
              {t("userManagement.filters.status")}
            </label>
            <CustomDropdown
              value={statusFilter}
              onChange={onFilter(setStatus)}
              options={[
                { label: t("list.filters.allStatus"), value: "All Status" },
                { label: t("status.active"), value: "Active" },
                { label: t("status.inactive"), value: "Inactive" }
              ]}
            />
          </div>
          {/* Clear filter */}
          <div className="flex-shrink-0 w-full sm:w-auto">
            <button 
              onClick={clearFilters}
              className="w-full sm:w-auto flex justify-center items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-2 rounded-lg font-medium text-sm transition-colors h-[42px]">
              <MdOutlineClear className="text-lg" /> {t("userManagement.filters.clear")}
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {[
                  { id: "sn", label: t("userManagement.table.sn") },
                  { id: "userName", label: t("userManagement.table.userName") },
                  { id: "email", label: t("userManagement.table.email") },
                  { id: "role", label: t("userManagement.table.role") },
                  { id: "status", label: t("userManagement.table.status") },
                  { id: "actions", label: t("userManagement.table.actions") },
                ].map((h) => (
                  <th
                    key={h.id}
                    className={`px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider ${h.id === "actions" ? "text-end" : "text-start"}`}
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-12 text-center text-sm text-gray-400"
                  >
                    {t("userManagement.loading")}
                  </td>
                </tr>
              ) : paginatedUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-12 text-center text-sm text-gray-400"
                  >
                    {t("userManagement.empty")}
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user, index) => {
                  const roleName = user.roles?.[0]?.name || "Employee";
                  const statusLabel = user.user_status === "ACTIVE" ? "Active" : "Inactive";
                  return (
                  <tr
                    key={user.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-5 py-4 text-sm text-gray-600">
                      {(page - 1) * PAGE_SIZE + index + 1}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={user.profile_url || `https://ui-avatars.com/api/?name=${user.full_name || 'User'}&background=374151&color=fff&size=40`}
                          alt={user.full_name}
                          className="w-10 h-10 rounded object-cover flex-shrink-0"
                        />
                        <div>
                          <p className="text-sm font-bold text-gray-900">
                            {user.full_name}
                          </p>
                          <p className="text-xs text-gray-400">{user.country_emp_id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-600">
                      {user.email}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold ${ROLE_STYLES[roleName] || ROLE_STYLES.Manager}`}
                      >
                        {roleName}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`flex items-center gap-1.5 text-sm font-semibold ${statusLabel === "Active" ? "text-green-600" : "text-gray-400"}`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${statusLabel === "Active" ? "bg-green-500" : "bg-gray-300"}`}
                        />
                        {statusText(statusLabel)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-end">
                      <button className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                        <MdOutlineMoreVert />
                      </button>
                    </td>
                  </tr>
                )})
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden divide-y divide-gray-100">
          {loading ? (
             <div className="py-12 text-center text-sm text-gray-400">
               {t("userManagement.loading")}
             </div>
          ) : paginatedUsers.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              {t("userManagement.empty")}
            </div>
          ) : (
            paginatedUsers.map((user) => {
              const roleName = user.roles?.[0]?.name || "Employee";
              const statusLabel = user.user_status === "ACTIVE" ? "Active" : "Inactive";
              return (
              <div key={user.id} className="flex items-start gap-3 px-4 py-4">
                <img
                  src={user.profile_url || `https://ui-avatars.com/api/?name=${user.full_name || 'User'}&background=374151&color=fff&size=40`}
                  alt={user.full_name}
                  className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-gray-900">
                        {user.full_name}
                      </p>
                      <p className="text-xs text-gray-400">{user.country_emp_id}</p>
                    </div>
                    <button className="p-1 text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0">
                      <MdOutlineMoreVert />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 truncate">
                    {user.email}
                  </p>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold ${ROLE_STYLES[roleName] || ROLE_STYLES.Manager}`}
                    >
                      {roleName}
                    </span>
                    <span
                      className={`flex items-center gap-1 text-xs font-semibold ${statusLabel === "Active" ? "text-green-600" : "text-gray-400"}`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${statusLabel === "Active" ? "bg-green-500" : "bg-gray-300"}`}
                      />
                      {statusText(statusLabel)}
                    </span>
                  </div>
                </div>
              </div>
            )})
          )}
        </div>

        {/* Pagination */}
        <Pagination
          page={page}
          totalPages={totalPages}
          total={totalCount}
          limit={PAGE_SIZE}
          onPage={setPage}
          label={t("userManagement.paginationLabel")}
          activeClass="bg-cyan-600 text-white"
          containerClass="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-gray-100"
        />
      </div>
    </div>
  );
}

export default UserManagement;

// import { useState } from "react";
// import {
//   MdOutlineAdd,
//   MdOutlineChevronLeft,
//   MdOutlineChevronRight,
//   MdOutlineMoreVert,
//   MdOutlineSearch,
// } from "react-icons/md";

// const USERS = [
//   {
//     id: 1,
//     name: "Sarah Jenkins",
//     since: "Member since 2021",
//     email: "s.jenkins@enterprise-hrms.com",
//     role: "Admin",
//     status: "Active",
//     avatar:
//       "https://ui-avatars.com/api/?name=Sarah+Jenkins&background=374151&color=fff&size=40",
//   },
//   {
//     id: 2,
//     name: "Michael Chen",
//     since: "Member since 2022",
//     email: "m.chen@enterprise-hrms.com",
//     role: "HR Manager",
//     status: "Active",
//     avatar:
//       "https://ui-avatars.com/api/?name=Michael+Chen&background=1e3a5f&color=fff&size=40",
//   },
//   {
//     id: 3,
//     name: "Elena Rodriguez",
//     since: "Member since 2023",
//     email: "e.rodriguez@enterprise-hrms.com",
//     role: "Manager",
//     status: "Inactive",
//     avatar:
//       "https://ui-avatars.com/api/?name=Elena+Rodriguez&background=7c3aed&color=fff&size=40",
//   },
//   {
//     id: 4,
//     name: "Marcus Thorne",
//     since: "Member since 2021",
//     email: "m.thorne@enterprise-hrms.com",
//     role: "Admin",
//     status: "Active",
//     avatar:
//       "https://ui-avatars.com/api/?name=Marcus+Thorne&background=065f46&color=fff&size=40",
//   },
//   {
//     id: 5,
//     name: "Priya Nair",
//     since: "Member since 2023",
//     email: "p.nair@enterprise-hrms.com",
//     role: "HR Manager",
//     status: "Active",
//     avatar:
//       "https://ui-avatars.com/api/?name=Priya+Nair&background=be185d&color=fff&size=40",
//   },
//   {
//     id: 6,
//     name: "Tom Briggs",
//     since: "Member since 2022",
//     email: "t.briggs@enterprise-hrms.com",
//     role: "Manager",
//     status: "Active",
//     avatar:
//       "https://ui-avatars.com/api/?name=Tom+Briggs&background=0369a1&color=fff&size=40",
//   },
// ];

// const PAGE_SIZE = 4;

// const ROLE_STYLES = {
//   Admin: "text-cyan-700 bg-cyan-50 border border-cyan-200",
//   "HR Manager": "text-gray-700 bg-gray-100 border border-gray-200",
//   Manager: "text-gray-700 bg-gray-100 border border-gray-200",
// };

// function UserManagement() {
//   const [search, setSearch] = useState("");
//   const [roleFilter, setRole] = useState("All Roles");
//   const [statusFilter, setStatus] = useState("All Status");
//   const [page, setPage] = useState(1);

//   const filtered = USERS.filter((u) => {
//     const q = search.toLowerCase();
//     const matchSearch =
//       !q ||
//       u.name.toLowerCase().includes(q) ||
//       u.email.toLowerCase().includes(q);
//     const matchRole = roleFilter === "All Roles" || u.role === roleFilter;
//     const matchStatus =
//       statusFilter === "All Status" || u.status === statusFilter;
//     return matchSearch && matchRole && matchStatus;
//   });

//   const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
//   const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

//   const onFilter = (setter) => (e) => {
//     setter(e.target.value);
//     setPage(1);
//   };

//   return (
//     <div className="space-y-5">
//       {/* Filters Row */}
//       <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
//         <div className="flex-1 bg-white border border-gray-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
//           {/* Search */}
//           <div>
//             <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
//               Search :
//             </label>
//             <div className="relative">
//               <MdOutlineSearch className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
//               <input
//                 type="text"
//                 value={search}
//                 onChange={onFilter(setSearch)}
//                 placeholder="Filter by name or email..."
//                 className="w-full ps-9 pe-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
//               />
//             </div>
//           </div>
//           {/* Role */}
//           <div>
//             <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
//               Filter by Role :
//             </label>
//             <div className="relative">
//               <select
//                 value={roleFilter}
//                 onChange={onFilter(setRole)}
//                 className="w-full appearance-none border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer pe-9"
//               >
//                 <option>All Roles</option>
//                 <option>Admin</option>
//                 <option>HR Manager</option>
//                 <option>Manager</option>
//               </select>
//               <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-gray-400">
//                 ▾
//               </span>
//             </div>
//           </div>
//           {/* Status */}
//           <div>
//             <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
//               Status :
//             </label>
//             <div className="relative">
//               <select
//                 value={statusFilter}
//                 onChange={onFilter(setStatus)}
//                 className="w-full appearance-none border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer pe-9"
//               >
//                 <option>All Status</option>
//                 <option>Active</option>
//                 <option>Inactive</option>
//               </select>
//               <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-gray-400">
//                 ▾
//               </span>
//             </div>
//           </div>
//         </div>
//         {/* Add User */}
//         <button className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-3 rounded-xl font-medium text-sm transition-colors flex-shrink-0 self-stretch sm:self-auto">
//           <MdOutlineAdd className="text-lg" /> Add User
//         </button>
//       </div>

//       {/* Table */}
//       <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
//         {/* Desktop Table */}
//         <div className="hidden md:block overflow-x-auto">
//           <table className="w-full">
//             <thead>
//               <tr className="border-b border-gray-100">
//                 {[
//                   "S.N",
//                   "S.N",
//                   "USER NAME",
//                   "EMAIL ADDRESS",
//                   "ROLE",
//                   "STATUS",
//                   "ACTIONS",
//                 ].map((h) => (
//                   <th
//                     key={h}
//                     className={`px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider ${h === "ACTIONS" ? "text-end" : "text-start"}`}
//                   >
//                     {h}
//                   </th>
//                 ))}
//               </tr>
//             </thead>
//             <tbody className="divide-y divide-gray-50">
//               {paginated.length === 0 ? (
//                 <tr>
//                   <td
//                     colSpan={6}
//                     colSpan={6}
//                     className="py-12 text-center text-sm text-gray-400"
//                   >
//                     No users match your filters.
//                   </td>
//                 </tr>
//               ) : (
//                 paginated.map((user, index) => (
//                 paginated.map((user, index) => (
//                   <tr
//                     key={user.id}
//                     className="hover:bg-gray-50 transition-colors"
//                   >
//                     <td className="px-5 py-4 text-sm text-gray-500 font-mono whitespace-nowrap">
//                       {(page - 1) * PAGE_SIZE + index + 1}
//                     </td>
//                     <td className="px-5 py-4">
//                       <div className="flex items-center gap-3">
//                         <img
//                           src={user.avatar}
//                           alt={user.name}
//                           className="w-10 h-10 rounded object-cover flex-shrink-0"
//                         />
//                         <div>
//                           <p className="text-sm font-bold text-gray-900">
//                             {user.name}
//                           </p>
//                           <p className="text-xs text-gray-400">{user.since}</p>
//                         </div>
//                       </div>
//                     </td>
//                     <td className="px-5 py-4 text-sm text-gray-600">
//                       {user.email}
//                     </td>
//                     <td className="px-5 py-4">
//                       <span
//                         className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold ${ROLE_STYLES[user.role]}`}
//                       >
//                         {user.role}
//                       </span>
//                     </td>
//                     <td className="px-5 py-4">
//                       <span
//                         className={`flex items-center gap-1.5 text-sm font-semibold ${user.status === "Active" ? "text-green-600" : "text-gray-400"}`}
//                       >
//                         <span
//                           className={`w-2 h-2 rounded-full ${user.status === "Active" ? "bg-green-500" : "bg-gray-300"}`}
//                         />
//                         {user.status}
//                       </span>
//                     </td>
//                     <td className="px-5 py-4 text-end">
//                       <button className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
//                         <MdOutlineMoreVert />
//                       </button>
//                     </td>
//                   </tr>
//                 ))
//               )}
//             </tbody>
//           </table>
//         </div>

//         {/* Mobile Cards */}
//         <div className="md:hidden divide-y divide-gray-100">
//           {paginated.length === 0 ? (
//             <div className="py-12 text-center text-sm text-gray-400">
//               No users match your filters.
//             </div>
//           ) : (
//             paginated.map((user) => (
//               <div key={user.id} className="flex items-start gap-3 px-4 py-4">
//                 <img
//                   src={user.avatar}
//                   alt={user.name}
//                   className="w-10 h-10 rounded-full object-cover flex-shrink-0"
//                 />
//                 <div className="flex-1 min-w-0">
//                   <div className="flex items-start justify-between gap-2">
//                     <div>
//                       <p className="text-sm font-bold text-gray-900">
//                         {user.name}
//                       </p>
//                       <p className="text-xs text-gray-400">{user.since}</p>
//                     </div>
//                     <button className="p-1 text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0">
//                       <MdOutlineMoreVert />
//                     </button>
//                   </div>
//                   <p className="text-xs text-gray-500 mt-1 truncate">
//                     {user.email}
//                   </p>
//                   <div className="flex items-center gap-3 mt-2 flex-wrap">
//                     <span
//                       className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold ${ROLE_STYLES[user.role]}`}
//                     >
//                       {user.role}
//                     </span>
//                     <span
//                       className={`flex items-center gap-1 text-xs font-semibold ${user.status === "Active" ? "text-green-600" : "text-gray-400"}`}
//                     >
//                       <span
//                         className={`w-1.5 h-1.5 rounded-full ${user.status === "Active" ? "bg-green-500" : "bg-gray-300"}`}
//                       />
//                       {user.status}
//                     </span>
//                   </div>
//                 </div>
//               </div>
//             ))
//           )}
//         </div>

//         {/* Pagination */}
//         <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-gray-100">
//           <p className="text-sm text-gray-400 order-2 sm:order-1">
//             Showing{" "}
//             <span className="font-semibold text-gray-600">
//               {filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1} to{" "}
//               {Math.min(page * PAGE_SIZE, filtered.length)}
//             </span>{" "}
//             of <span className="font-semibold text-gray-600">24</span> users
//           </p>
//           <div className="flex items-center gap-1 order-1 sm:order-2">
//             <button
//               onClick={() => setPage((p) => Math.max(1, p - 1))}
//               disabled={page === 1}
//               className="w-8 h-8 flex items-center justify-center rounded-md border border-gray-200 text-gray-400 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
//             >
//               <MdOutlineChevronLeft />
//             </button>
//             {Array.from(
//               { length: Math.min(totalPages, 3) },
//               (_, i) => i + 1,
//             ).map((n) => (
//               <button
//                 key={n}
//                 onClick={() => setPage(n)}
//                 className={`w-8 h-8 flex items-center justify-center rounded-md text-sm font-medium transition-colors ${
//                   page === n
//                     ? "bg-cyan-600 text-white"
//                     : "border border-gray-200 text-gray-600 hover:bg-gray-50"
//                 }`}
//               >
//                 {n}
//               </button>
//             ))}
//             <button
//               onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
//               disabled={page === totalPages}
//               className="w-8 h-8 flex items-center justify-center rounded-md border border-gray-200 text-gray-400 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
//             >
//               <MdOutlineChevronRight />
//             </button>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// export default UserManagement;
