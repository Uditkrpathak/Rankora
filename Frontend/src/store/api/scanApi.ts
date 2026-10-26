import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithReauth } from './baseQueryWithReauth';
import { IScanRun } from '@localo/types';
import { keywordApi } from './keywordApi';
import { locationApi } from './locationApi';

export const scanApi = createApi({
  reducerPath: 'scanApi',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Scan'],
  endpoints: (builder) => ({
    getScanConfig: builder.query<{
      success: boolean;
      data: {
        gridSizes: number[];
        defaultGridSize: number;
        minRadiusKm: number;
        maxRadiusKm: number;
        radiusStepKm: number;
        defaultRadiusKm: number;
        staleAfterMs: number;
        partialReuseMs: number;
        failedReuseMs: number;
        stalledAfterMs: number;
        maxRank: number;
        notFoundRank: number;
        top3Threshold: number;
        top10Threshold: number;
        pollingIntervalMs: number;
        maxTrackedKeywords: number;
        scanCreditsByGridSize: Record<string, number>;
        defaultScanShape: 'GRID' | 'SUNFLOWER';
        defaultSunflowerRadiusKm: number;
        scanShapes: {
          SUNFLOWER: { pointCount: number; providerSearchCount: number; creditCost: number; defaultRadiusKm: number };
          GRID?: { pointCount?: number; creditCost?: number };
        };
      };
    }, { workspaceId: string }>({
      query: ({ workspaceId }) => ({ url: `/v1/workspaces/${workspaceId}/scans/config` }),
    }),

    triggerScan: builder.mutation<
      { success: boolean; data: IScanRun },
      {
        workspaceId: string;
        locationId: string;
        keyword: string;
        gridSize?: number;
        scanShape?: 'GRID' | 'SUNFLOWER';
        force?: boolean;
        radiusKm?: number;
        center?: { lat: number; lng: number };
        localization?: { hl?: string; gl?: string; device?: 'DESKTOP' | 'MOBILE' };
      }
    >({
      query: ({ workspaceId, locationId, ...body }) => ({
        url: `/v1/workspaces/${workspaceId}/locations/${locationId}/scans`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Scan'],
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(keywordApi.util.invalidateTags(['Keywords']));
          dispatch(locationApi.util.invalidateTags(['Locations']));
        } catch {}
      },
    }),

    getLocationScans: builder.query<
      { success: boolean; data: IScanRun[] },
      { workspaceId: string; locationId: string; limit?: number }
    >({
      query: ({ workspaceId, locationId, limit }) => ({
        url: `/v1/workspaces/${workspaceId}/locations/${locationId}/scans${limit ? `?limit=${limit}` : ''}`,
      }),
      providesTags: ['Scan'],
    }),

    getScanById: builder.query<
      { success: boolean; data: IScanRun },
      { workspaceId: string; scanId: string }
    >({
      query: ({ workspaceId, scanId }) => ({
        url: `/v1/workspaces/${workspaceId}/scans/${scanId}`,
      }),
      providesTags: (result, error, { scanId }) => [{ type: 'Scan', id: scanId }],
    }),

    getLocationScanHistory: builder.query<
      { success: boolean; data: IScanRun[] },
      { workspaceId: string; locationId: string; keyword?: string }
    >({
      query: ({ workspaceId, locationId, keyword }) => ({
        url: `/v1/workspaces/${workspaceId}/locations/${locationId}/scans/history${keyword ? `?keyword=${encodeURIComponent(keyword)}` : ''}`,
      }),
      providesTags: ['Scan'],
    }),

    shareScan: builder.mutation<
      {
        success: boolean;
        data: {
          scanId: string;
          shareToken: string;
          isPublicShareable: boolean;
          agencyBranding?: {
            agencyName?: string;
            logoUrl?: string;
            primaryColor?: string;
            contactEmail?: string;
            websiteUrl?: string;
            notes?: string;
          };
          shareUrl: string;
        };
      },
      {
        workspaceId: string;
        locationId?: string;
        scanId: string;
        isPublic?: boolean;
        branding?: {
          agencyName?: string;
          logoUrl?: string;
          primaryColor?: string;
          contactEmail?: string;
          websiteUrl?: string;
          notes?: string;
        };
      }
    >({
      query: ({ workspaceId, scanId, ...body }) => ({
        url: `/v1/workspaces/${workspaceId}/scans/${scanId}/share`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (result, error, { scanId }) => [{ type: 'Scan', id: scanId }, 'Scan'],
    }),

    getPublicScan: builder.query<
      {
        success: boolean;
        data: {
          scan: IScanRun & {
            agencyBranding?: {
              agencyName?: string;
              logoUrl?: string;
              primaryColor?: string;
              contactEmail?: string;
              websiteUrl?: string;
              notes?: string;
            };
          };
          location: {
            name: string;
            address?: string;
            coordinates: { lat: number; lng: number };
            country?: string;
            website?: string;
            primaryCategory?: string;
            placeId?: string;
            rating?: number;
            reviewsCount?: number;
          };
        };
      },
      { shareToken: string }
    >({
      query: ({ shareToken }) => ({
        url: `/v1/public/scans/${shareToken}`,
      }),
    }),
  }),
});

export const {
  useGetScanConfigQuery,
  useTriggerScanMutation,
  useGetLocationScansQuery,
  useGetScanByIdQuery,
  useLazyGetScanByIdQuery,
  useGetLocationScanHistoryQuery,
  useShareScanMutation,
  useGetPublicScanQuery,
} = scanApi;
