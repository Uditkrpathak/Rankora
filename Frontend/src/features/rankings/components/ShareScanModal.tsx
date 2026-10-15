import React, { useState, useEffect } from 'react';
import { IScanRun } from '@localo/types';
import { useShareScanMutation } from '../../../store/api/scanApi';
import {
  X,
  Share2,
  Copy,
  Check,
  ExternalLink,
  Shield,
  Building,
  Globe,
  Mail,
  Palette,
  FileText,
  Sparkles,
  MessageCircle,
} from 'lucide-react';

interface ShareScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  scan: IScanRun & {
    agencyBranding?: {
      agencyName?: string;
      logoUrl?: string;
      primaryColor?: string;
      contactEmail?: string;
      websiteUrl?: string;
      notes?: string;
    };
    shareToken?: string;
    isPublicShareable?: boolean;
  };
  workspaceId: string;
  locationName: string;
}

export const ShareScanModal: React.FC<ShareScanModalProps> = ({
  isOpen,
  onClose,
  scan,
  workspaceId,
  locationName,
}) => {
  const [shareScan, { isLoading: isSharing }] = useShareScanMutation();
  const [copied, setCopied] = useState(false);
  const [isPublic, setIsPublic] = useState(scan.isPublicShareable !== false);
  const [agencyName, setAgencyName] = useState(scan.agencyBranding?.agencyName || '');
  const [logoUrl, setLogoUrl] = useState(scan.agencyBranding?.logoUrl || '');
  const [primaryColor, setPrimaryColor] = useState(scan.agencyBranding?.primaryColor || '#2563eb');
  const [contactEmail, setContactEmail] = useState(scan.agencyBranding?.contactEmail || '');
  const [websiteUrl, setWebsiteUrl] = useState(scan.agencyBranding?.websiteUrl || '');
  const [notes, setNotes] = useState(scan.agencyBranding?.notes || '');
  const [shareToken, setShareToken] = useState(scan.shareToken || '');

  useEffect(() => {
    setIsPublic(scan.isPublicShareable !== false);
    setAgencyName(scan.agencyBranding?.agencyName || '');
    setLogoUrl(scan.agencyBranding?.logoUrl || '');
    setPrimaryColor(scan.agencyBranding?.primaryColor || '#2563eb');
    setContactEmail(scan.agencyBranding?.contactEmail || '');
    setWebsiteUrl(scan.agencyBranding?.websiteUrl || '');
    setNotes(scan.agencyBranding?.notes || '');
    setShareToken(scan.shareToken || '');
  }, [scan]);

  if (!isOpen) return null;

  const origin = window.location.origin;
  const shareUrl = shareToken ? `${origin}/reports/${shareToken}` : '';
  const whatsappShareUrl = shareUrl
    ? `https://api.whatsapp.com/send?text=${encodeURIComponent(`Check out the live Local SEO Ranking Report for ${locationName}: ${shareUrl}`)}`
    : '';

  const handleSaveAndGenerate = async () => {
    try {
      const res = await shareScan({
        workspaceId,
        scanId: (scan as any)._id || (scan as any).id,
        isPublic,
        branding: {
          agencyName,
          logoUrl,
          primaryColor,
          contactEmail,
          websiteUrl,
          notes,
        },
      }).unwrap();

      if (res.data?.shareToken) {
        setShareToken(res.data.shareToken);
      }
    } catch (err) {
      console.error('Failed to update share settings:', err);
    }
  };

  const handleCopy = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Share2 size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Share Client Scan Report</h3>
              <p className="text-xs text-slate-500">{locationName} · &quot;{scan.keyword}&quot;</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Public Access Switch */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-blue-50/50 border border-blue-100">
            <div className="flex items-center gap-2.5">
              <Shield size={18} className="text-blue-600" />
              <div>
                <p className="text-xs font-bold text-slate-900">Public Link Access</p>
                <p className="text-[11px] text-slate-500">
                  Anyone with this link can view the interactive heatmap & competitor report.
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
            </label>
          </div>

          {/* Share Link Field */}
          {isPublic && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Client Share URL</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl || 'Generating public link...'}
                  className="flex-1 px-3.5 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl text-slate-800 select-all"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  disabled={!shareUrl}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm shadow-blue-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
                {shareUrl && (
                  <a
                    href={whatsappShareUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm shadow-emerald-500/20"
                    title="Share via WhatsApp"
                  >
                    <MessageCircle size={14} />
                    <span>WhatsApp</span>
                  </a>
                )}
                {shareUrl && (
                  <a
                    href={shareUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                    title="Open report in new tab"
                  >
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Agency White-Label Branding Section */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-slate-500">
              <Sparkles size={14} className="text-amber-500" />
              <span>White-Label Agency Branding</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                  <Building size={12} /> Agency / Company Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Apex Digital Marketing"
                  value={agencyName}
                  onChange={(e) => setAgencyName(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                  <Globe size={12} /> Agency Logo URL (Optional)
                </label>
                <input
                  type="url"
                  placeholder="https://youragency.com/logo.png"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                  <Mail size={12} /> Contact Email
                </label>
                <input
                  type="email"
                  placeholder="contact@youragency.com"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                  <Palette size={12} /> Brand Color Accent
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer border border-slate-200 p-0.5"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs font-mono border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none uppercase"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                <FileText size={12} /> Executive Notes for Client (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Regional visibility is up +42% in North sector. Primary recommendation is to add secondary categories..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleSaveAndGenerate}
            disabled={isSharing}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            <span>{isSharing ? 'Saving...' : 'Save & Update Link'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
