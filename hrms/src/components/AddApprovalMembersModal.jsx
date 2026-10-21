import { useEffect, useState } from "react";
import {
  MdOutlineClose,
  MdOutlineDeleteOutline,
  MdOutlineAdd,
} from "react-icons/md";
import { useTranslation } from "react-i18next";
import CustomDropdown from "./CustomDropdown";

const getEmpId = (e) => e?.id;

const blankRow = (level) => ({
  id: null,
  employee_id: "",
  level_no: level || 1,
  is_mandatory: true,
  can_skip: false,
});

// employees: approver options [{ id, name, employee_code, on_project }]
// existingMembers: [{ id, employee_id, level_no, is_mandatory, can_skip }]
// onSave(rows) -> the full new list of members (form rows); error = the server's message
function AddApprovalMembersModal({
  isOpen,
  onClose,
  employees = [],
  existingMembers = [],
  onSave,
  saving = false,
  error = "",
}) {
  const { t } = useTranslation("approvals");
  // Mounted while open: the rows start from the current members.
  const [localError, setLocalError] = useState("");
  const [rows, setRows] = useState(() =>
    existingMembers.length
      ? existingMembers.map((m) => ({
          id: m.id ?? null,
          employee_id: m.employee_id ?? "",
          level_no: m.level_no ?? 1,
          is_mandatory: m.is_mandatory ?? true,
          can_skip: m.can_skip ?? false,
        }))
      : [blankRow(1)]
  );

  useEffect(() => {
    if (!isOpen) return undefined;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (index, field, value) => {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    );
  };

  const addRow = () => setRows((prev) => [...prev, blankRow(prev.length + 1)]);

  const removeRow = (index) => setRows((prev) => prev.filter((_, i) => i !== index));

  // The rule texts of docs/standards.md §7.2 ("Approval group" members), shown under the list.
  const validate = () => {
    if (rows.length === 0) {
      setLocalError(t("membersModal.toast.addAtLeastOne"));
      return false;
    }
    const seen = new Set();
    for (const r of rows) {
      if (!r.employee_id) {
        setLocalError(t("createModal.validation.selectEmployee"));
        return false;
      }
      if (!r.level_no) {
        setLocalError(t("membersModal.toast.employeeLevelRequired"));
        return false;
      }
      if (seen.has(r.employee_id)) {
        setLocalError(t("membersModal.toast.duplicateEmployee"));
        return false;
      }
      seen.add(r.employee_id);
    }
    setLocalError("");
    return true;
  };

  const handleSave = () => {
    if (!validate()) return;
    // The rows are the whole new list; members left out are removed (D22a).
    onSave(rows);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col"
        style={{ maxHeight: "90vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <h3 className="text-lg font-bold text-gray-900">
            {t("membersModal.title")}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
          >
            <MdOutlineClose className="text-xl" />
          </button>
        </div>

        {/* Body */}
        <div
          className="p-6 space-y-3 overflow-y-auto"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {rows.map((row, index) => (
            <div
              key={index}
              className="border border-gray-200 rounded-lg p-3 space-y-3"
            >
              <div className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-7">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    {t("membersModal.employee")}
                  </label>
                  <CustomDropdown
                    value={row.employee_id}
                    onChange={(e) =>
                      handleChange(index, "employee_id", e.target.value)
                    }
                    options={[
                      { label: t("membersModal.selectEmployee"), value: "" },
                      ...employees.map((emp) => ({
                        label: `${emp.name}${emp.employee_code ? ` (${emp.employee_code})` : ""}`,
                        value: getEmpId(emp)
                      }))
                    ]}
                  />
                </div>

                <div className="col-span-4">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    {t("membersModal.level")}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={row.level_no}
                    onChange={(e) =>
                      handleChange(index, "level_no", e.target.value)
                    }
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white"
                  />
                </div>

                <div className="col-span-1 flex justify-center pb-1">
                  <button
                    onClick={() => removeRow(index)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md"
                  >
                    <MdOutlineDeleteOutline />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-5">
                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!row.is_mandatory}
                    onChange={(e) =>
                      handleChange(index, "is_mandatory", e.target.checked)
                    }
                    className="w-4 h-4 accent-cyan-600"
                  />
                  {t("membersModal.mandatory")}
                </label>
                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!row.can_skip}
                    onChange={(e) =>
                      handleChange(index, "can_skip", e.target.checked)
                    }
                    className="w-4 h-4 accent-cyan-600"
                  />
                  {t("membersModal.canSkip")}
                </label>
              </div>
            </div>
          ))}

          <button
            onClick={addRow}
            className="flex items-center gap-2 text-cyan-600 hover:text-cyan-700 text-sm font-semibold"
          >
            <MdOutlineAdd />
            {t("membersModal.addAnotherMember")}
          </button>
          {(localError || error) && <p className="text-xs font-medium text-red-500">{localError || error}</p>}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 shrink-0">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-5 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-60"
          >
            {t("membersModal.cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-semibold disabled:opacity-60 flex items-center gap-2"
          >
            {saving ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {t("membersModal.saving")}
              </>
            ) : (
              t("membersModal.saveMembers")
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AddApprovalMembersModal;
