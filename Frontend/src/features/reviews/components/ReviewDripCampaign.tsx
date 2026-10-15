import React, { useState } from 'react';
import { Mail, Users, Plus, CheckCircle2, XCircle, RefreshCw, Trash2, Star, Send, TestTube } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import {
  useGetReviewDripQuery,
  useUpsertReviewDripMutation,
  useAddDripContactsMutation,
  useSendTestDripEmailMutation,
  useMarkContactReviewedMutation,
  useOptOutContactMutation,
  DripContact,
} from '../../../store/api/reviewApi';

interface Props {
  workspaceId: string;
  locationId: string;
}

function ContactRow({
  contact,
  workspaceId,
  locationId,
}: {
  contact: DripContact;
  workspaceId: string;
  locationId: string;
}) {
  const [markReviewed] = useMarkContactReviewedMutation();
  const [optOut] = useOptOutContactMutation();

  const isOptedOut = Boolean(contact.optedOutAt);
  const hasReviewed = Boolean(contact.reviewedAt);

  return (
    <tr className={`text-xs ${isOptedOut ? 'opacity-40' : hasReviewed ? 'opacity-60' : ''}`}>
      <td className="py-2.5 px-3 font-semibold text-slate-800">{contact.name}</td>
      <td className="py-2.5 px-3 text-slate-500">{contact.email || contact.phone || '–'}</td>
      <td className="py-2.5 px-3">
        {contact.step2SentAt ? (
          <Badge variant="brand" size="sm">2 sent</Badge>
        ) : contact.step1SentAt ? (
          <Badge variant="neutral" size="sm">1 sent</Badge>
        ) : (
          <Badge variant="neutral" size="sm">Queued</Badge>
        )}
      </td>
      <td className="py-2.5 px-3">
        {hasReviewed ? (
          <Badge variant="success" size="sm" dot>Reviewed</Badge>
        ) : isOptedOut ? (
          <Badge variant="neutral" size="sm">Opted out</Badge>
        ) : (
          <span className="text-slate-400">–</span>
        )}
      </td>
      <td className="py-2.5 px-3 text-right">
        {!isOptedOut && !hasReviewed && (
          <div className="flex gap-1 justify-end">
            <button
              type="button"
              title="Mark as reviewed"
              onClick={() => markReviewed({ workspaceId, locationId, contactId: contact._id })}
              className="p-1 rounded hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              title="Opt out contact"
              onClick={() => optOut({ workspaceId, locationId, contactId: contact._id })}
              className="p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition cursor-pointer"
            >
              <XCircle className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

export const ReviewDripCampaign: React.FC<Props> = ({ workspaceId, locationId }) => {
  const { data, isLoading, refetch } = useGetReviewDripQuery({ workspaceId, locationId }, { skip: !workspaceId || !locationId });
  const [upsert, { isLoading: isSaving }] = useUpsertReviewDripMutation();
  const [addContacts, { isLoading: isAddingContacts }] = useAddDripContactsMutation();
  const [sendTest, { isLoading: isSendingTest }] = useSendTestDripEmailMutation();

  const campaign = data?.data;

  // Campaign config state
  const [campaignName, setCampaignName] = useState(campaign?.campaignName ?? 'Review Request Campaign');
  const [enabled, setEnabled] = useState(campaign?.enabled ?? true);
  const [step1Delay, setStep1Delay] = useState(campaign?.step1DelayHours ?? 0);
  const [step2Delay, setStep2Delay] = useState(campaign?.step2DelayHours ?? 72);

  // Add contacts state
  const [contactsText, setContactsText] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [testName, setTestName] = useState('');

  const [saveMsg, setSaveMsg] = useState('');

  React.useEffect(() => {
    if (campaign) {
      setCampaignName(campaign.campaignName);
      setEnabled(campaign.enabled);
      setStep1Delay(campaign.step1DelayHours);
      setStep2Delay(campaign.step2DelayHours);
    }
  }, [campaign]);

  const handleSaveCampaign = async () => {
    await upsert({
      workspaceId,
      locationId,
      campaignName,
      enabled,
      step1DelayHours: step1Delay,
      step2DelayHours: step2Delay,
    });
    setSaveMsg('Campaign settings saved!');
    setTimeout(() => setSaveMsg(''), 3000);
  };

  const handleAddContacts = async () => {
    // Parse: "Name, email@x.com" or "Name | +91xxxx" per line
    const lines = contactsText.split('\n').map((l) => l.trim()).filter(Boolean);
    const contacts = lines.map((line) => {
      const parts = line.split(/[,|]/).map((p) => p.trim());
      const name = parts[0] || 'Customer';
      const second = parts[1] || '';
      const isEmail = second.includes('@');
      const isPhone = /^\+?[\d\s-]{8,}$/.test(second);
      return {
        name,
        email: isEmail ? second : undefined,
        phone: isPhone ? second : undefined,
      };
    });

    if (!campaign) {
      await upsert({ workspaceId, locationId, campaignName, enabled });
    }

    await addContacts({ workspaceId, locationId, contacts });
    setContactsText('');
    setSaveMsg(`Added ${contacts.length} contact${contacts.length > 1 ? 's' : ''}.`);
    setTimeout(() => setSaveMsg(''), 3000);
    refetch();
  };

  const handleSendTest = async () => {
    if (!testEmail || !testName) return;
    const res = await sendTest({ workspaceId, locationId, email: testEmail, name: testName }).unwrap();
    setSaveMsg(res.data?.sent ? 'Test email sent!' : 'Test email failed — check RESEND_API_KEY.');
    setTimeout(() => setSaveMsg(''), 5000);
  };

  const contacts: DripContact[] = campaign?.contacts || [];
  const activeContacts = contacts.filter((c) => !c.optedOutAt && !c.reviewedAt);
  const sentCount = campaign?.totalSent ?? 0;
  const convertedCount = contacts.filter((c) => c.reviewedAt).length;

  if (isLoading) {
    return (
      <div className="h-32 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'In Drip', value: activeContacts.length, color: 'text-brand-600' },
          { label: 'Emails Sent', value: sentCount, color: 'text-indigo-600' },
          { label: 'Converted', value: convertedCount, color: 'text-emerald-600' },
        ].map((stat) => (
          <div key={stat.label} className="bg-slate-50 rounded-xl border border-slate-200 p-3 text-center">
            <div className={`text-xl font-black ${stat.color}`}>{stat.value}</div>
            <div className="text-[10px] text-slate-500 font-semibold mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Campaign settings */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-brand-500" />
            <h4 className="text-sm font-bold text-slate-900">Campaign Settings</h4>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-xs font-medium text-slate-600">Active</span>
            <button
              type="button"
              onClick={() => setEnabled(!enabled)}
              className={`w-9 h-5 rounded-full transition-colors relative ${enabled ? 'bg-brand-500' : 'bg-slate-300'}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform absolute top-0.5 ${enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Campaign Name</label>
            <input
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-brand-400 bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Step 1 Delay (hours)</label>
            <input
              type="number"
              min={0}
              max={720}
              value={step1Delay}
              onChange={(e) => setStep1Delay(Number(e.target.value))}
              className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-brand-400 bg-white"
            />
            <p className="text-[10px] text-slate-400 mt-0.5">0 = send immediately</p>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Step 2 Delay (hours after Step 1)</label>
            <input
              type="number"
              min={1}
              max={720}
              value={step2Delay}
              onChange={(e) => setStep2Delay(Number(e.target.value))}
              className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-brand-400 bg-white"
            />
            <p className="text-[10px] text-slate-400 mt-0.5">Default 72h (3 days)</p>
          </div>
        </div>

        <Button size="sm" variant="primary" onClick={handleSaveCampaign} isLoading={isSaving}>
          Save Campaign
        </Button>
      </div>

      {/* Add contacts */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-500" />
          <h4 className="text-sm font-bold text-slate-900">Add Contacts</h4>
        </div>
        <p className="text-[11px] text-slate-500">
          One contact per line. Format: <code className="bg-slate-100 px-1 rounded">Name, email@domain.com</code> or <code className="bg-slate-100 px-1 rounded">Name | +919876543210</code>
        </p>
        <textarea
          value={contactsText}
          onChange={(e) => setContactsText(e.target.value)}
          rows={4}
          placeholder={"Rahul Sharma, rahul@example.com\nPriya Gupta | +919876543210\nSunita Verma, sunita@gmail.com"}
          className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2.5 outline-none focus:border-brand-400 bg-slate-50 font-mono resize-none"
        />
        <Button size="sm" variant="outline" onClick={handleAddContacts} isLoading={isAddingContacts} leftIcon={<Plus className="w-3.5 h-3.5" />}>
          Add to Drip
        </Button>
      </div>

      {/* Test email */}
      <div className="bg-amber-50/60 rounded-xl border border-amber-200/80 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <TestTube className="w-4 h-4 text-amber-600" />
          <h4 className="text-sm font-bold text-slate-900">Send Test Email</h4>
        </div>
        <div className="flex gap-2">
          <input
            value={testName}
            onChange={(e) => setTestName(e.target.value)}
            placeholder="Your Name"
            className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-brand-400 bg-white"
          />
          <input
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="your@email.com"
            className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-brand-400 bg-white"
          />
          <Button size="sm" variant="outline" onClick={handleSendTest} isLoading={isSendingTest} leftIcon={<Send className="w-3.5 h-3.5" />}>
            Send
          </Button>
        </div>
      </div>

      {saveMsg && (
        <p className="text-xs text-brand-600 font-semibold flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" />
          {saveMsg}
        </p>
      )}

      {/* Contacts table */}
      {contacts.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800">Enrolled Contacts ({contacts.length})</span>
            <button type="button" onClick={() => refetch()} className="text-slate-400 hover:text-brand-600 transition cursor-pointer">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50/80 text-slate-500 text-[10px] font-semibold border-b border-slate-100">
                <tr>
                  <th className="py-2 px-3">Name</th>
                  <th className="py-2 px-3">Contact</th>
                  <th className="py-2 px-3">Email Status</th>
                  <th className="py-2 px-3">Review Status</th>
                  <th className="py-2 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contacts.slice(0, 50).map((c) => (
                  <ContactRow key={c._id} contact={c} workspaceId={workspaceId} locationId={locationId} />
                ))}
              </tbody>
            </table>
            {contacts.length > 50 && (
              <p className="text-center text-[11px] text-slate-400 py-2">Showing 50 of {contacts.length} contacts</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
