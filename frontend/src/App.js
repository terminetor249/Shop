import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import ShopPage from "@/pages/ShopPage";
import InventoryPage from "@/pages/InventoryPage";
import ScenariosPage from "@/pages/ScenariosPage";
import TransactionLogPage from "@/pages/TransactionLogPage";
import PlayerStatsPage from "@/pages/PlayerStatsPage";
import SendCoinsPage from "@/pages/SendCoinsPage";
import AdminItemsPage from "@/pages/AdminItemsPage";
import AdminPlayersPage from "@/pages/AdminPlayersPage";
import AdminPlayerDetailPage from "@/pages/AdminPlayerDetailPage";
import AdminPartyOverviewPage from "@/pages/AdminPartyOverviewPage";
import AdminScenariosPage from "@/pages/AdminScenariosPage";
import AppShell from "@/components/AppShell";
import NotificationPoller from "@/components/NotificationPoller";

function ProtectedRoute({ children, adminOnly = false }) {
  const { user } = useAuth();
  if (user === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="font-mono text-xs uppercase tracking-[0.4em] text-sky-400/70 animate-pulse">
          [ SYNCING WITH THE SYSTEM... ]
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== "admin") return <Navigate to="/" replace />;
  return <AppShell>{children}</AppShell>;
}

function GuestRoute({ children }) {
  const { user } = useAuth();
  if (user === null) return null;
  if (user) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
      <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
      <Route path="/" element={<ProtectedRoute><ShopPage /></ProtectedRoute>} />
      <Route path="/stats" element={<ProtectedRoute><PlayerStatsPage /></ProtectedRoute>} />
      <Route path="/inventory" element={<ProtectedRoute><InventoryPage /></ProtectedRoute>} />
      <Route path="/scenarios" element={<ProtectedRoute><ScenariosPage /></ProtectedRoute>} />
      <Route path="/send" element={<ProtectedRoute><SendCoinsPage /></ProtectedRoute>} />
      <Route path="/log" element={<ProtectedRoute><TransactionLogPage /></ProtectedRoute>} />
      <Route path="/admin/items" element={<ProtectedRoute adminOnly><AdminItemsPage /></ProtectedRoute>} />
      <Route path="/admin/party" element={<ProtectedRoute adminOnly><AdminPartyOverviewPage /></ProtectedRoute>} />
      <Route path="/admin/players" element={<ProtectedRoute adminOnly><AdminPlayersPage /></ProtectedRoute>} />
      <Route path="/admin/players/:id" element={<ProtectedRoute adminOnly><AdminPlayerDetailPage /></ProtectedRoute>} />
      <Route path="/admin/scenarios" element={<ProtectedRoute adminOnly><AdminScenariosPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
          <NotificationPoller />
          <Toaster
            theme="dark"
            position="top-right"
            toastOptions={{
              style: {
                background: "rgba(10, 25, 47, 0.9)",
                border: "1px solid rgba(56, 189, 248, 0.3)",
                color: "#bae6fd",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "12px",
                backdropFilter: "blur(16px)",
              },
            }}
          />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
