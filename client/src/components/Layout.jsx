import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

export default function Layout() {
  return (
    // Full screen: sidebar fixed on left, content scrolls on right
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Fixed left sidebar */}
      <Sidebar />

      {/* Main content area — scrollable */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Page content rendered here by React Router */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}