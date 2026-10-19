import {
  MdCheckCircle,
  MdRadioButtonChecked,
  MdRadioButtonUnchecked,
} from "react-icons/md";
import { useTranslation } from "react-i18next";

// Compact multi-level approval progress indicator.
// Mirrors the employee ApprovalInbox display so admin leave pages look the same.
//   levels: [{ level_no, approved, total, pending }]
//   currentLevel: the level the request is presently waiting on
export default function LevelProgress({ levels = [], currentLevel }) {
  const { t } = useTranslation("common");
  if (!Array.isArray(levels) || levels.length === 0) {
    return <span className="text-gray-400 text-xs">—</span>;
  }
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {levels.map((lvl) => {
        const done = lvl.level_no < currentLevel || lvl.pending === 0;
        const current = lvl.level_no === currentLevel && lvl.pending > 0;
        const Icon = done
          ? MdCheckCircle
          : current
            ? MdRadioButtonChecked
            : MdRadioButtonUnchecked;
        const color = done
          ? "text-green-500"
          : current
            ? "text-cyan-500"
            : "text-gray-300";
        return (
          <span
            key={lvl.level_no}
            className="flex items-center gap-0.5"
            title={t("levels.title", { level: lvl.level_no, approved: lvl.approved, total: lvl.total })}
          >
            <Icon className={`text-base ${color}`} />
            <span className="text-[10px] text-gray-400">{t("levels.short", { level: lvl.level_no })}</span>
          </span>
        );
      })}
    </div>
  );
}
