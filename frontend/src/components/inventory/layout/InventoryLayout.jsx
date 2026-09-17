import { useState } from "react";
import Topbar from "./Topbar";
import Sidebar from "./Sidebar";

function InventoryLayout({ children, activePage = "Dashboard" }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-800">
      <Sidebar
        activePage={activePage}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {isSidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setIsSidebarOpen(true)} />

        <main className="min-w-0 flex-1 p-4 sm:p-5 lg:p-6">
          {children}
        </main>

        <footer className="flex flex-col gap-1 border-t border-gray-200 bg-white px-4 py-4 text-[11px] text-gray-400 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© 2026 GrocerEase Grocery System. All rights reserved.</p>
          <p>Version 1.0.0</p>
        </footer>
      </div>
    </div>
  );
}

export default InventoryLayout;
