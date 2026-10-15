import React, { useState, useEffect } from 'react';
import { IAuditTask } from '@localo/types';
import { Location, useUpdateLocationMutation } from '../../../store/api/locationApi';
import { useRecalculateAuditMutation } from '../../../store/api/auditApi';
import { AiDraftAssistant } from './AiDraftAssistant';
import { X, Check, Save, Loader2, Clock, AlignLeft, Tags, Globe, AlertCircle, Copy, Code } from 'lucide-react';

interface RemediationModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: IAuditTask | null;
  location: Location | undefined;
  workspaceId: string;
  auditId?: string;
  onSuccess?: () => void;
}

const DAYS_OF_WEEK = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export const RemediationModal: React.FC<RemediationModalProps> = ({
  isOpen,
  onClose,
  task,
  location,
  workspaceId,
  auditId,
  onSuccess,
}) => {
  if (!isOpen || !task || !location) return null;

  const [updateLocation, { isLoading: isSaving }] = useUpdateLocationMutation();
  const [recalculateAudit, { isLoading: isRecalculating }] = useRecalculateAuditMutation();

  // Form states
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [categoryDraft, setCategoryDraft] = useState('');
  const [secondaryCategories, setSecondaryCategories] = useState<string[]>([]);
  const [hours, setHours] = useState<Record<string, { isClosed: boolean; open?: string; close?: string }>>({});
  const [error, setError] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [copiedSchema, setCopiedSchema] = useState(false);

  useEffect(() => {
    if (location) {
      setDescription((location as any).description || '');
      setWebsite(location.website || '');
      const existingSec = (location as any).secondaryCategories?.map((c: any) => c.displayName || c) || [];
      setSecondaryCategories(existingSec);
      
      const existingHours = (location as any).regularHours || {};
      const initialHours: Record<string, any> = {};
      for (const day of DAYS_OF_WEEK) {
        initialHours[day] = existingHours[day] || { isClosed: day === 'sunday', open: '09:00', close: '20:00' };
      }
      setHours(initialHours);
    }
  }, [location, task]);

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryDraft.trim()) return;
    if (secondaryCategories.length >= 5) {
      setError('Maximum 5 secondary categories allowed.');
      return;
    }
    if (!secondaryCategories.includes(categoryDraft.trim())) {
      setSecondaryCategories([...secondaryCategories, categoryDraft.trim()]);
    }
    setCategoryDraft('');
  };

  const handleRemoveCategory = (cat: string) => {
    setSecondaryCategories(secondaryCategories.filter((c) => c !== cat));
  };

  const handleSaveAndVerify = async () => {
    setError(null);
    try {
      const patchBody: any = {};

      if (task.signalCode === 'DES-01') {
        if (description.trim().length < 250) {
          setError('Description must be at least 250 characters for optimal Local SEO.');
          return;
        }
        patchBody.description = description.trim();
      } else if (task.signalCode === 'HRS-01') {
        patchBody.regularHours = hours;
      } else if (task.signalCode === 'CAT-02') {
        patchBody.secondaryCategories = secondaryCategories.map((name) => ({ displayName: name }));
      } else if (task.signalCode === 'WEB-04') {
        if (!website.trim().startsWith('http://') && !website.trim().startsWith('https://')) {
          setError('Website URL must start with http:// or https://');
          return;
        }
        patchBody.website = website.trim();
      } else {
        // Generic fallback
        if (description) patchBody.description = description.trim();
      }

      // 1. Save to Location model & GBP sync
      await updateLocation({
        workspaceId,
        locId: location._id,
        body: patchBody,
      }).unwrap();

      // 2. Trigger instant recalculation if auditId exists
      if (auditId) {
        await recalculateAudit({
          workspaceId,
          locationId: location._id,
          auditId,
        }).unwrap();
      }

      setSavedSuccess(true);
      if (onSuccess) onSuccess();
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 1200);
    } catch (err: any) {
      const data = err?.data;
      const message = data?.error?.message || data?.message || err?.error || 'Failed to save changes. Please try again.';
      setError(message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-50 border border-brand-100 text-brand-600 flex items-center justify-center font-bold text-xs">
              {task.signalCode}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-slate-900 leading-tight">Remediate: {task.title}</h3>
                {(location as any).googleConnectionId ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700">
                    GBP Live Write-Through
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 border border-slate-200 text-slate-600">
                    Local Profile Draft
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{location.name} · {location.city || 'Local Business'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <AiDraftAssistant
            workspaceId={workspaceId}
            locationId={location._id}
            auditId={auditId}
            signalCode={task.signalCode}
            kind="AUDIT_EXPLANATION"
          />

          {/* DES-01: Description Editor with AI Assistant */}
          {task.signalCode === 'DES-01' && (
            <div className="space-y-4">
              <AiDraftAssistant
                workspaceId={workspaceId}
                locationId={location._id}
                kind="DESCRIPTION"
                onApplyDraft={(draft) => setDescription(draft)}
              />

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <label htmlFor="rem-description">Business Description Editor</label>
                  <span className={`font-mono text-[11px] ${
                    description.length >= 250 && description.length <= 500
                      ? 'text-emerald-600 font-bold'
                      : description.length > 500
                      ? 'text-rose-600 font-bold'
                      : 'text-amber-600'
                  }`}>
                    {description.length} / 500 chars (Min: 250)
                  </span>
                </div>
                <textarea
                  id="rem-description"
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your business services, specialties, history, and community dedication..."
                  className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-brand-500 outline-none leading-relaxed"
                />
              </div>
            </div>
          )}

          {/* HRS-01: Operating Hours Editor */}
          {task.signalCode === 'HRS-01' && (
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-700">
                <Clock className="w-4 h-4 text-brand-600" />
                <span>Configure Weekly Operating Schedule</span>
              </div>
              <p className="text-xs text-slate-500">
                Specify opening and closing hours for each day of the week so local customers know when you are open.
              </p>

              <div className="space-y-2 pt-2">
                {DAYS_OF_WEEK.map((day) => {
                  const dayData = hours[day] || { isClosed: false, open: '09:00', close: '20:00' };
                  return (
                    <div key={day} className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs">
                      <span className="font-bold text-slate-800 capitalize w-24">{day}</span>
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!dayData.isClosed}
                          onChange={(e) => {
                            setHours({
                              ...hours,
                              [day]: { ...dayData, isClosed: !e.target.checked },
                            });
                          }}
                          className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        />
                        <span className="text-slate-600 font-medium">Open</span>
                      </label>

                      {!dayData.isClosed ? (
                        <div className="flex items-center space-x-2">
                          <input
                            type="time"
                            value={dayData.open || '09:00'}
                            onChange={(e) => {
                              setHours({
                                ...hours,
                                [day]: { ...dayData, open: e.target.value },
                              });
                            }}
                            className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs outline-none"
                          />
                          <span className="text-slate-400">to</span>
                          <input
                            type="time"
                            value={dayData.close || '20:00'}
                            onChange={(e) => {
                              setHours({
                                ...hours,
                                [day]: { ...dayData, close: e.target.value },
                              });
                            }}
                            className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs outline-none"
                          />
                        </div>
                      ) : (
                        <span className="text-slate-400 font-semibold px-6">Closed</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* CAT-02: Secondary Categories */}
          {task.signalCode === 'CAT-02' && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-700">
                <Tags className="w-4 h-4 text-brand-600" />
                <span>Secondary Google Business Categories (2–5 recommended)</span>
              </div>
              <p className="text-xs text-slate-500">
                Add secondary categories to expand your Google Maps discovery footprint.
              </p>

              <form onSubmit={handleAddCategory} className="flex gap-2">
                <input
                  type="text"
                  value={categoryDraft}
                  onChange={(e) => setCategoryDraft(e.target.value)}
                  placeholder="e.g. Indian sweets shop, Snack bar, Confectionery"
                  className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button
                  type="submit"
                  disabled={!categoryDraft.trim()}
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-2xs transition disabled:opacity-50 cursor-pointer"
                >
                  Add
                </button>
              </form>

              <div className="flex flex-wrap gap-2 pt-2">
                {secondaryCategories.map((cat) => (
                  <span
                    key={cat}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-50 border border-brand-200 text-brand-800 text-xs font-semibold"
                  >
                    <span>{cat}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveCategory(cat)}
                      className="hover:text-rose-600 transition cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
                {secondaryCategories.length === 0 && (
                  <p className="text-xs text-slate-400 italic">No secondary categories added yet.</p>
                )}
              </div>
            </div>
          )}

          {/* WEB-04: Website URL & Schema */}
          {task.signalCode === 'WEB-04' && (
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-700">
                <Globe className="w-4 h-4 text-brand-600" />
                <span>Website Landing Page & Schema URL</span>
              </div>
              <p className="text-xs text-slate-500">
                Provide your official landing page. Localo will automatically crawl it to verify LocalBusiness structured schema markup.
              </p>
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://example.com"
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-brand-500"
              />

              {/* On-Site Schema Generator Card */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-900 text-slate-100 space-y-3 shadow-inner mt-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-xs font-bold text-emerald-400">
                    <Code className="w-4 h-4" />
                    <span>On-Site LocalBusiness JSON-LD Schema Markup</span>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const schemaSnippet = `<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "LocalBusiness",\n  "name": "${location.name}",\n  "telephone": "${location.phone || '+91 11 0000 0000'}",\n  "url": "${website || 'https://example.com'}",\n  "address": {\n    "@type": "PostalAddress",\n    "streetAddress": "${location.address || ''}",\n    "addressLocality": "${location.city || 'Delhi'}",\n    "addressCountry": "IN"\n  }\n}\n</script>`;
                      if (navigator.clipboard?.writeText) {
                        await navigator.clipboard.writeText(schemaSnippet);
                        setCopiedSchema(true);
                        setTimeout(() => setCopiedSchema(false), 2500);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs cursor-pointer transition"
                  >
                    {copiedSchema ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied Schema!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Code Snippet</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  Paste this code block into the <code className="text-amber-300 font-mono text-[10px]">&lt;head&gt;</code> section of your website to prove NAP parity to Google search crawlers.
                </p>
                <pre className="p-3 bg-black/50 rounded-lg text-[11px] font-mono text-emerald-300 overflow-x-auto leading-relaxed border border-slate-800">
{`<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "${location.name}",
  "telephone": "${location.phone || '+91 11 0000 0000'}",
  "url": "${website || 'https://example.com'}",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "${location.address || ''}",
    "addressLocality": "${location.city || 'Delhi'}",
    "addressCountry": "IN"
  }
}
</script>`}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/70 transition cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSaveAndVerify}
            disabled={isSaving || isRecalculating || savedSuccess}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs text-white transition shadow-sm cursor-pointer disabled:opacity-50 ${
              savedSuccess ? 'bg-emerald-600' : 'bg-brand-600 hover:bg-brand-700'
            }`}
          >
            {savedSuccess ? (
              <>
                <Check className="w-4 h-4" />
                <span>
                  {(location as any).googleConnectionId
                    ? 'Saved & Synced to Google Profile!'
                    : 'Saved Locally & Queued for Verification!'}
                </span>
              </>
            ) : isSaving || isRecalculating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving & Verifying…</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>
                  {(location as any).googleConnectionId
                    ? 'Save & Sync to Google Profile'
                    : 'Save & Queue Verification'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
