import React from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ShieldAlert,
  KeyRound,
  Mail,
  Clock,
  Info,
  X,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

export type AlertType = 'danger' | 'warning' | 'info';

export interface FormattedError {
  type: AlertType;
  title: string;
  message: string;
  action?: {
    label: string;
    to?: string;
    onClick?: () => void;
  };
}

export function parseError(err: any): FormattedError {
  const code: string =
    err?.data?.error?.code ||
    err?.status ||
    (typeof err === 'string' && /^[A-Z0-9_]+$/.test(err) ? err : '') ||
    '';
  const rawMessage: string =
    err?.data?.error?.message ||
    (typeof err === 'string' ? err : err?.message || err?.error || 'An unexpected error occurred.');

  if (code === 'FETCH_ERROR' || rawMessage.toLowerCase().includes('failed to fetch')) {
    return {
      type: 'danger',
      title: 'Server Connection Error',
      message: 'Could not connect to the backend server. Please check that the server is running and try again.',
    };
  }

  switch (code) {
    case 'INVALID_CREDENTIALS':
      return {
        type: 'danger',
        title: 'Incorrect Email or Password',
        message: 'The email or password you entered does not match our records. Please verify and try again.',
        action: {
          label: 'Forgot your password?',
          to: '/forgot-password',
        },
      };

    case 'ACCOUNT_TEMPORARILY_LOCKED':
      return {
        type: 'warning',
        title: 'Account Temporarily Locked',
        message:
          'Access has been paused for 5 minutes due to consecutive failed attempts. You can wait or reset your password immediately.',
        action: {
          label: 'Reset password now',
          to: '/forgot-password',
        },
      };

    case 'EMAIL_ALREADY_EXISTS':
      return {
        type: 'info',
        title: 'Account Already Exists',
        message: 'An account with this email address is already registered on Localo.',
        action: {
          label: 'Sign in to your account',
          to: '/login',
        },
      };

    case 'INVALID_GOOGLE_CREDENTIAL':
      return {
        type: 'danger',
        title: 'Google Sign-In Failed',
        message:
          'Could not verify your Google authentication credentials. Please try signing in again or use email login.',
      };

    case 'GOOGLE_EMAIL_MISSING':
      return {
        type: 'warning',
        title: 'Google Email Required',
        message: 'No verified email address was shared from Google. Please ensure your Google account email is visible.',
      };

    case 'EMAIL_NOT_VERIFIED':
      return {
        type: 'warning',
        title: 'Email Verification Required',
        message: 'Please verify your email address to unlock your workspace tools and ranking dashboard.',
        action: {
          label: 'Go to email verification',
          to: '/verify-email',
        },
      };

    case 'INVALID_MFA_CODE':
      return {
        type: 'danger',
        title: 'Invalid Two-Factor Code',
        message: 'The 6-digit code or emergency backup code you entered is invalid or has expired.',
      };

    case 'MFA_CHALLENGE_EXPIRED':
      return {
        type: 'warning',
        title: 'Two-Factor Session Expired',
        message: 'The 2FA challenge window has expired. Please sign in again to receive a fresh verification prompt.',
        action: {
          label: 'Back to sign in',
          to: '/login',
        },
      };

    case 'LOCATION_LIMIT_EXCEEDED':
      return {
        type: 'warning',
        title: 'Plan Location Limit Reached',
        message: "You've reached the maximum number of locations allowed on your current plan. Upgrade to track more locations.",
      };

    case 'RATE_LIMIT_EXCEEDED':
    case 'TOO_MANY_REQUESTS':
      return {
        type: 'warning',
        title: 'Too Many Requests',
        message: 'You are making requests too quickly. Please wait a few seconds and try again.',
      };

    case 'TOKEN_EXPIRED':
    case 'SESSION_REVOKED':
    case 'UNAUTHORIZED':
      return {
        type: 'warning',
        title: 'Session Expired',
        message: 'Your login session has expired or was signed out. Please sign in again.',
        action: {
          label: 'Sign in again',
          to: '/login',
        },
      };

    case 'USER_SUSPENDED':
    case 'WORKSPACE_UNAVAILABLE':
      return {
        type: 'danger',
        title: 'Account Suspended',
        message: 'Your account or workspace has been suspended. Please contact Localo support for assistance.',
      };

    case 'VALIDATION_ERROR':
      return {
        type: 'danger',
        title: 'Invalid Form Submission',
        message: rawMessage || 'Please review the fields above and ensure all required values meet security policies.',
      };

    default: {
      // Clean up uppercase raw codes like "SOME_ERROR_CODE"
      const isRawCode = /^[A-Z0-9_]+$/.test(rawMessage);
      const cleanTitle = isRawCode
        ? rawMessage
            .toLowerCase()
            .split('_')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ')
        : 'Sign-in Error';

      const cleanMessage = isRawCode
        ? 'An error occurred while processing your request. Please try again or contact support.'
        : rawMessage;

      return {
        type: 'danger',
        title: cleanTitle,
        message: cleanMessage,
      };
    }
  }
}

