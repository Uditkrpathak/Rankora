import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithReauth } from './baseQueryWithReauth';

export interface ChatSuggestion {
  text: string;
}

export interface ChatResponseData {
  answer: string;
  source: 'deterministic' | 'cache' | 'llm' | 'fallback' | 'blocked';
  badge: string | null;
  reply: string;
  suggestions: string[];
  intent: string;
  businessName: string;
  remainingQuota?: number;
}

export interface BusinessDossierData {
  business: {
    id: string;
    name: string;
    address: string;
    city?: string;
    state?: string;
    country?: string;
    phone?: string;
    website?: string;
    category?: string;
    categories?: string[];
    description?: string;
    totalReviewCount: number;
    averageRating: number;
    responseRate: number;
    hasSchema: boolean;
  };
  reviews: {
    total: number;
    averageRating: number;
    responseRate: number;
    unrepliedCount: number;
    sampleReviews: Array<{
      author: string;
      rating: number;
      text: string;
      date: string;
      replied: boolean;
    }>;
    sentimentSummary?: {
      positivePercent: number;
      topics: Array<{ topic: string; count: number; sentiment: string }>;
    };
  };
  rankings: {
    totalTrackedKeywords: number;
    keywords: Array<{
      keyword: string;
      currentRank?: number;
      previousRank?: number;
      volume?: number;
    }>;
  };
  competitors: Array<{
    name: string;
    rating: number;
    reviewCount: number;
  }>;
  audit?: {
    healthScore?: number;
    issuesCount?: number;
    topRecommendations?: string[];
  };
}

export const chatApi = createApi({
  reducerPath: 'chatApi',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['BusinessChat', 'BusinessDossier'],
  endpoints: (builder) => ({
    sendChatMessage: builder.mutation<
      { success: boolean; data: ChatResponseData },
      {
        workspaceId: string;
        locationId: string;
        message: string;
        conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
      }
    >({
      query: ({ workspaceId, locationId, message, conversationHistory }) => ({
        url: `/v1/workspaces/${workspaceId}/locations/${locationId}/chat`,
        method: 'POST',
        body: { message, conversationHistory },
      }),
    }),

    getBusinessDossier: builder.query<
      { success: boolean; data: BusinessDossierData },
      { workspaceId: string; locationId: string }
    >({
      query: ({ workspaceId, locationId }) => ({
        url: `/v1/workspaces/${workspaceId}/locations/${locationId}/chat/dossier`,
      }),
      providesTags: (result, error, { locationId }) => [{ type: 'BusinessDossier', id: locationId }],
    }),
  }),
});

export const {
  useSendChatMessageMutation,
  useGetBusinessDossierQuery,
} = chatApi;
