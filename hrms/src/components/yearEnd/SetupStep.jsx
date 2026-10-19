import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { MdChevronRight, MdEventNote, MdOutlinePolicy, MdTrendingUp, MdWeekend } from "react-icons/md";

import HolidayCopyModal from "../fiscalYear/HolidayCopyModal";
import WeekOffCopyModal from "../fiscalYear/WeekOffCopyModal";
import { cardCls, primaryBtn, secondaryBtn } from "./styles";
import { fyLabel } from "../../utils/fiscalYear";

// Prepare the next FY: holidays, week-offs, leave policy versions, increments.
export default function SetupStep({ yearKey, startMonth, readOnly }) {
  const { t } = useTranslation("fiscalYear");
  const navigate = useNavigate();
  const [modal, setModal] = useState(null); // "holidays" | "weekoffs"
  const [done, setDone] = useState({});
  const nextKey = Number(yearKey) + 1;
  const next = fyLabel(startMonth, nextKey);

  // Static build: every year is available — go straight there.
  const go = (to) => navigate(to);

  const cards = [
    {
      id: "holidays",
      icon: MdEventNote,
      action: () => setModal("holidays"),
      button: t("setupStep.copy"),
      modal: true,
    },
    {
      id: "weekoffs",
      icon: MdWeekend,
      action: () => setModal("weekoffs"),
      button: t("setupStep.copy"),
      modal: true,
    },
    { id: "policies", icon: MdOutlinePolicy, action: () => go("/admin/leave-management/leave-policy"), button: t("setupStep.open") },
    { id: "increments", icon: MdTrendingUp, action: () => go("/admin/salary-increments"), button: t("setupStep.open") },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">{t("setupStep.intro", { next })}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.id} className={`${cardCls} p-4 flex flex-col gap-3`}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0">
                  <Icon className="text-xl" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{t(`setupStep.${c.id}.title`)}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{t(`setupStep.${c.id}.hint`, { next })}</p>
                  {done[c.id] && <p className="text-xs text-emerald-700 mt-1">{t("setupStep.copied")}</p>}
                </div>
              </div>
              {!(c.modal && readOnly) && (
                <button type="button" onClick={c.action} className={`self-end ${c.modal ? primaryBtn : secondaryBtn}`}>
                  {c.button}
                  {!c.modal && <MdChevronRight className="rtl:rotate-180" />}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <HolidayCopyModal
        open={modal === "holidays"}
        onClose={() => setModal(null)}
        fromFy={Number(yearKey)}
        toFy={nextKey}
        onDone={() => setDone((s) => ({ ...s, holidays: true }))}
      />
      <WeekOffCopyModal
        open={modal === "weekoffs"}
        onClose={() => setModal(null)}
        toFy={nextKey}
        onDone={() => setDone((s) => ({ ...s, weekoffs: true }))}
      />
    </div>
  );
}
