import React from "react";
import { Route, Routes } from "react-router-dom";
import StaffingCompanyLayout from "../layouts/StaffingCompanyLayout";
import Dashboard from "../pages/staffingCompanyDashboard/Dashboard";
import StaffingCompanyEmployees from "../pages/staffingCompanyDashboard/StaffingCompanyEmployees";
import StaffingCompanyProjects from "../pages/staffingCompanyDashboard/StaffingCompanyProjects";
import StaffingCompanyProjectDetail from "../pages/staffingCompanyDashboard/StaffingCompanyProjectDetail";
import StaffingCompanyProfile from "../pages/staffingCompanyDashboard/StaffingCompanyProfile";
import StaffingCompanyBilling from "../pages/staffingCompanyDashboard/StaffingCompanyBilling";
import MyContracts from "../pages/newContract/MyContracts";

function StaffingCompanyRoutes() {
  return (
    <StaffingCompanyLayout>
      <Routes>
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="employees" element={<StaffingCompanyEmployees />} />
        <Route path="projects" element={<StaffingCompanyProjects />} />
        <Route path="projects/:id" element={<StaffingCompanyProjectDetail />} />
        <Route path="billing" element={<StaffingCompanyBilling />} />
        <Route path="contracts" element={<MyContracts audienceFilter="staffing" title="Contracts" subtitle="Agreements sent to your company for review and signature." />} />
        <Route path="profile" element={<StaffingCompanyProfile />} />
      </Routes>
    </StaffingCompanyLayout>
  );
}

export default StaffingCompanyRoutes;
