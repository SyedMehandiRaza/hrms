import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { MdOutlineCloudOff } from "react-icons/md";
import { useCan } from "../../hooks/usePermission";
import { MODULES } from "../../constants/permissions";
import { toastApiError } from "../../utils/apiError";

// Project page tile: "Offline attendance — Allowed / Not allowed".
// Users with project:update get a switch that saves immediately; everyone else sees the badge.
// Same setting as the switch in the Create / Edit project form.
// save(allowed) → the saved project (PUT /projects/:id); without it (static pages) the caller
// gets { allow_offline_attendance } to flip locally.
export default function OfflineAttendanceTile({ project, onSaved, save }) {
  const { t } = useTranslation("projects");
  const can = useCan();
  const canEdit = can(MODULES.PROJECT, "update");
  const [saving, setSaving] = useState(false);

  if (!project) return null;
  const allowed = project.allow_offline_attendance !== false;

  const toggle = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const saved = save ? await save(!allowed) : { allow_offline_attendance: !allowed };
      toast.success(t("offlineAttendance.saved"));
      onSaved?.(saved);
    } catch (err) {
      toastApiError(err, t("offlineAttendance.saveFailed"));
    }
    setSaving(false);
  };

  return (
    <div className="bg-gray-50 rounded-lg p-3 flex items-start justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0">
        <MdOutlineCloudOff className="text-gray-400 text-xl mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs text-gray-500">{t("offlineAttendance.statusLabel")}</p>
          <span
            className={`mt-1 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold ${
              allowed
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-gray-200 bg-gray-100 text-gray-600"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${allowed ? "bg-emerald-500" : "bg-gray-400"}`} />
            {allowed ? t("offlineAttendance.allowed") : t("offlineAttendance.notAllowed")}
          </span>
        </div>
      </div>

      {canEdit && (
        <button
          type="button"
          role="switch"
          aria-checked={allowed}
          aria-label={t("offlineAttendance.toggleAria")}
          title={t("offlineAttendance.hint")}
          disabled={saving}
          onClick={toggle}
          className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 disabled:opacity-50 ${
            allowed ? "bg-cyan-600" : "bg-gray-300"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
              allowed ? "start-[1.375rem]" : "start-0.5"
            }`}
          />
        </button>
      )}
    </div>
  );
}
