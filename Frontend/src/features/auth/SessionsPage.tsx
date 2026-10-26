import React from 'react';
import { useListSessionsQuery, useRevokeSessionMutation, useLogoutAllMutation } from '../../store/api/authApi';
import { Laptop, Smartphone, Globe, Shield, Trash2, LogOut, CheckCircle2 } from 'lucide-react';
import { AppNavbar } from '../../components/layout/AppNavbar';

export const SessionsPage: React.FC = () => {
  const { data, isLoading, refetch } = useListSessionsQuery();
  const [revokeSession, { isLoading: isRevoking }] = useRevokeSessionMutation();
  const [logoutAll, { isLoading: isLoggingOutAll }] = useLogoutAllMutation();

  const sessions = data?.data || [];

  const handleRevoke = async (familyId: string) => {
    await revokeSession(familyId);
    refetch();
  };

  const handleLogoutAll = async () => {
    if (window.confirm('Are you sure you want to log out from all devices? You will be returned to the login screen.')) {
      await logoutAll();
      window.location.href = '/login';
    }
  };

  return (
    <div className="min-h-screen w-full page-canvas flex flex-col text-slate-900 antialiased selection:bg-brand-500 selection:text-white">
      <AppNavbar fullWidth={true} />
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Active Device Sessions</h1>
          <p className="text-sm text-slate-500 mt-1">Manage and revoke active login sessions across your devices.</p>
        </div>
        <button
          onClick={handleLogoutAll}
          disabled={isLoggingOutAll}
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 font-semibold text-xs transition disabled:opacity-50 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Log out from all devices</span>
        </button>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-slate-400 text-sm">Loading sessions...</div>
      ) : sessions.length === 0 ? (
        <div className="p-12 text-center text-slate-500 text-sm bg-white rounded-lg border border-slate-200">
          No active sessions found.
        </div>
      ) : (
        <div className="grid gap-4">
          {sessions.map((session: any) => {
            const isMobile = /mobile|iphone|android/i.test(session.userAgent || '');
            return (
              <div
                key={session.familyId}
                className="bg-white rounded-lg border border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="flex items-start space-x-4">
                  <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center flex-shrink-0">
                    {isMobile ? <Smartphone className="w-5 h-5" /> : <Laptop className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-sm text-slate-900">
                        {session.userAgent ? session.userAgent.slice(0, 50) + '...' : 'Unknown Browser'}
                      </span>
                      {session.isCurrent && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                          Current Device
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-4 text-xs text-slate-500 mt-1">
                      <span className="flex items-center space-x-1">
                        <Globe className="w-3.5 h-3.5 text-slate-400" />
                        <span>IP: {session.ipAddress || '0.0.0.0'}</span>
                      </span>
                      <span>Last active: {new Date(session.lastUsedAt || session.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {!session.isCurrent && (
                  <button
                    onClick={() => handleRevoke(session.familyId)}
                    disabled={isRevoking}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:border-rose-300 hover:text-rose-600 text-slate-600 text-xs font-medium transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Revoke</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      </main>
    </div>
  );
};
