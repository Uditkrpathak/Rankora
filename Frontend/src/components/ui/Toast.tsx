import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
}

interface ToastContextValue {
  toast: {
    success: (message: string, title?: string) => void;
    error: (message: string, title?: string) => void;
    info: (message: string, title?: string) => void;
    warning: (message: string, title?: string) => void;
  };
  showToast: (type: ToastType, message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastType, ReactNode> = {
  success: <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />,
  error: <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />,
  warning: <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />,
  info: <Info className="w-4 h-4 text-brand-600 shrink-0" />,
};

const BORDERS: Record<ToastType, string> = {
  success: 'border-emerald-200 bg-white text-slate-900',
  error: 'border-rose-200 bg-white text-slate-900',
  warning: 'border-amber-200 bg-white text-slate-900',
  info: 'border-brand-200 bg-white text-slate-900',
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((type: ToastType, message: string, title?: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    setToasts((prev) => [...prev, { id, type, title, message }]);

    // Auto dismiss after 4.5s
    setTimeout(() => {
      removeToast(id);
    }, 4500);
  }, [removeToast]);

  const value: ToastContextValue = {
    showToast,
    toast: {
      success: (msg, title) => showToast('success', msg, title),
      error: (msg, title) => showToast('error', msg, title),
      info: (msg, title) => showToast('info', msg, title),
      warning: (msg, title) => showToast('warning', msg, title),
    },
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast container portal */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-3"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto p-3 rounded-md border shadow-sm flex items-start gap-2.5 transition-all animate-in fade-in slide-in-from-bottom-2 ${BORDERS[t.type]}`}
          >
            <div className="mt-0.5">{ICONS[t.type]}</div>
            <div className="flex-1 min-w-0">
              {t.title && <div className="text-xs font-semibold text-slate-900 mb-0.5">{t.title}</div>}
              <div className="text-xs text-slate-700 leading-snug break-words">{t.message}</div>
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer shrink-0"
              aria-label="Dismiss toast"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast(): ToastContextValue['toast'] {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Graceful fallback if invoked outside provider
    return {
      success: (msg) => console.log('[Toast:success]', msg),
      error: (msg) => console.error('[Toast:error]', msg),
      info: (msg) => console.info('[Toast:info]', msg),
      warning: (msg) => console.warn('[Toast:warning]', msg),
    };
  }
  return ctx.toast;
}
