import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enCommon from "../locales/en/common.json";
import arCommon from "../locales/ar/common.json";
import enNav from "../locales/en/nav.json";
import arNav from "../locales/ar/nav.json";
import enAuth from "../locales/en/auth.json";
import arAuth from "../locales/ar/auth.json";
import enDashboard from "../locales/en/dashboard.json";
import arDashboard from "../locales/ar/dashboard.json";
import enApprovals from "../locales/en/approvals.json";
import arApprovals from "../locales/ar/approvals.json";
import enProjects from "../locales/en/projects.json";
import arProjects from "../locales/ar/projects.json";
import enLeaves from "../locales/en/leaves.json";
import arLeaves from "../locales/ar/leaves.json";
import enEmployees from "../locales/en/employees.json";
import arEmployees from "../locales/ar/employees.json";
import enAttendance from "../locales/en/attendance.json";
import arAttendance from "../locales/ar/attendance.json";
import enPayroll from "../locales/en/payroll.json";
import arPayroll from "../locales/ar/payroll.json";
import enStaffing from "../locales/en/staffing.json";
import arStaffing from "../locales/ar/staffing.json";
import enOffices from "../locales/en/offices.json";
import arOffices from "../locales/ar/offices.json";
import enHolidays from "../locales/en/holidays.json";
import arHolidays from "../locales/ar/holidays.json";
import enDocuments from "../locales/en/documents.json";
import arDocuments from "../locales/ar/documents.json";
import enInvoices from "../locales/en/invoices.json";
import arInvoices from "../locales/ar/invoices.json";
import enContracts from "../locales/en/contracts.json";
import arContracts from "../locales/ar/contracts.json";
import enSettings from "../locales/en/settings.json";
import arSettings from "../locales/ar/settings.json";
import enProfile from "../locales/en/profile.json";
import arProfile from "../locales/ar/profile.json";
import enShared from "../locales/en/shared.json";
import arShared from "../locales/ar/shared.json";
import enVisa from "../locales/en/visa.json";
import arVisa from "../locales/ar/visa.json";
import enLoans from "../locales/en/loans.json";
import arLoans from "../locales/ar/loans.json";
import enCollaboration from "../locales/en/collaboration.json";
import arCollaboration from "../locales/ar/collaboration.json";
import enContractStudio from "../locales/en/contractStudio.json";
import arContractStudio from "../locales/ar/contractStudio.json";
import enExits from "../locales/en/exits.json";
import arExits from "../locales/ar/exits.json";
import enFiscalYear from "../locales/en/fiscalYear.json";
import arFiscalYear from "../locales/ar/fiscalYear.json";

const STORAGE_KEY = "lang";

const readLang = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === "ar" ? "ar" : "en";
  } catch {
    return "en";
  }
};

// Apply text direction + lang attribute on <html>. RTL for Arabic.
const applyDirection = (lng) => {
  const dir = lng === "ar" ? "rtl" : "ltr";
  document.documentElement.setAttribute("dir", dir);
  document.documentElement.setAttribute("lang", lng);
};

const initialLng = readLang();

i18n.use(initReactI18next).init({
  resources: {
    en: { common: enCommon, nav: enNav, auth: enAuth, dashboard: enDashboard, approvals: enApprovals, projects: enProjects, leaves: enLeaves, employees: enEmployees, attendance: enAttendance, payroll: enPayroll, staffing: enStaffing, offices: enOffices, holidays: enHolidays, documents: enDocuments, invoices: enInvoices, contracts: enContracts, settings: enSettings, profile: enProfile, shared: enShared, visa: enVisa, loans: enLoans, collaboration: enCollaboration, contractStudio: enContractStudio, exits: enExits, fiscalYear: enFiscalYear },
    ar: { common: arCommon, nav: arNav, auth: arAuth, dashboard: arDashboard, approvals: arApprovals, projects: arProjects, leaves: arLeaves, employees: arEmployees, attendance: arAttendance, payroll: arPayroll, staffing: arStaffing, offices: arOffices, holidays: arHolidays, documents: arDocuments, invoices: arInvoices, contracts: arContracts, settings: arSettings, profile: arProfile, shared: arShared, visa: arVisa, loans: arLoans, collaboration: arCollaboration, contractStudio: arContractStudio, exits: arExits, fiscalYear: arFiscalYear },
  },
  lng: initialLng,
  fallbackLng: "en",
  defaultNS: "common",
  ns: ["common", "nav", "auth", "dashboard", "approvals", "projects", "leaves", "employees", "attendance", "payroll", "staffing", "offices", "holidays", "documents", "invoices", "contracts", "settings", "profile", "shared", "visa", "loans", "collaboration", "contractStudio", "exits", "fiscalYear"],
  interpolation: { escapeValue: false }, // React already escapes
  returnEmptyString: false,
});

applyDirection(initialLng);

i18n.on("languageChanged", (lng) => {
  try {
    localStorage.setItem(STORAGE_KEY, lng);
  } catch {
    // ignore storage errors
  }
  applyDirection(lng);
});

export default i18n;