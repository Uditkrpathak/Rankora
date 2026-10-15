import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithReauth } from './baseQueryWithReauth';
import { ICompetitor, ICompetitorBenchmark } from '@localo/types';

export const competitorApi = createApi({
  reducerPath: 'competitorApi',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Competitor'],
  endpoints: (builder) => ({
    getCompetitors: builder.query<
      { success: boolean; data: ICompetitor[] },
      { workspaceId: string; locationId: string; limit?: number }
    >({
      query: ({ workspaceId, locationId, limit }) => ({
        url: `/v1/workspaces/${workspaceId}/locations/${locationId}/competitors${limit ? `?limit=${limit}` : ''}`,
      }),
      providesTags: ['Competitor'],
    }),

    getCompetitorBenchmark: builder.query<
      { success: boolean; data: ICompetitorBenchmark },
      { workspaceId: string; locationId: string }
    >({
      query: ({ workspaceId, locationId }) => ({
        url: `/v1/workspaces/${workspaceId}/locations/${locationId}/competitors/benchmark`,
      }),
      providesTags: ['Competitor'],
    }),
  }),
});

export const {
  useGetCompetitorsQuery,
  useGetCompetitorBenchmarkQuery,
} = competitorApi;
