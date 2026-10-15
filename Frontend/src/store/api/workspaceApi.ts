import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithReauth } from './baseQueryWithReauth';

export const workspaceApi = createApi({
  reducerPath: 'workspaceApi',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Workspaces', 'Members'],
  endpoints: (builder) => ({
    getWorkspaces: builder.query<any, void>({
      query: () => '/v1/workspaces',
      providesTags: ['Workspaces']
    }),

    createWorkspace: builder.mutation<any, { name: string }>({
      query: (body) => ({
        url: '/v1/workspaces',
        method: 'POST',
        body
      }),
      invalidatesTags: ['Workspaces']
    }),

    updateWorkspace: builder.mutation<any, { workspaceId: string; name?: string; category?: string; targetCity?: string; websiteUrl?: string; locationCount?: string; primaryGoal?: string; gbpConnectionStatus?: string }>({
      query: ({ workspaceId, ...body }) => ({
        url: `/v1/workspaces/${workspaceId}`,
        method: 'PATCH',
        body
      }),
      invalidatesTags: ['Workspaces']
    }),

    getWorkspace: builder.query<any, string>({
      query: (id) => `/v1/workspaces/${id}`,
      providesTags: ['Workspaces']
    }),

    listMembers: builder.query<any, string>({
      query: (workspaceId) => `/v1/workspaces/${workspaceId}/members`,
      providesTags: ['Members']
    }),

    inviteMember: builder.mutation<any, { workspaceId: string; email: string; role: string }>({
      query: ({ workspaceId, ...body }) => ({
        url: `/v1/workspaces/${workspaceId}/invites`,
        method: 'POST',
        body
      }),
      invalidatesTags: ['Members']
    }),

    revokeInvite: builder.mutation<any, { workspaceId: string; inviteId: string }>({
      query: ({ workspaceId, inviteId }) => ({
        url: `/v1/workspaces/${workspaceId}/invites/${inviteId}`,
        method: 'DELETE'
      }),
      invalidatesTags: ['Members']
    }),

    acceptInvite: builder.mutation<any, { token: string }>({
      query: (body) => ({
        url: '/v1/workspaces/accept-invite',
        method: 'POST',
        body
      }),
      invalidatesTags: ['Workspaces']
    }),

    changeMemberRole: builder.mutation<any, { workspaceId: string; userId: string; role: string }>({
      query: ({ workspaceId, userId, role }) => ({
        url: `/v1/workspaces/${workspaceId}/members/${userId}`,
        method: 'PATCH',
        body: { role }
      }),
      invalidatesTags: ['Members']
    }),

    removeMember: builder.mutation<any, { workspaceId: string; userId: string }>({
      query: ({ workspaceId, userId }) => ({
        url: `/v1/workspaces/${workspaceId}/members/${userId}`,
        method: 'DELETE'
      }),
      invalidatesTags: ['Members']
    })
  })
});

export const {
  useGetWorkspacesQuery,
  useCreateWorkspaceMutation,
  useUpdateWorkspaceMutation,
  useGetWorkspaceQuery,
  useListMembersQuery,
  useInviteMemberMutation,
  useRevokeInviteMutation,
  useAcceptInviteMutation,
  useChangeMemberRoleMutation,
  useRemoveMemberMutation
} = workspaceApi;
