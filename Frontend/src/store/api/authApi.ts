import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithReauth } from './baseQueryWithReauth';
import { setCredentials, logOut, updateUserVerified } from '../slices/authSlice';

export const authApi = createApi({
  reducerPath: 'authApi',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['User', 'Sessions', 'Workspaces'],
  endpoints: (builder) => ({
    register: builder.mutation<any, any>({
      query: (credentials) => ({
        url: '/v1/auth/register',
        method: 'POST',
        body: credentials
      }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(setCredentials({
            user: data.data.user,
            activeWorkspace: data.data.activeWorkspace,
            accessToken: data.data.tokens.accessToken
          }));
        } catch {}
      }
    }),

    login: builder.mutation<any, any>({
      query: (credentials) => ({
        url: '/v1/auth/login',
        method: 'POST',
        body: credentials
      }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          if (!data.data.mfaRequired) {
            dispatch(setCredentials({
              user: data.data.user,
              activeWorkspace: data.data.activeWorkspace,
              accessToken: data.data.tokens.accessToken
            }));
          }
        } catch {}
      }
    }),

    googleLogin: builder.mutation<any, { idToken: string; workspaceName?: string }>({
      query: (body) => ({
        url: '/v1/auth/google',
        method: 'POST',
        body
      }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(setCredentials({
            user: data.data.user,
            activeWorkspace: data.data.activeWorkspace,
            accessToken: data.data.tokens.accessToken
          }));
        } catch {}
      }
    }),

    verifyEmail: builder.mutation<any, { token: string }>({
      query: (body) => ({
        url: '/v1/auth/verify-email',
        method: 'POST',
        body
      }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(updateUserVerified());
        } catch {}
      }
    }),

    resendVerification: builder.mutation<any, { email: string }>({
      query: (body) => ({
        url: '/v1/auth/resend-verification',
        method: 'POST',
        body
      })
    }),

    forgotPassword: builder.mutation<any, { email: string }>({
      query: (body) => ({
        url: '/v1/auth/forgot-password',
        method: 'POST',
        body
      })
    }),

    resetPassword: builder.mutation<any, { token: string; newPassword: string }>({
      query: (body) => ({
        url: '/v1/auth/reset-password',
        method: 'POST',
        body
      })
    }),

    mfaChallenge: builder.mutation<any, { mfaChallengeToken: string; code: string }>({
      query: (body) => ({
        url: '/v1/auth/mfa/challenge',
        method: 'POST',
        body
      }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(setCredentials({
            user: data.data.user,
            activeWorkspace: data.data.activeWorkspace,
            accessToken: data.data.tokens.accessToken
          }));
        } catch {}
      }
    }),

    mfaEnroll: builder.mutation<any, void>({
      query: () => ({
        url: '/v1/auth/mfa/enroll',
        method: 'POST'
      })
    }),

    mfaVerify: builder.mutation<any, { code: string }>({
      query: (body) => ({
        url: '/v1/auth/mfa/verify',
        method: 'POST',
        body
      })
    }),

    getMe: builder.query<any, void>({
      query: () => '/v1/auth/me',
      providesTags: ['User']
    }),

    listSessions: builder.query<any, void>({
      query: () => '/v1/auth/sessions',
      providesTags: ['Sessions']
    }),

    revokeSession: builder.mutation<any, string>({
      query: (familyId) => ({
        url: `/v1/auth/sessions/${familyId}`,
        method: 'DELETE'
      }),
      invalidatesTags: ['Sessions']
    }),

    getPublicConfig: builder.query<{ success: boolean; data: { devVerifyBypassEnabled: boolean } }, void>({
      query: () => '/v1/auth/public-config'
    }),

    devVerifyNow: builder.mutation<any, void>({
      query: () => ({
        url: '/v1/auth/dev/verify-now',
        method: 'POST'
      }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(updateUserVerified());
        } catch {}
      },
      invalidatesTags: ['User']
    }),

    updateMe: builder.mutation<any, { name?: string }>({
      query: (body) => ({
        url: '/v1/auth/me',
        method: 'PATCH',
        body
      }),
      invalidatesTags: ['User']
    }),

    uploadAvatar: builder.mutation<any, FormData>({
      query: (formData) => ({
        url: '/v1/auth/me/avatar',
        method: 'POST',
        body: formData
      }),
      invalidatesTags: ['User']
    }),

    requestEmailChange: builder.mutation<any, { newEmail: string; currentPassword: string }>({
      query: (body) => ({
        url: '/v1/auth/me/email/request-change',
        method: 'POST',
        body
      })
    }),

    confirmEmailChange: builder.mutation<any, { token: string }>({
      query: (body) => ({
        url: '/v1/auth/me/email/confirm-change',
        method: 'POST',
        body
      }),
      async onQueryStarted(_, { dispatch }) {
        dispatch(logOut());
      }
    }),

    changePassword: builder.mutation<any, { currentPassword: string; newPassword: string }>({
      query: (body) => ({
        url: '/v1/auth/me/password',
        method: 'POST',
        body
      })
    }),

    requestAccountDeletion: builder.mutation<any, { currentPassword: string }>({
      query: (body) => ({
        url: '/v1/auth/me/delete-request',
        method: 'POST',
        body
      }),
      invalidatesTags: ['User', 'Workspaces']
    }),

    logout: builder.mutation<any, void>({
      query: () => ({
        url: '/v1/auth/logout',
        method: 'POST'
      }),
      async onQueryStarted(_, { dispatch }) {
        dispatch(logOut());
      }
    }),

    logoutAll: builder.mutation<any, void>({
      query: () => ({
        url: '/v1/auth/logout-all',
        method: 'POST'
      }),
      async onQueryStarted(_, { dispatch }) {
        dispatch(logOut());
      }
    })
  })
});

export const {
  useRegisterMutation,
  useLoginMutation,
  useGoogleLoginMutation,
  useVerifyEmailMutation,
  useResendVerificationMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useMfaChallengeMutation,
  useMfaEnrollMutation,
  useMfaVerifyMutation,
  useGetMeQuery,
  useGetPublicConfigQuery,
  useDevVerifyNowMutation,
  useListSessionsQuery,
  useRevokeSessionMutation,
  useUpdateMeMutation,
  useUploadAvatarMutation,
  useRequestEmailChangeMutation,
  useConfirmEmailChangeMutation,
  useChangePasswordMutation,
  useRequestAccountDeletionMutation,
  useLogoutMutation,
  useLogoutAllMutation
} = authApi;
