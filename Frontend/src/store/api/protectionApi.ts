import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithReauth } from './baseQueryWithReauth';

export interface IProtectionIncident {
  _id?: string;
  id?: string;
  type: 'STATUS_CLOSED' | 'PHONE_CHANGED' | 'NAME_TAMPERED' | 'HOURS_MODIFIED' | 'ADDRESS_MOVED';
  field: string;
  previousValue: string;
  currentValue: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  message: string;
  detectedAt: string;
  resolvedAt?: string;
  isResolved: boolean;
}

export interface IProtectionSnapshot {
  _id: string;
  locationId: string;
  workspaceId: string;
  placeId: string;
  status: 'SECURE' | 'DRIFT_DETECTED' | 'CRITICAL_SABOTAGE';
  lastCheckedAt: string;
  baseline: {
    name: string;
    phone?: string;
    address?: string;
    website?: string;
    businessStatus?: string;
    rating?: number;
    userRatingCount?: number;
  };
  current: {
    name: string;
    phone?: string;
    address?: string;
    website?: string;
    businessStatus?: string;
    rating?: number;
    userRatingCount?: number;
  };
  incidents: IProtectionIncident[];
}

export const protectionApi = createApi({
  reducerPath: 'protectionApi',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Protection'],
  endpoints: (builder) => ({
    getProtectionStatus: builder.query<{ success: boolean; data: IProtectionSnapshot }, { workspaceId: string; locationId: string }>({
      query: ({ workspaceId, locationId }) => `/v1/workspaces/${workspaceId}/locations/${locationId}/protection`,
      providesTags: (_result, _error, { locationId }) => [{ type: 'Protection', id: locationId }],
    }),
    checkProtection: builder.mutation<{ success: boolean; data: IProtectionSnapshot }, { workspaceId: string; locationId: string }>({
      query: ({ workspaceId, locationId }) => ({
        url: `/v1/workspaces/${workspaceId}/locations/${locationId}/protection/check`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _error, { locationId }) => [{ type: 'Protection', id: locationId }],
    }),
    resolveProtectionIncident: builder.mutation<
      { success: boolean; data: IProtectionSnapshot },
      { workspaceId: string; locationId: string; incidentId: string }
    >({
      query: ({ workspaceId, locationId, incidentId }) => ({
        url: `/v1/workspaces/${workspaceId}/locations/${locationId}/protection/incidents/${incidentId}/resolve`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _error, { locationId }) => [{ type: 'Protection', id: locationId }],
    }),
  }),
});

export const {
  useGetProtectionStatusQuery,
  useCheckProtectionMutation,
  useResolveProtectionIncidentMutation,
} = protectionApi;
