import SidebarForStaffingCompany from "../components/SidebarForStaffingCompany";
import Header from "../components/Header";

function StaffingCompanyLayout({ children }) {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Staffing Company Sidebar */}
      <SidebarForStaffingCompany />

      {/* Right side — takes remaining width on lg+, full width on mobile */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header fixed at top */}
        <Header />

        {/* Only this scrolls */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-10 custom-scrollbar">
          {children}
        </main>
      </div>
    </div>
  );
}

export default StaffingCompanyLayout;
