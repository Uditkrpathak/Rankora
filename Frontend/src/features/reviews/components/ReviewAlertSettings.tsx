import React, { useState } from 'react';
import { Bell, BellOff, Mail, Slack, Plus, Trash2, CheckCircle2, RefreshCw } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import {
  ReviewAlertConfig,
  useGetReviewAlertQuery,
  useUpsertReviewAlertMutation,
  useDeleteReviewAlertMutation,
  useTriggerAlertCheckMutation,
} from '../../../store/api/reviewApi';

interface Props {
  workspaceId: string;
  locationId: string;
}

export const ReviewAlertSettings: React.FC<Props> = ({ workspaceId, locationId }) => {
  const { data, isLoading } = useGetReviewAlertQuery({ workspaceId, locationId }, { skip: !workspaceId || !locationId });
  const [upsert, { isLoading: isSaving }] = useUpsertReviewAlertMutation();
  const [deleteAlert, { isLoading: isDeleting }] = useDeleteReviewAlertMutation();
  const [triggerCheck, { isLoading: isChecking }] = useTriggerAlertCheckMutation();

  const existing: ReviewAlertConfig | null = data?.data ?? null;

  const [threshold, setThreshold] = useState(existing?.ratingThreshold ?? 3);
  const [emails, setEmails] = useState<string[]>(existing?.notifyEmails ?? []);
  const [newEmail, setNewEmail] = useState('');
  const [slack, setSlack] = useState(existing?.slackWebhookUrl ?? '');
  const [enabled, setEnabled] = useState(existing?.enabled ?? true);
  const [saved, setSaved] = useState(false);
  const [checkResult, setCheckResult] = useState<string | null>(null);

  React.useEffect(() => {
    if (existing) {
      setThreshold(existing.ratingThreshold);
      setEmails(existing.notifyEmails ?? []);
      setSlack(existing.slackWebhookUrl ?? '');
      setEnabled(existing.enabled);
    }
  }, [existing]);

  const addEmail = () => {
    const e = newEmail.trim().toLowerCase();
    if (e && !emails.includes(e) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      setEmails([...emails, e]);
      setNewEmail('');
    }
  };

  const removeEmail = (email: string) => setEmails(emails.filter((e) => e !== email));

  const handleSave = async () => {
    await upsert({ workspaceId, locationId, ratingThreshold: threshold, notifyEmails: emails, slackWebhookUrl: slack || undefined, enabled });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleDelete = async () => {
    await deleteAlert({ workspaceId, locationId });
    setEmails([]);
    setSlack('');
    setEnabled(false);
  };

  const handleCheck = async () => {
    const res = await triggerCheck({ workspaceId, locationId }).unwrap();
    const fired = res.data?.newAlertsFired ?? 0;
    setCheckResult(fired > 0 ? `${fired} alert${fired > 1 ? 's' : ''} fired!` : 'No new negative reviews since last check.');
    setTimeout(() => setCheckResult(null), 5000);
  };

  if (isLoading) {
    return <div className="h-32 flex items-center justify-center"><div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-rose-500" />
          <h3 className="text-sm font-bold text-slate-900">Negative Review Alerts</h3>
          {existing?.enabled && <Badge variant="success" size="sm" dot>Active</Badge>}
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-xs font-medium text-slate-600">Enable</span>
          <button
            type="button"
            onClick={() => setEnabled(!enabled)}
            className={`w-9 h-5 rounded-full transition-colors relative ${enabled ? 'bg-brand-500' : 'bg-slate-300'}`}
          >
            <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform absolute top-0.5 ${enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </button>
        </label>
      </div>

      {/* Threshold */}
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1.5">Alert when rating is ≤</label>
        <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200">
          {[1, 2, 3, 4].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setThreshold(n)}
              className={`px-3 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                threshold === n ? 'bg-rose-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {'★'.repeat(n)}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-slate-400 mt-1">
          You'll be notified whenever a new review with {threshold}★ or below appears.
        </p>
      </div>

      {/* Email recipients */}
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1.5">
          <Mail className="w-3.5 h-3.5 inline mr-1 text-brand-500" />
          Notify emails
        </label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {emails.map((email) => (
            <span key={email} className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-semibold px-2 py-1 rounded-full">
              {email}
              <button type="button" onClick={() => removeEmail(email)} className="hover:text-rose-500 transition cursor-pointer">
                <Trash2 className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addEmail())}
            placeholder="team@yourbusiness.com"
            className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-200 bg-white"
          />
          <Button size="sm" variant="outline" onClick={addEmail} leftIcon={<Plus className="w-3.5 h-3.5" />}>
            Add
          </Button>
        </div>
      </div>

      {/* Slack */}
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1.5">
          <Slack className="w-3.5 h-3.5 inline mr-1 text-[#4A154B]" />
          Slack webhook URL <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <input
          value={slack}
          onChange={(e) => setSlack(e.target.value)}
          placeholder="https://hooks.slack.com/services/..."
          className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-200 bg-white font-mono"
        />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button variant="primary" size="sm" onClick={handleSave} isLoading={isSaving} leftIcon={saved ? <CheckCircle2 className="w-3.5 h-3.5" /> : undefined}>
          {saved ? 'Saved!' : 'Save Alert Settings'}
        </Button>

        {existing && (
          <>
            <Button variant="outline" size="sm" onClick={handleCheck} isLoading={isChecking} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
              Run Check Now
            </Button>
            <Button variant="ghost" size="sm" onClick={handleDelete} isLoading={isDeleting} leftIcon={<BellOff className="w-3.5 h-3.5 text-slate-400" />}>
              Delete Alert
            </Button>
          </>
        )}
      </div>

      {checkResult && (
        <p className="text-xs text-brand-600 font-semibold">{checkResult}</p>
      )}

      {existing?.lastCheckedAt && (
        <p className="text-[11px] text-slate-400">
          Last checked: {new Date(existing.lastCheckedAt).toLocaleString('en-IN')}
        </p>
      )}
    </div>
  );
};
