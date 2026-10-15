import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import zxcvbn from 'zxcvbn';
import { AuthLayout } from './AuthLayout';
import { useRegisterMutation, useGoogleLoginMutation } from '../../store/api/authApi';
import { User, Mail, Lock, ArrowRight, Check, X, Eye, EyeOff } from 'lucide-react';
import { GoogleSignInButton } from '../../components/auth/GoogleSignInButton';
import { AuthAlert } from '../../components/ui/AuthAlert';
import { Button } from '../../components/ui/Button';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<{ message?: string; status?: number; data?: { error?: { message?: string } } } | null>(null);
  const [nameTouched, setNameTouched] = useState(false);

  const [register, { isLoading: isRegisterLoading }] = useRegisterMutation();
  const [googleLogin, { isLoading: isGoogleLoading }] = useGoogleLoginMutation();

  // Password rules validation (matching backend: min 10 chars + zxcvbn score >= 3)
  const zxcvbnScore = password ? zxcvbn(password, ['rankora', 'localo']).score : 0;
  const rules = {
    length: password.length >= 10,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
    strength: zxcvbnScore >= 3
  };
  const isPasswordValid = Object.values(rules).every(Boolean);
  const normalizedName = name.trim();
  const nameHasLetter = /\p{L}/u.test(normalizedName);
  const hasInvalidChars = /[^\p{L}\p{N}\s'\-\.]/u.test(normalizedName);
  const nameError = normalizedName.length < 2
    ? 'Enter at least 2 characters.'
    : normalizedName.length > 50
      ? 'Name must be 50 characters or fewer.'
      : hasInvalidChars
        ? 'Name can only contain letters, spaces, hyphens, and apostrophes.'
        : !nameHasLetter
          ? 'Name must include at least one letter.'
          : '';

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameTouched(true);
    if (nameError) {
      setError({ message: nameError });
      return;
    }
    if (!isPasswordValid) {
      setError({ message: 'Please satisfy all password security requirements before proceeding.' });
      return;
    }
    setError(null);

    try {
      await register({
        name: normalizedName,
        email: email.trim().toLowerCase(),
        password,
      }).unwrap();

      // Direct redirect to dashboard without onboarding wizard
      navigate('/dashboard');
    } catch (err: unknown) {
      setError(err as { message?: string; status?: number; data?: { error?: { message?: string } } });
    }
  };

  const handleGoogleSignUp = async (idToken: string) => {
    try {
      await googleLogin({ idToken }).unwrap();
      navigate('/dashboard');
    } catch (err: unknown) {
      setError(err as { message?: string; status?: number; data?: { error?: { message?: string } } });
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Track your Google Maps rankings, run geo-grid scans, and grow local visibility."
    >
      <AuthAlert error={error} onDismiss={() => setError(null)} />

      {/* Google Sign In */}
      <GoogleSignInButton
        text="signup"
        isLoading={isGoogleLoading}
        onSuccess={handleGoogleSignUp}
        onError={(msg) => setError({ message: msg })}
      />

      <div className="relative flex py-2 items-center mb-5">
        <div className="flex-grow border-t border-slate-200"></div>
        <span className="flex-shrink mx-3 text-slate-400 text-xs uppercase font-medium">Or register with email</span>
        <div className="flex-grow border-t border-slate-200"></div>
      </div>

      <form onSubmit={handleRegister} className="space-y-3.5">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Your Name</label>
          <div className="relative">
            <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={name}
              onChange={(e) => {
                const clean = e.target.value.replace(/[^\p{L}\p{N}\s'\-\.]/gu, '');
                setName(clean);
              }}
              onBlur={() => setNameTouched(true)}
              placeholder="e.g. Jane Doe"
              required
              maxLength={50}
              autoComplete="name"
              aria-invalid={nameTouched && Boolean(nameError)}
              aria-describedby={nameTouched && nameError ? 'register-name-error' : undefined}
              className={`w-full pl-9 pr-3 h-9 rounded-lg border text-slate-900 text-base md:text-xs focus-visible:outline-brand-500 outline-none transition ${
                nameTouched && nameError ? 'border-rose-400' : 'border-slate-300'
              }`}
            />
          </div>
          {nameTouched && nameError && <p id="register-name-error" className="mt-1 text-[11px] text-rose-600">{nameError}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Work Email</label>
          <div className="relative">
            <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              required
              maxLength={100}
              className="w-full pl-9 pr-3 h-9 rounded-lg border border-slate-300 text-slate-900 text-base md:text-xs focus-visible:outline-brand-500 outline-none transition"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
          <div className="relative">
            <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full pl-9 pr-9 h-9 rounded-lg border border-slate-300 text-slate-900 text-base md:text-xs focus-visible:outline-brand-500 outline-none transition"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none transition p-1 rounded"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Compact Password Security Criteria */}
          {password.length > 0 && (
            <div className="mt-2 p-2.5 bg-slate-50 border border-slate-100 rounded-lg grid grid-cols-2 gap-1.5 text-[11px]">
              <div className={`flex items-center gap-1.5 ${rules.length ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                {rules.length ? <Check className="w-3 h-3 text-emerald-600" /> : <X className="w-3 h-3 text-slate-400" />}
                <span>10+ characters</span>
              </div>
              <div className={`flex items-center gap-1.5 ${rules.strength ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                {rules.strength ? <Check className="w-3 h-3 text-emerald-600" /> : <X className="w-3 h-3 text-slate-400" />}
                <span>Strong & unguessable</span>
              </div>
              <div className={`flex items-center gap-1.5 ${rules.uppercase ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                {rules.uppercase ? <Check className="w-3 h-3 text-emerald-600" /> : <X className="w-3 h-3 text-slate-400" />}
                <span>Uppercase letter</span>
              </div>
              <div className={`flex items-center gap-1.5 ${rules.lowercase ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                {rules.lowercase ? <Check className="w-3 h-3 text-emerald-600" /> : <X className="w-3 h-3 text-slate-400" />}
                <span>Lowercase letter</span>
              </div>
              <div className={`flex items-center gap-1.5 ${rules.number ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                {rules.number ? <Check className="w-3 h-3 text-emerald-600" /> : <X className="w-3 h-3 text-slate-400" />}
                <span>Number</span>
              </div>
              <div className={`flex items-center gap-1.5 ${rules.special ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                {rules.special ? <Check className="w-3 h-3 text-emerald-600" /> : <X className="w-3 h-3 text-slate-400" />}
                <span>Special character</span>
              </div>
            </div>
          )}
        </div>

        <div className="pt-1">
          <Button
            type="submit"
            variant="primary"
            disabled={isRegisterLoading}
            className="w-full h-9 rounded-lg text-xs font-semibold"
          >
            {isRegisterLoading ? (
              'Creating account...'
            ) : (
              <span className="flex items-center justify-center gap-1.5">
                <span>Create account</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            )}
          </Button>
        </div>
      </form>

      <div className="mt-5 text-center text-xs text-slate-600">
        Already have an account?{' '}
        <Link to="/login" className="text-brand-600 hover:text-brand-700 font-semibold underline underline-offset-2">
          Sign in
        </Link>
      </div>
    </AuthLayout>
  );
};

export default RegisterPage;
