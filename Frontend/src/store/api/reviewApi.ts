import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithReauth } from './baseQueryWithReauth';

export interface GoogleReview {
  reviewId: string;
  name?: string;
  reviewer?: { displayName?: string; profilePhotoUrl?: string; isAnonymous?: boolean };
  starRating?: 'ONE' | 'TWO' | 'THREE' | 'FOUR' | 'FIVE';
  numericRating?: number;
  comment?: string;
  createTime?: string;
  updateTime?: string;
  reviewReply?: { comment?: string; updateTime?: string };
}

export interface GoogleReviewsPage {
  reviews?: GoogleReview[];
  averageRating?: number;
  totalReviews?: number;
  totalReviewCount?: number;
  responseRate?: number;
  source?: 'GOOGLE_GBP_OAUTH' | 'GOOGLE_PLACES_API' | 'SERPAPI_MAPS' | 'GOOGLE_MAPS_PUBLIC_SCRAPER';
  isCached?: boolean;
  isStale?: boolean;
  lastFetchedAt?: string;
  nextPageToken?: string;
}

export interface StoredAiDraft {
  _id: string;
  draftText: string;
  kind: string;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'PUBLISHING' | 'PUBLICATION_UNCERTAIN' | 'REJECTED' | 'PUBLISHED';
  isAiGenerated: boolean;
  evidenceUsed: Array<{ key: string; source: string; observedAt: string; value: unknown; untrusted?: boolean }>;
  evidenceMissing: Array<{ key: string; reason: string; expectedSources: string[] }>;
}

export interface ReviewCopilotTone {
  title: string;
  description: string;
  replyText: string;
  targetKeywords?: string[];
}

export interface ReviewCopilotTonesResponse {
  reviewId?: string;
  reviewerName: string;
  rating: number;
  reviewText: string;
  detectedLanguage?: 'HINDI' | 'HINGLISH' | 'ENGLISH';
  languageLabel?: string;
  businessName: string;
  city: string;
  category: string;
  placeId?: string;
  googleMapsReviewUrl?: string;
  tones: {
    professional: ReviewCopilotTone;
    friendly: ReviewCopilotTone;
    seo_optimized: ReviewCopilotTone;
  };
}

// ─── Analytics types ──────────────────────────────────────────────────────────

export interface SentimentBucket {
  date: string;
  positive: number;
  negative: number;
  neutral: number;
  total: number;
  averageRating: number;
}

export interface TopicEntry {
  topic: string;
  count: number;
  examples: string[];
  sentiment: 'positive' | 'negative' | 'mixed';
}

export interface CompetitorRatingSnapshot {
  name: string;
  placeId?: string;
  rating: number;
  reviewCount: number;
  fetchedAt: string;
}

export interface ReviewAnalytics {
  sentimentTimeline: SentimentBucket[];
  topics: TopicEntry[];
  competitorBenchmarks: CompetitorRatingSnapshot[];
  calculatedAt: string;
}

// ─── Alert types ──────────────────────────────────────────────────────────────

export interface ReviewAlertConfig {
  _id?: string;
  ratingThreshold: number;
  notifyEmails: string[];
  slackWebhookUrl?: string;
  enabled: boolean;
  lastCheckedAt?: string;
}

// ─── Drip types ───────────────────────────────────────────────────────────────

export interface DripContact {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  addedAt: string;
  step1SentAt?: string;
  step2SentAt?: string;
  reviewedAt?: string;
  optedOutAt?: string;
}

export interface ReviewDripCampaign {
  _id?: string;
  campaignName: string;
  enabled: boolean;
  reviewLink: string;
  step1DelayHours: number;
  step1SubjectTemplate: string;
  step1BodyTemplate: string;
  step2DelayHours: number;
  step2SubjectTemplate: string;
  step2BodyTemplate: string;
  contacts: DripContact[];
  totalSent: number;
  totalConverted: number;
}

// ─── Bulk reply types ─────────────────────────────────────────────────────────

export interface BulkReplyResult {
  reviewId: string;
  reviewerName: string;
  rating: number;
  tone: 'professional' | 'friendly' | 'seo_optimized';
  replyText: string;
  status: 'ready' | 'skipped' | 'error';
  reason?: string;
}

