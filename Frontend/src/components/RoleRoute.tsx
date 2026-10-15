import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { ShieldAlert, Lock, ArrowLeft } from 'lucide-react';
import { PlatformRole } from '@localo/types';

interface RoleRouteProps {
  children: React.ReactNode;
  roles: PlatformRole[];
}

export const RoleRoute: React.FC<RoleRouteProps> = ({ children, roles }) => {
  const location = useLocation();
  const { isAuthenticated, isLoading, user } = useSelector((state: RootState) => state.auth);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl shadow-2xl">
          <div className="w-12 h-12 rounded-full border-2 border-brand-500/20 border-t-brand-500 animate-spin" />
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-200">Verifying Permissions</p>
            <p className="text-xs text-slate-500 mt-0.5">Checking platform role authorization...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  if (user?.status === 'SUSPENDED') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <div className="max-w-md w-full p-8 rounded-2xl bg-slate-900 border border-rose-900/40 shadow-2xl text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-white">Account Suspended</h2>
          <p className="text-xs text-slate-400">Your account has been suspended by an administrator. Please contact support.</p>
        </div>
      </div>
    );
  }

  if (user?.mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }

  const userRole = (user?.platformRole as PlatformRole) || 'USER';
  if (!roles.includes(userRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <div className="max-w-md w-full p-8 rounded-2xl bg-slate-900 border border-amber-900/30 shadow-2xl text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Administrator Access Required</h2>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              This area is restricted to <span className="font-bold text-amber-400">{roles.join(' / ')}</span> roles. Your current platform role is <span className="font-mono text-white font-semibold">{userRole}</span>.
            </p>
          </div>
          <Link
            to="/dashboard"
            className="w-full py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold transition flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Dashboard</span>
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
