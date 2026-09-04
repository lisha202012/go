import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import OnboardingPage from '../pages/OnboardingPage';
import RankingsPage from '../pages/RankingsPage';
import LoginPage from '../pages/LoginPage';
import AdminLoginPage from '../pages/admin/AdminLoginPage';
import { AdminAppFrame } from '../components/admin/AdminAppFrame';
import { AdminShell } from '../pages/admin/AdminShell';
import {
  AdminHomePage,
  MissionEngineAdminPage,
  JourneyAdminPage,
  GlowAdminPage,
  UsersAdminPage,
  OrganizationsAdminPage,
  SchoolLinksAdminPage,
  SchoolLinkStudentsAdminPage,
  AvatarAssetsAdminPage,
  AuditLogAdminPage,
} from '../pages/admin/AdminModulePages';
import { AppShell } from '../components/AppShell';
import GlowInvitePage from '../pages/GlowInvitePage';
import { HarvestShell } from '../components/HarvestShell';
import { useAuthStore } from '../store/useAuthStore';

function RootRedirect() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  if (!accessToken && !refreshToken) return <Navigate to="/login" replace />;
  if (user && !user.onboardingCompleted) return <Navigate to="/onboarding" replace />;
  return <Navigate to="/home" replace />;
}

function RequireAuth({ children }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  if (!accessToken && !refreshToken) return <Navigate to="/login" replace />;
  return children;
}

/** Blocks /home, /missions, etc. until GAP assessment is complete (onboardingCompleted from /auth/me). */
function RequireGapComplete({ children }) {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  if (!accessToken && !refreshToken) return <Navigate to="/login" replace />;
  if (user && !user.onboardingCompleted) return <Navigate to="/onboarding" replace />;
  return children;
}

function RequireAdmin({ children }) {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  if (!accessToken && !refreshToken) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/admin/login?next=${next}`} replace />;
  }
  if (!user || user.role !== 'admin') {
    return <Navigate to="/admin/login?error=staff_only" replace />;
  }
  return children;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<LoginPage initialMode="signup" />} />
      <Route path="/invite/glow/:token" element={<GlowInvitePage />} />
      <Route
        path="/harvest"
        element={
          <RequireGapComplete>
            <HarvestShell />
          </RequireGapComplete>
        }
      />
      <Route path="/admin/login" element={<AdminAppFrame><AdminLoginPage /></AdminAppFrame>} />
      <Route
        path="/onboarding"
        element={
          <RequireAuth>
            <OnboardingPage />
          </RequireAuth>
        }
      />
      <Route
        element={
          <RequireGapComplete>
            <AppShell />
          </RequireGapComplete>
        }
      >
        <Route path="/home" element={null} />
        <Route path="/missions" element={null} />
        <Route path="/journey" element={null} />
        <Route path="/glow" element={null} />
        <Route path="/profile" element={null} />
        <Route path="/rankings" element={<RankingsPage />} />
      </Route>
      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <AdminAppFrame>
              <AdminShell />
            </AdminAppFrame>
          </RequireAdmin>
        }
      >
        <Route index element={<AdminHomePage />} />
        <Route path="mission-engine" element={<MissionEngineAdminPage />} />
        <Route path="journey" element={<JourneyAdminPage />} />
        <Route path="glow" element={<GlowAdminPage />} />
        <Route path="users" element={<UsersAdminPage />} />
        <Route path="organizations" element={<OrganizationsAdminPage />} />
        <Route path="school-links" element={<SchoolLinksAdminPage />} />
        <Route path="school-links/:linkId/students" element={<SchoolLinkStudentsAdminPage />} />
        <Route path="avatar-assets" element={<AvatarAssetsAdminPage />} />
        <Route path="trust-safety" element={<Navigate to="/admin/users" replace />} />
        <Route path="audit" element={<AuditLogAdminPage />} />
      </Route>
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}
