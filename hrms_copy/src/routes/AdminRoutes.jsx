import React from "react";
import { Outlet, Route, Routes } from "react-router-dom";
import AdminLayout from "../layouts/AdminLayout";
import Dashboard from "../pages/dashboard/Dashboard";
import SearchResult from "../pages/searchResult/SearchResult";
import Employees from "../pages/employees/Employees";
import EmployeeDetail from "../pages/employees/EmployeeDetail";
import ExitList from "../pages/exits/ExitList";
import ExitDetail from "../pages/exits/ExitDetail";
import AddEmployee from "../pages/employees/AddEmployee";
import Attendance from "../pages/attendance/Attendance";
import AttendanceReports from "../pages/attendance/AttendanceReports";
import OvertimeRequest from "../pages/attendance/OvertimeRequest";
import NewOvertimeRequest from "../pages/attendance/NewOvertimeRequest";
import BulkOvertimeApprovalView from "../pages/attendance/BulkOvertimeApprovalView";
import CorrectionRequest from "../pages/attendance/CorrectionRequest";
import PayrollOverview from "../pages/payroll/PayrollOverview";
import RunPayroll from "../pages/payroll/RunPayroll";
import PayrollPreviewMonthly from "../pages/payroll/PayrollPreviewMonthly";
import EmployeePayrollReview from "../pages/payroll/EmployeePayrollReview";
import SalaryComponent from "../pages/payroll/SalaryComponent";
import SalaryReport from "../pages/payroll/SalaryReport";
import SalaryIncrements from "../pages/payroll/SalaryIncrements";
import AnnualReports from "../pages/reports/AnnualReports";
import YearEndWizard from "../pages/yearEnd/YearEndWizard";
import StaffingBilling from "../pages/payroll/StaffingBilling";
import PayrollApprovals from "../pages/payroll/PayrollApprovals";
import VisaManagement from "../pages/visa/VisaManagement";
import MyVisa from "../pages/employee_dashboard/Visa/MyVisa";
import Transactions from "../pages/payroll/Transactions";
import Documents from "../pages/documents/Documents";
import DocumentTypes from "../pages/documents/DocumentTypes";
import AddNewDocument from "../pages/documents/AddNewDocument";
import Contracts from "../pages/contract/Contracts";
import ContractDetails from "../pages/contract/ContractDetails";
import CreateContract from "../pages/contract/CreateContract";
import ContractTypes from "../pages/contracts/ContractTypes";
// New Contract Studio (UI-only, mock data — separate from legacy contracts)
import NewContractDashboard from "../pages/newContract/NewContractDashboard";
import NewContracts from "../pages/newContract/NewContracts";
import NewContractWizard from "../pages/newContract/NewContractWizard";
import NewDocuments from "../pages/newContract/NewDocuments";
import NewTemplates from "../pages/newContract/NewTemplates";
import NewTemplateBuilder from "../pages/newContract/NewTemplateBuilder";
import MyContracts from "../pages/newContract/MyContracts";
import MyLoans from "../pages/loans/MyLoans";
import LoanApprovals from "../pages/loans/LoanApprovals";
import LeaveEncashments from "../pages/payroll/LeaveEncashments";
import LoanDetailPage from "../pages/loans/LoanDetailPage";
import LeaveManagement from "../pages/leaves/LeaveManagement";
import ApplyLeave from "../pages/leaves/ApplyLeave";
import LeavePolicy from "../pages/leaves/LeavePolicy";
import LeaveCalendar from "../pages/leaves/LeaveCalender";
import ReviewLeaveRequest from "../pages/leaves/ReviewLeaveRequest";

