import { useParams, useNavigate } from "react-router-dom";
import StaticProjectDetail from "./StaticProjectDetail";

export default function StaffingCompanyProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const handleBack = () => {
    navigate("/staffing-company/projects");
  };

  return (
    <StaticProjectDetail
      projectId={id}
      onBack={handleBack}
      isStaffingCompany={true}
    />
  );
}
