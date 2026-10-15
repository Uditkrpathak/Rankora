import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithReauth } from './baseQueryWithReauth';
import { ITrackedKeyword, ITrackedKeywordSettings, IKeywordsListResponse } from '@localo/types';

export const keywordApi = createApi({
  reducerPath: 'keywordApi',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Keywords'],
  endpoints: (builder) => ({
    listKeywords: builder.query<
      IKeywordsListResponse,
      {
        workspaceId: string;
        locationId: string;
        page?: number;
        limit?: number;
        search?: string;
        sortBy?: string;
        order?: string;
      }
    >({
      query: ({
        workspaceId,
        locationId,
        page = 1,
        limit = 20,
        search = '',
        sortBy = 'visibility',
        order = 'desc',
      }) =>
        `/v1/workspaces/${workspaceId}/locations/${locationId}/keywords?page=${page}&limit=${limit}&search=${encodeURIComponent(
          search
        )}&sortBy=${sortBy}&order=${order}`,
      transformResponse: (res: any) => res.data,
      providesTags: ['Keywords'],
    }),

    bulkAddKeywords: builder.mutation<
      { inserted: ITrackedKeyword[]; duplicates: string[]; totalAdded: number },
      { workspaceId: string; locationId: string; keywords: string[] }
    >({
      query: ({ workspaceId, locationId, keywords }) => ({
        url: `/v1/workspaces/${workspaceId}/locations/${locationId}/keywords`,
        method: 'POST',
        body: { keywords },
      }),
      transformResponse: (res: any) => res.data,
      invalidatesTags: ['Keywords'],
    }),

    updateTrackedKeyword: builder.mutation<
      ITrackedKeyword,
      { workspaceId: string; locationId: string; keywordId: string; settings: ITrackedKeywordSettings }
    >({
      query: ({ workspaceId, locationId, keywordId, settings }) => ({
        url: `/v1/workspaces/${workspaceId}/locations/${locationId}/keywords/${keywordId}`,
        method: 'PATCH',
        body: settings,
      }),
      transformResponse: (res: any) => res.data,
      invalidatesTags: ['Keywords'],
    }),

    deleteKeyword: builder.mutation<
      void,
      { workspaceId: string; locationId: string; keywordId: string }
    >({
      query: ({ workspaceId, locationId, keywordId }) => ({
        url: `/v1/workspaces/${workspaceId}/locations/${locationId}/keywords/${keywordId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Keywords'],
    }),

    refreshKeyword: builder.mutation<
      { scanId: string; status: string; message: string },
      { workspaceId: string; locationId: string; keywordId: string }
    >({
      query: ({ workspaceId, locationId, keywordId }) => ({
        url: `/v1/workspaces/${workspaceId}/locations/${locationId}/keywords/${keywordId}/refresh`,
        method: 'POST',
      }),
      transformResponse: (res: any) => res.data,
      invalidatesTags: ['Keywords'],
    }),

    checkKeywordRelevance: builder.query<
      { isInformational: boolean; relevanceScore: number; warning: string | null; suggestedReplacements: string[]; category: string },
      { workspaceId: string; locationId: string; keyword: string }
    >({
      query: ({ workspaceId, locationId, keyword }) =>
        `/v1/workspaces/${workspaceId}/locations/${locationId}/keywords/probe-check?keyword=${encodeURIComponent(keyword)}`,
      transformResponse: (res: any) => res.data,
    }),

    getKeywordSuggestions: builder.query<
      {
        locationId: string;
        cached: boolean;
        sublocalities: string[];
        suggestions: Array<{
          keyword: string;
          source: 'CATEGORY_SEED' | 'AUTOCOMPLETE';
          volumeTier: 'POPULAR' | 'MEDIUM' | 'LOW';
          triggersLocalPack: boolean;
          relevanceScore: number;
          alreadyTracked: boolean;
        }>;
      },
      { workspaceId: string; locationId: string }
    >({
      query: ({ workspaceId, locationId }) =>
        `/v1/workspaces/${workspaceId}/locations/${locationId}/keyword-suggestions`,
      transformResponse: (res: any) => res.data,
      providesTags: ['Keywords'],
    }),
  }),
});

export const {
  useListKeywordsQuery,
  useBulkAddKeywordsMutation,
  useUpdateTrackedKeywordMutation,
  useDeleteKeywordMutation,
  useRefreshKeywordMutation,
  useCheckKeywordRelevanceQuery,
  useLazyCheckKeywordRelevanceQuery,
  useGetKeywordSuggestionsQuery,
} = keywordApi;
