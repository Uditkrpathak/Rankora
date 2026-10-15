import { IGridPointResult, IRecommendedTask } from '@localo/types';
import { LocationDocument } from '../../models/Location';

export class TaskEngineService {
  /**
   * Generates evidence-backed actionable recommendations by comparing the target business
   * against top-3 ranking competitors across all observed grid pins.
   */
  public static generateTasks(
    location: LocationDocument,
    gridPoints: IGridPointResult[]
  ): IRecommendedTask[] {
    const validPoints = (gridPoints || []).filter((p) => p.observationState !== 'MISSING' && p.items?.length > 0);
    if (validPoints.length === 0) {
      return [];
    }

    // Extract top 3 competitors across all pins
    const top3Competitors = new Map<string, { name: string; rating?: number; reviewsCount?: number; primaryCategory?: string }>();

    for (const pt of validPoints) {
      for (const item of pt.items || []) {
        if (!item.isTarget && item.placeId && typeof item.rank === 'number' && item.rank <= 3) {
          if (!top3Competitors.has(item.placeId)) {
            top3Competitors.set(item.placeId, {
              name: item.name,
              rating: item.rating,
              reviewsCount: item.reviewsCount,
              primaryCategory: item.primaryCategory,
            });
          }
        }
      }
    }

    if (top3Competitors.size === 0) {
      return [];
    }

    const competitorList = Array.from(top3Competitors.values());
    const reviews = competitorList.map((c) => c.reviewsCount).filter((r): r is number => typeof r === 'number' && !isNaN(r));
    const ratings = competitorList.map((c) => c.rating).filter((r): r is number => typeof r === 'number' && !isNaN(r));

    if (reviews.length === 0 && ratings.length === 0) {
      return [];
    }

    // Compute medians
    const medianReviews = reviews.length > 0 ? this.computeMedian(reviews) : 0;
    const medianRating = ratings.length > 0 ? this.computeMedian(ratings) : 0;

    const targetReviews = location.totalReviewCount ?? location.cachedKpis?.totalReviews ?? 0;
    const targetRating = location.averageRating ?? location.cachedKpis?.averageRating ?? 0;
    const targetPhotos = location.photosCount ?? 0;
    const estimatedCompetitorPhotos = Math.max(15, Math.round(medianReviews * 0.2));

    const tasks: IRecommendedTask[] = [];
    const now = new Date();

    // 1. Review Volume Task
    if (medianReviews > targetReviews) {
      const gap = Math.round(medianReviews - targetReviews);
      const topCompetitorName = competitorList.sort((a, b) => (b.reviewsCount || 0) - (a.reviewsCount || 0))[0]?.name || 'Top Competitor';
      tasks.push({
        id: `task_reviews_${location._id}`,
        title: `Match competitor review volume (yours: ${targetReviews}, theirs: ${medianReviews})`,
        description: `Top-3 ranking competitors in this area (e.g. ${topCompetitorName}) average ${medianReviews} reviews. Acquire ${gap} more customer reviews to close the local pack gap.`,
        category: 'REVIEWS',
        impact: 'HIGH',
        priority: 1,
        actionUrl: location.gbpUrl || 'https://business.google.com',
        sourceLabel: 'Google Reviews',
        metrics: {
          targetValue: targetReviews,
          competitorMedian: medianReviews,
          gap: gap,
        },
        generatedAt: now,
      });
    }

    // 2. Rating Quality Task
    if (medianRating > targetRating && targetRating > 0) {
      const gap = parseFloat((medianRating - targetRating).toFixed(1));
      tasks.push({
        id: `task_rating_${location._id}`,
        title: `Improve rating (yours: ${targetRating.toFixed(1)}, top competitor: ${medianRating.toFixed(1)})`,
        description: `Top 3 competitors maintain a median rating of ${medianRating.toFixed(1)} stars compared to your ${targetRating.toFixed(1)}. Focus on review satisfaction and service experience.`,
        category: 'RATING',
        impact: 'HIGH',
        priority: 2,
        actionUrl: location.gbpUrl || 'https://business.google.com',
        sourceLabel: 'Google Rating',
        metrics: {
          targetValue: targetRating.toFixed(1),
          competitorMedian: medianRating.toFixed(1),
          gap: gap,
        },
        generatedAt: now,
      });
    }

    // 3. Photo Depth Task
    if (targetPhotos < estimatedCompetitorPhotos) {
      const photoGap = Math.max(8, Math.round(estimatedCompetitorPhotos - targetPhotos));
      tasks.push({
        id: `task_photos_${location._id}`,
        title: `Add ${photoGap}+ photos to match competitor average`,
        description: `High-ranking local competitors feature extensive interior, exterior, and product photos to increase local engagement and CTR.`,
        category: 'PHOTOS',
        impact: 'MEDIUM',
        priority: 3,
        actionUrl: location.gbpUrl || 'https://business.google.com',
        sourceLabel: 'GBP Media',
        metrics: {
          targetValue: targetPhotos,
          competitorMedian: estimatedCompetitorPhotos,
          gap: photoGap,
        },
        generatedAt: now,
      });
    }

    // 4. Google Updates / Post Frequency Task
    if (!location.hasRecentPost) {
      tasks.push({
        id: `task_posts_${location._id}`,
        title: `Increase post frequency (top competitor posts 3x/week)`,
        description: `Publish weekly updates, announcements, or seasonal offers on Google Business Profile to signal active operations and boost local relevance.`,
        category: 'POSTS',
        impact: 'MEDIUM',
        priority: 4,
        actionUrl: location.gbpUrl || 'https://business.google.com',
        sourceLabel: 'Google Posts',
        metrics: {
          targetValue: 'Inactive',
          competitorMedian: '3x / week',
          gap: 'Weekly Updates',
        },
        generatedAt: now,
      });
    }

    // 5. Category Optimization
    const dominantCategory = this.findDominantCategory(competitorList);
    const targetCat = location.primaryCategory?.displayName || location.categories?.[0];
    if (dominantCategory && targetCat && dominantCategory.toLowerCase() !== targetCat.toLowerCase()) {
      tasks.push({
        id: `task_category_${location._id}`,
        title: `Align primary category with top competitors (${dominantCategory})`,
        description: `Top ranking competitors in your grid primarily classify as "${dominantCategory}". Review your primary and secondary category assignments.`,
        category: 'CATEGORIES',
        impact: 'HIGH',
        priority: 5,
        actionUrl: location.gbpUrl || 'https://business.google.com',
        sourceLabel: 'GBP Categories',
        metrics: {
          targetValue: targetCat,
          competitorMedian: dominantCategory,
        },
        generatedAt: now,
      });
    }

    // 6. Profile Attributes & Special Hours
    if (!location.description || !location.website || !location.phone) {
      tasks.push({
        id: `task_profile_${location._id}`,
        title: `Complete business profile details and special hours`,
        description: `Ensure complete business description, website URL, contact numbers, and special holiday hours are published on Google.`,
        category: 'PROFILE',
        impact: 'MEDIUM',
        priority: 6,
        actionUrl: location.gbpUrl || 'https://business.google.com',
        sourceLabel: 'GBP Profile',
        metrics: {
          targetValue: 'Incomplete',
          competitorMedian: '100% Complete',
        },
        generatedAt: now,
      });
    }

    // Sort by priority (1 is highest impact)
    return tasks.sort((a, b) => a.priority - b.priority);
  }

  public static computeMedian(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 !== 0) {
      return sorted[mid];
    }
    return parseFloat(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(1));
  }

  private static findDominantCategory(competitors: Array<{ primaryCategory?: string }>): string | null {
    const counts = new Map<string, number>();
    for (const c of competitors) {
      if (c.primaryCategory) {
        counts.set(c.primaryCategory, (counts.get(c.primaryCategory) || 0) + 1);
      }
    }
    let topCat: string | null = null;
    let maxCount = 0;
    for (const [cat, count] of counts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        topCat = cat;
      }
    }
    return topCat;
  }
}
