import React from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState } from '../../store';
import { useLogoutMutation } from '../../store/api/authApi';
import { useGetWorkspaceQuery } from '../../store/api/workspaceApi';
import { AppNavbar } from '../../components/layout/AppNavbar';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { BusinessAvatar } from '../../components/ui/BusinessAvatar';
import {
  User as UserIcon,
  Mail,
  Building2,
  Zap,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Shield,
  CreditCard,
} from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, activeWorkspace } = useSelector((state: RootState) => state.auth);
  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation();

  const workspaceId = activeWorkspace?.id || '';
  const { data: wsDetail } = useGetWorkspaceQuery(workspaceId, { skip: !workspaceId });

  const handleSignOut = async () => {
    await logout();
    navigate('/login');
  };

  const ws = wsDetail?.data;
  const isVerified = user?.isEmailVerified;

  return (
    <div className="min-h-screen w-full page-canvas flex flex-col text-slate-900 antialiased selection:bg-brand-500 selection:text-white">
      <AppNavbar fullWidth={true} />
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 flex flex-col min-w-0">
        <div className="w-full space-y-4">
        {/* Header */}
        <div className="pb-3 border-b border-slate-200/80 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Account & Profile</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage your personal credentials, workspace association, and security settings.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            disabled={isLoggingOut}
            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
          >
            <LogOut className="w-3.5 h-3.5 mr-1.5" />
            <span>Sign out</span>
          </Button>
        </div>

        {/* User Card */}
        <Card className="p-4 sm:p-5 space-y-4 bg-white">
          <div className="flex items-center gap-3.5 pb-4 border-b border-slate-100">
            <BusinessAvatar
              name={user?.name || user?.email || 'User'}
              size="lg"
              photoUrl={user?.avatarUrl}
            />
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold text-slate-900 truncate">
                {user?.name || 'User'}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-slate-500 truncate">{user?.email}</span>
                {isVerified ? (
                  <Badge variant="success" size="sm" className="gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Verified</span>
                  </Badge>
                ) : (
                  <Badge variant="neutral" size="sm" className="gap-1 text-amber-700 bg-amber-50 border-amber-200">
                    <AlertCircle className="w-3 h-3" />
                    <span>Unverified</span>
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 text-xs">
            <div className="p-3 rounded-lg border border-slate-100 bg-slate-50/50 space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Account Status
              </span>
              <p className="font-medium text-slate-800 capitalize">
                {user?.status?.toLowerCase().replace(/_/g, ' ') || 'Active'}
              </p>
            </div>
          </div>
        </Card>

        {/* Workspace Card */}
        <Card className="p-4 sm:p-5 space-y-4 bg-white">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-brand-600" />
              <h2 className="text-sm font-bold text-slate-900">Current Workspace</h2>
            </div>
            <Badge variant="neutral" size="sm">
              Role: {activeWorkspace?.role || 'owner'}
            </Badge>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Workspace Name</span>
              <span className="font-semibold text-slate-800">{activeWorkspace?.name || 'Default Workspace'}</span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Plan Tier</span>
              <span className="font-semibold text-slate-800 uppercase">{ws?.plan?.key || 'Free Trial'}</span>
            </div>

            <div className="flex items-center justify-between py-1">
              <span className="text-slate-500">Available Scan Credits</span>
              <span className="font-semibold text-brand-600 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5" />
                <span>{ws?.limits?.scanCredits ?? 100} credits</span>
              </span>
            </div>
          </div>
        </Card>
      </div>
      </main>
    </div>
  );
};

export default ProfilePage;