// My Requests Section
import MyOvertimeRequests from "../pages/attendance/MyOvertimeRequests";
import MyCorrectionRequests from "../pages/attendance/MyCorrectionRequests";
import MyLeaveRequests from "../pages/leaves/MyLeaveRequests";
import MyDocuments from "../pages/documents/MyDocuments";
import EmployeeDashboard from "../pages/employee_dashboard/Dashboard/EmployeeDashboard";
import Projects from "../pages/projects/Projects";
import Invitations from "../pages/invitations/Invitations";
import ProjectList from "../pages/projects/ProjectList";
import CreateProject from "../pages/projects/CreateProject";
import ProjectDetail from "../pages/projects/ProjectDetail";
import HeadOffices from "../pages/headOffices/HeadOffices";
import CreateHeadOffice from "../pages/headOffices/CreateHeadOffice";
import StaffingCompanies from "../pages/staffingCompanies/StaffingCompanies";
import AddStaffingCompany from "../pages/staffingCompanies/AddStaffingCompany";
import StaffingCompanyDetails from "../pages/staffingCompanies/StaffingCompanyDetails";
import InvoiceView from "../pages/staffingCompanies/InvoiceView";
import AssignContractEmployees from "../pages/staffingCompanies/AssignContractEmployees";
import Invoices from "../pages/invoice/Invoices";
import InvoiceDetail from "../pages/invoice/InvoiceDetail";
import Approval from "../pages/approval/Approval";
import ViewApprovalGroup from "../pages/approval/ViewApprovalGroup";
import Settings from "../pages/settings/Settings";
import Profile from "../pages/profile/Profile";
import ViewAllLeaveRequest from "../pages/leaves/ViewAllLeaveRequest";
import HolidayManagement from "../pages/holiday/HolidayManagement";
import ShiftManagement from "../pages/shift/shift";
import AddShift from "../pages/shift/AddShift";
import Departments from "../pages/departments/Departments";
import DepartmentDetail from "../pages/departments/DepartmentDetail";

// "My Requests" is self-service: only admins who are also employees have data
// there. The company owner has no employee record → back to the dashboard.
function RequireEmployee() {
  // Static build: "My Requests" is always shown.
  return <Outlet />;
}

