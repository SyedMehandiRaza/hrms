import Header from "../components/Header";
import ReadOnlyYearBanner from "../components/ReadOnlyYearBanner";
import SidebarForEmployee from "../components/SidebarForEmployee";

function EmployeeLayout({ children }) {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Employee Sidebar */}
      <SidebarForEmployee />

      {/* Right side — takes remaining width on lg+, full width on mobile */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header fixed at top */}
        <Header />

        {/* Viewing a past / closed financial year */}
        <ReadOnlyYearBanner />

        {/* Only this scrolls */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-10 custom-scrollbar">
          {children}
        </main>
      </div>
    </div>
  );
}

export default EmployeeLayout;
