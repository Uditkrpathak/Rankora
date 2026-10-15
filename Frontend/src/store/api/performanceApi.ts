import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithReauth } from './baseQueryWithReauth';

export type GBPPerformanceMetric =
  | 'BUSINESS_IMPRESSIONS_DESKTOP_MAPS'
  | 'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH'
  | 'BUSINESS_IMPRESSIONS_MOBILE_MAPS'
  | 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH'
  | 'BUSINESS_DIRECTION_REQUESTS'
  | 'CALL_CLICKS'
  | 'WEBSITE_CLICKS'
  | 'BUSINESS_CONVERSATIONS'
  | 'BUSINESS_BOOKINGS'
  | 'BUSINESS_FOOD_ORDERS'
  | 'BUSINESS_FOOD_MENU_CLICKS';

export interface GBPPerformanceDay {
  _id: string;
  date: string;
  metrics: Partial<Record<GBPPerformanceMetric, number>>;
  source: 'GOOGLE_BUSINESS_PROFILE';
  fetchedAt: string;
}

export const performanceApi = createApi({
  reducerPath: 'performanceApi',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['GBPPerformance'],
  endpoints: (builder) => ({
    getGBPPerformance: builder.query<
      { success: boolean; data: GBPPerformanceDay[]; meta: { source: string; days: number } },
      { workspaceId: string; locationId: string; days: number }
    >({
      query: ({ workspaceId, locationId, days }) => `/v1/workspaces/${workspaceId}/locations/${locationId}/performance?days=${days}`,
      providesTags: (result, error, { locationId }) => [{ type: 'GBPPerformance', id: locationId }],
    }),
    refreshGBPPerformance: builder.mutation<
      { success: boolean; data: { days: number; fetchedAt: string; source: string; pointCount: number } },
      { workspaceId: string; locationId: string; days: number }
    >({
      query: ({ workspaceId, locationId, days }) => ({
        url: `/v1/workspaces/${workspaceId}/locations/${locationId}/performance/refresh`,
        method: 'POST',
        body: { days },
      }),
      invalidatesTags: (result, error, { locationId }) => [{ type: 'GBPPerformance', id: locationId }],
    }),
  }),
});

export const { useGetGBPPerformanceQuery, useRefreshGBPPerformanceMutation } = performanceApi;
