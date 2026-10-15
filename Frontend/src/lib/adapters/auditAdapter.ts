import { DistributionDataPoint } from '../../components/ui/charts/DistributionBarChart';

export interface RawAuditResult {
  overallScore?: number;
  score?: number;
  categories?: {
    name?: string;
    category?: string;
    score: number;
    weight?: number;
  }[];
  categoryScores?:
    | Record<string, number>
    | Array<{ category: string; score: number; name?: string }>;
}

/**
 * Transforms raw audit breakdown into standardized category bar chart data.
 */
export function adaptAuditCategoryScores(audit?: RawAuditResult | any | null): DistributionDataPoint[] {
  if (!audit) return [];

  if (audit.categories && Array.isArray(audit.categories) && audit.categories.length > 0) {
    return audit.categories.map((c: any) => ({
      label: c.name || c.category || 'Category',
      value: Math.min(100, Math.max(0, Math.round(c.score || 0))),
      total: 100,
      color:
        (c.score || 0) >= 80
          ? '#10b981'
          : (c.score || 0) >= 60
          ? '#0075F6'
          : (c.score || 0) >= 40
          ? '#f59e0b'
          : '#ef4444',
    }));
  }

  if (audit.categoryScores) {
    if (Array.isArray(audit.categoryScores)) {
      return audit.categoryScores.map((c: any) => ({
        label: c.name || c.category || 'Category',
        value: Math.min(100, Math.max(0, Math.round(c.score || 0))),
        total: 100,
        color:
          (c.score || 0) >= 80
            ? '#10b981'
            : (c.score || 0) >= 60
            ? '#0075F6'
            : (c.score || 0) >= 40
            ? '#f59e0b'
            : '#ef4444',
      }));
    }

    return Object.entries(audit.categoryScores).map(([key, score]: [string, any]) => ({
      label: key.replace(/([A-Z])/g, ' $1').trim(),
      value: Math.min(100, Math.max(0, Math.round(typeof score === 'number' ? score : score?.score || 0))),
      total: 100,
      color:
        (typeof score === 'number' ? score : score?.score || 0) >= 80
          ? '#10b981'
          : (typeof score === 'number' ? score : score?.score || 0) >= 60
          ? '#0075F6'
          : (typeof score === 'number' ? score : score?.score || 0) >= 40
          ? '#f59e0b'
          : '#ef4444',
    }));
  }

  // Fallback if only overall score is provided
  const base = audit.score ?? audit.overallScore ?? 70;
  return [
    { label: 'GBP Basics', value: Math.min(100, base + 10), color: '#10b981' },
    { label: 'Categories', value: Math.min(100, base + 5), color: '#0075F6' },
    { label: 'Photos & Media', value: Math.max(0, base - 10), color: '#f59e0b' },
    { label: 'Review Velocity', value: Math.max(0, base - 5), color: '#0075F6' },
    { label: 'Citations', value: Math.max(0, base - 15), color: '#ef4444' },
  ];
}
