import { Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { Landing } from "./pages/Landing";
import { Dashboard } from "./pages/Dashboard";
import { Transactions } from "./pages/Transactions";
import { TransactionDetailPage } from "./pages/TransactionDetailPage";
import { Alerts } from "./pages/Alerts";
import { GraphPage } from "./pages/GraphPage";
import { Runs } from "./pages/Runs";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route element={<AppShell />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/transactions/:id" element={<TransactionDetailPage />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/graph" element={<GraphPage />} />
        <Route path="/runs" element={<Runs />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
