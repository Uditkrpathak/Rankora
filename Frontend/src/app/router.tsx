import React from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { ProtectedRoute } from '../components/guards/ProtectedRoute';
import { PublicOnlyRoute } from '../components/guards/PublicOnlyRoute';
import { RoleRoute } from '../components/guards/RoleRoute';
import { FEATURE_FLAGS } from '../config/features';

// Public Pages
import { HomePage } from '../features/home/HomePage';
import { LoginPage } from '../features/auth/LoginPage';
import { AdminLoginPage } from '../features/auth/AdminLoginPage';
import { ForcedChangePasswordPage } from '../features/auth/ForcedChangePasswordPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { VerifyEmailPage } from '../features/auth/VerifyEmailPage';
import { ForgotPasswordPage } from '../features/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '../features/auth/ResetPasswordPage';
import { CreatePasswordPage } from '../features/auth/CreatePasswordPage';
import { SessionsPage } from '../features/auth/SessionsPage';
import { SecuritySettingsPage } from '../features/auth/SecuritySettingsPage';
import { PublicReportPage } from '../features/rankings/PublicReportPage';
import { PrivacyPolicyPage } from '../features/legal/PrivacyPolicyPage';
import { TermsOfServicePage } from '../features/legal/TermsOfServicePage';

// App Pages (protected)
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { SingleProfileDashboardPage } from '../features/dashboard/SingleProfileDashboardPage';
import { AddBusinessProfilesPage } from '../features/locations/AddBusinessProfilesPage';
import { GbpCallbackPage } from '../features/locations/GbpCallbackPage';
import { RankTrackingPage } from '../features/rankings/RankTrackingPage';
import { ProfilePage } from '../features/profile/ProfilePage';
import { HelpPage } from '../features/help/HelpPage';

// Gated & Settings Pages
import { AuditPage } from '../features/audits/AuditPage';
import { ReviewInboxPage } from '../features/reviews/ReviewInboxPage';
import { RecommendationsPage } from '../features/recommendations/RecommendationsPage';
import { CompetitorBenchmarkPage } from '../features/competitors/CompetitorBenchmarkPage';
import { WorkspaceSettingsPage } from '../features/settings/WorkspaceSettingsPage';
import { BillingPage } from '../features/settings/BillingPage';
import { AccountPage } from '../features/settings/AccountPage';
import { ConnectedAccountsPage } from '../features/settings/ConnectedAccountsPage';
import { ExplorePlansPage } from '../features/settings/ExplorePlansPage';
import { PublishedSitesPage } from '../features/settings/PublishedSitesPage';
import { TeamManagement } from '../features/workspaces/TeamManagement';
import { NotificationsPage } from '../features/notifications/NotificationsPage';
import { NotificationSettingsPage } from '../features/settings/NotificationSettingsPage';

// Admin Management Pages
import { AdminDashboardPage } from '../features/admin/AdminDashboardPage';
import { AdminUsersPage } from '../features/admin/AdminUsersPage';
import { AdminUserDetailPage } from '../features/admin/AdminUserDetailPage';
import { AdminAdminsPage } from '../features/admin/AdminAdminsPage';
import { AdminAdminDetailPage } from '../features/admin/AdminAdminDetailPage';
import { AdminPlansPage } from '../features/admin/AdminPlansPage';
import { AdminAuditLogPage } from '../features/admin/AdminAuditLogPage';

