import { RankTrendDataPoint } from '../../components/ui/charts/RankTrendChart';

export interface RawKeywordScan {
  date?: string;
  createdAt?: string | Date;
  rank?: number;
  averageRank?: number;
  visibilityScore?: number;
  visibility?: number;
  top3Count?: number;
}

/**
 * Transforms raw scan / KPI data from RTK Query into normalized RankTrendDataPoint array.
 */
export function adaptRankTrendData(scans?: RawKeywordScan[] | null): RankTrendDataPoint[] {
  if (!scans || scans.length === 0) {
    return [];
  }

  return scans.map((scan, idx) => {
    let dateStr = `Point ${idx + 1}`;
    if (scan.date) {
      dateStr = scan.date;
    } else if (scan.createdAt) {
      const d = new Date(scan.createdAt);
      dateStr = !isNaN(d.getTime())
        ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        : `Point ${idx + 1}`;
    }

    const rank = scan.averageRank ?? scan.rank ?? 0;
    const visibility = scan.visibilityScore ?? scan.visibility ?? 0;

    return {
      date: dateStr,
      visibilityScore: visibility,
      averageRank: Number(rank.toFixed(1)),
      top3Count: scan.top3Count,
    };
  });
}
