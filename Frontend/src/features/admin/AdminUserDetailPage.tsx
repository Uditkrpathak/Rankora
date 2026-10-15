import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { AdminLayout } from './AdminLayout';
import {
  useGetAdminUserDetailQuery,
  useUpdateUserLimitsMutation,
  useUpdateUserPermissionsMutation,
  useUpdateUserPlanMutation,
  useUpdateUserStatusMutation,
  useResetUserUsageMutation
} from '../../store/api/adminApi';
import {
  ArrowLeft,
  User,
  Sliders,
  Shield,
  CreditCard,
  History,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RotateCcw,
  ShieldAlert,
  Save,
  Check,
  Calendar,
  Layers
} from 'lucide-react';

export const AdminUserDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading, isError, refetch } = useGetAdminUserDetailQuery(id || '', { skip: !id });

  const [activeTab, setActiveTab] = useState<'overview' | 'limits' | 'permissions' | 'plan' | 'activity'>('overview');

  // Mutation hooks
  const [updateLimits, { isLoading: isLimitsSaving }] = useUpdateUserLimitsMutation();
  const [updatePermissions, { isLoading: isPermsSaving }] = useUpdateUserPermissionsMutation();
  const [updatePlan, { isLoading: isPlanSaving }] = useUpdateUserPlanMutation();
  const [updateStatus, { isLoading: isStatusSaving }] = useUpdateUserStatusMutation();
  const [resetUsage, { isLoading: isResettingUsage }] = useResetUserUsageMutation();

  // Local state for Limits Tab
  const [useDefaultMap, setUseDefaultMap] = useState<Record<string, boolean>>({
    keywordScanLimit: true,
    scanCreditsPerMonth: true,
    locationLimit: true,
    chatbotQuotaPerMonth: true,
    teamSeatLimit: true
  });
  const [customLimits, setCustomLimits] = useState<Record<string, number>>({
    keywordScanLimit: 100,
    scanCreditsPerMonth: 100,
    locationLimit: 10,
    chatbotQuotaPerMonth: 50,
    teamSeatLimit: 3
  });

  // Local state for Permissions Tab
  const [permsState, setPermsState] = useState<Record<string, boolean>>({
    canScan: true,
    canUseChatbot: true,
    canUseGeoGrid: true,
    canUseCompetitorMatrix: true,
    canExportPdf: true,
    canInviteTeam: true,
    canUseApi: false
  });

  // Local state for Plan Tab
  const [selectedPlanName, setSelectedPlanName] = useState('Trial');
  const [planExpiresAt, setPlanExpiresAt] = useState('');

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    description: string;
    action: () => Promise<void>;
  }>({ open: false, title: '', description: '', action: async () => {} });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const user = data?.data?.user;
  const auditHistory = data?.data?.auditHistory || [];
  const planDetails = user?.planDetails;

  // Initialize form state when user data is loaded
  useEffect(() => {
    if (user) {
      const overrides = user.limitOverrides || {};
      const defLimits = planDetails?.limits || {};

      setUseDefaultMap({
        keywordScanLimit: overrides.keywordScanLimit === null || overrides.keywordScanLimit === undefined,
        scanCreditsPerMonth: overrides.scanCreditsPerMonth === null || overrides.scanCreditsPerMonth === undefined,
        locationLimit: overrides.locationLimit === null || overrides.locationLimit === undefined,
        chatbotQuotaPerMonth: overrides.chatbotQuotaPerMonth === null || overrides.chatbotQuotaPerMonth === undefined,
        teamSeatLimit: overrides.teamSeatLimit === null || overrides.teamSeatLimit === undefined
      });

      setCustomLimits({
        keywordScanLimit: overrides.keywordScanLimit ?? defLimits.keywordScanLimit ?? 100,
        scanCreditsPerMonth: overrides.scanCreditsPerMonth ?? defLimits.scanCreditsPerMonth ?? 100,
        locationLimit: overrides.locationLimit ?? defLimits.locationLimit ?? 10,
        chatbotQuotaPerMonth: overrides.chatbotQuotaPerMonth ?? defLimits.chatbotQuotaPerMonth ?? 50,
        teamSeatLimit: overrides.teamSeatLimit ?? defLimits.teamSeatLimit ?? 3
      });

      const effectivePerms = user.effectivePermissions || {};
      setPermsState({
        canScan: effectivePerms.canScan ?? true,
        canUseChatbot: effectivePerms.canUseChatbot ?? true,
        canUseGeoGrid: effectivePerms.canUseGeoGrid ?? true,
        canUseCompetitorMatrix: effectivePerms.canUseCompetitorMatrix ?? true,
        canExportPdf: effectivePerms.canExportPdf ?? true,
        canInviteTeam: effectivePerms.canInviteTeam ?? true,
        canUseApi: effectivePerms.canUseApi ?? false
      });

      setSelectedPlanName(user.planName || 'Trial');
      setPlanExpiresAt(user.planExpiresAt ? new Date(user.planExpiresAt).toISOString().split('T')[0] : '');
    }
  }, [user, planDetails]);

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="p-12 text-center text-xs text-slate-400 space-y-3">
          <div className="w-8 h-8 rounded-full border-2 border-brand-500/20 border-t-brand-500 animate-spin mx-auto" />
          <p>Loading user profile and limits...</p>
        </div>
      </AdminLayout>
    );
  }

  if (isError || !user) {
    return (
      <AdminLayout>
        <div className="p-8 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs text-center space-y-3">
          <AlertCircle className="w-6 h-6 mx-auto text-rose-400" />
          <p className="font-semibold">User not found or access restricted.</p>
          <Link to="/admin/users" className="text-white underline hover:no-underline">
            ← Return to User Directory
          </Link>
        </div>
      </AdminLayout>
    );
  }

  // Save Limits Handler
  const handleSaveLimits = () => {
    setConfirmModal({
      open: true,
      title: 'Save Custom Resource Limits',
      description: `Are you sure you want to apply these custom resource limit overrides for ${user.email}? This takes effect immediately.`,
      action: async () => {
        try {
          const payload = {
            id: user.id,
            keywordScanLimit: useDefaultMap.keywordScanLimit ? null : customLimits.keywordScanLimit,
            scanCreditsPerMonth: useDefaultMap.scanCreditsPerMonth ? null : customLimits.scanCreditsPerMonth,
            locationLimit: useDefaultMap.locationLimit ? null : customLimits.locationLimit,
            chatbotQuotaPerMonth: useDefaultMap.chatbotQuotaPerMonth ? null : customLimits.chatbotQuotaPerMonth,
            teamSeatLimit: useDefaultMap.teamSeatLimit ? null : customLimits.teamSeatLimit
          };
          await updateLimits(payload).unwrap();
          showToast('User resource limits updated successfully.');
          refetch();
        } catch (err: any) {
          showToast(`Failed: ${err.message || 'Error updating limits'}`);
        }
      }
    });
  };

  // Save Permissions Handler
  const handleSavePermissions = () => {
    setConfirmModal({
      open: true,
      title: 'Update Feature Permissions',
      description: `Are you sure you want to update the feature access permissions for ${user.email}?`,
      action: async () => {
        try {
          await updatePermissions({ id: user.id, ...permsState }).unwrap();
          showToast('Feature permissions updated successfully.');
          refetch();
        } catch (err: any) {
          showToast(`Failed: ${err.message || 'Error updating permissions'}`);
        }
      }
    });
  };

  // Save Plan Handler
  const handleSavePlan = () => {
    setConfirmModal({
      open: true,
      title: `Assign ${selectedPlanName} Plan`,
      description: `Assign plan "${selectedPlanName}" to ${user.email}?`,
      action: async () => {
        try {
          await updatePlan({
            id: user.id,
            planName: selectedPlanName,
            planExpiresAt: planExpiresAt ? new Date(planExpiresAt).toISOString() : null
          }).unwrap();
          showToast(`Plan changed to ${selectedPlanName} successfully.`);
          refetch();
        } catch (err: any) {
          showToast(`Failed: ${err.message || 'Error updating plan'}`);
        }
      }
    });
  };

  // Toggle Suspend Status
  const handleToggleStatus = () => {
    const newStatus = user.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
    setConfirmModal({
      open: true,
      title: `${newStatus === 'SUSPENDED' ? 'Suspend' : 'Activate'} User Account`,
      description: `Are you sure you want to set the account status of ${user.email} to ${newStatus}? ${
        newStatus === 'SUSPENDED' ? 'The user will immediately be blocked from logging in or executing actions.' : 'The user will be restored full access.'
      }`,
      action: async () => {
        try {
          await updateStatus({ id: user.id, status: newStatus }).unwrap();
          showToast(`Account status updated to ${newStatus}.`);
          refetch();
        } catch (err: any) {
          showToast(`Failed: ${err.message || 'Error updating status'}`);
        }
      }
    });
  };

  // Reset Usage Handler
  const handleResetUsage = () => {
    setConfirmModal({
      open: true,
      title: 'Reset Monthly Usage Counters',
      description: `Reset all usage counters (keywords scanned, credits consumed, chatbot messages) for ${user.email} back to zero?`,
      action: async () => {
        try {
          await resetUsage(user.id).unwrap();
          showToast('Monthly usage counters reset to 0.');
          refetch();
        } catch (err: any) {
          showToast(`Failed: ${err.message || 'Error resetting usage'}`);
        }
      }
    });
  };

  return (
    <AdminLayout>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl bg-slate-900 border border-brand-500/40 text-brand-300 text-xs shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3">
          <CheckCircle2 className="w-4 h-4 text-brand-400 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Confirmation Dialog Modal */}
      {confirmModal.open && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white">{confirmModal.title}</h3>
            <p className="text-xs text-slate-400 leading-relaxed">{confirmModal.description}</p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmModal({ ...confirmModal, open: false })}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setConfirmModal({ ...confirmModal, open: false });
                  await confirmModal.action();
                }}
                className="px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-xs text-white font-bold transition cursor-pointer"
              >
                Confirm & Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <Link
            to="/admin/users"
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-tight">{user.name}</h1>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                user.status === 'SUSPENDED'
                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              }`}>
                {user.status}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-500/10 text-brand-400 border border-brand-500/20">
                {user.planName}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{user.email}</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleResetUsage}
            disabled={isResettingUsage}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 font-semibold transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            <span>Reset Usage</span>
          </button>

          <button
            onClick={handleToggleStatus}
            disabled={isStatusSaving}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              user.status === 'SUSPENDED'
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : 'bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>{user.status === 'SUSPENDED' ? 'Activate Account' : 'Suspend Account'}</span>
          </button>
        </div>
      </div>

      {/* ── Navigation Tabs ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-slate-800/80 pb-px overflow-x-auto">
        {[
          { key: 'overview', label: 'Overview', icon: User },
          { key: 'limits', label: 'Limits & Overrides', icon: Sliders },
          { key: 'permissions', label: 'Feature Permissions', icon: Shield },
          { key: 'plan', label: 'Plan & Expiry', icon: CreditCard },
          { key: 'activity', label: 'Audit Trail', icon: History }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'border-brand-500 text-brand-400 bg-brand-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Tab Content ─────────────────────────────────────────────── */}
      {/* 1. OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-xl space-y-5">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-brand-400" />
                <span>Current Usage vs Effective Limits</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  {
                    title: 'Keywords Scanned',
                    used: user.usage?.keywordsScannedThisMonth || 0,
                    limit: user.effectiveLimits?.keywordScanLimit || 100,
                    unit: 'keywords'
                  },
                  {
                    title: 'Scan Credits Consumed',
                    used: user.usage?.scanCreditsUsed || 0,
                    limit: user.effectiveLimits?.scanCreditsPerMonth || 100,
                    unit: 'credits'
                  },
                  {
                    title: 'AI Assistant Queries',
                    used: user.usage?.chatbotUsed || 0,
                    limit: user.effectiveLimits?.chatbotQuotaPerMonth || 50,
                    unit: 'messages'
                  },
                  {
                    title: 'Locations Configured',
                    used: user.usage?.locationsCount || 0,
                    limit: user.effectiveLimits?.locationLimit || 10,
                    unit: 'profiles'
                  }
                ].map((item) => {
                  const percent = Math.min(100, Math.round((item.used / item.limit) * 100));
                  return (
                    <div key={item.title} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-slate-300">{item.title}</span>
                        <span className="text-[11px] font-mono text-slate-400">
                          <strong>{item.used}</strong> / {item.limit} {item.unit}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            percent >= 90 ? 'bg-rose-500' : percent >= 70 ? 'bg-amber-500' : 'bg-brand-500'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-slate-500 text-right">{percent}% quota used</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* User Meta Card */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-xl space-y-4">
            <h2 className="text-sm font-bold text-white">Account Details</h2>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Platform Role</span>
                <span className="font-bold text-white font-mono">{user.platformRole}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Account Status</span>
                <span className="font-semibold text-white">{user.status}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Plan Started</span>
                <span className="text-slate-300">{user.planStartedAt ? new Date(user.planStartedAt).toLocaleDateString() : 'N/A'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Plan Expires</span>
                <span className="text-slate-300">{user.planExpiresAt ? new Date(user.planExpiresAt).toLocaleDateString() : 'Never / Auto-renew'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Last Login</span>
                <span className="text-slate-300">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Never'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Joined</span>
                <span className="text-slate-300">{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. LIMITS TAB */}
      {activeTab === 'limits' && (
        <div className="max-w-3xl p-6 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-xl space-y-6">
          <div>
            <h2 className="text-sm font-bold text-white">Custom Resource Limit Overrides</h2>
            <p className="text-xs text-slate-400 mt-1">
              Toggle "Use Plan Default" to automatically inherit limits from the user's plan ({user.planName}), or enter custom limits.
            </p>
          </div>

          <div className="space-y-4">
            {[
              { key: 'keywordScanLimit', label: 'Keyword Scan Limit', unit: 'keywords/mo', def: planDetails?.limits?.keywordScanLimit || 100 },
              { key: 'scanCreditsPerMonth', label: 'Scan Credits Per Month', unit: 'credits/mo', def: planDetails?.limits?.scanCreditsPerMonth || 100 },
              { key: 'locationLimit', label: 'Maximum Locations', unit: 'profiles', def: planDetails?.limits?.locationLimit || 10 },
              { key: 'chatbotQuotaPerMonth', label: 'AI Assistant Messages', unit: 'messages/mo', def: planDetails?.limits?.chatbotQuotaPerMonth || 50 },
              { key: 'teamSeatLimit', label: 'Team Seat Limit', unit: 'seats', def: planDetails?.limits?.teamSeatLimit || 3 }
            ].map((f) => {
              const isDefault = useDefaultMap[f.key];
              return (
                <div key={f.key} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <label className="text-xs font-semibold text-white block">{f.label}</label>
                    <span className="text-[11px] text-slate-400">
                      Plan Default: <strong className="text-slate-300">{f.def}</strong> {f.unit}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isDefault}
                        onChange={(e) => setUseDefaultMap({ ...useDefaultMap, [f.key]: e.target.checked })}
                        className="rounded border-slate-700 bg-slate-800 text-brand-600 focus:ring-brand-500"
                      />
                      <span>Use Plan Default</span>
                    </label>

                    {!isDefault && (
                      <input
                        type="number"
                        min="1"
                        value={customLimits[f.key] ?? f.def}
                        onChange={(e) => setCustomLimits({ ...customLimits, [f.key]: parseInt(e.target.value) || 0 })}
                        className="w-24 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-bold text-white text-right outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleSaveLimits}
              disabled={isLimitsSaving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-md shadow-brand-600/20 transition cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isLimitsSaving ? 'Saving Overrides...' : 'Save Limits'}</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. PERMISSIONS TAB */}
      {activeTab === 'permissions' && (
        <div className="max-w-3xl p-6 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-xl space-y-6">
          <div>
            <h2 className="text-sm font-bold text-white">Feature Access Permissions</h2>
            <p className="text-xs text-slate-400 mt-1">
              Enable or restrict specific platform features for this user account.
            </p>
          </div>

          <div className="space-y-3">
            {[
              { key: 'canScan', label: 'Keyword Scanning', desc: 'Allow user to run automated and on-demand keyword rank scans.' },
              { key: 'canUseChatbot', label: 'AI Business Assistant', desc: 'Access to the LLM-powered interactive local business copilot.' },
              { key: 'canUseGeoGrid', label: 'Geo-Grid Visualizer', desc: 'Interactive geographic radius maps and local rankings grid.' },
              { key: 'canUseCompetitorMatrix', label: 'Competitor Benchmarking', desc: 'Competitor matrix and local share of voice comparisons.' },
              { key: 'canExportPdf', label: 'PDF & CSV Export', desc: 'Download client-ready audit reports and keyword export sheets.' },
              { key: 'canInviteTeam', label: 'Team Invitations', desc: 'Invite and manage team members and client viewers.' },
              { key: 'canUseApi', label: 'API & MCP Access', desc: 'Access Model Context Protocol server and automated API keys.' }
            ].map((p) => {
              const isChecked = permsState[p.key] ?? false;
              return (
                <div key={p.key} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between gap-4">
                  <div>
                    <label className="text-xs font-semibold text-white block">{p.label}</label>
                    <p className="text-[11px] text-slate-400 mt-0.5">{p.desc}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPermsState({ ...permsState, [p.key]: !isChecked })}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isChecked ? 'bg-brand-600' : 'bg-slate-800'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        isChecked ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleSavePermissions}
              disabled={isPermsSaving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-md shadow-brand-600/20 transition cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isPermsSaving ? 'Saving Permissions...' : 'Save Permissions'}</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. PLAN TAB */}
      {activeTab === 'plan' && (
        <div className="max-w-2xl p-6 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-xl space-y-6">
          <div>
            <h2 className="text-sm font-bold text-white">Manage Subscription Plan</h2>
            <p className="text-xs text-slate-400 mt-1">Assign an administrative plan tier and set expiration bounds.</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Select Plan Tier</label>
              <select
                value={selectedPlanName}
                onChange={(e) => setSelectedPlanName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="Trial">Trial (14-day evaluation, 10 locations)</option>
                <option value="Starter">Starter (3 locations, 50 credits)</option>
                <option value="Pro Growth">Pro Growth (15 locations, 300 credits)</option>
                <option value="Agency Scale">Agency Scale (50+ locations, 1,200 credits)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Plan Expiry Date (Optional)</label>
              <input
                type="date"
                value={planExpiresAt}
                onChange={(e) => setPlanExpiresAt(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white outline-none focus:ring-2 focus:ring-brand-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">Leave empty for open-ended access.</p>
            </div>

            {user.assignedByUserId && (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs text-slate-400">
                Assigned by Admin ID: <strong className="text-white font-mono">{user.assignedByUserId}</strong>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleSavePlan}
              disabled={isPlanSaving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-md shadow-brand-600/20 transition cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isPlanSaving ? 'Updating Plan...' : 'Apply Plan'}</span>
            </button>
          </div>
        </div>
      )}

      {/* 5. ACTIVITY / AUDIT LOG TAB */}
      {activeTab === 'activity' && (
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-xl space-y-4">
          <div>
            <h2 className="text-sm font-bold text-white">User Audit History</h2>
            <p className="text-xs text-slate-400 mt-1">Immutable ledger of administrative actions applied to this user.</p>
          </div>

          {auditHistory.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No audit logs recorded for this account yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {auditHistory.map((item: any) => (
                <div key={item._id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="font-semibold text-white">{item.action}</span>
                    <span className="text-slate-500 ml-2">by {item.actorRole || 'ADMIN'}</span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {new Date(item.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </AdminLayout>
  );
};
