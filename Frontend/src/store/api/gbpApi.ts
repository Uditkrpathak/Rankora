import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithReauth } from './baseQueryWithReauth';
import { IGbpDiscoveredLocation } from '@localo/types';
import { Location } from './locationApi';

export interface GbpAccount {
  _id: string;
  googleEmail: string;
  googleAccountId: string;
  status: string;
  lastSyncedAt?: string;
}

export interface GbpStatusResponse {
  isConnected: boolean;
  googleEmail?: string;
  status?: 'CONNECTED' | 'EXPIRED' | 'REVOKED' | 'NOT_CONNECTED';
  lastSyncedAt?: string;
  lastRefreshError?: string;
  accounts?: GbpAccount[];
}

export interface BatchImportResponse {
  imported: Location[];
  skipped: Array<{
    placeId?: string | null;
    locationName: string;
    reason: 'QUOTA_EXCEEDED' | 'ALREADY_EXISTS' | string;
  }>;
}

export const gbpApi = createApi({
  reducerPath: 'gbpApi',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['GbpStatus', 'DiscoveredLocations', 'Location', 'Locations'],
  endpoints: (builder) => ({
    getGoogleAuthUrl: builder.query<
      { authUrl: string },
      string | { workspaceId: string; linkToLocationId?: string }
    >({
      query: (arg) => {
        const workspaceId = typeof arg === 'string' ? arg : arg.workspaceId;
        const linkToLocationId = typeof arg === 'object' ? arg.linkToLocationId : undefined;
        return {
          url: `/v1/workspaces/${workspaceId}/google/auth-url`,
          params: linkToLocationId ? { linkToLocationId } : undefined,
        };
      },
      transformResponse: (response: any) => response.data || response,
    }),

    getGoogleStatus: builder.query<GbpStatusResponse, string>({
      query: (workspaceId) => `/v1/workspaces/${workspaceId}/google/status`,
      transformResponse: (response: { data: GbpStatusResponse }) => response.data,
      providesTags: ['GbpStatus'],
    }),

    getConnectedAccounts: builder.query<GbpAccount[], string>({
      query: (workspaceId) => `/v1/workspaces/${workspaceId}/google/accounts`,
      transformResponse: (response: { data: { accounts: GbpAccount[] } }) => response.data.accounts,
      providesTags: ['GbpStatus'],
    }),

    connectGoogle: builder.mutation<GbpStatusResponse, { workspaceId: string; code: string; state: string }>({
      query: ({ workspaceId, code, state }) => ({
        url: `/v1/workspaces/${workspaceId}/google/callback`,
        method: 'POST',
        body: { code, state },
      }),
      invalidatesTags: ['GbpStatus', 'DiscoveredLocations', 'Location', 'Locations'],
    }),

    disconnectGoogle: builder.mutation<{ isConnected: boolean }, { workspaceId: string; email?: string }>({
      query: ({ workspaceId, email }) => ({
        url: `/v1/workspaces/${workspaceId}/google/disconnect`,
        method: 'DELETE',
        body: email ? { email } : undefined,
      }),
      invalidatesTags: ['GbpStatus', 'DiscoveredLocations', 'Location', 'Locations'],
    }),

    getDiscoveredLocations: builder.query<IGbpDiscoveredLocation[], string>({
      query: (workspaceId) => `/v1/workspaces/${workspaceId}/google/discovered-locations`,
      transformResponse: (response: { data: { locations: IGbpDiscoveredLocation[] } }) => response.data.locations,
      providesTags: ['DiscoveredLocations'],
    }),

    importLocation: builder.mutation<Location, { workspaceId: string; body: IGbpDiscoveredLocation }>({
      query: ({ workspaceId, body }) => ({
        url: `/v1/workspaces/${workspaceId}/google/import`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['DiscoveredLocations', 'Location', 'Locations'],
    }),

    batchImportLocations: builder.mutation<BatchImportResponse, { workspaceId: string; locations: IGbpDiscoveredLocation[] }>({
      query: ({ workspaceId, locations }) => ({
        url: `/v1/workspaces/${workspaceId}/google/accounts/batch-import`,
        method: 'POST',
        body: { locations },
      }),
      transformResponse: (response: { data: BatchImportResponse }) => response.data,
      invalidatesTags: ['DiscoveredLocations', 'Location', 'Locations'],
    }),

    syncLocation: builder.mutation<Location, { workspaceId: string; locId: string }>({
      query: ({ workspaceId, locId }) => ({
        url: `/v1/workspaces/${workspaceId}/locations/${locId}/sync`,
        method: 'POST',
      }),
      invalidatesTags: ['Location', 'Locations'],
    }),
  }),
});

export const {
  useGetGoogleAuthUrlQuery,
  useLazyGetGoogleAuthUrlQuery,
  useGetGoogleStatusQuery,
  useGetConnectedAccountsQuery,
  useConnectGoogleMutation,
  useDisconnectGoogleMutation,
  useGetDiscoveredLocationsQuery,
  useImportLocationMutation,
  useBatchImportLocationsMutation,
  useSyncLocationMutation,
} = gbpApi;
