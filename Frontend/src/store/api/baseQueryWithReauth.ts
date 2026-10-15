import { fetchBaseQuery, BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { setAccessToken, logOut } from '../slices/authSlice';

function getCookie(name: string): string | null {
  const matches = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + '=([^;]*)'));
  return matches ? decodeURIComponent(matches[1]) : null;
}

const rawBaseUrl = (
  (import.meta as any).env?.VITE_API_BASE_URL ||
  (import.meta as any).env?.VITE_API_URL ||
  ''
).replace(/\/+$/, '');

const baseQuery = fetchBaseQuery({
  baseUrl: rawBaseUrl ? `${rawBaseUrl}/` : '/',
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
let refreshSubscribers: Array<(token: string) => void> = [];

function onTokenRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
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

      // Attempt token refresh via HttpOnly cookie
      const refreshResult = await baseQuery(
        {
          url: '/v1/auth/refresh',
          method: 'POST'
        },
        api,
        extraOptions
      );

      isRefreshing = false;

      if (refreshResult.data) {
        const data = refreshResult.data as any;
        const newAccessToken = data.data?.accessToken;
        const newCsrfToken = data.data?.csrfToken;
        api.dispatch(setAccessToken({ accessToken: newAccessToken, csrfToken: newCsrfToken }));
        onTokenRefreshed(newAccessToken);

        // Retry initial query with new token
        result = await baseQuery(args, api, extraOptions);
      } else {
        api.dispatch(logOut());
      }
    } else {
      // Queue concurrent request until refresh completes
      const retryPromise = new Promise<void>((resolve) => {
        refreshSubscribers.push(() => {
          resolve();
        });
      });
      await retryPromise;
      result = await baseQuery(args, api, extraOptions);
    }
  }

  return result;
};
