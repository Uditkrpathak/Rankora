import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAdminLoginMutation } from '../../store/api/authApi';
import { ShieldAlert, ShieldCheck, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { AuthAlert } from '../../components/ui/AuthAlert';
import { BrandLogo } from '../../components/ui/BrandLogo';

export const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<any>(null);

  const [adminLogin, { isLoading }] = useAdminLoginMutation();

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const res = await adminLogin({ email, password }).unwrap();
      const user = res.data?.user;
      if (user?.mustChangePassword) {
        navigate('/change-password', { replace: true });
      } else {
        navigate('/admin', { replace: true });
      }
    } catch (err: any) {
      setError(err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Subtle Background Glows */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full relative z-10">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-brand-500/10 rounded-2xl border border-brand-500/20 backdrop-blur-md">
              <ShieldCheck className="w-8 h-8 text-brand-400" />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Administrator Portal</h1>
          <p className="text-xs text-slate-400 mt-1.5">Sign in with privileged administrator credentials</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-7 shadow-2xl backdrop-blur-xl space-y-6">
          <AuthAlert error={error} onDismiss={() => setError(null)} />

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Admin Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  required
                  autoFocus
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-white text-xs placeholder-slate-500 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-white text-xs placeholder-slate-500 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold transition shadow-lg shadow-brand-600/20 flex items-center justify-center space-x-2 disabled:opacity-50 mt-2 cursor-pointer"
            >
              <span>{isLoading ? 'Verifying Admin Access...' : 'Authenticate as Admin'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="pt-4 border-t border-slate-800/80 text-center">
            <Link to="/login" className="text-xs text-slate-400 hover:text-brand-400 transition font-medium">
              ← Return to Standard User Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
