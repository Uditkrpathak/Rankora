import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import { SettingsLayout } from './SettingsLayout';
import { useUpdateWorkspaceMutation } from '../../store/api/workspaceApi';
import { setActiveWorkspace } from '../../store/slices/authSlice';
import { Save, CheckCircle2, Loader2, Building2, Globe, MapPin, Target, Sparkles } from 'lucide-react';

export const WorkspaceSettingsPage: React.FC = () => {
  const dispatch = useDispatch();
  const { activeWorkspace } = useSelector((state: RootState) => state.auth);
  const workspaceId = activeWorkspace?.id || '';

  const [name, setName] = useState(activeWorkspace?.name || '');
  const [category, setCategory] = useState(activeWorkspace?.category || 'Dental & Healthcare');
  const [targetCity, setTargetCity] = useState(activeWorkspace?.targetCity || '');
  const [websiteUrl, setWebsiteUrl] = useState(activeWorkspace?.websiteUrl || '');
  const [primaryGoal, setPrimaryGoal] = useState(activeWorkspace?.primaryGoal || 'rank_tracking');

  const [updateWorkspace, { isLoading }] = useUpdateWorkspaceMutation();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setError('');
      setSuccess(false);
      const res = await updateWorkspace({
        workspaceId,
        name: name.trim(),
        category,
        targetCity: targetCity.trim() || undefined,
        websiteUrl: websiteUrl.trim() || undefined,
        primaryGoal,
      }).unwrap();

      const updated = res.data?.workspace || res.workspace || res.data || res;
      if (updated) {
        dispatch(setActiveWorkspace({ ...activeWorkspace, ...updated }));
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err?.data?.error?.message || err?.data?.message || 'Failed to update workspace');
    }
  };

  return (
    <SettingsLayout>
      <div className="w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-slate-200/60">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Workspace Settings
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Configure workspace identity, business categories, and SEO objectives.
            </p>
          </div>
        </div>

        {success && (
          <div className="flex items-center gap-2 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold shadow-2xs">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>Workspace settings saved successfully!</span>
          </div>
        )}

        {error && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold shadow-2xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* General Info Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
              <Building2 className="w-5 h-5 text-brand-600" />
              <div>
                <h2 className="text-base font-bold text-slate-900">Workspace Identity</h2>
                <p className="text-xs text-slate-500">The primary branding and profile information for this workspace.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Workspace Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Acme Dental Group"
                  required
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Primary Business Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition cursor-pointer"
                >
                  <option value="Dental & Healthcare">Dental & Healthcare</option>
                  <option value="Restaurant & Hospitality">Restaurant & Hospitality</option>
                  <option value="Real Estate & Property">Real Estate & Property</option>
                  <option value="Legal & Financial Services">Legal & Financial Services</option>
                  <option value="Home Services & Contractors">Home Services & Contractors</option>
                  <option value="Digital Agency / Marketing">Digital Agency / Marketing</option>
                  <option value="Retail & Shopping">Retail & Shopping</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  Target Market / Primary City
                </label>
                <input
                  type="text"
                  value={targetCity}
                  onChange={(e) => setTargetCity(e.target.value)}
                  placeholder="e.g. New York, London, Delhi"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-slate-400" />
                  Official Website URL
                </label>
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://yourbusiness.com"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
                />
              </div>
            </div>
          </div>

          {/* Objectives Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
              <Target className="w-5 h-5 text-brand-600" />
              <div>
                <h2 className="text-base font-bold text-slate-900">SEO Strategy & Primary Goal</h2>
                <p className="text-xs text-slate-500">Helps customize AI recommendations and audit priorities for this workspace.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { id: 'rank_tracking', title: 'Dominate Map Pack', desc: 'Prioritize top 3 local rankings in high-density areas.' },
                { id: 'reviews_growth', title: 'Review Velocity', desc: 'Focus on review generation and AI response automation.' },
                { id: 'listing_protection', title: 'Listing Defense', desc: 'Monitor competitor edits and protect Google citations.' },
              ].map((goal) => (
                <div
                  key={goal.id}
                  onClick={() => setPrimaryGoal(goal.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition ${
                    primaryGoal === goal.id
                      ? 'border-brand-500 bg-brand-50/40 shadow-xs'
                      : 'border-slate-200 bg-slate-50/40 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-bold text-slate-900">{goal.title}</span>
                    {primaryGoal === goal.id && <Sparkles className="w-4 h-4 text-brand-600" />}
                  </div>
                  <p className="text-xs text-slate-500">{goal.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              <span>Save Workspace Changes</span>
            </button>
          </div>
        </form>
      </div>
    </SettingsLayout>
  );
};
