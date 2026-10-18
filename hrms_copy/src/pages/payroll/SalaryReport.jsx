import React, { useMemo, useState } from "react";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import { MdDownload } from "react-icons/md";
import * as XLSX from "xlsx";
import CustomDropdown from "../../components/CustomDropdown";
import CustomMonthPicker from "../../components/CustomMonthPicker";
import useFiscalYear from "../../hooks/useFiscalYear";
import useFyResetState from "../../hooks/useFyResetState";
import { PAYROLL_PROJECTS, getSalaryReport } from "../../data/groupE";

const money = (n) =>
  Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const hrs = (n) => (n == null ? "—" : Number(n).toFixed(2));
const rate = (n) => (n == null ? "—" : money(n));

// Column order shared by the on-screen table and the Excel export (i18n label keys).
const HEAD_KEYS = [
  "sn", "employeeName", "idNumber", "designation",
  "workHrs", "allotted", "perHour", "basic", "allowances",
  "otHrs", "otPay", "gross", "adv", "deductions", "netPayable", "sign", "figure",
];

export default function SalaryReport() {
  const { t } = useTranslation("payroll");
  const HEAD = HEAD_KEYS.map((k) => t(`report.head.${k}`));
  const fy = useFiscalYear();
  // A month of the selected FY; back to its default when the year changes.
  const [month, setMonth] = useFyResetState(fy.defaultMonth, fy.version);
  const projects = PAYROLL_PROJECTS;
  const [projectId, setProjectId] = useState("");
  const loading = false;
  // The month's report, built from the static payroll run of that month.
  const report = useMemo(() => (month ? getSalaryReport(month, projectId) : null), [month, projectId]);

  const projName = (id) =>
    projects.find((p) => String(p.id) === String(id))?.project_name || "";

  // Build a flat sheet: project header → rows → subtotal, then grand total.
  const exportExcel = () => {
    if (!report?.projects?.length) return toast.info(t("report.toast.nothingToExport"));
    const aoa = [
      [t("report.excel.title", { month: report.month })],
      [projectId ? t("report.excel.subtitleWithProject", { project: projName(projectId) }) : t("report.excel.subtitle")],
      [],
      HEAD,
    ];
    let sno = 0;
    report.projects.forEach((g) => {
      aoa.push([t("report.excel.project", { name: g.project_name })]);
      g.rows.forEach((r) => {
        sno += 1;
        aoa.push([
          sno, r.name, r.id_number || "", r.designation || "",
          r.work_hours, r.allotted_hours, r.per_hour_rate ?? "", r.basic_pay, r.allowances,
          r.ot_hours, r.ot_pay, r.gross, r.advance, r.deductions, r.net, "", "",
        ]);
      });
      const s = g.subtotal;
      aoa.push([
        "", t("report.subtotal", { name: g.project_name }), "", "",
        s.work_hours, s.allotted_hours, "", s.basic_pay, s.allowances,
        s.ot_hours, s.ot_pay, s.gross, s.advance, s.deductions, s.net, "", "",
      ]);
      aoa.push([]);
    });
    const gt = report.grand_total;
    aoa.push([
      "", t("report.excel.grandTotal"), "", "",
      gt.work_hours, gt.allotted_hours, "", gt.basic_pay, gt.allowances,
      gt.ot_hours, gt.ot_pay, gt.gross, gt.advance, gt.deductions, gt.net, "", "",
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "Salary");
    XLSX.writeFile(wb, `salary_report_${report.month}.xlsx`);
  };

  const grand = report?.grand_total;
  const colCount = HEAD.length;

  return (
    <div className="space-y-5 max-w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("report.title")}</h1>
          <p className="text-gray-500 mt-1 text-sm">
            {t("report.subtitle")}
          </p>
        </div>
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">{t("report.month")}</label>
            <CustomMonthPicker
              value={month}
              onChange={(val) => setMonth(val)}
              className="h-[42px]"
            />
          </div>
          <div className="min-w-[180px]">
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">{t("report.project")}</label>
            <CustomDropdown
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              options={[
                { label: t("report.allProjects"), value: "" },
                ...projects.map((p) => ({ label: p.project_name, value: String(p.id) }))
              ]}
            />
          </div>
          <button
            onClick={exportExcel}
            disabled={!report?.projects?.length}
            className="flex items-center gap-2 bg-[#17a2b8] hover:bg-[#138496] text-white px-4 py-2.5 rounded-lg text-sm font-bold disabled:opacity-50"
          >
            <MdDownload className="text-lg" /> {t("report.download")}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse text-[12px] min-w-[1100px]">
            <thead>
              <tr className="bg-[#f2f4f8] border-b border-gray-200">
                {HEAD.map((h) => (
                  <th key={h} className="py-3 px-3 text-[10px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={colCount} className="py-10 text-center text-sm text-gray-400">{t("report.loading")}</td></tr>
              ) : !report?.generated ? (
                <tr><td colSpan={colCount} className="py-10 text-center text-sm text-gray-400">{t("report.notGenerated")}</td></tr>
              ) : !report?.projects?.length ? (
                <tr><td colSpan={colCount} className="py-10 text-center text-sm text-gray-400">{t("report.noEmployees")}</td></tr>
              ) : (
                report.projects.map((g) => {
                  let sno = 0;
                  return (
                    <React.Fragment key={g.project_id ?? "unassigned"}>
                      <tr className="bg-cyan-50/70 border-y border-cyan-100">
                        <td colSpan={colCount} className="py-2 px-3 font-bold text-cyan-800 text-[12px]">
                          {t("report.projectHeader", { name: g.project_name, count: g.rows.length })}
                        </td>
                      </tr>
                      {g.rows.map((r) => {
                        sno += 1;
                        return (
                          <tr key={r.employee_id} className="border-b border-gray-100 hover:bg-gray-50/60">
                            <td className="py-2 px-3 text-gray-500">{sno}</td>
                            <td className="py-2 px-3 font-semibold text-gray-900 whitespace-nowrap">{r.name}</td>
                            <td className="py-2 px-3 text-gray-600 whitespace-nowrap">{r.id_number || "—"}</td>
                            <td className="py-2 px-3 text-gray-600 whitespace-nowrap">{r.designation || "—"}</td>
                            <td className="py-2 px-3 text-right">{hrs(r.work_hours)}</td>
                            <td className="py-2 px-3 text-right">{hrs(r.allotted_hours)}</td>
                            <td className="py-2 px-3 text-right">{rate(r.per_hour_rate)}</td>
                            <td className="py-2 px-3 text-right">{money(r.basic_pay)}</td>
                            <td className="py-2 px-3 text-right">{money(r.allowances)}</td>
                            <td className="py-2 px-3 text-right">{hrs(r.ot_hours)}</td>
                            <td className="py-2 px-3 text-right">{money(r.ot_pay)}</td>
                            <td className="py-2 px-3 text-right font-semibold">{money(r.gross)}</td>
                            <td className="py-2 px-3 text-right text-amber-700">{r.advance ? money(r.advance) : "—"}</td>
                            <td className="py-2 px-3 text-right text-red-600">{money(r.deductions)}</td>
                            <td className="py-2 px-3 text-right font-bold text-gray-900">{money(r.net)}</td>
                            <td className="py-2 px-3 text-gray-300">—</td>
                            <td className="py-2 px-3 text-gray-300">—</td>
                          </tr>
                        );
                      })}
                      <tr className="bg-gray-50 border-b border-gray-200 font-bold text-gray-800">
                        <td className="py-2 px-3" colSpan={4}>{t("report.subtotal", { name: g.project_name })}</td>
                        <td className="py-2 px-3 text-right">{hrs(g.subtotal.work_hours)}</td>
                        <td className="py-2 px-3 text-right">{hrs(g.subtotal.allotted_hours)}</td>
                        <td className="py-2 px-3"></td>
                        <td className="py-2 px-3 text-right">{money(g.subtotal.basic_pay)}</td>
                        <td className="py-2 px-3 text-right">{money(g.subtotal.allowances)}</td>
                        <td className="py-2 px-3 text-right">{hrs(g.subtotal.ot_hours)}</td>
                        <td className="py-2 px-3 text-right">{money(g.subtotal.ot_pay)}</td>
                        <td className="py-2 px-3 text-right">{money(g.subtotal.gross)}</td>
                        <td className="py-2 px-3 text-right">{money(g.subtotal.advance)}</td>
                        <td className="py-2 px-3 text-right">{money(g.subtotal.deductions)}</td>
                        <td className="py-2 px-3 text-right">{money(g.subtotal.net)}</td>
                        <td className="py-2 px-3" colSpan={2}></td>
                      </tr>
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
            {grand && report?.projects?.length ? (
              <tfoot>
                <tr className="bg-[#eef2f7] font-bold text-gray-900 border-t-2 border-gray-300">
                  <td className="py-3 px-3" colSpan={4}>{t("report.grandTotal", { count: report.employee_count })}</td>
                  <td className="py-3 px-3 text-right">{hrs(grand.work_hours)}</td>
                  <td className="py-3 px-3 text-right">{hrs(grand.allotted_hours)}</td>
                  <td className="py-3 px-3"></td>
                  <td className="py-3 px-3 text-right">{money(grand.basic_pay)}</td>
                  <td className="py-3 px-3 text-right">{money(grand.allowances)}</td>
                  <td className="py-3 px-3 text-right">{hrs(grand.ot_hours)}</td>
                  <td className="py-3 px-3 text-right">{money(grand.ot_pay)}</td>
                  <td className="py-3 px-3 text-right">{money(grand.gross)}</td>
                  <td className="py-3 px-3 text-right">{money(grand.advance)}</td>
                  <td className="py-3 px-3 text-right">{money(grand.deductions)}</td>
                  <td className="py-3 px-3 text-right">{money(grand.net)}</td>
                  <td className="py-3 px-3" colSpan={2}></td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </div>
    </div>
  );
}
