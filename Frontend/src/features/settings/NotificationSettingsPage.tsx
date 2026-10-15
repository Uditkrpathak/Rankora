import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { SettingsLayout } from './SettingsLayout';
import {
  useGetPreferencesQuery,
  useUpdatePreferencesMutation,
  useSendTestNotificationMutation,
  NotificationType,
} from '../../store/api/notificationApi';
import {
  Bell,
  Mail,
  ShieldAlert,
  Star,
  TrendingDown,
  Users,
  Check,
  Plus,
  Trash2,
  Send,
  Sparkles,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

export const NotificationSettingsPage: React.FC = () => {
  const { activeWorkspace } = useSelector((state: RootState) => state.auth);
  const workspaceId = activeWorkspace?.id || '';

  const { data: prefData, isLoading } = useGetPreferencesQuery(workspaceId, { skip: !workspaceId });
  const [updatePreferences, { isLoading: isSaving }] = useUpdatePreferencesMutation();
  const [sendTestNotification, { isLoading: isTesting }] = useSendTestNotificationMutation();

  const [emailAlertsEnabled, setEmailAlertsEnabled] = useState(true);
  const [inAppAlertsEnabled, setInAppAlertsEnabled] = useState(true);
  const [notifyEmails, setNotifyEmails] = useState<string[]>([]);
  const [newEmailInput, setNewEmailInput] = useState('');
  const [emailError, setEmailError] = useState('');

  // Categories
  const [negativeReviews, setNegativeReviews] = useState({
    enabled: true,
    email: true,
    inApp: true,
    ratingThreshold: 3,
  });

  const [listingProtection, setListingProtection] = useState({
    enabled: true,
    email: true,
    inApp: true,
  });

  const [rankDrops, setRankDrops] = useState({
    enabled: true,
    email: true,
    inApp: true,
    minDropPositions: 3,
  });

  const [workspaceActivity, setWorkspaceActivity] = useState({
    enabled: true,
    email: true,
    inApp: true,
  });

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  // Sync state from query
  useEffect(() => {
    if (prefData?.data) {
      const p = prefData.data;
      setEmailAlertsEnabled(p.emailAlertsEnabled ?? true);
      setInAppAlertsEnabled(p.inAppAlertsEnabled ?? true);
      setNotifyEmails(p.notifyEmails || []);
      if (p.categories?.negativeReviews) {
        setNegativeReviews({
          enabled: p.categories.negativeReviews.enabled ?? true,
          email: p.categories.negativeReviews.email ?? true,
          inApp: p.categories.negativeReviews.inApp ?? true,
          ratingThreshold: p.categories.negativeReviews.ratingThreshold ?? 3,
        });
      }
      if (p.categories?.listingProtection) {
        setListingProtection({
          enabled: p.categories.listingProtection.enabled ?? true,
          email: p.categories.listingProtection.email ?? true,
          inApp: p.categories.listingProtection.inApp ?? true,
        });
      }
      if (p.categories?.rankDrops) {
        setRankDrops({
          enabled: p.categories.rankDrops.enabled ?? true,
          email: p.categories.rankDrops.email ?? true,
          inApp: p.categories.rankDrops.inApp ?? true,
          minDropPositions: p.categories.rankDrops.minDropPositions ?? 3,
        });
      }
      if (p.categories?.workspace) {
        setWorkspaceActivity({
          enabled: p.categories.workspace.enabled ?? true,
          email: p.categories.workspace.email ?? true,
          inApp: p.categories.workspace.inApp ?? true,
        });
      }
    }
  }, [prefData]);

  const handleAddEmail = (e: React.FormEvent) => {
    e.preventDefault();
    const email = newEmailInput.trim().toLowerCase();
    setEmailError('');
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Please enter a valid email address.');
      return;
    }
    if (notifyEmails.includes(email)) {
      setEmailError('This email is already in your notification list.');
      return;
    }
    setNotifyEmails([...notifyEmails, email]);
    setNewEmailInput('');
  };

  const handleRemoveEmail = (emailToRemove: string) => {
    setNotifyEmails(notifyEmails.filter((e) => e !== emailToRemove));
  };

  const handleSave = async () => {
    if (!workspaceId) return;
    try {
      await updatePreferences({
        workspaceId,
        updates: {
          emailAlertsEnabled,
          inAppAlertsEnabled,
          notifyEmails,
          categories: {
            negativeReviews,
            listingProtection,
            rankDrops,
            workspace: workspaceActivity,
          },
        },
      }).unwrap();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error('Failed to update preferences:', err);
    }
  };

  const handleSendTest = async (type: NotificationType) => {
    if (!workspaceId) return;
    setTestResult(null);
    try {
      await sendTestNotification({ workspaceId, type }).unwrap();
      setTestResult(`Test ${type} alert sent! Check your notification bell and recipient emails.`);
      setTimeout(() => setTestResult(null), 5000);
    } catch (err: any) {
      setTestResult('Failed to trigger test alert. Please verify backend connectivity.');
    }
  };

  return (
    <SettingsLayout>
      <div className="flex-1 max-w-4xl">
        {/* Title */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Alerts & Notification Preferences</h1>
            <p className="text-xs text-slate-500 mt-1">
              Configure real-time in-app alerts and Resend email dispatches for reviews, Google Maps sabotage, and rank drops.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-brand-600 hover:bg-brand-700 text-white transition shadow-sm flex items-center gap-1.5 self-start sm:self-auto disabled:opacity-50"
          >
            {isSaving ? (
              <span>Saving changes...</span>
            ) : saveSuccess ? (
              <>
                <Check size={14} />
                <span>Saved successfully!</span>
              </>
            ) : (
              <span>Save preferences</span>
            )}
          </button>
        </div>

        {/* Global Delivery Channels */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 mb-6 shadow-2xs">
          <h2 className="text-sm font-bold text-slate-900 mb-1">Master Notification Channels</h2>
          <p className="text-xs text-slate-500 mb-4">
            Master switches to enable or disable notification dispatch channels across this workspace.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Email Alerts Toggle */}
            <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200/80 hover:border-slate-300 transition cursor-pointer bg-slate-50/50">
              <input
                type="checkbox"
                checked={emailAlertsEnabled}
                onChange={(e) => setEmailAlertsEnabled(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500"
              />
              <div className="flex-1 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <Mail size={14} className="text-brand-600" />
                  <span>Email Alerts (Resend)</span>
                </div>
                <p className="text-slate-500 mt-0.5">
                  Sends formatted HTML alert emails immediately when critical events occur.
                </p>
              </div>
            </label>

            {/* In-App Notifications Toggle */}
            <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200/80 hover:border-slate-300 transition cursor-pointer bg-slate-50/50">
              <input
                type="checkbox"
                checked={inAppAlertsEnabled}
                onChange={(e) => setInAppAlertsEnabled(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500"
              />
              <div className="flex-1 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <Bell size={14} className="text-brand-600" />
                  <span>In-App Notification Center</span>
                </div>
                <p className="text-slate-500 mt-0.5">
                  Displays bell badges, real-time unread counter, and notification list.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Email Recipients */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 mb-6 shadow-2xs">
          <h2 className="text-sm font-bold text-slate-900 mb-1">Email Alert Recipients</h2>
          <p className="text-xs text-slate-500 mb-4">
            Specify which team members or clients should receive email alerts. Defaults to the workspace owner if empty.
          </p>

          {/* Form to add email */}
          <form onSubmit={handleAddEmail} className="flex gap-2 max-w-md mb-4">
            <input
              type="email"
              placeholder="e.g. alerts@company.com"
              value={newEmailInput}
              onChange={(e) => setNewEmailInput(e.target.value)}
              className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
            />
            <button
              type="submit"
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition shadow-2xs flex items-center gap-1"
            >
              <Plus size={14} />
              <span>Add</span>
            </button>
          </form>
          {emailError && <p className="text-xs text-red-600 mb-3">{emailError}</p>}

          {/* List of active recipients */}
          <div className="space-y-2 max-w-lg">
            {notifyEmails.length === 0 ? (
              <p className="text-xs text-slate-400 italic">
                No custom recipients added yet — workspace owners/admins receive alerts by default.
              </p>
            ) : (
              notifyEmails.map((email) => (
                <div
                  key={email}
                  className="flex items-center justify-between p-2.5 px-3 rounded-lg border border-slate-200 bg-slate-50/50 text-xs"
                >
                  <span className="font-medium text-slate-700">{email}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveEmail(email)}
                    className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-white transition"
                    title="Remove recipient"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Categories Section */}
        <div className="space-y-4 mb-6">
          <h2 className="text-sm font-bold text-slate-900 px-1">Alert Trigger Rules & Thresholds</h2>

          {/* Negative Reviews Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center border border-red-100">
                  <Star size={16} className="fill-red-500" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Negative Google Reviews</h3>
                  <p className="text-xs text-slate-500">
                    Triggers when a customer leaves a low rating so you can resolve issues quickly.
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={negativeReviews.enabled}
                onChange={(e) => setNegativeReviews({ ...negativeReviews, enabled: e.target.checked })}
                className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500"
              />
            </div>

            {negativeReviews.enabled && (
              <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Rating Threshold (Trigger at or below):
                  </label>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setNegativeReviews({ ...negativeReviews, ratingThreshold: val })}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg border transition ${
                          negativeReviews.ratingThreshold === val
                            ? 'bg-red-600 border-red-600 text-white shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {val === 3 ? '≤ 3 Stars (Recommended)' : `≤ ${val} Star${val > 1 ? 's' : ''}`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-600">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={negativeReviews.email}
                      onChange={(e) => setNegativeReviews({ ...negativeReviews, email: e.target.checked })}
                      className="rounded text-brand-600"
                    />
                    <span>Email</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={negativeReviews.inApp}
                      onChange={(e) => setNegativeReviews({ ...negativeReviews, inApp: e.target.checked })}
                      className="rounded text-brand-600"
                    />
                    <span>In-App</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* 24/7 Listing Protection Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
                  <ShieldAlert size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">24/7 Listing Protection & Hijack Defense</h3>
                  <p className="text-xs text-slate-500">
                    Watchdog surveillance for unverified edits to phone numbers, addresses, names, or closed status on Google Maps.
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={listingProtection.enabled}
                onChange={(e) => setListingProtection({ ...listingProtection, enabled: e.target.checked })}
                className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500"
              />
            </div>

            {listingProtection.enabled && (
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                <span className="text-slate-500">Always flags CRITICAL on phone/address tamper</span>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={listingProtection.email}
                      onChange={(e) => setListingProtection({ ...listingProtection, email: e.target.checked })}
                      className="rounded text-brand-600"
                    />
                    <span>Email</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={listingProtection.inApp}
                      onChange={(e) => setListingProtection({ ...listingProtection, inApp: e.target.checked })}
                      className="rounded text-brand-600"
                    />
                    <span>In-App</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Keyword Rank Drop Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                  <TrendingDown size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Keyword Rank Drop Volatility</h3>
                  <p className="text-xs text-slate-500">
                    Alerts when tracked local keywords drop positions or a competitor takes your local pack spot.
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={rankDrops.enabled}
                onChange={(e) => setRankDrops({ ...rankDrops, enabled: e.target.checked })}
                className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500"
              />
            </div>

            {rankDrops.enabled && (
              <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Minimum Drop Threshold:
                  </label>
                  <div className="flex items-center gap-1.5">
                    {[2, 3, 5, 10].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setRankDrops({ ...rankDrops, minDropPositions: val })}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg border transition ${
                          rankDrops.minDropPositions === val
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        ≥ {val} spots
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-600">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rankDrops.email}
                      onChange={(e) => setRankDrops({ ...rankDrops, email: e.target.checked })}
                      className="rounded text-brand-600"
                    />
                    <span>Email</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rankDrops.inApp}
                      onChange={(e) => setRankDrops({ ...rankDrops, inApp: e.target.checked })}
                      className="rounded text-brand-600"
                    />
                    <span>In-App</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Workspace Activity Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center border border-slate-200">
                  <Users size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Workspace & Team Events</h3>
                  <p className="text-xs text-slate-500">
                    Notifies on team member invites, credit status warnings, and completed SEO audits.
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={workspaceActivity.enabled}
                onChange={(e) => setWorkspaceActivity({ ...workspaceActivity, enabled: e.target.checked })}
                className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500"
              />
            </div>

            {workspaceActivity.enabled && (
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-end gap-4 text-xs text-slate-600">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={workspaceActivity.email}
                    onChange={(e) => setWorkspaceActivity({ ...workspaceActivity, email: e.target.checked })}
                    className="rounded text-brand-600"
                  />
                  <span>Email</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={workspaceActivity.inApp}
                    onChange={(e) => setWorkspaceActivity({ ...workspaceActivity, inApp: e.target.checked })}
                    className="rounded text-brand-600"
                  />
                  <span>In-App</span>
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Live Test Tool */}
        <div className="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-2xl p-5 sm:p-6 text-white shadow-md">
          <div className="flex items-center gap-2 text-brand-300 font-semibold text-xs uppercase tracking-wider mb-1">
            <Sparkles size={14} />
            <span>Real-Time Alert Verification</span>
          </div>
          <h3 className="text-base font-bold text-white mb-1">Send a Live Test Alert</h3>
          <p className="text-xs text-slate-300 mb-4 max-w-xl">
            Simulate an alert to immediately verify that the notification bell popover and Resend email templates are working correctly.
          </p>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={isTesting}
              onClick={() => handleSendTest('NEGATIVE_REVIEW')}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/15 transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <Send size={12} />
              <span>Test Negative Review Alert</span>
            </button>
            <button
              type="button"
              disabled={isTesting}
              onClick={() => handleSendTest('LISTING_PROTECTION')}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/15 transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <Send size={12} />
              <span>Test Protection Hijack Alert</span>
            </button>
            <button
              type="button"
              disabled={isTesting}
              onClick={() => handleSendTest('RANK_DROP')}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/15 transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <Send size={12} />
              <span>Test Rank Drop Alert</span>
            </button>
          </div>

          {testResult && (
            <div className="mt-4 p-3 rounded-lg bg-white/10 border border-white/20 text-xs text-brand-200 flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 size={15} className="text-emerald-400" />
              <span>{testResult}</span>
            </div>
          )}
        </div>
      </div>
    </SettingsLayout>
  );
};
