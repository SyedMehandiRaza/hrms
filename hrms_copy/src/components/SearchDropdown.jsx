import {
  MdOutlineSearch,
  MdOutlineAccessTime,
  MdOutlineApartment,
} from "react-icons/md";
import { useTranslation } from "react-i18next";

const recentSearches = [
  "Ahmed Khan",
  "Payroll March 2026",
  "Riyadh Metro Project",
];

const quickResults = {
  employees: [
    {
      name: "Ahmed Mansour",
      role: "Senior Project Manager • Riyadh HQ",
      img: "https://randomuser.me/api/portraits/men/32.jpg",
      status: "ACTIVE",
    },
    {
      name: "Farrah Ahmed",
      role: "HR Business Partner • Dubai Office",
      img: "https://randomuser.me/api/portraits/women/45.jpg",
    },
    {
      name: "Ahmed Al-Farsi",
      role: "Chief Operations Officer • Global",
      img: "https://randomuser.me/api/portraits/men/54.jpg",
    },
  ],

  projects: [
    {
      name: "Riyadh Metro - Phase Ahmar",
      sub: "Infrastructure Development • 84% Complete",
    },
    {
      name: "Residential Complex Ahmedi",
      sub: "Kuwait Urban Expansion • In Review",
    },
  ],
};

const SearchDropdown = ({ query, onClose, onSelectResult }) => {
  const { t } = useTranslation("shared");
  const isSearching = query.trim().length > 0;

  return (
    <div className="w-full bg-white border mt-1 border-gray-200 rounded-2xl shadow-xl overflow-hidden custom-scrollbar">
      {/* EMPTY SEARCH */}
      {!isSearching && (
        <div className="p-4">
          <div className="text-xs font-semibold text-gray-400 tracking-wider mb-4">
            {t("search.recentSearches")}
          </div>

          <div className="space-y-4">
            {recentSearches.map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 rounded-lg p-2"
              >
                <MdOutlineAccessTime className="text-gray-400 text-lg" />
                <span className="text-gray-700">{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SEARCH RESULTS */}
      {isSearching && (
        <div className="max-h-[500px] overflow-y-auto">
          {/* Employees */}
          <div className="p-4 border-b">
            <div className="flex justify-between mb-4">
              <span className="text-xs font-bold text-gray-500 tracking-widest">
                {t("search.employees")}
              </span>
              <span className="text-xs text-gray-400">
                {t("search.results", { count: quickResults.employees.length })}
              </span>
            </div>

            <div className="space-y-4">
              {quickResults.employees.map((emp) => (
                <div
                  key={emp.name}
                  className="flex gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded-lg"
                >
                  <img src={emp.img} className="w-10 h-10 rounded-full" />

                  <div className="flex-1">
                    <div className="font-medium text-gray-900 flex gap-2 items-center">
                      {emp.name}

                      {emp.status && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-green-100 text-green-700">
                          {emp.status}
                        </span>
                      )}
                    </div>

                    <div className="text-sm text-gray-500">{emp.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Projects */}
          <div className="p-4">
            <div className="flex justify-between mb-4">
              <span className="text-xs font-bold text-gray-500 tracking-widest">
                {t("search.projects")}
              </span>
              <span className="text-xs text-gray-400">
                {t("search.results", { count: quickResults.projects.length })}
              </span>
            </div>

            <div className="space-y-4">
              {quickResults.projects.map((project) => (
                <div
                  key={project.name}
                  className="flex gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded-lg"
                >
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                    <MdOutlineApartment className="text-cyan-600 text-xl" />
                  </div>

                  <div>
                    <div className="font-medium text-gray-900">
                      {project.name}
                    </div>

                    <div className="text-sm text-gray-500">{project.sub}</div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={onSelectResult}
              className="w-full mt-5 py-3 rounded-xl bg-cyan-600 text-white font-medium hover:bg-cyan-700"
            >
              {t("search.viewFullResults")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchDropdown;
