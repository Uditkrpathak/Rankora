import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import { SettingsLayout } from './SettingsLayout';
import { useUpdateWorkspaceMutation } from '../../store/api/workspaceApi';
import { setActiveWorkspace } from '../../store/slices/authSlice';
import { Save, CheckCircle2, Loader2, Building2, Globe } from 'lucide-react';

export const WorkspaceSettingsPage: React.FC = () => {
  const dispatch = useDispatch();
  const { activeWorkspace } = useSelector((state: RootState) => state.auth);
  const workspaceId = activeWorkspace?.id || '';

  const branding = activeWorkspace?.branding || {};
  const [name, setName] = useState(activeWorkspace?.name || '');
  const [category, setCategory] = useState(activeWorkspace?.category || branding.category || 'Dental & Healthcare');
  const [websiteUrl, setWebsiteUrl] = useState(activeWorkspace?.websiteUrl || branding.websiteUrl || '');

  useEffect(() => {
    if (activeWorkspace) {
      const b = activeWorkspace.branding || {};
      setName(activeWorkspace.name || '');
      setCategory(activeWorkspace.category || b.category || 'Dental & Healthcare');
      setWebsiteUrl(activeWorkspace.websiteUrl || b.websiteUrl || '');
    }
  }, [activeWorkspace]);

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
        websiteUrl: websiteUrl.trim() || undefined,
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
              Configure workspace identity, business category, and report branding.
            </p>
          </div>
        </div>

        {success && (
          <div className="flex items-center gap-2 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>Workspace settings saved successfully!</span>
          </div>
        )}

        {error && (
          <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* General Info Card */}
          <div className="bg-white rounded-lg border border-slate-200 p-5 sm:p-6 space-y-6">
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
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Primary Business Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition cursor-pointer"
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

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-slate-400" />
                  Official Website URL
                </label>
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://yourbusiness.com"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
                />
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Used as your official company or agency link on white-label reports and exports.
                </p>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition disabled:opacity-50 cursor-pointer"
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
