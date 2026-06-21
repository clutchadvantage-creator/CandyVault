import { Outlet } from "react-router-dom";
import PageHeader from "../Header/PageHeader.jsx";
import Sidebar from "../Sidebar/Sidebar.jsx";

function AppLayout() {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-shell">
        <PageHeader />
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AppLayout;
