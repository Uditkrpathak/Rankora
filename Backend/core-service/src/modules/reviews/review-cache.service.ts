import { redisClient, memoryFallback } from '../../config/redis';
import { ReviewCache, IStoredReview, ReviewCacheDocument } from '../../models/ReviewCache';
import { invalidateLocationChatCache } from '../chat/chat.cache';

export interface ReviewDataset {
  reviews: IStoredReview[];
  totalReviews: number;
  averageRating: number;
  ratingDistribution: {
    fiveStar: number;
    fourStar: number;
    threeStar: number;
    twoStar: number;
    oneStar: number;
  };
  responseRate: number;
  source: 'GOOGLE_GBP_OAUTH' | 'GOOGLE_PLACES_API' | 'GOOGLE_MAPS_PUBLIC_SCRAPER';
  isStale?: boolean;
  lastFetchedAt: Date;
}

const CACHE_TTL_SECONDS = 60 * 60 * 24; // 24 Hours

export class ReviewCacheService {
  private getCacheKey(workspaceId: string, locationId: string): string {
    return `cache:reviews:${workspaceId}:${locationId}`;
  }

  /**
   * Retrieves cached reviews from Redis or MongoDB. Returns null if expired or missing.
   */
  public async getCachedReviews(workspaceId: string, locationId: string): Promise<ReviewDataset | null> {
    const key = this.getCacheKey(workspaceId, locationId);

    // 1. Try Redis
    try {
      if (redisClient && redisClient.status === 'ready') {
        const raw = await redisClient.get(key);
        if (raw) {
          return JSON.parse(raw);
        }
      }
    } catch (err) {
      console.warn('[ReviewCache] Redis get error:', err);
    }

    // 2. Try In-Memory fallback
    const mem = memoryFallback.get(key);
    if (mem && mem.exp > Date.now()) {
      try {
        return JSON.parse(mem.val);
      } catch {
        return null;
      }
    }

    // 3. Try MongoDB
    try {
      const doc = await ReviewCache.findOne({
        workspaceId,
        locationId,
        expiresAt: { $gt: new Date() },
      });

      if (doc) {
        const dataset: ReviewDataset = {
          reviews: doc.reviews,
          totalReviews: doc.totalReviews,
          averageRating: doc.averageRating,
          ratingDistribution: doc.ratingDistribution,
          responseRate: doc.responseRate,
          source: doc.source,
          lastFetchedAt: doc.lastFetchedAt,
        };

        // Populate back into Redis
        await this.populateMemoryCache(key, dataset, CACHE_TTL_SECONDS);
        return dataset;
      }
    } catch (err) {
      console.warn('[ReviewCache] MongoDB get error:', err);
    }

    return null;
  }

  /**
   * Gets last-known-good reviews regardless of expiration date (used for circuit breaker fallback)
   */
  public async getLastKnownGood(workspaceId: string, locationId: string): Promise<ReviewDataset | null> {
    try {
      const doc = await ReviewCache.findOne({ workspaceId, locationId }).sort({ lastFetchedAt: -1 });
      if (doc) {
        return {
          reviews: doc.reviews,
          totalReviews: doc.totalReviews,
          averageRating: doc.averageRating,
          ratingDistribution: doc.ratingDistribution,
          responseRate: doc.responseRate,
          source: doc.source,
          isStale: true,
          lastFetchedAt: doc.lastFetchedAt,
        };
      }
    } catch (err) {
      console.warn('[ReviewCache] getLastKnownGood error:', err);
    }
    return null;
  }

  /**
   * Saves reviews into Redis, in-memory, and MongoDB with 24-hour TTL
   */
  public async setCachedReviews(
    workspaceId: string,
    locationId: string,
    placeId: string | undefined,
    dataset: ReviewDataset
  ): Promise<void> {
    const key = this.getCacheKey(workspaceId, locationId);
    const expiresAt = new Date(Date.now() + CACHE_TTL_SECONDS * 1000);

    // 1. Populate Redis & In-Memory
    await this.populateMemoryCache(key, dataset, CACHE_TTL_SECONDS);

    // 2. Persist to MongoDB
    try {
      const existing = await ReviewCache.findOne({ workspaceId, locationId })
        .select('totalReviews averageRating reviews')
        .lean();

      const hasChanged =
        !existing ||
        existing.totalReviews !== dataset.totalReviews ||
        Math.abs((existing.averageRating || 0) - dataset.averageRating) > 0.01 ||
        (existing.reviews?.length || 0) !== (dataset.reviews?.length || 0) ||
        existing.reviews?.[0]?.reviewId !== dataset.reviews?.[0]?.reviewId;

      await ReviewCache.findOneAndUpdate(
        { workspaceId, locationId },
        {
          $set: {
            placeId,
            source: dataset.source,
            reviews: dataset.reviews,
            totalReviews: dataset.totalReviews,
            averageRating: dataset.averageRating,
            ratingDistribution: dataset.ratingDistribution,
            responseRate: dataset.responseRate,
            lastFetchedAt: new Date(),
            expiresAt,
          },
        },
        { upsert: true, new: true }
      );

      if (hasChanged) {
        invalidateLocationChatCache(locationId).catch(() => {});
      }
    } catch (err) {
      console.warn('[ReviewCache] MongoDB save error:', err);
    }
  }

  private async populateMemoryCache(key: string, data: any, ttlSeconds: number): Promise<void> {
    const payload = JSON.stringify(data);
    try {
      if (redisClient && redisClient.status === 'ready') {
        await redisClient.set(key, payload, 'EX', ttlSeconds);
      }
    } catch {}
    memoryFallback.set(key, { val: payload, exp: Date.now() + ttlSeconds * 1000 });
  }
}

export const reviewCacheService = new ReviewCacheService();
