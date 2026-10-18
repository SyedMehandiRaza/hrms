import React from "react";
import { Route, Routes } from "react-router-dom";
import EmployeeLayout from "../layouts/EmployeeLayout";
import EmployeeDashboard from "../pages/employee_dashboard/Dashboard/EmployeeDashboard";
import Myleaves from "../pages/employee_dashboard/Leaves/MyLeaves";
import Profile from "../pages/profile/Profile";
import MyCalendar from "../pages/employee_dashboard/Leaves/MyCalendar";
import Holiday from "../pages/employee_dashboard/Holiday/Holiday";
import ApplyLeave from "../pages/leaves/ApplyLeave";
import ApprovalInbox from "../pages/employee_dashboard/Approvals/ApprovalInbox";
import MyPayslips from "../pages/employee_dashboard/Payroll/MyPayslips";
import PayrollApprovals from "../pages/payroll/PayrollApprovals";
import MyVisa from "../pages/employee_dashboard/Visa/MyVisa";
import VisaApprovals from "../pages/visa/VisaApprovals";
import MyContracts from "../pages/newContract/MyContracts";
import MyLoans from "../pages/loans/MyLoans";
import LoanDetailPage from "../pages/loans/LoanDetailPage";

function EmployeeRoutes() {
  return (
    <EmployeeLayout>
      <Routes>
        <Route path="dashboard" element={<EmployeeDashboard />} />
        <Route path="my-leaves" element={<Myleaves />} />
        <Route path="approvals" element={<ApprovalInbox />} />
        <Route path="my-payslips" element={<MyPayslips />} />
        <Route path="salary-approvals" element={<PayrollApprovals />} />
        <Route path="my-visa" element={<MyVisa />} />
        <Route path="visa-approvals" element={<VisaApprovals />} />
        <Route path="calendar" element={<MyCalendar />} />
        <Route path="holiday-list" element={<Holiday />} />
        <Route path="my-leaves/apply-leave" element={<ApplyLeave />} />
        <Route path="my-contracts" element={<MyContracts audienceFilter="employee" title="My Contracts" subtitle="Contracts your employer has sent you to review and sign." />} />
        <Route path="loans" element={<MyLoans title="My Loans" subtitle="Apply for a company loan and track your EMIs." />} />
        <Route path="loans/:id" element={<LoanDetailPage />} />
        <Route path="profile" element={<Profile />} />
      </Routes>
    </EmployeeLayout>
  );
}

export default EmployeeRoutes;
