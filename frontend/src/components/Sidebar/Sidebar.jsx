import { NavLink } from "react-router-dom";

const navigation = [
  { label: "Dashboard", path: "/", icon: "dashboard" },
  { label: "Documents", path: "/documents", icon: "documents" },
  { label: "Expenses", path: "/expenses", icon: "expenses" },
  { label: "Pay Profiles", path: "/pay-profiles", icon: "pay" },
  { label: "Calculators", path: "/calculators", icon: "calculators" },
  { label: "Notes", path: "/notes", icon: "notes" },
  { label: "Settings", path: "/settings", icon: "settings" },
];

const iconPaths = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  documents: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>,
  expenses: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M16 15h2" /></>,
  pay: <><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5c-.8-.7-1.9-1-3.2-1-1.8 0-3 .8-3 2s1 1.8 3.1 2.2c2.1.4 3.1 1.1 3.1 2.4s-1.3 2.4-3.2 2.4c-1.4 0-2.7-.4-3.7-1.2M12 5.5v13" /></>,
  calculators: <><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M8 6h8v3H8zM8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01" /></>,
  notes: <><path d="M5 3h14v18H5z" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.09A1.7 1.7 0 0 0 8.95 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.58 15 1.7 1.7 0 0 0 3 14v-4h.09A1.7 1.7 0 0 0 4.6 8.95a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.58 1.7 1.7 0 0 0 10 3V3h4v.09A1.7 1.7 0 0 0 15.05 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.42 9 1.7 1.7 0 0 0 21 10v4h-.09A1.7 1.7 0 0 0 19.4 15Z" /></>,
};

function NavIcon({ name }) {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {iconPaths[name]}
    </svg>
  );
}

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">CV</div>
        <div>
          <div className="brand-name">CandyVault</div>
          <div className="brand-tagline">Powered by candyserver</div>
        </div>
      </div>

      <div className="nav-label">Navigation</div>
      <nav className="sidebar-nav" aria-label="Primary navigation">
        {navigation.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/"}
            className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
          >
            <NavIcon name={item.icon} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="workspace-label">CandyVault</div>
        <div className="workspace-status">candyserver connected</div>
      </div>
    </aside>
  );
}

export default Sidebar;
