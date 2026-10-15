import mongoose, { Schema, Document } from 'mongoose';

export interface IStoredReview {
  reviewId: string;
  reviewer: {
    displayName: string;
    profilePhotoUrl?: string;
    isAnonymous?: boolean;
  };
  starRating: 'ONE' | 'TWO' | 'THREE' | 'FOUR' | 'FIVE';
  numericRating: number;
  comment?: string;
  createTime: string;
  updateTime?: string;
  reviewReply?: {
    comment: string;
    updateTime?: string;
  };
}

export interface ReviewCacheDocument extends Document {
  workspaceId: string;
  locationId: string;
  placeId?: string;
  source: 'GOOGLE_GBP_OAUTH' | 'GOOGLE_PLACES_API' | 'GOOGLE_MAPS_PUBLIC_SCRAPER';
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
  lastFetchedAt: Date;
  expiresAt: Date;
}

const StoredReviewSchema = new Schema(
  {
    reviewId: { type: String, required: true },
    reviewer: {
      displayName: { type: String, default: 'Google Customer' },
      profilePhotoUrl: { type: String },
      isAnonymous: { type: Boolean, default: false },
    },
    starRating: { type: String, default: 'FIVE' },
    numericRating: { type: Number, default: 5 },
    comment: { type: String, default: '' },
    createTime: { type: String },
    updateTime: { type: String },
    reviewReply: {
      comment: { type: String },
      updateTime: { type: String },
    },
  },
  { _id: false }
);

const ReviewCacheSchema = new Schema<ReviewCacheDocument>({
  workspaceId: { type: String, required: true, index: true },
  locationId: { type: String, required: true, index: true },
  placeId: { type: String },
  source: {
    type: String,
    enum: ['GOOGLE_GBP_OAUTH', 'GOOGLE_PLACES_API', 'GOOGLE_MAPS_PUBLIC_SCRAPER'],
    required: true,
  },
  reviews: [StoredReviewSchema],
  totalReviews: { type: Number, default: 0 },
  averageRating: { type: Number, default: 0 },
  ratingDistribution: {
    fiveStar: { type: Number, default: 0 },
    fourStar: { type: Number, default: 0 },
    threeStar: { type: Number, default: 0 },
    twoStar: { type: Number, default: 0 },
    oneStar: { type: Number, default: 0 },
  },
  responseRate: { type: Number, default: 0 },
  lastFetchedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
});

ReviewCacheSchema.index({ workspaceId: 1, locationId: 1 }, { unique: true });
ReviewCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // MongoDB TTL index

export const ReviewCache = mongoose.model<ReviewCacheDocument>('ReviewCache', ReviewCacheSchema);
