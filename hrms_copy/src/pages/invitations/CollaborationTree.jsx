import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  MdChevronRight,
  MdUnfoldMore,
  MdUnfoldLess,
  MdOutlineSearch,
  MdOutlineAccountTree,
} from "react-icons/md";
import { INVITATIONS, COLLAB_TREES } from "../../data/groupB";
import CustomDropdown from "../../components/CustomDropdown";
import Loader from "../../components/Loader";
import PartnerCompanyView from "./PartnerCompanyView";

const ROLE = {
  OWNER: { badge: "bg-indigo-50 text-indigo-700 border-indigo-200", dot: "bg-indigo-500", avatar: "bg-indigo-100 text-indigo-700" },
  CONSULTANT: { badge: "bg-cyan-50 text-cyan-700 border-cyan-200", dot: "bg-cyan-500", avatar: "bg-cyan-100 text-cyan-700" },
  EPC: { badge: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500", avatar: "bg-amber-100 text-amber-700" },
  SUBCONTRACTOR: { badge: "bg-violet-50 text-violet-700 border-violet-200", dot: "bg-violet-500", avatar: "bg-violet-100 text-violet-700" },
};
const roleOf = (r) =>
  ROLE[r] || { badge: "bg-gray-100 text-gray-600 border-gray-200", dot: "bg-gray-400", avatar: "bg-gray-100 text-gray-600" };

const initials = (name) =>
  (name || "?").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

// count of all descendants (not counting the node itself)
const countNodes = (n) => (n.children || []).reduce((s, c) => s + 1 + countNodes(c), 0);
// every employer_id in the subtree
const allIds = (n, acc = []) => {
  acc.push(n.employer_id);
  (n.children || []).forEach((c) => allIds(c, acc));
  return acc;
};

function TreeNode({ node, expanded, toggle, query, onSelect, isRoot }) {
  const { t } = useTranslation("collaboration");
  const r = roleOf(node.role);
  const roleText = node.role ? t(`role.${node.role}`, { defaultValue: node.role }) : "—";
  const kids = node.children || [];
  const hasKids = kids.length > 0;
  const open = expanded.has(node.employer_id);
  const hit = query && (node.name || "").toLowerCase().includes(query.toLowerCase());
  const selectable = !isRoot; // the root is "me"; only companies UNDER me open

  return (
    <div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => hasKids && toggle(node.employer_id)}
          className={`flex-shrink-0 w-5 h-5 grid place-items-center rounded ${
            hasKids ? "text-gray-400 hover:text-gray-700 hover:bg-gray-100" : "opacity-0 pointer-events-none"
          }`}
          aria-label={open ? t("tree.collapse") : t("tree.expand")}
        >
          <MdChevronRight className={`text-lg transition-transform ${open ? "rotate-90" : ""}`} />
        </button>
        <div
          onClick={() => selectable && onSelect && onSelect(node)}
          className={`flex-1 flex items-center gap-3 my-1 px-3 py-2 rounded-xl border transition-colors ${
            hit ? "border-cyan-300 ring-1 ring-cyan-200 bg-cyan-50/40" : "border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm"
          } ${selectable ? "cursor-pointer hover:border-cyan-300" : ""}`}
        >
          <span className={`flex-shrink-0 w-8 h-8 rounded-full grid place-items-center text-xs font-bold ${r.avatar}`}>
            {initials(node.name)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-gray-800 text-sm truncate">{node.name}</div>
          </div>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${r.badge}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${r.dot}`} /> {roleText}
          </span>
          {hasKids && (
            <span
              className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold"
              title={t("tree.companiesBelow", { count: countNodes(node) })}
            >
              {countNodes(node)}
            </span>
          )}
        </div>
      </div>

      {hasKids && open && (
        <div className="ml-[10px] pl-5 border-l border-dashed border-gray-200">
          {kids.map((c) => (
            <TreeNode key={c.employer_id} node={c} expanded={expanded} toggle={toggle} query={query} onSelect={onSelect} isRoot={false} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CollaborationTree() {
  const { t } = useTranslation("collaboration");
  // Projects the acting company is on (source for the dropdown).
  const [projects] = useState(() => {
    const seen = new Set();
    const uniq = [];
    INVITATIONS.collaborations.forEach((r) => {
      if (!seen.has(r.projectId)) {
        seen.add(r.projectId);
        uniq.push({ id: r.projectId, name: r.projectName || t("invitations.projectFallback", { id: r.projectId }) });
      }
    });
    return uniq;
  });
  const [projectId, setProjectId] = useState(() => (projects.length ? String(projects[0].id) : ""));
  const loadingProjects = false;
  const treeLoading = false;
  const tree = useMemo(() => (projectId ? COLLAB_TREES[projectId] || null : null), [projectId]);
  const [expanded, setExpanded] = useState(new Set());
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null); // a company node → drill-in view


  // Expand everything by default (and whenever a fresh tree or a search arrives).
  const [expandedFor, setExpandedFor] = useState(null);
  const expandKey = tree?.tree ? `${projectId}|${query}` : null;
  if (expandKey && expandedFor !== expandKey) {
    setExpandedFor(expandKey);
    setExpanded(new Set(allIds(tree.tree)));
  }

  const toggle = (id) =>
    setExpanded((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const expandAll = () => tree?.tree && setExpanded(new Set(allIds(tree.tree)));
  const collapseAll = () => tree?.tree && setExpanded(new Set([tree.tree.employer_id]));

  const options = projects.map((p) => ({ label: p.name, value: String(p.id) }));

  // Drill-in: a company under me is selected → show its detail + employees.
  if (selected) {
    return (
      <PartnerCompanyView
        company={selected}
        projects={projects}
        projectId={projectId}
        onBack={() => setSelected(null)}
      />
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 border-b border-gray-100">
        <div className="w-full sm:w-72">
          <CustomDropdown
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            options={options}
            placeholder={loadingProjects ? t("tree.loadingProjects") : t("tree.selectProject")}
          />
        </div>
        <div className="flex-1 relative">
          <MdOutlineSearch className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("tree.searchCompany")}
            className="w-full h-[42px] ps-10 pe-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={expandAll}
            className="inline-flex items-center gap-1.5 px-3 h-[42px] rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            <MdUnfoldMore className="text-lg" /> {t("tree.expandAll")}
          </button>
          <button
            onClick={collapseAll}
            className="inline-flex items-center gap-1.5 px-3 h-[42px] rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            <MdUnfoldLess className="text-lg" /> {t("tree.collapse")}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        {treeLoading ? (
          <Loader />
        ) : !projects.length ? (
          <div className="text-center py-16">
            <MdOutlineAccountTree className="mx-auto text-4xl text-gray-300" />
            <p className="mt-3 text-sm font-semibold text-gray-600">{t("tree.empty.title")}</p>
            <p className="text-xs text-gray-400 mt-1">{t("tree.empty.subtitle")}</p>
          </div>
        ) : !tree?.tree ? (
          <div className="text-center py-16 text-sm text-gray-400">{t("tree.selectToView")}</div>
        ) : (
          <>
            {tree.project_name && (
              <div className="flex items-center gap-2 mb-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <MdOutlineAccountTree className="text-base text-gray-400" />
                {t("tree.projectHierarchy", { name: tree.project_name })}
              </div>
            )}
            <TreeNode node={tree.tree} expanded={expanded} toggle={toggle} query={query} onSelect={setSelected} isRoot />
          </>
        )}
      </div>
    </div>
  );
}
