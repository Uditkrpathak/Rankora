import React from 'react';
import { Link } from 'react-router-dom';
import { RankoraLogo } from '../../components/ui/RankoraLogo';
import { ShieldCheck, ArrowLeft, Lock, Database, Eye, RefreshCw } from 'lucide-react';

export const PrivacyPolicyPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/" className="inline-block">
            <RankoraLogo size="sm" showSubtitle={false} />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-brand-600 transition"
          >
            <ArrowLeft size={14} />
            Back to Home
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-12 shadow-xs space-y-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-brand-600 text-xs font-semibold mb-3">
              <ShieldCheck size={14} />
              <span>Legal & Data Protection</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Privacy Policy
            </h1>
            <p className="text-sm text-slate-500 mt-2">
              Effective Date: October 21, 2026 | Last Updated: October 21, 2026
            </p>
          </div>

          <div className="prose prose-slate max-w-none text-sm leading-relaxed space-y-6">
            <p>
              Rankora (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;), operated by Agumentik Software Private Limited, is committed to safeguarding your privacy. This Privacy Policy describes how we collect, use, process, and disclose your personal and business data when you use the Rankora platform, APIs, and associated web services at <strong>https://rankora-ashy-psi.vercel.app</strong>.
            </p>

            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
              <Eye size={18} className="text-brand-600" />
              1. Information We Collect
            </h2>
            <p>When you create an account, connect integrations, or use our tools, we collect:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Account Information:</strong> Your name, business email address, company name, and encrypted authentication credentials.</li>
              <li><strong>Google User Data:</strong> When you connect your Google Account via OAuth 2.0, we access your Google email and requested scopes (including <code>https://www.googleapis.com/auth/business.manage</code> and <code>https://www.googleapis.com/auth/userinfo.email</code>).</li>
              <li><strong>Google Business Profile Data:</strong> Business name, address, categories, opening hours, photos, ratings, reviews, and search performance insights.</li>
              <li><strong>Location & Ranking Data:</strong> Geocoded coordinates of your business locations, tracked keywords, and competitor ranking snapshots on Google Maps.</li>
            </ul>

            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
              <Database size={18} className="text-brand-600" />
              2. How We Use Your Information
            </h2>
            <p>We use the data collected strictly to provide and improve Rankora&apos;s local SEO services, including:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Visualizing your geographic rankings on multi-pin GeoGrid maps.</li>
              <li>Synchronizing Google Business Profile NAP (Name, Address, Phone) details, categories, and attributes.</li>
              <li>Syncing customer Google reviews and publishing your approved replies back to Google Maps.</li>
              <li>Generating SEO audits, ranking velocity alerts, and competitor benchmark reports.</li>
              <li>Providing customer support and communicating service notices.</li>
            </ul>

            <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200/80 text-blue-900">
              <h3 className="font-bold text-sm mb-1 flex items-center gap-1.5">
                <Lock size={15} />
                Google API Services User Data Policy Compliance
              </h3>
              <p className="text-xs leading-relaxed">
                Rankora&apos;s use and transfer to any other app of information received from Google APIs will adhere to the{' '}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold underline"
                >
                  Google API Services User Data Policy
                </a>
                , including the Limited Use requirements. We never sell your Google data to third parties, nor do we use it for advertising or surveillance.
              </p>
            </div>

            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
              3. Data Storage & Security
            </h2>
            <p>
              We implement industry-standard security safeguards. All OAuth access and refresh tokens received from Google are encrypted at rest using AES-256-GCM encryption with dynamic initialization vectors in a dedicated token vault. Passwords are salted and hashed using Argon2id. All network transmissions are strictly enforced over HTTPS/TLS 1.3.
            </p>

            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
              <RefreshCw size={18} className="text-brand-600" />
              4. Data Retention, Disconnection & Deletion
            </h2>
            <p>
              You maintain full control over your connected accounts and stored data:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Disconnecting Google:</strong> You can disconnect your Google Business Profile at any time from <strong>Settings &gt; Connected Accounts</strong>. Disconnecting immediately revokes our access tokens and stops all syncing.</li>
              <li><strong>Data Deletion Request:</strong> You can request full deletion of your account and associated ranking history by contacting us or scheduling workspace deletion from workspace settings. All data is purged within 30 days.</li>
            </ul>

            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
              5. Third-Party Service Providers
            </h2>
            <p>
              We may utilize trusted third-party cloud infrastructure (e.g. MongoDB Atlas, Vercel, Supabase, and Redis) solely to host and execute our software. These providers are bound by strict confidentiality and data protection agreements.
            </p>

            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
              6. Contact Information
            </h2>
            <p>
              If you have any questions or concerns about this Privacy Policy or our data practices, please contact our Data Protection Officer:
            </p>
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-xs space-y-1">
              <p><strong>Rankora by Agumentik Software Private Limited</strong></p>
              <p>Email: <a href="mailto:dev@rankora.io" className="text-brand-600 underline">dev@rankora.io</a> / <a href="mailto:uditpathak65@gmail.com" className="text-brand-600 underline">uditpathak65@gmail.com</a></p>
              <p>Website: <a href="https://rankora-ashy-psi.vercel.app" className="text-brand-600 underline">https://rankora-ashy-psi.vercel.app</a></p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>&copy; 2026 Rankora by Agumentik Software Private Limited. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link to="/terms" className="hover:text-brand-600 transition">Terms of Service</Link>
            <Link to="/privacy" className="text-brand-600 font-semibold">Privacy Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
