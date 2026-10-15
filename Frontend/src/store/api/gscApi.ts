import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithReauth } from './baseQueryWithReauth';

export interface GscSite {
  siteUrl: string;
  permissionLevel: string;
}

export interface GscDailyDataPoint {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  averagePosition: number;
}

export interface GscTotals {
  clicks: number;
  impressions: number;
  ctr: number;
  averagePosition: number;
}

export interface GscPerformanceResponse {
  status: 'connected' | 'not_connected' | 'no_data_yet';
  message?: string;
  range?: '28d' | '90d';
  siteUrl?: string;
  totals?: GscTotals;
  daily?: GscDailyDataPoint[];
  dataNotes?: string;
}

export interface GscOpportunityQuery {
  query: string;
  normalizedQuery: string;
  clicks: number;
  impressions: number;
  ctr: number;
  averagePosition: number;
}

export interface GscTopQueriesResponse {
  status: 'connected' | 'not_connected' | 'no_data_yet';
  discovered: GscOpportunityQuery[];
  strikingDistance: GscOpportunityQuery[];
}

export interface GscKeywordMetricItem {
  _id: string;
  keyword: string;
  normalizedKeyword?: string;
  gscMetrics?: {
    clicks: number;
    impressions: number;
    ctr: number;
    averagePosition: number;
    lastSyncedAt: string;
  } | null;
}

export interface GscKeywordMetricsResponse {
  status: 'connected' | 'not_connected' | 'no_data_yet';
  keywords: GscKeywordMetricItem[];
}

export const gscApi = createApi({
  reducerPath: 'gscApi',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['GscSites', 'GscPerformance', 'GscOpportunities', 'GscKeywordMetrics', 'Location', 'Locations', 'Keywords'],
  endpoints: (builder) => ({
    getGscAuthUrl: builder.query<{ authUrl: string }, { workspaceId: string; linkToLocationId?: string }>({
      query: ({ workspaceId, linkToLocationId }) => ({
        url: `/v1/workspaces/${workspaceId}/google/auth-url`,
        params: {
          connectionType: 'gsc',
          ...(linkToLocationId ? { linkToLocationId } : {}),
        },
      }),
      transformResponse: (response: any) => response.data || response,
    }),

    getGscSites: builder.query<GscSite[], string>({
      query: (workspaceId) => `/v1/workspaces/${workspaceId}/gsc/sites`,
      transformResponse: (response: { success: boolean; data: { sites: GscSite[] } }) => response.data?.sites || [],
      providesTags: ['GscSites'],
    }),

    connectGscLocation: builder.mutation<
      { locationId: string; siteUrl: string; gscConnectionStatus: string },
      { workspaceId: string; locId: string; siteUrl: string }
    >({
      query: ({ workspaceId, locId, siteUrl }) => ({
        url: `/v1/workspaces/${workspaceId}/gsc/locations/${locId}/connect`,
        method: 'POST',
        body: { siteUrl },
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: ['GscPerformance', 'GscOpportunities', 'GscKeywordMetrics', 'Location', 'Locations', 'Keywords'],
    }),

    getGscPerformance: builder.query<
      GscPerformanceResponse,
      { workspaceId: string; locId: string; range?: '28d' | '90d' }
    >({
      query: ({ workspaceId, locId, range = '28d' }) =>
        `/v1/workspaces/${workspaceId}/gsc/locations/${locId}/performance?range=${range}`,
      transformResponse: (response: { success: boolean; data: GscPerformanceResponse }) => response.data,
      providesTags: (_result, _error, { locId, range }) => [
        { type: 'GscPerformance', id: `${locId}-${range || '28d'}` },
      ],
    }),

    getGscTopQueries: builder.query<GscTopQueriesResponse, { workspaceId: string; locId: string }>({
      query: ({ workspaceId, locId }) => `/v1/workspaces/${workspaceId}/gsc/locations/${locId}/top-queries`,
      transformResponse: (response: { success: boolean; data: GscTopQueriesResponse }) => response.data,
      providesTags: (_result, _error, { locId }) => [{ type: 'GscOpportunities', id: locId }],
    }),

    getGscKeywordMetrics: builder.query<GscKeywordMetricsResponse, { workspaceId: string; locId: string }>({
      query: ({ workspaceId, locId }) => `/v1/workspaces/${workspaceId}/gsc/locations/${locId}/keyword-metrics`,
      transformResponse: (response: { success: boolean; data: GscKeywordMetricsResponse }) => response.data,
      providesTags: (_result, _error, { locId }) => [{ type: 'GscKeywordMetrics', id: locId }],
    }),

    syncGscLocation: builder.mutation<
      { locationId: string; gscSiteUrl: string; lastSyncedAt: string },
      { workspaceId: string; locId: string }
    >({
      query: ({ workspaceId, locId }) => ({
        url: `/v1/workspaces/${workspaceId}/gsc/locations/${locId}/sync`,
        method: 'POST',
      }),
      transformResponse: (response: any) => response.data,
      invalidatesTags: (_result, _error, { locId }) => [
        { type: 'GscPerformance', id: `${locId}-28d` },
        { type: 'GscPerformance', id: `${locId}-90d` },
        { type: 'GscOpportunities', id: locId },
        { type: 'GscKeywordMetrics', id: locId },
        'Location',
        'Locations',
        'Keywords',
      ],
    }),
  }),
});

export const {
  useGetGscAuthUrlQuery,
  useLazyGetGscAuthUrlQuery,
  useGetGscSitesQuery,
  useLazyGetGscSitesQuery,
  useConnectGscLocationMutation,
  useGetGscPerformanceQuery,
  useGetGscTopQueriesQuery,
  useGetGscKeywordMetricsQuery,
  useSyncGscLocationMutation,
} = gscApi;
