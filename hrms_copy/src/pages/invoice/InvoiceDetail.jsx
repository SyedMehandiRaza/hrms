import { useState } from "react";
import {
  MdOutlineChevronRight,
  MdOutlineDownload,
  MdOutlineSend,
  MdOutlineCheckCircle,
  MdInfoOutline,
  MdOutlineShield,
} from "react-icons/md";
import { useTranslation } from "react-i18next";

import Ltr from "../../components/Ltr";


// ── Data ──────────────────────────────────────────────────────────────────────
const LINE_ITEMS = [
  {
    initials: "SK",
    color: "bg-blue-100",
    textColor: "text-blue-600",
    name: "Sarah Kendrick",
    role: "Senior Cloud Architect",
    hours: "160.00",
    rate: "$125.00",
    amount: "$20,000.00",
  },
  {
    initials: "JM",
    color: "bg-purple-100",
    textColor: "text-purple-600",
    name: "James Miller",
    role: "DevOps Engineer",
    hours: "145.50",
    rate: "$95.00",
    amount: "$13,822.50",
  },
  {
    initials: "AL",
    color: "bg-teal-100",
    textColor: "text-teal-600",
    name: "Anita Lopez",
    role: "Security Analyst",
    hours: "40.00",
    rate: "$110.00",
    amount: "$4,400.00",
  },
  {
    initials: "SV",
    color: "bg-gray-100",
    textColor: "text-gray-500",
    name: "Software Licenses",
    role: "Enterprise Subscription Hub",
    hours: "–",
    rate: "–",
    amount: "$1,250.00",
  },
];

