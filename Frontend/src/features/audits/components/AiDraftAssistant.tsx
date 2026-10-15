import React, { useState } from 'react';
import { useApproveAiDraftMutation, useCreateAiDraftMutation, useGenerateAiDescriptionDraftMutation } from '../../../store/api/locationApi';
import { Sparkles, Loader2, AlertCircle, Check, Info } from 'lucide-react';

type DraftKind = 'DESCRIPTION' | 'AUDIT_EXPLANATION' | 'ACTION_DRAFT';
interface AiDraftAssistantProps {
  workspaceId: string;
  locationId: string;
  auditId?: string;
  signalCode?: string;
  kind?: 'DESCRIPTION' | 'AUDIT_EXPLANATION';
  onApplyDraft?: (draftText: string) => void;
}

export const AiDraftAssistant: React.FC<AiDraftAssistantProps> = ({ workspaceId, locationId, auditId, signalCode, kind = 'DESCRIPTION', onApplyDraft }) => {
  const [generateDescription, descriptionState] = useGenerateAiDescriptionDraftMutation();
  const [createDraft, draftState] = useCreateAiDraftMutation();
  const [approveDraft, approvalState] = useApproveAiDraftMutation();
  const [draft, setDraft] = useState<any>(null);
  const [selectedKind, setSelectedKind] = useState<DraftKind>(kind);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const isLoading = descriptionState.isLoading || draftState.isLoading;

  const handleGenerate = async (nextKind = selectedKind) => {
    setError(null);
    setApplied(false);
    setDraft(null);
    setSelectedKind(nextKind);
    try {
      const result = nextKind === 'DESCRIPTION'
        ? await generateDescription({ workspaceId, locId: locationId }).unwrap()
        : await createDraft({ workspaceId, locId: locationId, kind: nextKind, auditId, signalCode }).unwrap();
      setDraft(result);
    } catch (err: any) {
      setError(err?.data?.error?.message || err?.data?.message || err?.error || 'Failed to generate AI draft. Please try again.');
    }
  };

  const handleApprove = async () => {
    if (!draft?.draftId && !draft?._id) return;
    setError(null);
    try {
      const result = await approveDraft({ workspaceId, draftId: draft.draftId || draft._id }).unwrap();
      setDraft((previous: any) => ({ ...previous, ...result, status: result.status || result.data?.status || 'APPROVED' }));
    } catch (err: any) {
      setError(err?.data?.error?.message || 'Draft approval failed.');
    }
  };

  const handleApply = async () => {
    if (!draft?.draftText || draft.status !== 'APPROVED') return;
    if (onApplyDraft) onApplyDraft(draft.draftText);
    else if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(draft.draftText);
    setApplied(true);
    setTimeout(() => setApplied(false), 2000);
  };

  const evidenceUsed = draft?.evidenceUsed || [];
  const evidenceMissing = draft?.evidenceMissing || [];

  return (
    <div className="rounded-xl border border-brand-100 bg-gradient-to-br from-brand-50/70 to-purple-50/50 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2 text-brand-950 font-bold text-xs"><Sparkles className="w-4 h-4 text-brand-600" /><span>AI Evidence Draft Assistant</span></div>
        {kind === 'AUDIT_EXPLANATION' ? (
          <div className="flex gap-2">
            <button type="button" onClick={() => handleGenerate('AUDIT_EXPLANATION')} disabled={isLoading || !auditId || !signalCode} className="px-3 py-1.5 rounded-lg bg-brand-600 text-white font-bold text-xs disabled:opacity-50">Explain finding</button>
            <button type="button" onClick={() => handleGenerate('ACTION_DRAFT')} disabled={isLoading || !auditId || !signalCode} className="px-3 py-1.5 rounded-lg border border-brand-200 bg-white text-brand-700 font-bold text-xs disabled:opacity-50">Draft action</button>
          </div>
        ) : (
          <button type="button" onClick={() => handleGenerate('DESCRIPTION')} disabled={isLoading} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs disabled:opacity-50">
            {isLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Drafting…</> : <><Sparkles className="w-3.5 h-3.5" />{draft ? 'Regenerate Draft' : 'Generate Draft'}</>}
          </button>
        )}
      </div>

      <div className="flex items-start gap-1.5 text-[11px] text-slate-600"><Info className="w-3.5 h-3.5 text-brand-500 shrink-0 mt-0.5" /><p>Drafts are AI-generated, include evidence provenance and missing-data reasons, and require explicit approval before use or any Google write.</p></div>
      {error && <div role="alert" className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" /><span>{error}</span></div>}

      {draft && <div className="space-y-2.5 pt-2 border-t border-brand-100/70">
        <div className="flex items-center gap-2"><span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px] font-bold">AI-GENERATED</span><span className="text-[10px] text-slate-600">{draft.status || 'PENDING_APPROVAL'} · {draft.provider || draft.model}</span></div>
        <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">{draft.draftText}</div>
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-[10px] space-y-1">
          <p className="font-bold text-slate-700">Evidence used</p>
          {evidenceUsed.length ? evidenceUsed.map((fact: any) => <p key={fact.key} className="text-slate-600">{fact.key} · {fact.source} · {fact.observedAt ? new Date(fact.observedAt).toLocaleString() : 'timestamp unavailable'}{fact.untrusted ? ' · untrusted user content' : ''}</p>) : <p className="text-slate-500">No eligible evidence used.</p>}
          <p className="font-bold text-slate-700 pt-1">Missing or excluded</p>
          {evidenceMissing.length ? evidenceMissing.map((item: any, index: number) => <p key={`${item.key}-${index}`} className="text-amber-700">{item.key} · {item.reason.replaceAll('_', ' ')}</p>) : <p className="text-slate-500">None reported.</p>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-mono text-slate-500">{draft.draftText.length} characters</span>
          <div className="flex gap-2">
            {draft.status === 'PENDING_APPROVAL' && <button type="button" onClick={handleApprove} disabled={approvalState.isLoading} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold disabled:opacity-50">{approvalState.isLoading ? 'Approving…' : 'Approve draft'}</button>}
            {draft.status === 'APPROVED' && <button type="button" onClick={handleApply} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold ${applied ? 'bg-emerald-600 text-white' : 'bg-brand-50 border border-brand-200 text-brand-700'}`}>{applied ? <><Check className="w-3.5 h-3.5" />Applied</> : onApplyDraft ? 'Use approved draft in editor' : 'Copy approved draft'}</button>}
          </div>
        </div>
      </div>}
    </div>
  );
};
