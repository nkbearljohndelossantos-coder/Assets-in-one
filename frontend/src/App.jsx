import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ToastContainer from './components/Toast';
import Layout from './components/Layout';

// Public & Auth Pages
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ForceChangePassword from './pages/ForceChangePassword';
import ChangePassword from './pages/ChangePassword';
import PublicAssetSpecs from './pages/PublicAssetSpecs';

// ITMS Core Pages
import Dashboard from './pages/Dashboard';
import Assets from './pages/Assets';
import TwoWayRadios from './pages/TwoWayRadios';
import AssetDetails from './pages/AssetDetails';
import Tickets from './pages/Tickets';
import TicketDetails from './pages/TicketDetails';
import Repairs from './pages/Repairs';
import RepairDetails from './pages/RepairDetails';
import Maintenance from './pages/Maintenance';
import MaintenanceDetails from './pages/MaintenanceDetails';
import Inventory from './pages/Inventory';
import Licenses from './pages/Licenses';
import Backups from './pages/Backups';
import Endpoints from './pages/Endpoints';
import NetworkPage from './pages/Network';
import Printers from './pages/Printers';
import FileShares from './pages/FileShares';
import GuestWifi from './pages/GuestWifi';
import Websites from './pages/Websites';
import RemoteManagement from './pages/RemoteManagement';
import WebFiltering from './pages/WebFiltering';
import Employees from './pages/Employees';
import Reports from './pages/Reports';
import AuditLogs from './pages/AuditLogs';
import Settings from './pages/Settings';
import ApiPlatform from './pages/ApiPlatform';
import Calculator from './pages/Calculator';
import WifiDeviceMonitor from './pages/WifiDeviceMonitor';

// PPE Domain Pages
import PpeDashboardPage from './ppe/pages/PpeDashboardPage';
import PpeAssetsPage from './ppe/pages/PpeAssetsPage';
import PpeAssetDetailPage from './ppe/pages/PpeAssetDetailPage';
import PpeAccountingPage from './ppe/pages/PpeAccountingPage';
import PpeContainersPage from './ppe/pages/PpeContainersPage';
import PpeReportsPage from './ppe/pages/PpeReportsPage';

// Route guards
const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Force password reset if flag is active
  if (user.forcePasswordChange && location.pathname !== '/force-change-password') {
    return <Navigate to="/force-change-password" replace state={{ username: user.username }} />;
  }

  return children;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return children;
};

