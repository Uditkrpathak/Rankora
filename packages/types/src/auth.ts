export type UserStatus = 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED' | 'DELETED' | 'PENDING_DELETION';

export type UserRole = 'owner' | 'admin' | 'member' | 'viewer';

export type PlatformRole = 'SUPER_ADMIN' | 'ADMIN' | 'USER';

export type PlatformPlanName = 'Trial' | 'Starter' | 'Pro Growth' | 'Agency Scale';

export interface UserLimitOverrides {
  keywordScanLimit?: number | null;
  scanCreditsPerMonth?: number | null;
  locationLimit?: number | null;
  chatbotQuotaPerMonth?: number | null;
  teamSeatLimit?: number | null;
}

export interface UserUsageCounters {
  keywordsScannedThisMonth: number;
  scanCreditsUsed: number;
  chatbotUsed: number;
  locationsCount: number;
  usageResetAt: Date;
}

export interface UserPermissionFlags {
  canScan: boolean;
  canUseChatbot: boolean;
  canUseGeoGrid: boolean;
  canUseCompetitorMatrix: boolean;
  canExportPdf: boolean;
  canInviteTeam: boolean;
  canUseApi: boolean;
}

export type WorkspaceStatus = 'ACTIVE' | 'PENDING_DELETION' | 'SUSPENDED';

export type WorkspacePlan = 'free_trial' | 'starter' | 'pro' | 'agency';

export type WorkspaceGbpConnectionStatus = 'not_started' | 'connected' | 'skipped';

export type InviteStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';

export interface IUser {
  _id: string;
  email: string;
  passwordHash?: string;
  name: string;
  status: UserStatus;
  platformRole?: PlatformRole;
  mustChangePassword?: boolean;
  planName?: PlatformPlanName;
  planStartedAt?: Date;
  planExpiresAt?: Date | null;
  assignedByUserId?: string | null;
  limitOverrides?: UserLimitOverrides;
  usage?: UserUsageCounters;
  permissions?: UserPermissionFlags;
  lastLoginAt?: Date;
  createdByUserId?: string | null;
  isEmailVerified: boolean;
  emailVerificationTokenHash?: string;
  emailVerificationExpiresAt?: Date;
  passwordResetTokenHash?: string;
  passwordResetExpiresAt?: Date;
  pendingEmail?: string;
  emailChangeTokenHash?: string;
  emailChangeExpiresAt?: Date;
  deletionScheduledAt?: Date;
  googleSub?: string;
  avatarUrl?: string;
  mfaEnabled: boolean;
  argon2Version: number;
  emailSuppressed: boolean;
  sessionVersion: number;
  hasClaimedTrial?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IWorkspace {
  _id: string;
  name: string;
  ownerId: string;
  status: WorkspaceStatus;
  plan: {
    key: WorkspacePlan;
    status: 'trialing' | 'active' | 'past_due' | 'canceled';
    periodEnd: Date;
  };
  gbpConnectionStatus?: WorkspaceGbpConnectionStatus;
  trialEndsAt?: Date;
  deletionScheduledAt?: Date;
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
  limits: {
    locations: number;
    activeProfilesLimit?: number;
    optimizationSlots?: number;
    seats: number;
    scanCredits: number;
    aiCredits: number;
  };
  spendLimits?: {
    monthlyUsdCap: number;
    currentMonthSpendUsd: number;
    billingCycleStart?: Date;
    alertThresholdPercent?: number;
    alertSent?: boolean;
  };
  settings: {
    requireMfaForAdmins: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface IWorkspaceMember {
  _id: string;
  workspaceId: string;
  userId: string;
  role: UserRole;
  customPermissions?: string[];
  invitedBy?: string;
  joinedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRefreshToken {
  _id: string;
  tokenId: string;
  familyId: string;
  userId: string;
  tokenHash: string;
  parentTokenId?: string;
  replacedByTokenId?: string;
  isRevoked: boolean;
  revokedAt?: Date;
  revocationReason?: 'ROTATED' | 'REPLAY_DETECTED' | 'MANUAL_LOGOUT' | 'PASSWORD_RESET';
  userAgent?: string;
  userAgentHash?: string;
  ipAddress?: string;
  ipHash?: string;
  locationSummary?: string;
  lastUsedAt?: Date;
  expiresAt: Date;
  createdAt: Date;
}

export interface IWorkspaceInvite {
  _id: string;
  workspaceId: string;
  email: string;
  role: UserRole;
  invitedBy: string;
  tokenHash: string;
  status: InviteStatus;
  expiresAt: Date;
  acceptedAt?: Date;
  revokedAt?: Date;
  createdAt: Date;
}

export interface IMfaSecret {
  _id: string;
  userId: string;
  secretEncrypted: string;
  backupCodes: Array<{
    codeHash: string;
    isUsed: boolean;
    usedAt?: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAuditLog {
  _id: string;
  workspaceId?: string;
  actorUserId: string;
  actorRole?: PlatformRole | string;
  targetUserId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  before?: Record<string, any>;
  after?: Record<string, any>;
  ip?: string;
  userAgent?: string;
  correlationId?: string;
  createdAt: Date;
}

export interface JWTPayload {
  sub: string; // userId
  sessionVersion: number;
  type: 'access';
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
  expiresIn: number;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string;
    status: UserStatus;
    isEmailVerified: boolean;
    mfaEnabled: boolean;
    avatarUrl?: string;
  };
  activeWorkspace?: {
    id: string;
    name: string;
    role: UserRole;
    permissions: string[];
    plan: WorkspacePlan;
  };
  workspaces: Array<{
    id: string;
    name: string;
    role: UserRole;
  }>;
  tokens: {
    accessToken: string;
    csrfToken: string;
    expiresIn: number;
  };
}
