import { useParams, useNavigate } from "react-router-dom";
import ProjectDetail from "../projects/ProjectDetail";

export default function StaffingCompanyProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const handleBack = () => {
    navigate("/staffing-company/projects");
  };

  return (
    <ProjectDetail
      projectId={id}
      onBack={handleBack}
      isStaffingCompany={true}
    />
  );
}