const PermissionRoute = ({ permission, children }) => {
  const { hasPermission, loading } = useAuth();
  if (loading) return null;

  if (permission && !hasPermission(permission)) {
    return (
      <div className="bg-white p-8 rounded-xl border border-slate-200 text-center max-w-md mx-auto space-y-4 shadow mt-10">
        <div className="h-12 w-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200 font-extrabold text-xl">
          !
        </div>
        <h3 className="font-bold text-slate-900 text-lg">403 Access Forbidden</h3>
        <p className="text-xs text-slate-500 leading-normal">
          Your active security roles do not carry authorization parameters ({permission}) required to access this console module.
        </p>
      </div>
    );
  }
  return children;
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* ==========================================
              PUBLIC PATHWAYS
              ========================================== */}
          <Route path="/login" element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          } />
          
          <Route path="/forgot-password" element={
            <PublicRoute>
              <ForgotPassword />
            </PublicRoute>
          } />
          
          <Route path="/reset-password" element={
            <PublicRoute>
              <ResetPassword />
            </PublicRoute>
          } />

          <Route path="/force-change-password" element={
            <ForceChangePassword />
          } />

          {/* Public Fast QR Code Scan Asset Spec Lookup */}
          <Route path="/scan/:code" element={<PublicAssetSpecs />} />
          <Route path="/assets/scan/:code" element={<PublicAssetSpecs />} />

          {/* ==========================================
              PROTECTED APPLICATION SHELL PATHWAYS
              ========================================== */}
          <Route path="/" element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }>
            {/* Dashboard Index */}
            <Route index element={
              <PermissionRoute permission="dashboard.view">
                <Dashboard />
              </PermissionRoute>
            } />

            {/* Change password within shell */}
            <Route path="change-password" element={<ChangePassword />} />

            {/* ==========================================
                PPE (PROPERTY, PLANT & EQUIPMENT) DOMAIN
                ========================================== */}
            <Route path="ppe" element={
              <PermissionRoute permission="ppe.assets.view">
                <PpeDashboardPage />
              </PermissionRoute>
            } />
            <Route path="ppe/assets" element={
              <PermissionRoute permission="ppe.assets.view">
                <PpeAssetsPage />
              </PermissionRoute>
            } />
            <Route path="ppe/assets/:id" element={
              <PermissionRoute permission="ppe.assets.view">
                <PpeAssetDetailPage />
              </PermissionRoute>
            } />
            <Route path="ppe/accounting" element={
              <PermissionRoute permission="ppe.accounting.view">
                <PpeAccountingPage />
              </PermissionRoute>
            } />
            <Route path="ppe/containers" element={
              <PermissionRoute permission="ppe.containers.view">
                <PpeContainersPage />
              </PermissionRoute>
            } />
            <Route path="ppe/reports" element={
              <PermissionRoute permission="ppe.reports.view">
                <PpeReportsPage />
              </PermissionRoute>
            } />

            {/* Legacy PPE backward-compatible redirects */}
            <Route path="property-plant-equipment" element={<Navigate to="/ppe" replace />} />
            <Route path="containers" element={<Navigate to="/ppe/containers" replace />} />
            <Route path="ppe-reports" element={<Navigate to="/ppe/reports" replace />} />

            {/* ==========================================
                ITMS CORE ASSET & SERVICE DESK DOMAIN
                ========================================== */}
            <Route path="assets" element={
              <PermissionRoute permission="assets.view">
                <Assets />
              </PermissionRoute>
            } />
            <Route path="assets/:id" element={
              <PermissionRoute permission="assets.view">
                <AssetDetails />
              </PermissionRoute>
            } />
            <Route path="two-way-radios" element={
              <PermissionRoute permission="assets.view">
                <TwoWayRadios />
              </PermissionRoute>
            } />

            {/* Tickets / Help Desk */}
            <Route path="tickets" element={<Tickets />} />
            <Route path="tickets/:id" element={<TicketDetails />} />

            {/* Repairs */}
            <Route path="repairs" element={
              <PermissionRoute permission="repairs.view">
                <Repairs />
              </PermissionRoute>
            } />
            <Route path="repairs/:id" element={
              <PermissionRoute permission="repairs.view">
                <RepairDetails />
              </PermissionRoute>
            } />

            {/* Maintenance */}
            <Route path="maintenance" element={
              <PermissionRoute permission="maintenance.view">
                <Maintenance />
              </PermissionRoute>
            } />
            <Route path="maintenance/:id" element={
              <PermissionRoute permission="maintenance.view">
                <MaintenanceDetails />
              </PermissionRoute>
            } />

            {/* Inventory */}
            <Route path="inventory" element={
              <PermissionRoute permission="inventory.view">
                <Inventory />
              </PermissionRoute>
            } />

            {/* Software Licenses */}
            <Route path="licenses" element={
              <PermissionRoute permission="licenses.view">
                <Licenses />
              </PermissionRoute>
            } />

            {/* ==========================================
                IT OPERATIONS HUB
                ========================================== */}
            <Route path="backups" element={
              <PermissionRoute permission="backups.view">
                <Backups />
              </PermissionRoute>
            } />
            <Route path="endpoints" element={
              <PermissionRoute permission="endpoint_security.view">
                <Endpoints />
              </PermissionRoute>
            } />
            <Route path="network" element={
              <PermissionRoute permission="network.view">
                <NetworkPage />
              </PermissionRoute>
            } />
            <Route path="printers" element={
              <PermissionRoute permission="printers.view">
                <Printers />
              </PermissionRoute>
            } />
            <Route path="file-shares" element={
              <PermissionRoute permission="file_shares.view">
                <FileShares />
              </PermissionRoute>
            } />
            <Route path="guest-wifi" element={
              <PermissionRoute permission="guest_wifi.view">
                <GuestWifi />
              </PermissionRoute>
            } />
            <Route path="websites" element={
              <PermissionRoute permission="websites.view">
                <Websites />
              </PermissionRoute>
            } />
            <Route path="remote-management" element={
              <PermissionRoute permission="remote_device.view">
                <RemoteManagement />
              </PermissionRoute>
            } />
            <Route path="web-filtering" element={
              <PermissionRoute permission="assets.view">
                <WebFiltering />
              </PermissionRoute>
            } />
            <Route path="wifi-monitor" element={
              <PermissionRoute permission="wifi_monitor.view">
                <WifiDeviceMonitor />
              </PermissionRoute>
            } />

            {/* Calculator */}
            <Route path="calculator" element={<Calculator />} />

            {/* ==========================================
                ADMINISTRATION & PLATFORM
                ========================================== */}
            <Route path="employees" element={
              <PermissionRoute permission="users.view">
                <Employees />
              </PermissionRoute>
            } />

            <Route path="reports" element={
              <PermissionRoute permission="reports.view">
                <Reports />
              </PermissionRoute>
            } />

            <Route path="audit-logs" element={
              <PermissionRoute permission="audit_logs.view">
                <AuditLogs />
              </PermissionRoute>
            } />

            <Route path="api-platform" element={<ApiPlatform />} />

            <Route path="settings" element={
              <PermissionRoute permission="settings.manage">
                <Settings />
              </PermissionRoute>
            } />

          </Route>
        </Routes>
        
        {/* Real-time Alert drawers */}
        <ToastContainer />
      </AuthProvider>
    </BrowserRouter>
  );
}