function AdminRoutes() {
  return (
    <AdminLayout>
      <Routes>
        <Route path="dashboard" element={<Dashboard />} />

        <Route path="dashboard/search-results" element={<SearchResult />} />

        <Route path="employees" element={<Employees />} />

        <Route path="employees/add-employee" element={<AddEmployee />} />

        <Route path="employees/:id" element={<EmployeeDetail />} />

        {/* Employee Exit (resignation / termination) */}
        <Route path="exits" element={<ExitList />} />
        <Route path="exits/:id" element={<ExitDetail />} />

        <Route path="departments" element={<Departments />} />
        <Route
          path="departments/:id"
          element={<DepartmentDetail />}
        />

        <Route path="invitations" element={<Invitations />} />

        <Route path="attendance" element={<Attendance />} />
        <Route path="attendance/reports" element={<AttendanceReports />} />
        <Route path="attendance/request" element={<OvertimeRequest />} />
        <Route path="attendance/request/new" element={<NewOvertimeRequest />} />
        <Route path="attendance/request/bulk-approval" element={<BulkOvertimeApprovalView />} />
        <Route path="attendance/correction-requests" element={<CorrectionRequest />} />

        <Route path="payroll-overview" element={<PayrollOverview />} />

        <Route path="payroll-overview/run-payroll" element={<RunPayroll />} />

        <Route
          path="payroll-overview/payroll-preview-monthly"
          element={<PayrollPreviewMonthly />}
        />

        <Route
          path="payroll-overview/payroll-preview-monthly/employee-payroll-review"
          element={<EmployeePayrollReview />}
        />

        <Route path="salary-component" element={<SalaryComponent />} />

        <Route path="salary-report" element={<SalaryReport />} />
        <Route path="salary-increments" element={<SalaryIncrements />} />
        <Route path="annual-reports" element={<AnnualReports />} />
        <Route path="fiscal-years/:yearKey/close" element={<YearEndWizard />} />

        <Route path="staffing-billing" element={<StaffingBilling />} />

        <Route path="payroll-approvals" element={<PayrollApprovals />} />

        <Route path="visa-management" element={<VisaManagement />} />
        <Route path="payroll-transactions" element={<Transactions />} />
        <Route path="loan-approvals" element={<LoanApprovals />} />
        <Route path="loan-approvals/:id" element={<LoanDetailPage />} />
        <Route path="leave-encashments" element={<LeaveEncashments />} />

        <Route path="documents" element={<Documents />} />
        <Route path="document-type" element={<DocumentTypes />} />
        <Route path="documents/add-new-document" element={<AddNewDocument />} />
        <Route path="contracts" element={<Contracts />} />
        <Route path="contracts/create" element={<CreateContract />} />
        <Route path="contracts/:id" element={<ContractDetails />} />
        <Route path="contract-types" element={<ContractTypes />} />

        {/* New Contract Studio (UI-only, mock data) */}
        <Route path="new-contracts/dashboard" element={<NewContractDashboard />} />
        <Route path="new-contracts" element={<NewContracts />} />
        <Route path="new-contracts/documents" element={<NewDocuments />} />
        <Route path="new-contracts/templates" element={<NewTemplates />} />
        <Route path="new-contracts/templates/build" element={<NewTemplateBuilder />} />
        <Route path="new-contracts/create" element={<NewContractWizard />} />

        <Route path="leave-management" element={<LeaveManagement />} />

        <Route path="leave-management/apply-leave" element={<ApplyLeave />} />

        <Route path="leave-management/leave-policy" element={<LeavePolicy />} />

        <Route
          path="leave-management/leave-calender"
          element={<LeaveCalendar />}
        />

        <Route
          path="leave-management/review-leave-request"
          element={<ReviewLeaveRequest />}
        />

        <Route
          path="leave-management/view-all-requests"
          element={<ViewAllLeaveRequest />}
        />

        {/* My Requests Section */}
        <Route path="my-requests" element={<RequireEmployee />}>
          <Route path="dashboard" element={<EmployeeDashboard />} />
          <Route path="overtime" element={<MyOvertimeRequests />} />
          <Route path="overtime/new" element={<NewOvertimeRequest />} />
          <Route path="correction" element={<MyCorrectionRequests />} />
          <Route path="leave" element={<MyLeaveRequests />} />
          <Route path="leave/apply-leave" element={<ApplyLeave />} />
          <Route path="documents" element={<MyDocuments />} />
          <Route path="contracts" element={<MyContracts title="My Contracts" subtitle="Contracts sent to you for review and signature." />} />
          <Route path="loans" element={<MyLoans title="My Loans" subtitle="Apply for a company loan and track your EMIs." />} />
          <Route path="loans/:id" element={<LoanDetailPage />} />
          <Route path="visa" element={<MyVisa />} />
        </Route>

        <Route path="holiday-management" element={<HolidayManagement />} />

        <Route path="shift-management" element={<ShiftManagement />} />
        <Route path="shift-management/add-shift" element={<AddShift />} />
        <Route path="shift-management/edit/:id" element={<AddShift />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/all" element={<ProjectList />} />

        <Route path="projects/create-project" element={<CreateProject />} />

        <Route path="projects/project-detail/:id" element={<ProjectDetail />} />

        <Route path="head-offices" element={<HeadOffices />} />

        <Route
          path="head-offices/create-head-office"
          element={<CreateHeadOffice />}
        />

        <Route path="staffing-companies" element={<StaffingCompanies />} />

        <Route
          path="staffing-companies/add-staffing-company"
          element={<AddStaffingCompany />}
        />
        <Route
          path="staffing-companies/company-detail/:id"
          element={<StaffingCompanyDetails />}
        />

        <Route
          path="staffing-companies/company-detail/1/view-invoice"
          element={<InvoiceView />}
        />

        <Route
          path="staffing-companies/assign-contract-employees"
          element={<AssignContractEmployees />}
        />

        <Route path="invoices" element={<Invoices />} />

        <Route path="invoices/invoice-detail" element={<InvoiceDetail />} />

        <Route path="approvals" element={<Approval />} />

        <Route
          path="approvals/approval-group/:id"
          element={<ViewApprovalGroup />}
        />

        <Route path="settings" element={<Settings />} />

        <Route path="profile" element={<Profile />} />
      </Routes>
    </AdminLayout>
  );
}

export default AdminRoutes;
