import { useTranslation } from "react-i18next";
import { MdOutlineCloudOff } from "react-icons/md";

// Project setting: may employees whose MAIN project this is punch attendance
// offline in the mobile app (synced later)? Backend field
// projects.allow_offline_attendance (default on). The attendance API refuses
// offline punches when it's off; GET /employee/:id/current-projects returns it
// as can_apply_offline_attendance for the mobile app.
//
//   <OfflineAttendanceToggle register={register} name="allowOffline" />
export default function OfflineAttendanceToggle({ register, name = "allowOffline", disabled = false }) {
  const { t } = useTranslation("projects");
  const id = `project-${name}`;
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-3.5">
      <div className="flex items-start gap-3 min-w-0">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-cyan-600">
          <MdOutlineCloudOff className="text-lg" />
        </span>
        <div className="min-w-0">
          <label htmlFor={id} className="block text-sm font-semibold text-gray-800 cursor-pointer">
            {t("offlineAttendance.label")}
          </label>
          <p className="mt-0.5 text-xs leading-5 text-gray-500">{t("offlineAttendance.hint")}</p>
        </div>
      </div>
      <label className="relative inline-flex shrink-0 cursor-pointer items-center mt-1">
        <input id={id} type="checkbox" className="peer sr-only" disabled={disabled} {...register(name)} />
        <span className="h-6 w-11 rounded-full bg-gray-300 transition-colors peer-checked:bg-cyan-600 peer-focus-visible:ring-2 peer-focus-visible:ring-cyan-500 peer-focus-visible:ring-offset-2 peer-disabled:opacity-50" />
        <span className="absolute start-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all peer-checked:start-[1.375rem]" />
      </label>
    </div>
  );
}
