import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface UserState {
  id: string;
  email: string;
  name: string;
  platformRole?: 'SUPER_ADMIN' | 'ADMIN' | 'USER';
  mustChangePassword?: boolean;
  planName?: string;
  status: 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED' | 'DELETED' | 'PENDING_DELETION';
  isEmailVerified: boolean;
  mfaEnabled: boolean;
  avatarUrl?: string;
  lastLoginAt?: string | Date;
  hasPassword?: boolean;
}

export interface WorkspaceState {
  id: string;
  name: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  plan?: string;
  category?: string;
  targetCity?: string;
  websiteUrl?: string;
  phoneNumber?: string;
  locationCount?: string;
  primaryGoal?: string;
  gbpConnectionStatus?: 'not_started' | 'connected' | 'skipped';
  branding?: {
    logoUrl?: string;
    primaryColor?: string;
    domain?: string;
    agencyName?: string;
    category?: string;
    targetCity?: string;
    websiteUrl?: string;
    phoneNumber?: string;
    locationCount?: string;
    primaryGoal?: string;
  };
}

interface AuthState {
  user: UserState | null;
  activeWorkspace: WorkspaceState | null;
  workspaces: WorkspaceState[];
  accessToken: string | null;
  csrfToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const initialState: AuthState = {
  user: null,
  activeWorkspace: null,
  workspaces: [],
  accessToken: null,
  csrfToken: null,
  isAuthenticated: false,
  isLoading: true
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{
        user: UserState;
        activeWorkspace?: WorkspaceState;
        workspaces?: WorkspaceState[];
        accessToken?: string;
        csrfToken?: string;
      }>
    ) => {
      state.user = action.payload.user;
      if (action.payload.accessToken) {
        state.accessToken = action.payload.accessToken;
      }
      if (action.payload.csrfToken) {
        state.csrfToken = action.payload.csrfToken;
      }
      state.isAuthenticated = true;
      state.isLoading = false;
      if (action.payload.activeWorkspace) {
        state.activeWorkspace = action.payload.activeWorkspace;
      }
      if (action.payload.workspaces) {
        state.workspaces = action.payload.workspaces;
      }
    },
    setActiveWorkspace: (state, action: PayloadAction<WorkspaceState>) => {
      state.activeWorkspace = action.payload;
    },
    updateWorkspaceDetails: (state, action: PayloadAction<Partial<WorkspaceState>>) => {
      if (state.activeWorkspace) {
        state.activeWorkspace = { ...state.activeWorkspace, ...action.payload };
      }
    },
    updateUserProfile: (state, action: PayloadAction<Partial<UserState>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },
    updateUserVerified: (state) => {
      if (state.user) {
        state.user.isEmailVerified = true;
        state.user.status = 'ACTIVE';
      }
    },
    setAccessToken: (state, action: PayloadAction<string | { accessToken: string; csrfToken?: string }>) => {
      if (typeof action.payload === 'string') {
        state.accessToken = action.payload;
      } else {
        state.accessToken = action.payload.accessToken;
        if (action.payload.csrfToken) {
          state.csrfToken = action.payload.csrfToken;
        }
      }
      state.isAuthenticated = true;
      state.isLoading = false;
    },
    setCsrfToken: (state, action: PayloadAction<string>) => {
      state.csrfToken = action.payload;
    },
    logOut: (state) => {
      state.user = null;
      state.activeWorkspace = null;
      state.workspaces = [];
      state.accessToken = null;
      state.csrfToken = null;
      state.isAuthenticated = false;
      state.isLoading = false;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    }
  }
});

export const {
  setCredentials,
  setActiveWorkspace,
  updateWorkspaceDetails,
  updateUserProfile,
  updateUserVerified,
  setAccessToken,
  logOut,
  setLoading
} = authSlice.actions;
export default authSlice.reducer;
