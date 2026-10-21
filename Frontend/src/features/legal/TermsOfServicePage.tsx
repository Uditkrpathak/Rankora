import React from 'react';
import { Link } from 'react-router-dom';
import { RankoraLogo } from '../../components/ui/RankoraLogo';
import { FileText, ArrowLeft, Shield, CheckCircle2 } from 'lucide-react';

export const TermsOfServicePage: React.FC = () => {
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
              <FileText size={14} />
              <span>User Agreement & Terms</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Terms of Service
            </h1>
            <p className="text-sm text-slate-500 mt-2">
              Effective Date: October 21, 2026 | Last Updated: October 21, 2026
            </p>
          </div>

          <div className="prose prose-slate max-w-none text-sm leading-relaxed space-y-6">
            <p>
              Welcome to <strong>Rankora</strong> (&quot;Service&quot;), operated by <strong>Agumentik Software Private Limited</strong> (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;). By accessing or using our website at <strong>https://rankora-ashy-psi.vercel.app</strong> or our application features, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.
            </p>

            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
              <CheckCircle2 size={18} className="text-brand-600" />
              1. Description of Service
            </h2>
            <p>
              Rankora provides local search engine optimization (SEO) software, multi-pin GeoGrid ranking visualization, Google Business Profile management, customer review synchronization, and audit analysis tools for businesses and agencies.
            </p>

            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
              2. User Accounts & Responsibilities
            </h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>You must be at least 18 years old or the legal age of majority in your jurisdiction to use Rankora.</li>
              <li>You are responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account.</li>
              <li>You agree to provide accurate, current, and complete business information.</li>
            </ul>

            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
              <Shield size={18} className="text-brand-600" />
              3. Google Business Profile & Third-Party Services
            </h2>
            <p>
              Rankora allows you to integrate your Google Business Profile account via Google OAuth 2.0. By using these features, you acknowledge and agree that:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>You are an authorized owner, manager, or representative of the Google Business Profile listings you connect to Rankora.</li>
              <li>Your use of Google Business Profile features is also subject to the <a href="https://policies.google.com/terms" target="_blank" rel="noreferrer" className="text-brand-600 underline">Google Terms of Service</a> and <a href="https://support.google.com/business/answer/3038177" target="_blank" rel="noreferrer" className="text-brand-600 underline">Google Business Profile Policies</a>.</li>
              <li>Rankora is an independent platform and is not sponsored by, affiliated with, or endorsed by Google LLC.</li>
            </ul>

            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
              4. Acceptable Use Policy
            </h2>
            <p>When using Rankora, you agree not to:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Use the service for any unlawful, defamatory, or fraudulent purpose.</li>
              <li>Attempt to reverse engineer, decompile, or compromise the security of our application.</li>
              <li>Publish false, misleading, or abusive review responses through our platform.</li>
              <li>Scrape or extract proprietary data outside authorized UI and export features.</li>
            </ul>

            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
              5. Intellectual Property
            </h2>
            <p>
              Rankora, including its design, branding, software code, algorithms, and documentation, is the exclusive intellectual property of Agumentik Software Private Limited. You retain all ownership rights to the business content and review replies you create.
            </p>

            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
              6. Limitation of Liability
            </h2>
            <p>
              Rankora provides analytical and local SEO tools on an &quot;as is&quot; and &quot;as available&quot; basis. We do not guarantee specific placement or search engine results on third-party platforms like Google Maps. To the maximum extent permitted by applicable law, Agumentik Software Private Limited shall not be liable for any indirect, incidental, or consequential damages resulting from the use of the platform.
            </p>

            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
              7. Termination & Cancellation
            </h2>
            <p>
              You may cancel your account at any time via your workspace settings. We reserve the right to suspend or terminate accounts that violate these Terms of Service or engage in abusive activity.
            </p>

            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
              8. Contact Us
            </h2>
            <p>
              For any questions regarding these Terms of Service, please contact us at:
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
            <Link to="/terms" className="text-brand-600 font-semibold">Terms of Service</Link>
            <Link to="/privacy" className="hover:text-brand-600 transition">Privacy Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
