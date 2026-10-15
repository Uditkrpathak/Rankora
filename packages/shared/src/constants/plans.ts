import { PlatformPlanName, PlatformRole, UserLimitOverrides, UserPermissionFlags } from '@localo/types';

export interface PlanLimits {
  keywordScanLimit: number;
  scanCreditsPerMonth: number;
  locationLimit: number;
  chatbotQuotaPerMonth: number;
  teamSeatLimit: number;
}

export interface PlanPermissions {
  canScan: boolean;
  canUseChatbot: boolean;
  canUseGeoGrid: boolean;
  canUseCompetitorMatrix: boolean;
  canExportPdf: boolean;
  canInviteTeam: boolean;
  canUseApi: boolean;
}

export interface PlanDefinition {
  id: string;
  name: PlatformPlanName;
  price: string;
  period: string;
  badge?: string;
  description: string;
  popular?: boolean;
  limits: PlanLimits;
  permissions: PlanPermissions;
  features: string[];
}

export const PLAN_DEFAULTS: Record<PlatformPlanName, PlanDefinition> = {
  'Trial': {
    id: 'trial',
    name: 'Trial',
    price: '$0',
    period: 'for 14 days',
    badge: 'CURRENT PLAN',
    description: 'Full access to all Pro features with 10 locations and 100 scan credits.',
    popular: false,
    limits: {
      keywordScanLimit: 100,
      scanCreditsPerMonth: 100,
      locationLimit: 10,
      chatbotQuotaPerMonth: 50,
      teamSeatLimit: 3,
    },
    permissions: {
      canScan: true,
      canUseChatbot: true,
      canUseGeoGrid: true,
      canUseCompetitorMatrix: true,
      canExportPdf: true,
      canInviteTeam: true,
      canUseApi: false,
    },
    features: [
      '10 Google Business Profile locations',
      '100 Geo-Grid Scan credits',
      '50 AI Assistant messages',
      'Full 17-Point Audit engine',
      '3 Team member seats',
      'Live Google Search & Maps API sync',
    ],
  },
  'Starter': {
    id: 'starter',
    name: 'Starter',
    price: '$29',
    period: '/ month',
    description: 'Ideal for single storefront businesses boosting local search rankings.',
    popular: false,
    limits: {
      keywordScanLimit: 50,
      scanCreditsPerMonth: 50,
      locationLimit: 3,
      chatbotQuotaPerMonth: 150,
      teamSeatLimit: 2,
    },
    permissions: {
      canScan: true,
      canUseChatbot: true,
      canUseGeoGrid: true,
      canUseCompetitorMatrix: false,
      canExportPdf: false,
      canInviteTeam: true,
      canUseApi: false,
    },
    features: [
      '3 Google Business Profile locations',
      '50 Geo-Grid Scan credits / mo',
      '150 AI Assistant messages / mo',
      'Automated monthly audits',
      '2 Team member seats',
      'Standard email support',
    ],
  },
  'Pro Growth': {
    id: 'pro',
    name: 'Pro Growth',
    price: '$79',
    period: '/ month',
    badge: 'MOST POPULAR',
    description: 'For growing businesses and multi-location practices dominating local 3-packs.',
    popular: true,
    limits: {
      keywordScanLimit: 300,
      scanCreditsPerMonth: 300,
      locationLimit: 15,
      chatbotQuotaPerMonth: 500,
      teamSeatLimit: 10,
    },
    permissions: {
      canScan: true,
      canUseChatbot: true,
      canUseGeoGrid: true,
      canUseCompetitorMatrix: true,
      canExportPdf: true,
      canInviteTeam: true,
      canUseApi: false,
    },
    features: [
      '15 Google Business Profile locations',
      '300 Geo-Grid Scan credits / mo',
      '500 AI Assistant messages / mo',
      '17-Point Audits on demand',
      '10 Team & Client seats',
      'Competitor benchmarking matrix',
      'Priority API sync frequency',
    ],
  },
  'Agency Scale': {
    id: 'agency',
    name: 'Agency Scale',
    price: '$199',
    period: '/ month',
    badge: 'FOR AGENCIES',
    description: 'For digital agencies managing dozens of client profiles at scale.',
    popular: false,
    limits: {
      keywordScanLimit: 1200,
      scanCreditsPerMonth: 1200,
      locationLimit: 50,
      chatbotQuotaPerMonth: 2000,
      teamSeatLimit: 50,
    },
    permissions: {
      canScan: true,
      canUseChatbot: true,
      canUseGeoGrid: true,
      canUseCompetitorMatrix: true,
      canExportPdf: true,
      canInviteTeam: true,
      canUseApi: true,
    },
    features: [
      '50+ Google Business Profile locations',
      '1,200 Geo-Grid Scan credits / mo',
      '2,000 AI Assistant messages / mo',
      'Unlimited team & client logins',
      'White-label audit PDF exports',
      'Dedicated account manager',
      'Custom Webhook & API integrations',
    ],
  },
};

