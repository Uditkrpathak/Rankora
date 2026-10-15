import { Location } from '../../models/Location';
import { ReviewCache } from '../../models/ReviewCache';
import { ReviewAnalyticsSnapshot } from '../../models/ReviewAnalyticsSnapshot';
import { TrackedKeyword } from '../../models/TrackedKeyword';
import { Competitor } from '../../models/Competitor';
import { Audit } from '../../models/Audit';
import { BusinessDossier } from './chat.types';

export class BusinessContextService {
  /**
   * Aggregates all live facts about a business location across reviews,
   * GBP profile, rankings, competitors, and audits into a unified dossier.
   */
  public async getBusinessDossier(workspaceId: string, locationId: string): Promise<BusinessDossier | null> {
    const location = await Location.findOne({
      _id: locationId,
      workspaceId,
      deletedAt: null,
    }).lean();

    if (!location) return null;

    // 1. Reviews & Sentiment
    const reviewCache = await ReviewCache.findOne({ workspaceId, locationId }).lean();
    const analytics = await ReviewAnalyticsSnapshot.findOne({ workspaceId, locationId }).lean();

    const rawReviews = reviewCache?.reviews || [];
    const unrepliedCount = rawReviews.filter((r) => !r.reviewReply?.comment).length;

    const sampleReviews = rawReviews.slice(0, 8).map((r) => ({
      author: r.reviewer?.displayName || 'Customer',
      rating: r.numericRating || 5,
      text: r.comment || '(No written text)',
      date: r.createTime ? r.createTime.slice(0, 10) : 'Recent',
      replied: Boolean(r.reviewReply?.comment),
    }));

    let positivePercent = 100;
    if (analytics?.sentimentTimeline?.length) {
      const latest = analytics.sentimentTimeline[analytics.sentimentTimeline.length - 1];
      if (latest && latest.total > 0) {
        positivePercent = Math.round((latest.positive / latest.total) * 100);
      }
    }

    // 2. Tracked Keywords & Rankings
    const keywords = await TrackedKeyword.find({
      workspaceId,
      locationId,
      deletedAt: null,
    })
      .sort({ updatedAt: -1 })
      .limit(10)
      .lean();

    const formattedKeywords = keywords.map((k) => ({
      keyword: k.keyword,
      currentRank: k.currentRank ?? (k as any).latestRank ?? undefined,
      previousRank: k.previousRank ?? undefined,
      volume: k.monthlySearchVolume ?? undefined,
    }));

    // 3. Competitors
    const competitors = await Competitor.find({
      workspaceId,
      locationId,
      deletedAt: null,
    })
      .sort({ rating: -1 })
      .limit(5)
      .lean();

    const formattedCompetitors = competitors.map((c) => ({
      name: c.name,
      rating: c.rating || 0,
      reviewCount: (c as any).reviewsCount ?? (c as any).userRatingCount ?? 0,
    }));

    // 4. Audits & Health Score
    const audit = await Audit.findOne({ workspaceId, locationId }).sort({ createdAt: -1 }).lean();

    return {
      business: {
        id: location._id.toString(),
        name: location.name,
        address: location.address,
        city: location.city,
        state: location.state,
        country: location.country,
        phone: location.phone,
        website: location.website,
        category: location.primaryCategory?.displayName || (location.categories && location.categories[0]),
        categories: location.categories || [],
        description: location.description,
        coordinates: location.coordinates ? { lat: location.coordinates.lat, lng: location.coordinates.lng } : undefined,
        totalReviewCount: location.totalReviewCount || reviewCache?.totalReviews || 0,
        averageRating: location.averageRating || reviewCache?.averageRating || 5,
        responseRate: location.reviewResponseRate || reviewCache?.responseRate || 0,
        hasSchema: Boolean(location.hasLocalBusinessSchema),
      },
      reviews: {
        total: reviewCache?.totalReviews || location.totalReviewCount || 0,
        averageRating: reviewCache?.averageRating || location.averageRating || 5,
        responseRate: reviewCache?.responseRate || location.reviewResponseRate || 0,
        unrepliedCount,
        sampleReviews,
        sentimentSummary: {
          positivePercent,
          topics: (analytics?.topics || []).slice(0, 6).map((t) => ({
            topic: t.topic,
            count: t.count,
            sentiment: t.sentiment,
          })),
        },
      },
      rankings: {
        totalTrackedKeywords: keywords.length,
        keywords: formattedKeywords,
      },
      competitors: formattedCompetitors,
      audit: audit
        ? {
            healthScore: (audit as any).score ?? (audit as any).overallScore ?? undefined,
            issuesCount: (audit as any).issues?.length ?? undefined,
            topRecommendations: ((audit as any).recommendations || []).slice(0, 4),
          }
        : undefined,
    };
  }
}

export const businessContextService = new BusinessContextService();
