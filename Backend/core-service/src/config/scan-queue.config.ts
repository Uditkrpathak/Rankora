export const WORKSPACE_PRIORITY: Record<string, number> = {
  free: 1,
  trial: 2,
  starter: 5,
  pro: 10,
  agency: 10,
};

export const QUEUE_BACKPRESSURE = {
  maxGlobalDepth: 500,
  maxWorkspaceDepth: 50,
  retryAfterSeconds: 60,
};

export const GRID_POINT_TIMEOUT_MS = 12000; // 12 seconds per pin

/**
 * BullMQ processes jobs with lowest numerical priority first (1 is higher priority than 10).
 * This helper inverts business priority (where 10 = Pro/Agency) into BullMQ execution order.
 */
export function getBullMqPriority(planKey?: string): number {
  const normalized = (planKey || 'free').toLowerCase();
  const businessPriority = WORKSPACE_PRIORITY[normalized] ?? 1;
  // Map 10 -> 1, 5 -> 6, 2 -> 9, 1 -> 10
  return Math.max(1, 11 - businessPriority);
}
