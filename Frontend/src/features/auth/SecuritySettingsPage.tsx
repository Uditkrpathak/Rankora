import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { RootState } from '../../store';
import { useMfaEnrollMutation, useMfaVerifyMutation } from '../../store/api/authApi';
import { AppNavbar } from '../../components/layout/AppNavbar';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  Key,
  Copy,
  Check,
  Download,
  AlertCircle,
  ArrowRight,
  Lock,
  RefreshCw,
  ExternalLink
} from 'lucide-react';

export const SecuritySettingsPage: React.FC = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);

  const [mfaEnroll, { isLoading: isEnrolling }] = useMfaEnrollMutation();
  const [mfaVerify, { isLoading: isVerifying }] = useMfaVerifyMutation();

  const [enrollData, setEnrollData] = useState<{ qrCodeDataUrl: string; secret: string } | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);
  const [isEnrolledLocal, setIsEnrolledLocal] = useState(user?.mfaEnabled || false);

  const handleStartEnroll = async () => {
    setErrorMessage(null);
    setBackupCodes(null);
    try {
      const res = await mfaEnroll().unwrap();
      setEnrollData(res.data);
    } catch (err: any) {
      setErrorMessage(err.data?.error?.message || 'Failed to start MFA enrollment.');
    }
  };

  const handleVerifyEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totpCode || totpCode.length < 6) return;
    setErrorMessage(null);

    try {
      const res = await mfaVerify({ code: totpCode.trim() }).unwrap();
      setBackupCodes(res.data.backupCodes);
      setEnrollData(null);
      setIsEnrolledLocal(true);
    } catch (err: any) {
      setErrorMessage(err.data?.error?.message || 'Invalid 6-digit authenticator code.');
    }
  };

  const handleCopySecret = () => {
    if (enrollData?.secret) {
      navigator.clipboard.writeText(enrollData.secret);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const handleCopyAllCodes = () => {
    if (backupCodes) {
      navigator.clipboard.writeText(backupCodes.join('\n'));
      setCopiedCodes(true);
      setTimeout(() => setCopiedCodes(false), 2000);
    }
  };

  const handleDownloadCodes = () => {
    if (backupCodes) {
      const element = document.createElement('a');
      const file = new Blob([backupCodes.join('\n')], { type: 'text/plain' });
      element.href = URL.createObjectURL(file);
      element.download = 'localo-mfa-backup-codes.txt';
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    }
  };

  return (
    <div className="min-h-screen w-full page-canvas flex flex-col text-slate-900 antialiased selection:bg-brand-500 selection:text-white">
      <AppNavbar fullWidth={true} />
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
      <div className="pb-6 border-b border-slate-200">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Security & Authentication</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage your account protection, two-factor authentication (2FA), and active devices.
        </p>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 2FA Status Card */}
      <div className="bg-white rounded-lg border border-slate-200 p-5 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start space-x-4">
            <div
              className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                isEnrolledLocal ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {isEnrolledLocal ? <ShieldCheck className="w-6 h-6" /> : <Smartphone className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-slate-900">Two-Factor Authentication (TOTP)</h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    isEnrolledLocal
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {isEnrolledLocal ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Protect your Google Business Profile and workspaces from credential stuffing by requiring a 6-digit code on login.
              </p>
            </div>
          </div>

          {!isEnrolledLocal && !enrollData && (
            <button
              onClick={handleStartEnroll}
              disabled={isEnrolling}
              className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs transition shadow-sm self-start sm:self-auto cursor-pointer"
            >
              <span>{isEnrolling ? 'Loading QR...' : 'Enable 2FA'}</span>
            </button>
          )}
        </div>

        {/* Step 1 & 2: Active Enrollment View */}
        {enrollData && (
          <div className="mt-6 p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-6 animate-fade-in">
            <div className="border-b border-slate-200 pb-4">
              <h3 className="text-base font-bold text-slate-900">Step 1: Scan QR Code with Authenticator App</h3>
              <p className="text-xs text-slate-500 mt-1">
                Open Google Authenticator, 1Password, Authy, or Microsoft Authenticator and scan this code.
              </p>
            </div>

            <div className="flex flex-col md:flex-row items-center gap-8">
              {/* QR Code */}
              <div className="p-3 bg-white border border-slate-200 rounded-2xl shadow-xs">
                <img
                  src={enrollData.qrCodeDataUrl}
                  alt="MFA QR Code"
                  className="w-48 h-48 rounded-lg"
                />
              </div>

              {/* Manual Secret Key */}
              <div className="flex-1 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Can't scan? Enter this secret key manually:
                  </label>
                  <div className="flex items-center space-x-2">
                    <code className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-xs text-brand-700 select-all">
                      {enrollData.secret}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopySecret}
                      className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 text-xs flex items-center space-x-1"
                    >
                      {copiedKey ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedKey ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                {/* Form to Confirm Code */}
                <form onSubmit={handleVerifyEnroll} className="space-y-3 pt-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Step 2: Enter the 6-digit code shown in your app
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      maxLength={6}
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="123456"
                      required
                      autoFocus
                      className="w-40 px-4 py-2.5 rounded-xl border border-slate-300 text-center tracking-widest font-mono text-lg font-bold text-slate-900 outline-none focus:ring-2 focus:ring-brand-600"
                    />
                    <button
                      type="submit"
                      disabled={isVerifying || totpCode.length !== 6}
                      className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs transition shadow-sm disabled:opacity-50 cursor-pointer"
                    >
                      {isVerifying ? 'Activating...' : 'Verify & Activate 2FA'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEnrollData(null)}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-semibold text-xs transition"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Backup Codes Reveal (One-Time) */}
        {backupCodes && (
          <div className="mt-6 p-6 rounded-lg bg-emerald-50 border border-emerald-200 space-y-4 animate-fade-in">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-emerald-900 flex items-center space-x-2">
                  <Check className="w-5 h-5 text-emerald-600" />
                  <span>Two-Factor Authentication is Activated!</span>
                </h3>
                <p className="text-xs text-emerald-700 mt-1">
                  Save these <strong>10 emergency backup codes</strong> now. Each code can be used once if you lose access to your authenticator app. They will not be shown again.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 p-4 bg-white/90 border border-emerald-100 rounded-lg font-mono text-xs text-slate-800 text-center font-bold">
              {backupCodes.map((code, idx) => (
                <div key={idx} className="p-2 rounded bg-slate-50 border border-slate-200 select-all">
                  {code}
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleCopyAllCodes}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-white border border-emerald-300 text-emerald-800 text-xs font-semibold hover:bg-emerald-100/50 transition cursor-pointer"
              >
                {copiedCodes ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCodes ? 'Copied to Clipboard' : 'Copy All Codes'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadCodes}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-white border border-emerald-300 text-emerald-800 text-xs font-semibold hover:bg-emerald-100/50 transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download as .txt</span>
              </button>

              <button
                type="button"
                onClick={() => setBackupCodes(null)}
                className="ml-auto px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition cursor-pointer"
              >
                I have safely stored my backup codes
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Additional Security Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Device & Session Management */}
        <div className="bg-white rounded-lg border border-slate-200 p-5 flex flex-col justify-between space-y-4">
          <div>
            <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center mb-3">
              <Key className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Active Device Sessions</h3>
            <p className="text-xs text-slate-500 mt-1">
              View all logged-in devices across Chrome, Safari, and mobile apps. Revoke suspicious sessions instantly.
            </p>
          </div>
          <Link
            to="/sessions"
            className="inline-flex items-center space-x-1.5 text-xs font-semibold text-brand-600 hover:underline pt-2"
          >
            <span>Manage active sessions</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Password Recovery & Reset */}
        <div className="bg-white rounded-lg border border-slate-200 p-5 flex flex-col justify-between space-y-4">
          <div>
            <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center mb-3">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Password & Encryption</h3>
            <p className="text-xs text-slate-500 mt-1">
              Hashed with memory-hard Argon2id (OWASP 19 MB baseline). Passwords can be securely reset via transactional email.
            </p>
          </div>
          <Link
            to="/forgot-password"
            className="inline-flex items-center space-x-1.5 text-xs font-semibold text-brand-600 hover:underline pt-2"
          >
            <span>Initiate password reset</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
      </main>
    </div>
  );
};
