import { Routes, Route } from "react-router-dom";
import { useTranslation } from "react-i18next";

import Login from "../pages/auth/Login";
import SignUp from "../pages/auth/SignUp";
import ForgotPassword from "../pages/auth/ForgotPassword";
import VerifyOtp from "../pages/auth/VerifyOtp";
import ResetPassword from "../pages/auth/ResetPassword";
import InviteLanding from "../pages/auth/InviteLanding";
import AccessEnded from "../pages/auth/AccessEnded";

import AdminRoutes from "./AdminRoutes";
import ProtectedRoute from "./ProtectedRoute";
import EmployeeRoutes from "./EmployeeRoutes";
import StaffingCompanyRoutes from "./StaffingCompanyRoutes";

// Minimal access-denied screen (kept inline; only the text is translated).
function Unauthorized() {
  const { t } = useTranslation("common");
  return <h1>{t("unauthorized")}</h1>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* PUBLIC ROUTES */}

      <Route path="/" element={<Login />} />

      <Route path="/login" element={<Login />} />

      <Route path="/signup" element={<SignUp />} />

      <Route path="/forgot-password" element={<ForgotPassword />} />

      <Route path="/verify-otp" element={<VerifyOtp />} />

      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/invitations/token/:token" element={<InviteLanding />} />
      <Route path="/unauthorized" element={<Unauthorized />} />
      <Route path="/access-ended" element={<AccessEnded />} />

      {/* ADMIN ROUTES */}
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute panel="admin">
            <AdminRoutes />
          </ProtectedRoute>
        }
      />

      {/* STAFFING COMPANY ROUTES */}
      <Route
        path="/staffing-company/*"
        element={
          <ProtectedRoute panel="staffing-company">
            <StaffingCompanyRoutes />
          </ProtectedRoute>
        }
      />

      {/* EMPLOYEE ROUTES */}
      <Route
        path="/employee/*"
        element={
          <ProtectedRoute panel="employee">
            <EmployeeRoutes />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default AppRoutes;