// Helper redirect component for location ID to business ID
const LocationRedirect: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/business/${id || ''}`} replace />;
};

export const AppRouter: React.FC = () => {
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);

  return (
    <Routes>
      {/* ── Public Landing & Auth Routes ────────────────────────────── */}
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
      <Route path="/admin/login" element={<PublicOnlyRoute><AdminLoginPage /></PublicOnlyRoute>} />
      <Route path="/change-password" element={<ProtectedRoute><ForcedChangePasswordPage /></ProtectedRoute>} />
      <Route path="/register" element={<PublicOnlyRoute><RegisterPage /></PublicOnlyRoute>} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/forgot-password" element={<PublicOnlyRoute><ForgotPasswordPage /></PublicOnlyRoute>} />
      <Route path="/reset-password" element={<PublicOnlyRoute><ResetPasswordPage /></PublicOnlyRoute>} />
      <Route path="/create-password" element={<CreatePasswordPage />} />
      <Route path="/reports/:shareToken" element={<PublicReportPage />} />
      <Route path="/privacy" element={<PrivacyPolicyPage />} />
      <Route path="/terms" element={<TermsOfServicePage />} />

      {/* ── Core Navigation Routes ─────────────────────────────────── */}
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/business/:id" element={<ProtectedRoute><SingleProfileDashboardPage /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      <Route path="/help" element={<ProtectedRoute><HelpPage /></ProtectedRoute>} />

      {/* ── Location Setup & Scans ─────────────────────────────────── */}
      <Route path="/locations/add" element={<ProtectedRoute><AddBusinessProfilesPage /></ProtectedRoute>} />
      <Route path="/locations/new" element={<Navigate to="/locations/add" replace />} />
      <Route path="/locations/manual-add" element={<Navigate to="/locations/add" replace />} />
      <Route path="/locations/google/callback" element={<ProtectedRoute><GbpCallbackPage /></ProtectedRoute>} />
      <Route path="/rank-tracking" element={<ProtectedRoute><RankTrackingPage /></ProtectedRoute>} />
      <Route path="/recommendations" element={<ProtectedRoute><RecommendationsPage /></ProtectedRoute>} />
      <Route path="/locations/:id/recommendations" element={<ProtectedRoute><RecommendationsPage /></ProtectedRoute>} />
      <Route path="/scans" element={<Navigate to="/rank-tracking" replace />} />

      {/* ── Duplicate & Legacy Route Redirects ─────────────────────── */}
      {/* Old /onboarding route redirects directly to /dashboard */}
      <Route path="/onboarding" element={<Navigate to="/dashboard" replace />} />
      <Route path="/locations" element={<Navigate to="/dashboard" replace />} />
      <Route path="/locations/:id" element={<LocationRedirect />} />
      <Route path="/locations/:id/profile" element={<LocationRedirect />} />
      <Route path="/team" element={<Navigate to="/settings/workspace" replace />} />

      {/* ── Security & Account Settings ────────────────────────────── */}
      <Route path="/sessions" element={<ProtectedRoute><SessionsPage /></ProtectedRoute>} />
      <Route path="/security" element={<ProtectedRoute><SecuritySettingsPage /></ProtectedRoute>} />
      <Route path="/settings" element={<Navigate to="/settings/workspace" replace />} />
      <Route path="/settings/workspace" element={<ProtectedRoute><WorkspaceSettingsPage /></ProtectedRoute>} />
      <Route path="/settings/account" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
      <Route path="/settings/billing" element={<ProtectedRoute><BillingPage /></ProtectedRoute>} />
      <Route path="/settings/notifications" element={<ProtectedRoute><NotificationSettingsPage /></ProtectedRoute>} />
      <Route path="/settings/connections" element={<ProtectedRoute><ConnectedAccountsPage /></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />

      {/* ── Feature Gated Routes (Hidden / Redirected when Backend Not Live) ── */}
      {FEATURE_FLAGS.ENABLE_AUDITS ? (
        <Route path="/audits" element={<ProtectedRoute><AuditPage /></ProtectedRoute>} />
      ) : (
        <Route path="/audits" element={<Navigate to="/dashboard" replace />} />
      )}

      {FEATURE_FLAGS.ENABLE_REVIEWS_INBOX ? (
        <Route path="/reviews" element={<ProtectedRoute><ReviewInboxPage /></ProtectedRoute>} />
      ) : (
        <Route path="/reviews" element={<Navigate to="/dashboard" replace />} />
      )}

      {FEATURE_FLAGS.ENABLE_TEAM_CLIENTS ? (
        <Route path="/settings/team" element={<ProtectedRoute requiredRoles={['owner', 'admin']}><TeamManagement /></ProtectedRoute>} />
      ) : (
        <Route path="/settings/team" element={<Navigate to="/settings/workspace" replace />} />
      )}

      {FEATURE_FLAGS.ENABLE_EXPLORE_PLANS ? (
        <Route path="/settings/plans" element={<ProtectedRoute><ExplorePlansPage /></ProtectedRoute>} />
      ) : (
        <Route path="/settings/plans" element={<Navigate to="/settings/billing" replace />} />
      )}

      {FEATURE_FLAGS.ENABLE_PUBLISHED_SITES ? (
        <Route path="/settings/published-sites" element={<ProtectedRoute><PublishedSitesPage /></ProtectedRoute>} />
      ) : (
        <Route path="/settings/published-sites" element={<Navigate to="/settings/workspace" replace />} />
      )}

      <Route path="/competitors" element={<ProtectedRoute><CompetitorBenchmarkPage /></ProtectedRoute>} />

      {/* ── Admin Management Routes (ADMIN & SUPER_ADMIN) ─────────── */}
      <Route path="/admin" element={<RoleRoute roles={['ADMIN', 'SUPER_ADMIN']}><AdminDashboardPage /></RoleRoute>} />
      <Route path="/admin/users" element={<RoleRoute roles={['ADMIN', 'SUPER_ADMIN']}><AdminUsersPage /></RoleRoute>} />
      <Route path="/admin/users/:id" element={<RoleRoute roles={['ADMIN', 'SUPER_ADMIN']}><AdminUserDetailPage /></RoleRoute>} />

      {/* ── Super Admin Only Routes (SUPER_ADMIN) ──────────────────── */}
      <Route path="/admin/admins" element={<RoleRoute roles={['SUPER_ADMIN']}><AdminAdminsPage /></RoleRoute>} />
      <Route path="/admin/admins/:id" element={<RoleRoute roles={['SUPER_ADMIN']}><AdminAdminDetailPage /></RoleRoute>} />
      <Route path="/admin/plans" element={<RoleRoute roles={['SUPER_ADMIN']}><AdminPlansPage /></RoleRoute>} />
      <Route path="/admin/audit-log" element={<RoleRoute roles={['SUPER_ADMIN']}><AdminAuditLogPage /></RoleRoute>} />

      {/* ── Fallback Catch-All ────────────────────────────────────────── */}
      <Route path="*" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />} />
    </Routes>
  );
};

export default AppRouter;
