import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithReauth } from './baseQueryWithReauth';

export const adminApi = createApi({
  reducerPath: 'adminApi',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['AdminUsers', 'AdminStats', 'SuperAdminAdmins', 'SuperAdminOverview', 'SuperAdminAuditLog'],
  endpoints: (builder) => ({
    // ── Admin Endpoints (ADMIN + SUPER_ADMIN) ───────────────────
    getAdminStats: builder.query<any, void>({
      query: () => '/v1/admin/stats',
      providesTags: ['AdminStats']
    }),

    listAdminUsers: builder.query<any, { search?: string; plan?: string; status?: string; page?: number; limit?: number }>({
      query: (params) => ({
        url: '/v1/admin/users',
        params
      }),
      providesTags: ['AdminUsers']
    }),

    getAdminUserDetail: builder.query<any, string>({
      query: (id) => `/v1/admin/users/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'AdminUsers', id }]
    }),

    updateUserLimits: builder.mutation<any, { id: string; [key: string]: any }>({
      query: ({ id, ...body }) => ({
        url: `/v1/admin/users/${id}/limits`,
        method: 'PATCH',
        body
      }),
      invalidatesTags: (_result, _error, { id }) => [{ type: 'AdminUsers', id }, 'AdminStats']
    }),

    updateUserPermissions: builder.mutation<any, { id: string; [key: string]: any }>({
      query: ({ id, ...body }) => ({
        url: `/v1/admin/users/${id}/permissions`,
        method: 'PATCH',
        body
      }),
      invalidatesTags: (_result, _error, { id }) => [{ type: 'AdminUsers', id }]
    }),

    updateUserPlan: builder.mutation<any, { id: string; planName: string; planExpiresAt?: string | null }>({
      query: ({ id, ...body }) => ({
        url: `/v1/admin/users/${id}/plan`,
        method: 'PATCH',
        body
      }),
      invalidatesTags: (_result, _error, { id }) => [{ type: 'AdminUsers', id }, 'AdminStats', 'SuperAdminOverview']
    }),

    updateUserStatus: builder.mutation<any, { id: string; status: 'ACTIVE' | 'SUSPENDED' }>({
      query: ({ id, status }) => ({
        url: `/v1/admin/users/${id}/status`,
        method: 'PATCH',
        body: { status }
      }),
      invalidatesTags: (_result, _error, { id }) => [{ type: 'AdminUsers', id }, 'AdminStats']
    }),

    resetUserUsage: builder.mutation<any, string>({
      query: (id) => ({
        url: `/v1/admin/users/${id}/reset-usage`,
        method: 'POST'
      }),
      invalidatesTags: (_result, _error, id) => [{ type: 'AdminUsers', id }, 'AdminStats']
    }),

    manuallyVerifyUserEmail: builder.mutation<any, string>({
      query: (id) => ({
        url: `/v1/admin/users/${id}/verify-email`,
        method: 'POST'
      }),
      invalidatesTags: (_result, _error, id) => [{ type: 'AdminUsers', id }, 'AdminStats']
    }),

    // ── Super Admin Endpoints (SUPER_ADMIN only) ────────────────
    listAdmins: builder.query<any, void>({
      query: () => '/v1/superadmin/admins',
      providesTags: ['SuperAdminAdmins']
    }),

    createAdmin: builder.mutation<any, { name: string; email: string; tempPassword?: string; permissions?: any }>({
      query: (body) => ({
        url: '/v1/superadmin/admins',
        method: 'POST',
        body
      }),
      invalidatesTags: ['SuperAdminAdmins', 'AdminStats']
    }),

    updateAdmin: builder.mutation<any, { id: string; name?: string; status?: 'ACTIVE' | 'SUSPENDED'; permissions?: any }>({
      query: ({ id, ...body }) => ({
        url: `/v1/superadmin/admins/${id}`,
        method: 'PATCH',
        body
      }),
      invalidatesTags: ['SuperAdminAdmins']
    }),

    deleteAdmin: builder.mutation<any, string>({
      query: (id) => ({
        url: `/v1/superadmin/admins/${id}`,
        method: 'DELETE'
      }),
      invalidatesTags: ['SuperAdminAdmins', 'AdminStats']
    }),

    getAdminActivity: builder.query<any, string>({
      query: (id) => `/v1/superadmin/admins/${id}/activity`
    }),

    getSuperAdminOverview: builder.query<any, void>({
      query: () => '/v1/superadmin/overview',
      providesTags: ['SuperAdminOverview']
    }),

    getSuperAdminAuditLog: builder.query<any, { actor?: string; target?: string; action?: string; page?: number; limit?: number }>({
      query: (params) => ({
        url: '/v1/superadmin/audit-log',
        params
      }),
      providesTags: ['SuperAdminAuditLog']
    })
  })
});

export const {
  useGetAdminStatsQuery,
  useListAdminUsersQuery,
  useGetAdminUserDetailQuery,
  useUpdateUserLimitsMutation,
  useUpdateUserPermissionsMutation,
  useUpdateUserPlanMutation,
  useUpdateUserStatusMutation,
  useResetUserUsageMutation,
  useManuallyVerifyUserEmailMutation,
  useListAdminsQuery,
  useCreateAdminMutation,
  useUpdateAdminMutation,
  useDeleteAdminMutation,
  useGetAdminActivityQuery,
  useGetSuperAdminOverviewQuery,
  useGetSuperAdminAuditLogQuery
} = adminApi;
