import { useLocation } from "react-router-dom";

const pageNames = {
  "/": "Dashboard",
  "/documents": "Documents",
  "/expenses": "Expenses",
  "/calculators": "Calculators",
  "/notes": "Notes",
  "/settings": "Settings",
};

function PageHeader() {
  const { pathname } = useLocation();
  const pageName = pageNames[pathname] ?? "Dashboard";

  return (
    <header className="top-header">
      <div>
        <div className="header-context">
          Personal Vault <span aria-hidden="true">/</span> <strong>{pageName}</strong>
        </div>
        <div className="header-subtitle">Personal Data &amp; Document Hub</div>
      </div>
      <div className="header-badge">Private workspace</div>
    </header>
  );
}

export default PageHeader;
