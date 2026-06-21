import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/Layout/AppLayout.jsx";
import InteractionFeedback from "./components/Feedback/InteractionFeedback.jsx";
import Calculators from "./pages/Calculators.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Documents from "./pages/Documents.jsx";
import Expenses from "./pages/Expenses.jsx";
import Notes from "./pages/Notes.jsx";
import PayProfiles from "./pages/PayProfiles.jsx";
import Settings from "./pages/Settings.jsx";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <InteractionFeedback />
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="documents" element={<Documents />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="pay-profiles" element={<PayProfiles />} />
          <Route path="calculators" element={<Calculators />} />
          <Route path="notes" element={<Notes />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