/**
 * Normalizes plan name string to standard PlatformPlanName
 */
export function normalizePlanName(rawName?: string | null): PlatformPlanName {
  if (!rawName) return 'Trial';
  const lower = rawName.toLowerCase().trim();
  if (lower.includes('agency')) return 'Agency Scale';
  if (lower.includes('pro')) return 'Pro Growth';
  if (lower.includes('starter')) return 'Starter';
  return 'Trial';
}

export const EXPIRED_PLAN_BEHAVIOR: 'FALLBACK_TO_TRIAL' | 'RESTRICT' = 'FALLBACK_TO_TRIAL';

/**
 * Computes effective limits and permissions by combining plan defaults with custom admin overrides.
 * Single source of truth across Backend enforcement and Frontend display.
 */
export function getEffectiveLimits(user?: {
  planName?: string | null;
  planExpiresAt?: Date | string | null;
  limitOverrides?: UserLimitOverrides | null;
  permissions?: Partial<UserPermissionFlags> | null;
}): { limits: PlanLimits; permissions: PlanPermissions; plan: PlanDefinition; isExpired?: boolean } {
  let isExpired = false;
  if (user?.planExpiresAt) {
    const expiry = new Date(user.planExpiresAt);
    if (!isNaN(expiry.getTime()) && expiry.getTime() < Date.now()) {
      isExpired = true;
    }
  }

  let planKey = normalizePlanName(user?.planName);
  if (isExpired && EXPIRED_PLAN_BEHAVIOR === 'FALLBACK_TO_TRIAL') {
    planKey = 'Trial';
  }

  const plan = PLAN_DEFAULTS[planKey] || PLAN_DEFAULTS['Trial'];

  const overrides = user?.limitOverrides || {};
  const perms = user?.permissions || {};

  if (isExpired && EXPIRED_PLAN_BEHAVIOR === 'RESTRICT') {
    return {
      limits: {
        keywordScanLimit: 0,
        scanCreditsPerMonth: 0,
        locationLimit: 0,
        chatbotQuotaPerMonth: 0,
        teamSeatLimit: 1
      },
      permissions: {
        canScan: false,
        canUseChatbot: false,
        canUseGeoGrid: false,
        canUseCompetitorMatrix: false,
        canExportPdf: false,
        canInviteTeam: false,
        canUseApi: false
      },
      plan,
      isExpired: true
    };
  }

  const limits: PlanLimits = {
    keywordScanLimit: overrides.keywordScanLimit ?? plan.limits.keywordScanLimit,
    scanCreditsPerMonth: overrides.scanCreditsPerMonth ?? plan.limits.scanCreditsPerMonth,
    locationLimit: overrides.locationLimit ?? plan.limits.locationLimit,
    chatbotQuotaPerMonth: overrides.chatbotQuotaPerMonth ?? plan.limits.chatbotQuotaPerMonth,
    teamSeatLimit: overrides.teamSeatLimit ?? plan.limits.teamSeatLimit,
  };

  const permissions: PlanPermissions = {
    canScan: perms.canScan ?? plan.permissions.canScan,
    canUseChatbot: perms.canUseChatbot ?? plan.permissions.canUseChatbot,
    canUseGeoGrid: perms.canUseGeoGrid ?? plan.permissions.canUseGeoGrid,
    canUseCompetitorMatrix: perms.canUseCompetitorMatrix ?? plan.permissions.canUseCompetitorMatrix,
    canExportPdf: perms.canExportPdf ?? plan.permissions.canExportPdf,
    canInviteTeam: perms.canInviteTeam ?? plan.permissions.canInviteTeam,
    canUseApi: perms.canUseApi ?? plan.permissions.canUseApi,
  };

  return { limits, permissions, plan, isExpired };
}
