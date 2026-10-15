import React, { useState } from 'react';
import { Sparkles, Send } from 'lucide-react';
import { useApproveAiDraftMutation, useCreateAiDraftMutation, usePublishAiGbpPostDraftMutation } from '../../store/api/locationApi';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

export const AiGbpPostDraftPanel: React.FC<{ workspaceId: string; locationId: string }> = ({ workspaceId, locationId }) => {
  const [createDraft, createState] = useCreateAiDraftMutation();
  const [approveDraft, approveState] = useApproveAiDraftMutation();
  const [publishDraft, publishState] = usePublishAiGbpPostDraftMutation();
  const [draft, setDraft] = useState<any>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const generate = async () => {
    setError(''); setMessage('');
    try { setDraft(await createDraft({ workspaceId, locId: locationId, kind: 'GBP_POST' }).unwrap()); }
    catch (err: any) { setError(err?.data?.error?.message || 'Post draft could not be generated.'); }
  };
  const approve = async () => {
    if (!draft?._id) return;
    setError('');
    try { setDraft(await approveDraft({ workspaceId, draftId: draft._id }).unwrap()); }
    catch (err: any) { setError(err?.data?.error?.message || 'Draft approval failed.'); }
  };
  const publish = async () => {
    if (!draft?._id || draft.status !== 'APPROVED') return;
    setError(''); setMessage('');
    try { const result = await publishDraft({ workspaceId, draftId: draft._id }).unwrap(); setDraft(result.draft); setMessage('Approved post published to Google.'); }
    catch (err: any) { setError(err?.data?.error?.message || 'Approved post could not be published.'); }
  };

  return <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
    <div className="flex items-center justify-between gap-3">
      <div><h2 className="text-sm font-bold text-slate-900">Google Business Profile post</h2><p className="text-xs text-slate-500">Generate a grounded draft. It cannot be published until approved.</p></div>
      <Button size="sm" variant="outline" isLoading={createState.isLoading} leftIcon={<Sparkles className="w-3.5 h-3.5" />} onClick={generate}>Generate draft</Button>
    </div>
    {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}{message && <p role="status" className="text-xs text-emerald-700">{message}</p>}
    {draft && <div className="space-y-3">
      <div className="flex items-center gap-2"><Badge variant="brand" size="sm">AI-GENERATED</Badge><Badge variant={draft.status === 'APPROVED' ? 'success' : draft.status === 'PENDING_APPROVAL' ? 'warning' : 'neutral'} size="sm">{draft.status?.replaceAll('_', ' ')}</Badge></div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 whitespace-pre-wrap">{draft.draftText}</div>
      <div className="grid gap-3 sm:grid-cols-2 text-[11px]">
        <div><p className="font-bold text-slate-700">Evidence used</p>{draft.evidenceUsed?.length ? draft.evidenceUsed.map((fact: any) => <p key={fact.key} className="text-slate-500">{fact.key} · {fact.source} · {new Date(fact.observedAt).toLocaleString()}</p>) : <p className="text-slate-500">None</p>}</div>
        <div><p className="font-bold text-slate-700">Missing or excluded</p>{draft.evidenceMissing?.length ? draft.evidenceMissing.map((item: any, index: number) => <p key={`${item.key}-${index}`} className="text-amber-700">{item.key} · {item.reason.replaceAll('_', ' ')}</p>) : <p className="text-slate-500">None reported</p>}</div>
      </div>
      <div className="flex justify-end gap-2">
        {draft.status === 'PENDING_APPROVAL' && <Button size="sm" variant="primary" isLoading={approveState.isLoading} onClick={approve}>Approve draft</Button>}
        {draft.status === 'APPROVED' && <Button size="sm" variant="primary" isLoading={publishState.isLoading} leftIcon={<Send className="w-3.5 h-3.5" />} onClick={publish}>Publish approved post</Button>}
        {draft.status === 'PUBLICATION_UNCERTAIN' && <span className="text-xs text-amber-700">Check Google before retrying; publication outcome is uncertain.</span>}
      </div>
    </div>}
  </section>;
};
