import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  MdOutlineCheckCircle,
  MdOutlineFilterList,
  MdOutlineEdit,
  MdOutlineCreditCard,
  MdOutlineLocationOn,
  MdOutlinePhone,
  MdTrendingUp,
} from "react-icons/md";
import Ltr from "./Ltr";
import { useFormat } from "../hooks/useFormat";

// ── Data ──────────────────────────────────────────────────────────────────────
const INVOICES = [
  {
    id: "INV-2024-0012",
    date: "2023-11-15",
    amount: "$2,499.00",
    status: "PAID",
  },
  {
    id: "INV-2024-0011",
    date: "2023-10-15",
    amount: "$2,499.00",
    status: "PAID",
  },
  {
    id: "INV-2024-0010",
    date: "2023-09-15",
    amount: "$2,499.00",
    status: "PAID",
  },
  {
    id: "INV-2024-0009",
    date: "2023-08-15",
    amount: "$2,499.00",
    status: "PAID",
  },
  {
    id: "INV-2024-0008",
    date: "2023-07-15",
    amount: "$2,499.00",
    status: "PAID",
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────
export default function BillingSubscriptions() {
  const { t } = useTranslation("settings");
  const { fmtDate } = useFormat();
  const [editingBilling, setEditingBilling] = useState(false);

  return (
    <div className="space-y-5">
      {/* ── Top: Plan + Invoices ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left Column */}
        <div className="space-y-5">
          {/* Active Plan Card */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 lg:p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-cyan-700 bg-cyan-50 border border-cyan-200 px-2.5 py-1 rounded-full uppercase tracking-wider">
                {t("billing.activePlan")}
              </span>
              <button className="text-sm font-semibold text-cyan-600 hover:text-cyan-700 transition-colors">
                {t("billing.changePlan")}
              </button>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-5">
              {t("billing.enterprisePlan")}
            </h2>

            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                  {t("billing.capacity")}
                </p>
                <p className="text-lg font-bold text-gray-900">
                  {t("billing.capacityValue")}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                  {t("billing.expirationDate")}
                </p>
                <p className="text-lg font-bold text-gray-900">{fmtDate("2024-12-20")}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <MdOutlineCheckCircle className="text-green-500 text-xl flex-shrink-0" />
                {t("billing.premiumUnlocked")}
              </div>
              <div className="sm:text-end">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  {t("billing.monthlyTotal")}
                </p>
                <p className="text-2xl font-bold text-gray-900"><Ltr>$2,499.00</Ltr></p>
              </div>
            </div>
          </div>

          {/* Billing Information Card */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 lg:p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-gray-900">
                {t("billing.billingInformation")}
              </h3>
              <button
                onClick={() => setEditingBilling((v) => !v)}
                className="flex items-center gap-1.5 text-sm font-semibold text-cyan-600 hover:text-cyan-700 transition-colors"
              >
                <MdOutlineEdit className="text-base" />
                {editingBilling ? t("billing.done") : t("billing.editInfo")}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Payment Method */}
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">
                  {t("billing.paymentMethod")}
                </p>
                <div className="flex items-center gap-3 border border-gray-200 rounded-lg px-4 py-3 bg-gray-50">
                  <div className="flex-shrink-0 w-12 h-8 bg-white border border-gray-200 rounded flex items-center justify-center">
                    <span className="text-[11px] font-extrabold text-blue-700 tracking-wide">
                      VISA
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      <Ltr>•••• •••• •••• 4242</Ltr>
                    </p>
                    <p className="text-xs text-gray-400">{t("billing.cardExpires")}</p>
                  </div>
                </div>
                {editingBilling && (
                  <button className="mt-2 text-xs font-semibold text-cyan-600 hover:text-cyan-700 transition-colors flex items-center gap-1">
                    <MdOutlineCreditCard className="text-sm" /> {t("billing.updateCard")}
                  </button>
                )}
              </div>

              {/* Billing Address */}
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">
                  {t("billing.billingAddress")}
                </p>
                {editingBilling ? (
                  <div className="space-y-2">
                    <input
                      defaultValue="Global Corp Headquarters"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                    <input
                      defaultValue="123 Enterprise Way, Suite 500"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                    <input
                      defaultValue="San Francisco, CA 94105"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                    <input
                      defaultValue="United States"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                ) : (
                  <div className="text-sm text-gray-700 space-y-0.5">
                    <p className="font-bold text-gray-900">
                      Global Corp Headquarters
                    </p>
                    <p className="text-gray-500">
                      123 Enterprise Way, Suite 500
                    </p>
                    <p className="text-gray-500">San Francisco, CA 94105</p>
                    <p className="text-gray-500">United States</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Recent Invoices */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
            <h3 className="text-base font-bold text-gray-900">
              {t("billing.recentInvoices")}
            </h3>
            <button className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              <MdOutlineFilterList />
            </button>
          </div>

          {/* Desktop Invoice List */}
          <div className="hidden sm:block flex-1 divide-y divide-gray-50">
            {INVOICES.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <div>
                  <p className="text-sm font-bold text-gray-900"><Ltr>{inv.id}</Ltr></p>
                  <p className="text-xs text-gray-400 mt-0.5">{fmtDate(inv.date)}</p>
                </div>
                <div className="text-end">
                  <span className="text-[10px] font-bold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full uppercase tracking-wider block mb-1">
                    {t("billing.status.paid")}
                  </span>
                  <p className="text-sm font-bold text-gray-900">
                    <Ltr>{inv.amount}</Ltr>
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Mobile Invoice List (more compact) */}
          <div className="sm:hidden flex-1 divide-y divide-gray-50">
            {INVOICES.slice(0, 3).map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="text-sm font-bold text-gray-900"><Ltr>{inv.id}</Ltr></p>
                  <p className="text-xs text-gray-400">{fmtDate(inv.date)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full uppercase">
                    {t("billing.status.paid")}
                  </span>
                  <p className="text-sm font-bold text-gray-900">
                    <Ltr>{inv.amount}</Ltr>
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* View All */}
          <div className="border-t border-gray-100 px-5 py-4 flex-shrink-0">
            <button className="w-full text-center text-sm font-semibold text-cyan-600 hover:text-cyan-700 transition-colors py-1">
              {t("billing.viewAllInvoices")}
            </button>
          </div>
        </div>
      </div>

      {/* ── Scaling Banner ── */}
      <div className="bg-cyan-600 rounded-xl p-6 lg:p-8 relative overflow-hidden">
        {/* Decorative */}
        <div className="absolute end-0 top-0 bottom-0 w-1/3 opacity-10 flex items-center justify-center">
          <MdTrendingUp className="text-[200px] text-white" />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 relative z-10">
          <div className="max-w-lg">
            <h3 className="text-xl font-bold text-white mb-2">
              {t("billing.scalingTitle")}
            </h3>
            <p className="text-sm text-cyan-100 leading-relaxed">
              {t("billing.scalingDesc")}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
            <button className="px-5 py-2.5 bg-white text-cyan-600 hover:bg-cyan-50 rounded-lg text-sm font-semibold transition-colors">
              {t("billing.contactSales")}
            </button>
            <button className="px-5 py-2.5 border border-white text-white hover:bg-white hover:text-cyan-600 rounded-lg text-sm font-semibold transition-colors">
              {t("billing.upgradeOptions")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
