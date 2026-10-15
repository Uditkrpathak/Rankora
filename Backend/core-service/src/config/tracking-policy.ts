/**
 * Canonical Tracking Policy & Plan Definitions (§S14 Cost Model)
 * Defines monthly request volumes per business based on grid size, keyword count, and scan frequencies.
 */

export interface PlanTrackingPolicy {
  planName: string;
  keywordsPerBusiness: number;
  gridSize: number; // 3 = 3x3 (9 points), 5 = 5x5 (25 points), 7 = 7x7 (49 points)
  pointsPerScan: number;
  scansPerMonth: number; // 4 weekly scans + 1 on-demand on average
  requestsPerBusinessPerMonth: number;
}

export const TRACKING_PLANS: Record<string, PlanTrackingPolicy> = {
  starter: {
    planName: 'Starter Plan',
    keywordsPerBusiness: 3,
    gridSize: 3,
    pointsPerScan: 9,
    scansPerMonth: 5,
    requestsPerBusinessPerMonth: 3 * 9 * 5, // 135 requests/mo
  },
  pro: {
    planName: 'Pro Plan',
    keywordsPerBusiness: 10,
    gridSize: 5,
    pointsPerScan: 25,
    scansPerMonth: 5,
    requestsPerBusinessPerMonth: 10 * 25 * 5, // 1,250 requests/mo
  },
  agency: {
    planName: 'Agency Plan',
    keywordsPerBusiness: 25,
    gridSize: 7,
    pointsPerScan: 49,
    scansPerMonth: 5,
    requestsPerBusinessPerMonth: 25 * 49 * 5, // 6,125 requests/mo
  },
  blendedDefault: {
    planName: 'Blended 10,000 Scale Baseline (60% Starter / 35% Pro / 5% Agency)',
    keywordsPerBusiness: 6,
    gridSize: 5,
    pointsPerScan: 25,
    scansPerMonth: 5,
    // (0.60 * 135) + (0.35 * 1250) + (0.05 * 6125) = 81 + 437.5 + 306.25 = 824.75 reqs/mo
    requestsPerBusinessPerMonth: 825,
  },
};

/**
 * Computes monthly operating cost per business based on measured wire bytes,
 * provider cost per GB, and residential/datacenter tier ratios.
 */
export function computeMonthlyCostPerBusiness(params: {
  measuredWireBytesPerRequest: number;
  datacenterCostPerGbUsd: number;
  residentialCostPerGbUsd: number;
  datacenterRatio?: number; // default 0.70
  residentialRatio?: number; // default 0.30
  dedupSavingsRatio?: number; // default 0.00 (raw) or cache savings
  planKey?: keyof typeof TRACKING_PLANS;
}) {
  const plan = TRACKING_PLANS[params.planKey || 'blendedDefault'];
  const dcRatio = params.datacenterRatio ?? 0.70;
  const resRatio = params.residentialRatio ?? 0.30;
  const dedup = params.dedupSavingsRatio ?? 0.0;

  const effectiveRequestsPerMonth = plan.requestsPerBusinessPerMonth * (1 - dedup);
  const bytesPerRequest = params.measuredWireBytesPerRequest;
  const totalMonthlyBytes = effectiveRequestsPerMonth * bytesPerRequest;
  const totalMonthlyGb = totalMonthlyBytes / (1024 * 1024 * 1024);

  const dcGb = totalMonthlyGb * dcRatio;
  const resGb = totalMonthlyGb * resRatio;

  const dcCostUsd = dcGb * params.datacenterCostPerGbUsd;
  const resCostUsd = resGb * params.residentialCostPerGbUsd;
  const totalCostUsd = dcCostUsd + resCostUsd;

  return {
    planName: plan.planName,
    rawRequestsPerMonth: plan.requestsPerBusinessPerMonth,
    effectiveRequestsPerMonth: Math.round(effectiveRequestsPerMonth),
    measuredWireBytesPerRequest: bytesPerRequest,
    totalMonthlyGb,
    monthlyCostPerBusinessUsd: totalCostUsd,
    monthlyCostFor10kBusinessesUsd: totalCostUsd * 10000,
    costPer1kRequestsUsd: (totalCostUsd / effectiveRequestsPerMonth) * 1000,
  };
}