export const reviewApi = createApi({
  reducerPath: 'reviewApi',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['GoogleReviews', 'ReviewAnalytics', 'ReviewAlert', 'ReviewDrip'],
  endpoints: (builder) => ({
    // ─── Existing ─────────────────────────────────────────────────────────────
    getLocationReviews: builder.query<
      { success: boolean; data: GoogleReviewsPage },
      { workspaceId: string; locationId: string; pageToken?: string; sync?: boolean }
    >({
      query: ({ workspaceId, locationId, pageToken, sync }) => {
        const params = new URLSearchParams();
        if (pageToken) params.set('pageToken', pageToken);
        if (sync) params.set('sync', 'true');
        const qs = params.toString();
        return { url: `/v1/workspaces/${workspaceId}/locations/${locationId}/reviews${qs ? `?${qs}` : ''}` };
      },
      providesTags: (result, error, { locationId }) => [{ type: 'GoogleReviews', id: locationId }],
    }),

    sendReviewReply: builder.mutation<
      { success: boolean; data: unknown },
      { workspaceId: string; locationId: string; reviewId: string; comment: string }
    >({
      query: ({ workspaceId, locationId, reviewId, comment }) => ({
        url: `/v1/workspaces/${workspaceId}/locations/${locationId}/reviews/${encodeURIComponent(reviewId)}/reply`,
        method: 'PUT',
        body: { comment },
      }),
      invalidatesTags: (result, error, { locationId }) => [{ type: 'GoogleReviews', id: locationId }],
    }),

    generateReviewCopilotTones: builder.mutation<
      { success: boolean; data: ReviewCopilotTonesResponse },
      { workspaceId: string; locationId: string; reviewText?: string; reviewerName?: string; rating?: number; reviewId?: string }
    >({
      query: ({ workspaceId, locationId, ...body }) => ({
        url: `/v1/workspaces/${workspaceId}/locations/${locationId}/reviews/generate-copilot-tones`,
        method: 'POST',
        body,
      }),
    }),

    generateAiReviewReplyDraft: builder.mutation<
      { success: boolean; data: StoredAiDraft },
      { workspaceId: string; locationId: string; reviewId: string }
    >({
      query: ({ workspaceId, locationId, reviewId }) => ({
        url: `/v1/workspaces/${workspaceId}/locations/${locationId}/ai/drafts`,
        method: 'POST',
        body: { kind: 'REVIEW_REPLY', reviewId },
      }),
    }),

    updateAiDraft: builder.mutation<
      { success: boolean; data: StoredAiDraft },
      { workspaceId: string; draftId: string; draftText: string }
    >({
      query: ({ workspaceId, draftId, draftText }) => ({
        url: `/v1/workspaces/${workspaceId}/ai/drafts/${draftId}`,
        method: 'PATCH',
        body: { draftText },
      }),
    }),

    approveAiDraft: builder.mutation<{ success: boolean; data: StoredAiDraft }, { workspaceId: string; draftId: string }>({
      query: ({ workspaceId, draftId }) => ({ url: `/v1/workspaces/${workspaceId}/ai/drafts/${draftId}/approve`, method: 'POST' }),
    }),

    rejectAiDraft: builder.mutation<{ success: boolean; data: StoredAiDraft }, { workspaceId: string; draftId: string }>({
      query: ({ workspaceId, draftId }) => ({ url: `/v1/workspaces/${workspaceId}/ai/drafts/${draftId}/reject`, method: 'POST' }),
    }),

    publishApprovedAiReviewReply: builder.mutation<
      { success: boolean; data: unknown },
      { workspaceId: string; locationId: string; draftId: string }
    >({
      query: ({ workspaceId, locationId, draftId }) => ({
        url: `/v1/workspaces/${workspaceId}/ai/drafts/${draftId}/publish-review-reply`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, { locationId }) => [{ type: 'GoogleReviews', id: locationId }],
    }),

    // ─── Analytics ────────────────────────────────────────────────────────────
    getReviewAnalytics: builder.query<
      { success: boolean; data: ReviewAnalytics },
      { workspaceId: string; locationId: string; refresh?: boolean }
    >({
      query: ({ workspaceId, locationId, refresh }) =>
        `/v1/workspaces/${workspaceId}/locations/${locationId}/reviews/analytics${refresh ? '?refresh=true' : ''}`,
      providesTags: (result, error, { locationId }) => [{ type: 'ReviewAnalytics', id: locationId }],
    }),

    // ─── Alerts ───────────────────────────────────────────────────────────────
    getReviewAlert: builder.query<
      { success: boolean; data: ReviewAlertConfig | null },
      { workspaceId: string; locationId: string }
    >({
      query: ({ workspaceId, locationId }) => `/v1/workspaces/${workspaceId}/locations/${locationId}/reviews/alerts`,
      providesTags: (result, error, { locationId }) => [{ type: 'ReviewAlert', id: locationId }],
    }),

    upsertReviewAlert: builder.mutation<
      { success: boolean; data: ReviewAlertConfig },
      { workspaceId: string; locationId: string } & ReviewAlertConfig
    >({
      query: ({ workspaceId, locationId, ...body }) => ({
        url: `/v1/workspaces/${workspaceId}/locations/${locationId}/reviews/alerts`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (result, error, { locationId }) => [{ type: 'ReviewAlert', id: locationId }],
    }),

    deleteReviewAlert: builder.mutation<{ success: boolean }, { workspaceId: string; locationId: string }>({
      query: ({ workspaceId, locationId }) => ({
        url: `/v1/workspaces/${workspaceId}/locations/${locationId}/reviews/alerts`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, { locationId }) => [{ type: 'ReviewAlert', id: locationId }],
    }),

    triggerAlertCheck: builder.mutation<
      { success: boolean; data: { newAlertsFired: number } },
      { workspaceId: string; locationId: string }
    >({
      query: ({ workspaceId, locationId }) => ({
        url: `/v1/workspaces/${workspaceId}/locations/${locationId}/reviews/alerts/check`,
        method: 'POST',
      }),
    }),

    // ─── Drip campaigns ───────────────────────────────────────────────────────
    getReviewDrip: builder.query<
      { success: boolean; data: ReviewDripCampaign | null },
      { workspaceId: string; locationId: string }
    >({
      query: ({ workspaceId, locationId }) => `/v1/workspaces/${workspaceId}/locations/${locationId}/reviews/drip`,
      providesTags: (result, error, { locationId }) => [{ type: 'ReviewDrip', id: locationId }],
    }),

    upsertReviewDrip: builder.mutation<
      { success: boolean; data: ReviewDripCampaign },
      { workspaceId: string; locationId: string; [key: string]: any }
    >({
      query: ({ workspaceId, locationId, ...body }) => ({
        url: `/v1/workspaces/${workspaceId}/locations/${locationId}/reviews/drip`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (result, error, { locationId }) => [{ type: 'ReviewDrip', id: locationId }],
    }),

    addDripContacts: builder.mutation<
      { success: boolean; data: ReviewDripCampaign },
      { workspaceId: string; locationId: string; contacts: Array<{ name: string; email?: string; phone?: string }> }
    >({
      query: ({ workspaceId, locationId, contacts }) => ({
        url: `/v1/workspaces/${workspaceId}/locations/${locationId}/reviews/drip/contacts`,
        method: 'POST',
        body: { contacts },
      }),
      invalidatesTags: (result, error, { locationId }) => [{ type: 'ReviewDrip', id: locationId }],
    }),

    sendTestDripEmail: builder.mutation<
      { success: boolean; data: { sent: boolean } },
      { workspaceId: string; locationId: string; email: string; name: string }
    >({
      query: ({ workspaceId, locationId, email, name }) => ({
        url: `/v1/workspaces/${workspaceId}/locations/${locationId}/reviews/drip/test-email`,
        method: 'POST',
        body: { email, name },
      }),
    }),

    markContactReviewed: builder.mutation<
      { success: boolean },
      { workspaceId: string; locationId: string; contactId: string }
    >({
      query: ({ workspaceId, locationId, contactId }) => ({
        url: `/v1/workspaces/${workspaceId}/locations/${locationId}/reviews/drip/contacts/${contactId}/reviewed`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, { locationId }) => [{ type: 'ReviewDrip', id: locationId }],
    }),

    optOutContact: builder.mutation<{ success: boolean }, { workspaceId: string; locationId: string; contactId: string }>({
      query: ({ workspaceId, locationId, contactId }) => ({
        url: `/v1/workspaces/${workspaceId}/locations/${locationId}/reviews/drip/contacts/${contactId}/optout`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, { locationId }) => [{ type: 'ReviewDrip', id: locationId }],
    }),

    // ─── Bulk AI reply ────────────────────────────────────────────────────────
    generateBulkReplies: builder.mutation<
      { success: boolean; data: { results: BulkReplyResult[]; skipped: number } },
      { workspaceId: string; locationId: string; tone?: 'professional' | 'friendly' | 'seo_optimized'; maxBatch?: number }
    >({
      query: ({ workspaceId, locationId, tone = 'professional', maxBatch = 20 }) => ({
        url: `/v1/workspaces/${workspaceId}/locations/${locationId}/reviews/bulk-reply`,
        method: 'POST',
        body: { tone, maxBatch },
      }),
    }),
  }),
});

export const {
  useGetLocationReviewsQuery,
  useSendReviewReplyMutation,
  useGenerateReviewCopilotTonesMutation,
  useGenerateAiReviewReplyDraftMutation,
  useUpdateAiDraftMutation,
  useApproveAiDraftMutation,
  useRejectAiDraftMutation,
  usePublishApprovedAiReviewReplyMutation,
  // New
  useGetReviewAnalyticsQuery,
  useGetReviewAlertQuery,
  useUpsertReviewAlertMutation,
  useDeleteReviewAlertMutation,
  useTriggerAlertCheckMutation,
  useGetReviewDripQuery,
  useUpsertReviewDripMutation,
  useAddDripContactsMutation,
  useSendTestDripEmailMutation,
  useMarkContactReviewedMutation,
  useOptOutContactMutation,
  useGenerateBulkRepliesMutation,
} = reviewApi;
