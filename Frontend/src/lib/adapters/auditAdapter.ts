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
    return audit.categories.map((c: any) => {
      const maxScore = typeof c.maxScore === 'number' && c.maxScore > 0 ? c.maxScore : (c.weight || 100);
      const score = typeof c.score === 'number' ? c.score : 0;
      const percentage = typeof c.percentage === 'number'
        ? c.percentage
        : maxScore > 0
          ? Math.round((score / maxScore) * 100)
          : Math.min(100, Math.max(0, Math.round(score)));

      return {
        label: c.name || c.category || 'Category',
        value: Math.min(100, Math.max(0, percentage)),
        score,
        maxScore,
        total: 100,
        color:
          percentage >= 80
            ? '#10b981'
            : percentage >= 60
            ? '#2563eb'
            : percentage >= 40
            ? '#f59e0b'
            : '#ef4444',
      };
    });
  }

  if (audit.categoryScores) {
    if (Array.isArray(audit.categoryScores)) {
      return audit.categoryScores.map((c: any) => {
        const maxScore = typeof c.maxScore === 'number' && c.maxScore > 0 ? c.maxScore : 100;
        const score = typeof c.score === 'number' ? c.score : 0;
        const percentage = typeof c.percentage === 'number'
          ? c.percentage
          : maxScore > 0 && maxScore !== 100
            ? Math.round((score / maxScore) * 100)
            : Math.min(100, Math.max(0, Math.round(score)));

        return {
          label: c.name || c.category || 'Category',
          value: Math.min(100, Math.max(0, percentage)),
          score,
          maxScore,
          total: 100,
          color:
            percentage >= 80
              ? '#10b981'
              : percentage >= 60
              ? '#2563eb'
              : percentage >= 40
              ? '#f59e0b'
              : '#ef4444',
        };
      });
    }

    return Object.entries(audit.categoryScores).map(([key, score]: [string, any]) => {
      const rawScore = typeof score === 'number' ? score : score?.score || 0;
      const maxScore = typeof score?.maxScore === 'number' ? score.maxScore : 100;
      const percentage = typeof score?.percentage === 'number'
        ? score.percentage
        : maxScore > 0 && maxScore !== 100
          ? Math.round((rawScore / maxScore) * 100)
          : Math.min(100, Math.max(0, Math.round(rawScore)));

      return {
        label: key.replace(/([A-Z])/g, ' $1').trim(),
        value: Math.min(100, Math.max(0, percentage)),
        score: rawScore,
        maxScore,
        total: 100,
        color:
          percentage >= 80
            ? '#10b981'
            : percentage >= 60
            ? '#2563eb'
            : percentage >= 40
            ? '#f59e0b'
            : '#ef4444',
      };
    });
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
