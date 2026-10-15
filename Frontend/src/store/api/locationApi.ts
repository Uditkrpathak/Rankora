import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithReauth } from './baseQueryWithReauth';
import { LocationAddedVia } from '@localo/types';

export interface Location {
  _id: string;
  workspaceId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode?: string;
  coordinates?: { lat: number; lng: number } | null;
  placeId?: string | null;
  gbpAccountId?: string | null;
  gbpLocationId?: string | null;
  googleConnectionId?: string | null;
  status: 'active' | 'paused' | 'archived';
  ownershipVerified?: boolean;
  addedVia?: LocationAddedVia;
  syncStatus?: 'PENDING' | 'SYNCED' | 'STANDALONE' | 'ERROR';
  gbpUrl?: string | null;
  categories: string[];
  phone?: string;
  website?: string;
  coverPhotoUrl?: string;
  logoUrl?: string;
  photosCount?: number;
  averageRating?: number | null;
  totalReviewCount?: number | null;
  mediaSyncedAt?: string | null;
  auditScore?: number | null;
  auditUnknownCount?: number | null;
  auditUpdatedAt?: string | null;
  auditRulesVersion?: string | null;
  lastSyncedAt?: string | null;
  gscSiteUrl?: string | null;
  gscConnectionStatus?: 'connected' | 'needs_reauth' | 'none';
  gscLastSyncedAt?: string | null;
  placesDetailsFetchedAt?: string | null;
  syncError?: string | null;
  auditScheduleEnabled?: boolean;
  nextAuditAt?: string | null;
  attributes?: string[];
  regularHours?: Record<string, any>;
  primaryCategory?: { id: string; displayName: string };
  secondaryCategories?: Array<{ id: string; displayName: string }>;
  recommendedTasks?: Array<{
    id: string;
    title: string;
    description: string;
    category: 'REVIEWS' | 'RATING' | 'PHOTOS' | 'POSTS' | 'PROFILE' | 'CATEGORIES';
    impact: 'HIGH' | 'MEDIUM' | 'LOW';
    priority: number;
    actionUrl?: string;
    sourceLabel?: string;
    metrics?: {
      targetValue: number | string;
      competitorMedian: number | string;
      gap?: number | string;
    };
    generatedAt: string;
  }>;
  cachedKpis?: {
    visibilityScore?: number;
    averagePosition?: number;
    areaDifficulty?: 'LOW' | 'MEDIUM' | 'HIGH';
    totalReviews?: number;
    averageRating?: number;
    lastCalculatedAt?: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateLocationInput {
  name: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode?: string;
  phone?: string;
  website?: string;
  categories?: string[];
  status?: 'active' | 'paused' | 'archived';
}

export interface PlaceSearchResult {
  placeId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode?: string;
  category?: string;
  thumbnailUrl?: string;
  coordinates?: { lat: number; lng: number };
  rating?: number;
  userRatingCount?: number;
}

export const locationApi = createApi({
  reducerPath: 'locationApi',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Locations'],
  endpoints: (builder) => ({
    listLocations: builder.query<
      { locations: Location[]; total: number; page: number; pages: number },
      { workspaceId: string; page?: number; search?: string }
    >({
      query: ({ workspaceId, page = 1, search = '' }) =>
        `/v1/workspaces/${workspaceId}/locations?page=${page}&search=${encodeURIComponent(search)}`,
      transformResponse: (res: any) => res.data,
      providesTags: ['Locations'],
    }),

    getLocation: builder.query<Location, { workspaceId: string; locId: string }>({
      query: ({ workspaceId, locId }) =>
        `/v1/workspaces/${workspaceId}/locations/${locId}`,
      transformResponse: (res: any) => res.data,
      providesTags: ['Locations'],
    }),

    createLocation: builder.mutation<
      Location,
      { workspaceId: string; body: CreateLocationInput }
    >({
      query: ({ workspaceId, body }) => ({
        url: `/v1/workspaces/${workspaceId}/locations`,
        method: 'POST',
        body,
      }),
      transformResponse: (res: any) => res.data,
      invalidatesTags: ['Locations'],
    }),

    updateLocation: builder.mutation<
      Location,
      { workspaceId: string; locId: string; body: Partial<CreateLocationInput> }
    >({
      query: ({ workspaceId, locId, body }) => ({
        url: `/v1/workspaces/${workspaceId}/locations/${locId}`,
        method: 'PATCH',
        body,
      }),
      transformResponse: (res: any) => res.data,
      invalidatesTags: ['Locations'],
    }),

    deleteLocation: builder.mutation<void, { workspaceId: string; locId?: string; locationId?: string }>({
      query: ({ workspaceId, locId, locationId }) => ({
        url: `/v1/workspaces/${workspaceId}/locations/${locId || locationId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Locations'],
    }),

    searchPlaces: builder.query<{ results: (PlaceSearchResult & { resolvedCategory?: string; categorySource?: string; categoryConfidence?: string })[] }, { workspaceId: string; q: string }>({
      query: ({ workspaceId, q }) => `/v1/workspaces/${workspaceId}/places/search?q=${encodeURIComponent(q)}`,
      transformResponse: (res: any) => res.data,
    }),

    previewKeywords: builder.query<
      {
        businessName: string;
        category: string;
        categoryKey: string;
        categorySource: string;
        confidence: string;
        needsUserConfirmation?: boolean;
        status: 'AVAILABLE' | 'CATEGORY_REQUIRED' | 'NO_SUGGESTIONS';
        message: string;
        keywords: Array<{ keyword: string; source: 'GOOGLE_AUTOCOMPLETE'; evidence: string }>;
      },
      { workspaceId: string; placeId?: string; name?: string; lat?: number; lng?: number; city?: string }
    >({
      query: ({ workspaceId, placeId = '', name = '', lat, lng, city = '' }) =>
        `/v1/workspaces/${workspaceId}/places/preview-keywords?placeId=${encodeURIComponent(placeId)}&name=${encodeURIComponent(name)}&lat=${lat ?? ''}&lng=${lng ?? ''}&city=${encodeURIComponent(city)}`,
      transformResponse: (res: any) => res.data,
    }),

    addFromPlacesSearch: builder.mutation<
      Location,
      { workspaceId: string; placeId: string; confirmedCoordinates?: { lat: number; lng: number } }
    >({
      query: ({ workspaceId, placeId, confirmedCoordinates }) => ({
        url: `/v1/workspaces/${workspaceId}/places/add`,
        method: 'POST',
        body: { placeId, confirmedCoordinates },
      }),
      transformResponse: (res: any) => res.data.location,
      invalidatesTags: ['Locations'],
    }),

    getOverview: builder.query<
      {
        counters: {
          activeProfiles: number;
          activeProfilesLimit: number;
          optimizationSlotsUsed: number;
          optimizationSlotsLimit: number;
          pinnedCount: number;
          inactiveCount: number;
        };
        locations: (Location & {
          isPinned?: boolean;
          tags?: string[];
          optimization?: { enabled: boolean; enabledAt?: string; protectionWatchdog?: boolean };
          cachedKpis?: {
            visibilityScore: number;
            averagePosition: number;
            profileViewsThisMonth: number;
            profileViewsDelta: number;
            totalReviews: number;
            averageRating: number;
            newReviewsCount: number;
            areaDifficulty?: string;
          };
          topKeywords?: Array<{
            _id: string;
            keyword: string;
            currentRank: number | null;
            visibilityScore: number;
            lastScannedAt?: string | null;
            lastProvider?: string | null;
            lastScanStatus?: string | null;
            lastScanError?: string | null;
          }>;
        })[];
        total: number;
        page: number;
        pages: number;
      },
      {
        workspaceId: string;
        page?: number;
        search?: string;
        status?: string;
        googleAccountId?: string;
        tag?: string;
        sortBy?: string;
      }
    >({
      query: ({ workspaceId, page = 1, search = '', status = '', googleAccountId = '', tag = '', sortBy = 'lastOpened' }) =>
        `/v1/workspaces/${workspaceId}/locations/overview?page=${page}&search=${encodeURIComponent(
          search
        )}&status=${status}&googleAccountId=${googleAccountId}&tag=${encodeURIComponent(tag)}&sortBy=${sortBy}`,
      transformResponse: (res: any) => res.data,
      providesTags: ['Locations'],
    }),

    getSingleLocationDashboard: builder.query<
      {
        location: Location & {
          isPinned?: boolean;
          tags?: string[];
          optimization?: { enabled: boolean; enabledAt?: string; protectionWatchdog?: boolean };
        };
        kpis: {
          visibilityScore: number;
          averagePosition: number;
          profileViewsThisMonth: number | null;
          profileViewsLastMonth: number | null;
          profileViewsDelta: number | null;
          totalReviews: number;
          averageRating: number;
          newReviewsCount: number;
          areaDifficulty?: string;
          lastCalculatedAt?: string | null;
        };
        keywordsPreview: any[];
        tasksSummary: { pending: number; highImpact: number };
        optimization: { enabled: boolean; enabledAt?: string; protectionWatchdog: boolean };
      },
      { workspaceId: string; locId: string }
    >({
      query: ({ workspaceId, locId }) => `/v1/workspaces/${workspaceId}/locations/${locId}/dashboard`,
      transformResponse: (res: any) => res.data,
      providesTags: ['Locations'],
    }),

    toggleOptimization: builder.mutation<
      Location,
      { workspaceId: string; locId: string; enabled: boolean }
    >({
      query: ({ workspaceId, locId, enabled }) => ({
        url: `/v1/workspaces/${workspaceId}/locations/${locId}/optimization`,
        method: 'PATCH',
        body: { enabled },
      }),
      transformResponse: (res: any) => res.data,
      invalidatesTags: ['Locations'],
    }),

    togglePin: builder.mutation<Location, { workspaceId: string; locId: string }>({
      query: ({ workspaceId, locId }) => ({
        url: `/v1/workspaces/${workspaceId}/locations/${locId}/pin`,
        method: 'PATCH',
      }),
      transformResponse: (res: any) => res.data,
      invalidatesTags: ['Locations'],
    }),

    generateAiDescriptionDraft: builder.mutation<
      {
        draftId: string;
        draftText: string;
        charCount: number;
        factsUsed: {
          name: string;
          city: string;
          primaryCategory?: string;
          secondaryCategories?: string[];
          phone?: string;
        };
        model: string;
        latencyMs: number;
        evidenceUsed: Array<{ key: string; source: string; observedAt: string; value: unknown; untrusted?: boolean }>;
        evidenceMissing: Array<{ key: string; reason: string; expectedSources: string[] }>;
        status: string;
      },
      { workspaceId: string; locId: string }
    >({
      query: ({ workspaceId, locId }) => ({
        url: `/v1/workspaces/${workspaceId}/locations/${locId}/ai/description-draft`,
        method: 'POST',
      }),
      transformResponse: (res: any) => res.data,
    }),

    createAiDraft: builder.mutation<any, { workspaceId: string; locId: string; kind: 'AUDIT_EXPLANATION' | 'ACTION_DRAFT' | 'GBP_POST'; auditId?: string; signalCode?: string; instruction?: string }>({
      query: ({ workspaceId, locId, ...body }) => ({ url: `/v1/workspaces/${workspaceId}/locations/${locId}/ai/drafts`, method: 'POST', body }),
      transformResponse: (res: any) => res.data,
    }),
    approveAiDraft: builder.mutation<any, { workspaceId: string; draftId: string }>({
      query: ({ workspaceId, draftId }) => ({ url: `/v1/workspaces/${workspaceId}/ai/drafts/${draftId}/approve`, method: 'POST' }),
      transformResponse: (res: any) => res.data,
    }),
    publishAiGbpPostDraft: builder.mutation<any, { workspaceId: string; draftId: string }>({
      query: ({ workspaceId, draftId }) => ({ url: `/v1/workspaces/${workspaceId}/ai/drafts/${draftId}/publish-gbp-post`, method: 'POST' }),
      transformResponse: (res: any) => res.data,
    }),

    getWorkspaceDashboardMetrics: builder.query<
      any,
      { workspaceId: string; timeframe?: '7d' | '30d' | '90d' }
    >({
      query: ({ workspaceId, timeframe = '30d' }) => ({
        url: `/v1/workspaces/${workspaceId}/locations/workspace-metrics?timeframe=${timeframe}`,
        method: 'GET',
      }),
      transformResponse: (res: any) => res.data,
      providesTags: ['Locations'],
    }),
  }),
});

export const {
  useListLocationsQuery,
  useGetOverviewQuery,
  useGetLocationQuery,
  useGetSingleLocationDashboardQuery,
  useGetWorkspaceDashboardMetricsQuery,
  useCreateLocationMutation,
  useUpdateLocationMutation,
  useDeleteLocationMutation,
  useToggleOptimizationMutation,
  useTogglePinMutation,
  useLazySearchPlacesQuery,
  usePreviewKeywordsQuery,
  useLazyPreviewKeywordsQuery,
  useAddFromPlacesSearchMutation,
  useGenerateAiDescriptionDraftMutation,
  useCreateAiDraftMutation,
  useApproveAiDraftMutation,
  usePublishAiGbpPostDraftMutation,
} = locationApi;
