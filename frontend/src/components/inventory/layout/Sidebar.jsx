import logo from "../../../assets/images/Logo.png";

const navigationItems = [
  { label: "Dashboard", href: "/inventory/dashboard", icon: "dashboard" },
  { label: "Product Management", href: "/inventory/products", icon: "products" },
  { label: "Stock Management", href: "/inventory/stock", icon: "stock" },
  { label: "Stock Verification Requests", href: "/inventory/verifications", icon: "clipboard" },
  { label: "Low Stock Monitoring", href: "/inventory/low-stock", icon: "warning" },
  { label: "Submit Stock Update", href: "/inventory/stock-update", icon: "upload" },
  { label: "Supervisor Notification", href: "/inventory/notifications", icon: "user" },
  { label: "Activity Log", href: "/inventory/activity", icon: "activity" },
];

function NavIcon({ name }) {
  const commonProps = {
    className: "h-5 w-5 shrink-0",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  if (name === "dashboard") {
    return (
      <svg {...commonProps}>
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
    );
  }

  if (name === "products") {
    return (
      <svg {...commonProps}>
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
        <path d="M3.27 6.96 12 12.01l8.73-5.05M12 22.08V12" />
      </svg>
    );
  }

  if (name === "stock") {
    return (
      <svg {...commonProps}>
        <path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z" />
        <path d="M7 7h.01" />
      </svg>
    );
  }

  if (name === "clipboard") {
    return (
      <svg {...commonProps}>
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <rect x="8" y="2" width="8" height="4" rx="1" />
        <path d="m9 14 2 2 4-4" />
      </svg>
    );
  }

  if (name === "warning") {
    return (
      <svg {...commonProps}>
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
        <path d="M12 9v4M12 17h.01" />
      </svg>
    );
  }

  if (name === "upload") {
    return (
      <svg {...commonProps}>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <path d="m17 8-5-5-5 5M12 3v12" />
      </svg>
    );
  }

  if (name === "user") {
    return (
      <svg {...commonProps}>
        <path d="M20 21a8 8 0 0 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6M8 13h8M8 17h8" />
    </svg>
  );
}

function Sidebar({ activePage, isOpen, onClose }) {
  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex h-screen w-64 shrink-0 transform flex-col justify-between border-r border-gray-200 bg-white transition-transform duration-200 lg:sticky lg:top-0 lg:translate-x-0 ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="min-h-0 overflow-y-auto">
        <div className="flex items-center gap-3 border-b border-gray-100 p-4">
          <img src={logo} alt="GrocerEase" className="h-10 w-10 object-contain" />

          <div className="min-w-0 flex-1">
            <h1 className="text-base font-bold leading-tight text-gray-800">
              Grocer<span className="text-green-700">Ease</span>
            </h1>
            <p className="text-[11px] text-gray-400">Inventory Worker Portal</p>
          </div>

          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={onClose}
            className="rounded-md p-1 text-gray-500 hover:bg-gray-100 lg:hidden"
          >
            ×
          </button>
        </div>

        <nav aria-label="Inventory navigation" className="space-y-1 p-3 text-sm font-medium">
          {navigationItems.map((item) => {
            const isActive = activePage === item.label;

            return (
              <a
                key={item.label}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                  isActive
                    ? "bg-green-700 font-semibold text-white"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <NavIcon name={item.icon} />
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-gray-100 p-3">
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="m16 17 5-5-5-5M21 12H9" />
          </svg>
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
