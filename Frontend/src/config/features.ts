/**
 * Feature Flags Configuration
 * 
 * Controls visibility of features that do not yet have a working backend.
 * Never delete code; gate it behind these flags until backend is live.
 */
export const FEATURE_FLAGS = {
  /** Explore Plans / Billing checkout stub */
  ENABLE_EXPLORE_PLANS: false,
  /** Published Sites static hosting */
  ENABLE_PUBLISHED_SITES: false,
  /** GBP Reviews Inbox & AI Copilot */
  ENABLE_REVIEWS_INBOX: true,
  /** 17-Point SEO Audits Engine UI */
  ENABLE_AUDITS: true,
  /** Team & Client Management */
  ENABLE_TEAM_CLIENTS: false,
  /** Auto-Pilot Listing Protection */
  ENABLE_AUTOPILOT_SHIELD: false,
  /** AI Google Business Profile Post generator */
  ENABLE_GBP_POSTS: false,
} as const;
