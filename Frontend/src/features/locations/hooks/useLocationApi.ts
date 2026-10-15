import { useState, useCallback } from 'react';

export interface ApiToast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  action?: string;
  durationMs?: number;
}

export interface UseLocationApiReturn {
  toasts: ApiToast[];
  addToast: (toast: Omit<ApiToast, 'id'>) => void;
  removeToast: (id: string) => void;
  handleApiError: (error: any, operationName?: string) => string;
}

export function useLocationApi(): UseLocationApiReturn {
  const [toasts, setToasts] = useState<ApiToast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((toast: Omit<ApiToast, 'id'>) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newToast: ApiToast = { ...toast, id };
    setToasts((prev) => [...prev, newToast]);

    const duration = toast.durationMs || (toast.type === 'error' ? 6000 : 4000);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const handleApiError = useCallback(
    (error: any, operationName: string = 'perform action'): string => {
      let userMessage = `Failed to ${operationName}. Please try again.`;
      const status = error?.status || error?.statusCode || error?.data?.error?.statusCode;
      const errorCode = error?.data?.error?.code;
      const serverMessage = error?.data?.error?.message || error?.message;

      if (status === 404) {
        userMessage = 'Location profile not found. It may have been deleted.';
        addToast({ type: 'error', message: userMessage });
      } else if (status === 403) {
        userMessage = "You don't have permission to perform this action in this workspace.";
        addToast({ type: 'error', message: userMessage });
      } else if (status === 409 || errorCode === 'LOCATION_ALREADY_ADDED') {
        userMessage = 'This location profile has already been added to your workspace.';
        addToast({ type: 'warning', message: userMessage });
      } else if (status === 402 || errorCode === 'LOCATION_LIMIT_EXCEEDED') {
        userMessage = 'Profile limit reached on your plan. Upgrade to add more locations.';
        addToast({ type: 'warning', message: userMessage, action: 'Upgrade' });
      } else if (status === 503 || errorCode === 'QUEUE_OVERLOADED') {
        userMessage = 'System is experiencing high load. Please try again in 60 seconds.';
        addToast({ type: 'warning', message: userMessage, durationMs: 8000 });
      } else if (status === 500) {
        userMessage = 'A server error occurred. Our team has been notified. Try again later.';
        addToast({ type: 'error', message: userMessage });
      } else if (serverMessage && typeof serverMessage === 'string') {
        userMessage = serverMessage;
        addToast({ type: 'error', message: userMessage });
      } else {
        addToast({ type: 'error', message: userMessage });
      }

      return userMessage;
    },
    [addToast]
  );

  return {
    toasts,
    addToast,
    removeToast,
    handleApiError,
  };
}