const AUDIT = [
  {
    labelKey: "detail.audit.invoiceGenerated",
    sub: "Oct 12, 2023 · 09:14 AM",
    done: true,
    dotColor: "bg-blue-500",
  },
  {
    labelKey: "detail.audit.viewedByClient",
    sub: "Oct 14, 2023 · 02:45 PM",
    done: true,
    dotColor: "bg-gray-400",
  },
  {
    labelKey: "detail.audit.paymentProcessed",
    subKey: "detail.audit.pendingAction",
    done: false,
    dotColor: "bg-gray-300",
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────
export default function InvoiceDetail({ onBack }) {
  const { t } = useTranslation("invoices");
  const [marked, setMarked] = useState(false);

  return (

      <div className="space-y-5">
        {/* ── Breadcrumb + Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-sm flex-wrap mb-2">
              <button
                onClick={onBack}
                className="text-gray-400 hover:text-cyan-600 transition-colors"
              >
                {t("detail.breadcrumb.invoices")}
              </button>
              <MdOutlineChevronRight className="text-gray-300 rtl:rotate-180" />
              <span className="text-cyan-600 font-semibold">
                {t("detail.breadcrumb.details")}
              </span>
            </div>
            {/* Title + Status */}
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
                <Ltr>INV-2023-089</Ltr>
              </h1>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                  marked
                    ? "text-green-700 bg-green-50 border-green-200"
                    : "text-amber-600 bg-amber-50 border-amber-200"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${marked ? "bg-green-500" : "bg-amber-400"}`}
                />
                {marked ? t("detail.status.paid") : t("detail.status.pending")}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
            <button className="flex items-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors">
              <MdOutlineDownload className="text-base" /> {t("detail.actions.downloadPdf")}
            </button>
            <button className="flex items-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors">
              <MdOutlineSend className="text-base" /> {t("detail.actions.sendInvoice")}
            </button>
            <button
              onClick={() => setMarked(true)}
              disabled={marked}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors ${
                marked
                  ? "bg-green-500 text-white cursor-default"
                  : "bg-cyan-600 hover:bg-cyan-700 text-white"
              }`}
            >
              <MdOutlineCheckCircle className="text-lg" />
              {marked ? t("detail.actions.markedAsPaid") : t("detail.actions.markAsPaid")}
            </button>
          </div>
        </div>

        {/* ── Main Two-column Layout ── */}
        <div className="flex flex-col lg:flex-row gap-5 items-start">
          {/* ── Left Column ── */}
          <div className="flex-1 space-y-5 min-w-0">
            {/* Client / Project / Dates */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                {/* Client */}
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                    {t("detail.clientInformation")}
                  </p>
                  <p className="text-sm font-bold text-gray-900 mb-0.5">
                    Global Tech Solutions Inc.
                  </p>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    452 Enterprise Way, Suite 100
                    <br />
                    San Francisco, CA 94105
                    <br />
                    <Ltr>finance@globaltech.com</Ltr>
                  </p>
                </div>

                {/* Project */}
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                    {t("detail.projectDetails")}
                  </p>
                  <p className="text-sm font-bold text-gray-900 mb-1">
                    Cloud Migration Phase II
                  </p>
                  <p className="text-xs text-gray-400">
                    {t("detail.projectIdLabel")} <Ltr>PRJ-CM-2023</Ltr>
                  </p>
                  <p className="text-xs text-gray-400">
                    {t("detail.billingCycleLabel")} Monthly
                  </p>
                </div>

                {/* Dates */}
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                    {t("detail.importantDates")}
                  </p>
                  <div className="space-y-1.5">
                    {[
                      {
                        labelKey: "detail.dates.issueDate",
                        value: "Oct 12, 2023",
                        color: "text-gray-900",
                      },
                      {
                        labelKey: "detail.dates.dueDate",
                        value: "Oct 26, 2023",
                        color: "text-red-500",
                      },
                      {
                        labelKey: "detail.dates.servicePeriod",
                        value: "Sept 2023",
                        color: "text-gray-900",
                      },
                    ].map(({ labelKey, value, color }) => (
                      <div
                        key={labelKey}
                        className="flex items-center justify-between gap-3"
                      >
                        <span className="text-xs text-gray-400">{t(labelKey)}</span>
                        <span className={`text-xs font-bold ${color}`}>
                          <Ltr>{value}</Ltr>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Service Breakdown */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  {t("detail.serviceBreakdown")}
                </p>
              </div>

              {/* Desktop Table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {[
                        t("detail.table.sn"),
                        t("detail.table.employeeService"),
                        t("detail.table.hours"),
                        t("detail.table.rate"),
                        t("detail.table.amount"),
                      ].map(
                        (h, i) => (
                          <th
                            key={h}
                            className={`px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider ${i <= 1 ? "text-start" : "text-end"}`}
                          >
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {LINE_ITEMS.map((item, index) => (
                      <tr
                        key={item.name}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-5 py-4 text-sm text-gray-600 text-start">
                          {index + 1}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-lg ${item.color} ${item.textColor} text-xs font-bold flex items-center justify-center flex-shrink-0`}
                            >
                              {item.initials}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-gray-900">
                                {item.name}
                              </p>
                              <p className="text-xs text-gray-400">
                                {item.role}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-600 text-end">
                          <Ltr>{item.hours}</Ltr>
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-600 text-end">
                          <Ltr>{item.rate}</Ltr>
                        </td>
                        <td className="px-5 py-4 text-sm font-bold text-gray-900 text-end">
                          <Ltr>{item.amount}</Ltr>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="sm:hidden divide-y divide-gray-100">
                {LINE_ITEMS.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-start gap-3 px-4 py-4"
                  >
                    <div
                      className={`w-9 h-9 rounded-lg ${item.color} ${item.textColor} text-xs font-bold flex items-center justify-center flex-shrink-0`}
                    >
                      {item.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold text-gray-900">
                            {item.name}
                          </p>
                          <p className="text-xs text-gray-400">{item.role}</p>
                        </div>
                        <p className="text-sm font-bold text-gray-900 flex-shrink-0">
                          <Ltr>{item.amount}</Ltr>
                        </p>
                      </div>
                      {item.hours !== "–" && (
                        <div className="flex gap-4 mt-1.5 text-xs text-gray-400">
                          <span><Ltr>{item.hours}</Ltr> {t("detail.hoursUnit")}</span>
                          <span>@ <Ltr>{item.rate}</Ltr></span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes & Instructions */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                {t("detail.notesTitle")}
              </p>
              <p className="text-sm text-gray-600 leading-relaxed">
                Please include the invoice number{" "}
                <strong className="text-gray-900"><Ltr>INV-2023-089</Ltr></strong> with
                your wire transfer. All payments should be made within{" "}
                <strong className="text-gray-900">14 days</strong> of the issue
                date. For any billing inquiries, please contact our finance
                department at{" "}
                <span className="text-cyan-600">
                  <Ltr>billing@hrmsenterprise.com</Ltr>
                </span>{" "}
                or call{" "}
                <strong className="text-gray-900"><Ltr>+1 (555) 012-3456</Ltr></strong>.
              </p>
            </div>

            {/* Footer */}
            <div className="text-center py-2">
              <p className="flex items-center justify-center gap-2 text-[10px] font-bold text-gray-300 uppercase tracking-widest">
                <MdOutlineShield className="text-sm" /> {t("detail.digitallySigned")}
              </p>
            </div>
          </div>

          {/* ── Right Sidebar ── */}
          <div className="w-full lg:w-72 xl:w-80 flex-shrink-0 space-y-4">
            {/* Financial Summary */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">
                {t("detail.financialSummary")}
              </p>
              <div className="space-y-3 mb-4">
                {[
                  {
                    labelKey: "detail.summary.subtotal",
                    value: "$39,472.50",
                    color: "text-gray-900",
                  },
                  {
                    labelKey: "detail.summary.salesTax",
                    value: "$3,355.16",
                    color: "text-gray-900",
                  },
                  {
                    labelKey: "detail.summary.projectDiscount",
                    value: "-$500.00",
                    color: "text-cyan-600",
                  },
                ].map(({ labelKey, value, color }) => (
                  <div
                    key={labelKey}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm text-gray-500">{t(labelKey)}</span>
                    <span className={`text-sm font-semibold ${color}`}>
                      <Ltr>{value}</Ltr>
                    </span>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-100 pt-4 mb-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  {t("detail.totalAmountDue")}
                </p>
                <div className="flex items-end justify-between">
                  <p className="text-3xl font-bold text-cyan-600"><Ltr>$42,327.66</Ltr></p>
                  <p className="text-xs text-gray-400 font-semibold pb-1">
                    <Ltr>USD</Ltr>
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                <MdInfoOutline className="text-blue-500 text-lg flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700 leading-relaxed">
                  {t("detail.infoNote")}
                </p>
              </div>
            </div>

            {/* Audit Trail */}
            <div className="bg-gray-900 rounded-xl p-5">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">
                {t("detail.auditTrail")}
              </p>
              <div className="space-y-0">
                {AUDIT.map((step, i) => (
                  <div key={step.labelKey} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-3 h-3 rounded-full flex-shrink-0 mt-0.5 ${step.dotColor}`}
                      />
                      {i < AUDIT.length - 1 && (
                        <div className="w-px flex-1 bg-gray-700 my-1" />
                      )}
                    </div>
                    <div className="pb-4">
                      <p
                        className={`text-sm font-semibold ${step.done ? "text-white" : "text-gray-500"}`}
                      >
                        {t(step.labelKey)}
                      </p>
                      <p
                        className={`text-xs mt-0.5 ${step.done ? "text-gray-400" : "text-gray-600"}`}
                      >
                        {step.subKey ? t(step.subKey) : <Ltr>{step.sub}</Ltr>}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
  
  );
}
