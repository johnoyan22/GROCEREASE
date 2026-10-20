import { Link } from "react-router-dom";
import { UserRound } from "lucide-react";

// Shared top navigation for Inventory Worker pages.
function Topbar({ onMenuClick, user }) {
  let fullName = "Inventory Worker";

  if (user.profile) {
    const firstName = user.profile.first_name || "";
    const lastName = user.profile.last_name || "";

    const accountName = (firstName + " " + lastName).trim();

    if (accountName !== "") {
      fullName = accountName;
    }
  }
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-200 bg-white px-3 py-3 sm:px-6">
      {/* Left: Hamburger Toggle & Search Bar */}
      <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
        <button
          type="button"
          aria-label="Open navigation menu"
          onClick={onMenuClick}
          className="p-1 text-gray-500 hover:text-gray-700"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="relative hidden w-full max-w-md sm:block">
          <input
            type="text" disabled aria-label="Global search unavailable; use the filters on each page"
            placeholder="Use the search on each page"
            className="w-full pl-4 pr-10 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <svg className="w-4 h-4 text-gray-400 absolute right-3 top-2.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Right: Notifications & Profile */}
      <div className="flex items-center gap-1 sm:gap-3 lg:gap-5">
        {/* Bell Alert Badge */}
        <Link to="/inventory/notifications" aria-label="View stock updates" className="relative rounded-full p-2 text-gray-500 hover:bg-gray-100">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </Link>

        {/* Task Requests Badge */}
        <Link to="/inventory/verifications" aria-label="View stock adjustment requests" className="relative rounded-full p-2 text-gray-500 hover:bg-gray-100">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </Link>

        {/* Profile Card */}
          <Link
            to="/inventory/profile"
            aria-label="Open your account"
            title={fullName}
            className="flex items-center gap-2 border-l border-gray-200 pl-3 sm:gap-3 sm:pl-4"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-200 text-amber-800">
              <UserRound size={18} />
            </div>

            <div className="hidden text-left md:block">
              <p className="max-w-40 truncate text-xs font-bold leading-none text-gray-800">
                {fullName}
              </p>
              <p className="mt-0.5 text-[10px] text-gray-400">
                Inventory Worker
              </p>
            </div>
          </Link>
      </div>
    </header>
  );
}

export default Topbar;