interface AuthAlertProps {
  error: any;
  onDismiss?: () => void;
  className?: string;
}

export const AuthAlert: React.FC<AuthAlertProps> = ({ error, onDismiss, className = '' }) => {
  if (!error) return null;

  const parsed = parseError(error);

  const getThemeStyles = () => {
    switch (parsed.type) {
      case 'warning':
        return {
          wrapper: 'bg-amber-50/90 border-amber-200/80 text-amber-900',
          iconBg: 'bg-amber-100 text-amber-600',
          title: 'text-amber-900',
          message: 'text-amber-800/90',
          action: 'text-amber-700 hover:text-amber-900 hover:underline',
          close: 'text-amber-500 hover:text-amber-700 hover:bg-amber-100',
          Icon: parsed.title.includes('Locked') ? Clock : AlertCircle,
        };
      case 'info':
        return {
          wrapper: 'bg-brand-50/90 border-brand-200/80 text-brand-900',
          iconBg: 'bg-brand-100 text-brand-600',
          title: 'text-brand-900',
          message: 'text-brand-800/90',
          action: 'text-brand-700 hover:text-brand-900 font-semibold hover:underline',
          close: 'text-brand-500 hover:text-brand-700 hover:bg-brand-100',
          Icon: Info,
        };
      case 'danger':
      default:
        return {
          wrapper: 'bg-rose-50/90 border-rose-200/80 text-rose-900',
          iconBg: 'bg-rose-100 text-rose-600',
          title: 'text-rose-900',
          message: 'text-rose-800/90',
          action: 'text-rose-700 hover:text-rose-900 font-semibold hover:underline',
          close: 'text-rose-500 hover:text-rose-700 hover:bg-rose-100',
          Icon: parsed.title.includes('Password') ? KeyRound : ShieldAlert,
        };
    }
  };

  const theme = getThemeStyles();
  const IconComponent = theme.Icon;

  return (
    <div
      role="alert"
      className={`relative mb-6 p-3.5 rounded-2xl border backdrop-blur-xs shadow-xs transition-all animate-in fade-in slide-in-from-top-1 duration-200 ${theme.wrapper} ${className}`}
    >
      <div className="flex items-start space-x-3">
        {/* Icon */}
        <div className={`p-1.5 rounded-xl flex-shrink-0 mt-0.5 ${theme.iconBg}`}>
          <IconComponent className="w-4 h-4" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pr-6">
          <h4 className={`text-xs font-bold leading-snug tracking-tight ${theme.title}`}>
            {parsed.title}
          </h4>
          <p className={`text-xs mt-0.5 leading-relaxed ${theme.message}`}>
            {parsed.message}
          </p>

          {/* Action Link / Button if available */}
          {parsed.action && (
            <div className="mt-2 pt-1.5 border-t border-black/5">
              {parsed.action.to ? (
                <Link
                  to={parsed.action.to}
                  className={`inline-flex items-center space-x-1 text-xs font-semibold ${theme.action}`}
                >
                  <span>{parsed.action.label}</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              ) : parsed.action.onClick ? (
                <button
                  type="button"
                  onClick={parsed.action.onClick}
                  className={`inline-flex items-center space-x-1 text-xs font-semibold ${theme.action}`}
                >
                  <span>{parsed.action.label}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              ) : null}
            </div>
          )}
        </div>

        {/* Dismiss Button */}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss error"
            className={`absolute top-2.5 right-2.5 p-1 rounded-lg transition ${theme.close}`}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
