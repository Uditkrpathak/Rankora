import { fetchBaseQuery, BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { setAccessToken, logOut } from '../slices/authSlice';

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const matches = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + '=([^;]*)'));
  return matches ? decodeURIComponent(matches[1]) : null;
}

export function resolveApiBaseUrl(
  envOverrides?: { VITE_API_BASE_URL?: string; VITE_API_URL?: string },
  isBrowser: boolean = typeof window !== 'undefined'
): string {
  const metaEnv = (typeof import.meta !== 'undefined' && (import.meta as any).env) || {};
  const procEnv = (typeof process !== 'undefined' && process.env) || {};
  const raw = (
    envOverrides?.VITE_API_BASE_URL ??
    envOverrides?.VITE_API_URL ??
    metaEnv.VITE_API_BASE_URL ??
    metaEnv.VITE_API_URL ??
    procEnv.VITE_API_BASE_URL ??
    procEnv.VITE_API_URL ??
    ''
  ).replace(/\/+$/, '');

  if (raw) {
    return `${raw}/`;
  }
  return isBrowser ? '/' : 'http://localhost:5001/';
}

const baseQuery = fetchBaseQuery({
  baseUrl: resolveApiBaseUrl(),
  credentials: 'include',
  prepareHeaders: (headers, { getState }) => {
    const state = getState() as any;
    const token = state.auth?.accessToken;

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    // Attach active workspace ID
    const activeWorkspaceId = state.auth?.activeWorkspace?.id;
    if (activeWorkspaceId) {
      headers.set('X-Workspace-Id', activeWorkspaceId);
    }

    // Attach CSRF Token for state-changing requests (in-memory state or cookie fallback)
    const csrfToken = state.auth?.csrfToken || getCookie('csrfToken');
    if (csrfToken) {
      headers.set('X-CSRF-Token', csrfToken);
    }

    return headers;
  }
});

// Single-Flight Mutex to prevent refresh storms when concurrent queries receive 401
let isRefreshing = false;
let refreshSubscribers: Array<(success: boolean) => void> = [];

function notifySubscribers(success: boolean) {
  const subscribers = refreshSubscribers;
  refreshSubscribers = [];
  subscribers.forEach((cb) => {
    try {
      cb(success);
    } catch {}
  });
}

export const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions
) => {
  let result = await baseQuery(args, api, extraOptions);

  if (result.error && result.error.status === 401) {
    const errorData: any = result.error.data;
    // If session was revoked or no refresh token, logout immediately
    if (errorData?.error?.code === 'SESSION_REVOKED' || errorData?.error?.code === 'TOKEN_REPLAY_DETECTED') {
      api.dispatch(logOut());
      return result;
    }

    if (!isRefreshing) {
      isRefreshing = true;
      let refreshSucceeded = false;

      try {
        // Attempt token refresh via HttpOnly cookie
        const refreshResult = await baseQuery(
          {
            url: '/v1/auth/refresh',
            method: 'POST'
          },
          api,
          extraOptions
        );

        if (refreshResult.data) {
          const data = refreshResult.data as any;
          const newAccessToken = data.data?.tokens?.accessToken || data.data?.accessToken;
          const newCsrfToken = data.data?.tokens?.csrfToken || data.data?.csrfToken;

          if (newAccessToken) {
            api.dispatch(setAccessToken({ accessToken: newAccessToken, csrfToken: newCsrfToken }));
            refreshSucceeded = true;
          } else {
            api.dispatch(logOut());
          }
        } else {
          api.dispatch(logOut());
        }
      } catch {
        api.dispatch(logOut());
      } finally {
        isRefreshing = false;
        notifySubscribers(refreshSucceeded);
      }

      if (refreshSucceeded) {
        // Retry initial query with new token
        result = await baseQuery(args, api, extraOptions);
      }
    } else {
      // Queue concurrent request until refresh completes
      const retryPromise = new Promise<boolean>((resolve) => {
        refreshSubscribers.push((success) => {
          resolve(success);
        });
      });

      const refreshSucceeded = await retryPromise;
      if (refreshSucceeded) {
        // Retry query with newly refreshed credentials
        result = await baseQuery(args, api, extraOptions);
      }
      // If refresh failed, do NOT retry with expired credentials. Return original 401 result.
    }
  }

  return result;
};
