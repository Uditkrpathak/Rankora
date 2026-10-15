import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithReauth } from './baseQueryWithReauth';
import { IAuditRun, IAuditTask } from '@localo/types';

export const auditApi = createApi({
  reducerPath: 'auditApi',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Audit', 'AuditTask'],
  endpoints: (builder) => ({
    runAudit: builder.mutation<
      { success: boolean; data: IAuditRun },
      { workspaceId: string; locationId: string }
    >({
      query: ({ workspaceId, locationId }) => ({
        url: `/v1/workspaces/${workspaceId}/locations/${locationId}/audits`,
        method: 'POST',
      }),
      invalidatesTags: ['Audit', 'AuditTask'],
    }),

    getLocationAudits: builder.query<
      { success: boolean; data: IAuditRun[] },
      { workspaceId: string; locationId: string; limit?: number }
    >({
      query: ({ workspaceId, locationId, limit }) => ({
        url: `/v1/workspaces/${workspaceId}/locations/${locationId}/audits${limit ? `?limit=${limit}` : ''}`,
      }),
      providesTags: ['Audit'],
    }),

    getAuditById: builder.query<
      { success: boolean; data: IAuditRun },
      { workspaceId: string; auditId: string }
    >({
      query: ({ workspaceId, auditId }) => ({
        url: `/v1/workspaces/${workspaceId}/audits/${auditId}`,
      }),
      providesTags: (result, error, { auditId }) => [{ type: 'Audit', id: auditId }],
    }),

    recalculateAudit: builder.mutation<
      { success: boolean; data: IAuditRun },
      { workspaceId: string; locationId: string; auditId: string }
    >({
      query: ({ workspaceId, locationId, auditId }) => ({
        url: `/v1/workspaces/${workspaceId}/locations/${locationId}/audits/${auditId}/recalculate`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, { auditId }) => [{ type: 'Audit', id: auditId }, 'Audit', 'AuditTask'],
    }),

    getLocationAuditTasks: builder.query<
      { success: boolean; data: IAuditTask[] },
      { workspaceId: string; locationId: string }
    >({
      query: ({ workspaceId, locationId }) => ({ url: `/v1/workspaces/${workspaceId}/locations/${locationId}/audit-tasks` }),
      providesTags: ['AuditTask'],
    }),

    updateAuditTaskStatus: builder.mutation<
      { success: boolean; data: IAuditTask },
      { workspaceId: string; taskId: string; status: 'OPEN' | 'PENDING_VERIFICATION' | 'DONE' | 'VERIFIED' | 'DISMISSED' }
    >({
      query: ({ workspaceId, taskId, status }) => ({
        url: `/v1/workspaces/${workspaceId}/audit-tasks/${taskId}`,
        method: 'PATCH',
        body: { status },
      }),
      invalidatesTags: ['AuditTask'],
    }),

    setLocationAuditSchedule: builder.mutation<
      { success: boolean; data: { enabled: boolean; nextAuditAt: string | null } },
      { workspaceId: string; locationId: string; enabled: boolean }
    >({
      query: ({ workspaceId, locationId, enabled }) => ({
        url: `/v1/workspaces/${workspaceId}/locations/${locationId}/audit-schedule`,
        method: 'PATCH',
        body: { enabled },
      }),
    }),
  }),
});

export const {
  useRunAuditMutation,
  useGetLocationAuditsQuery,
  useLazyGetLocationAuditsQuery,
  useGetAuditByIdQuery,
  useRecalculateAuditMutation,
  useGetLocationAuditTasksQuery,
  useUpdateAuditTaskStatusMutation,
  useSetLocationAuditScheduleMutation,
} = auditApi;
