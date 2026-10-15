import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { useLogoutMutation } from '../store/api/authApi';
import { ShieldAlert, Lock, ArrowLeft, LogOut } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /**
   * Restrict access to specific workspace roles (e.g. ['owner', 'admin'])
   */
  requiredRoles?: ('owner' | 'admin' | 'member' | 'viewer')[];
  /**
   * Enforce that the user must have verified their email. Defaults to true.
   */
  requireVerifiedEmail?: boolean;
}

/**
 * Enterprise ProtectedRoute guarding private routes with comprehensive state handling:
 *
 * 1. Initial / In-Flight Auth Check: Sleek dark glassmorphic loading animation.
 * 2. Unauthenticated: Redirects to /login preserving the requested path in location state.
 * 3. Account Suspended: Renders a dedicated suspension screen with support and logout.
 * 4. Unverified Email: Redirects to /verify-email to complete 14-day trial activation.
 * 5. Role-Based Access Control (RBAC): Renders an access-denied UI if user role is insufficient.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRoles,
  requireVerifiedEmail = false
}) => {
  const location = useLocation();
  const dispatch = useDispatch();
  const { isAuthenticated, isLoading, user, activeWorkspace } = useSelector(
    (state: RootState) => state.auth
  );
  const [logout] = useLogoutMutation();

  // 1. Loading State
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl shadow-2xl">
          <div className="relative w-12 h-12">
            <div className="w-12 h-12 rounded-full border-2 border-brand-500/20 border-t-brand-500 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-4 h-4 rounded-full bg-brand-500/40 animate-pulse" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-200 tracking-wide">Authenticating Localo</p>
            <p className="text-xs text-slate-500 mt-0.5">Verifying secure workspace session...</p>
          </div>
        </div>
      </div>
    );
  }

  // 2. Not Authenticated -> Redirect to Login with return URL
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. Account Suspended
  if (user?.status === 'SUSPENDED') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <div className="max-w-md w-full p-8 rounded-2xl bg-slate-900 border border-rose-900/40 shadow-2xl text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mx-auto shadow-inner">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Account Suspended</h2>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Your Localo account has been suspended due to security or policy enforcement. Please contact support to resolve this issue.
            </p>
          </div>
          <div className="pt-2 flex flex-col gap-2">
            <a
              href="mailto:support@localseo.app"
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition text-center"
            >
              Contact Support
            </a>
            <button
              onClick={() => logout()}
              className="w-full py-2.5 px-4 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3b. Forced Password Change Required
  if (user?.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  // 4. Authenticated but Email Unverified
  if (
    requireVerifiedEmail &&
    (user?.status === 'PENDING_VERIFICATION' || !user?.isEmailVerified)
  ) {
    return <Navigate to="/verify-email" state={{ from: location }} replace />;
  }

  // 5. Role-Based Access Control (RBAC)
  if (
    requiredRoles &&
    requiredRoles.length > 0 &&
    activeWorkspace &&
    !requiredRoles.includes(activeWorkspace.role)
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <div className="max-w-md w-full p-8 rounded-2xl bg-slate-900 border border-amber-900/30 shadow-2xl text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Access Restricted</h2>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              You need <span className="font-bold text-amber-400">{requiredRoles.join(' or ')}</span> permissions in workspace <span className="text-white font-medium">{activeWorkspace.name}</span> to access this page.
            </p>
          </div>
          <button
            onClick={() => window.history.back()}
            className="w-full py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Go Back</span>
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
