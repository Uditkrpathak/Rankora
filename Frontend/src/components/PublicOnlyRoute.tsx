import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../store';

interface PublicOnlyRouteProps {
  children: React.ReactNode;
}

/**
 * Guards public auth pages (/login, /register, /forgot-password, /reset-password).
 * If the user already has an active, authenticated session:
 * - If verified: Redirects to /dashboard (or previously intended route).
 * - If unverified: Redirects to /verify-email.
 * Otherwise, renders the public route component.
 */
export const PublicOnlyRoute: React.FC<PublicOnlyRouteProps> = ({ children }) => {
  const location = useLocation();
  const { isAuthenticated, isLoading, user } = useSelector(
    (state: RootState) => state.auth
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl shadow-2xl">
          <div className="w-10 h-10 rounded-full border-2 border-brand-500/20 border-t-brand-500 animate-spin" />
          <span className="text-xs text-slate-400 font-medium">Loading Localo...</span>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    const destination = (location.state as any)?.from?.pathname || '/dashboard';
    return <Navigate to={destination} replace />;
  }

  return <>{children}</>;
};
