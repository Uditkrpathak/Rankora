import mongoose, { Schema, Document } from 'mongoose';

export interface ITopicEntry {
  topic: string;
  count: number;
  examples: string[];
  sentiment: 'positive' | 'negative' | 'mixed';
}

export interface ISentimentBucket {
  date: string; // YYYY-MM-DD
  positive: number;
  negative: number;
  neutral: number;
  total: number;
  averageRating: number;
}

export interface ICompetitorRatingSnapshot {
  name: string;
  placeId?: string;
  rating: number;
  reviewCount: number;
  fetchedAt: string;
}

export interface ReviewAnalyticsSnapshotDocument extends Document {
  workspaceId: string;
  locationId: string;
  /** Sentiment distribution over time (1 bucket per scrape run) */
  sentimentTimeline: ISentimentBucket[];
  /** Top topics extracted from review text */
  topics: ITopicEntry[];
  /** Competitor rating benchmarks */
  competitorBenchmarks: ICompetitorRatingSnapshot[];
  /** Calculated at */
  calculatedAt: Date;
  expiresAt: Date;
}

const TopicEntrySchema = new Schema<ITopicEntry>(
  {
    topic: { type: String, required: true },
    count: { type: Number, default: 0 },
    examples: { type: [String], default: [] },
    sentiment: { type: String, enum: ['positive', 'negative', 'mixed'], default: 'positive' },
  },
  { _id: false }
);

const SentimentBucketSchema = new Schema<ISentimentBucket>(
  {
    date: { type: String, required: true },
    positive: { type: Number, default: 0 },
    negative: { type: Number, default: 0 },
    neutral: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0 },
  },
  { _id: false }
);

const CompetitorRatingSchema = new Schema<ICompetitorRatingSnapshot>(
  {
    name: { type: String, required: true },
    placeId: { type: String },
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    fetchedAt: { type: String },
  },
  { _id: false }
);

const ReviewAnalyticsSnapshotSchema = new Schema<ReviewAnalyticsSnapshotDocument>({
  workspaceId: { type: String, required: true, index: true },
  locationId: { type: String, required: true, index: true },
  sentimentTimeline: { type: [SentimentBucketSchema], default: [] },
  topics: { type: [TopicEntrySchema], default: [] },
  competitorBenchmarks: { type: [CompetitorRatingSchema], default: [] },
  calculatedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
});

ReviewAnalyticsSnapshotSchema.index({ workspaceId: 1, locationId: 1 }, { unique: true });
ReviewAnalyticsSnapshotSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const ReviewAnalyticsSnapshot = mongoose.model<ReviewAnalyticsSnapshotDocument>(
  'ReviewAnalyticsSnapshot',
  ReviewAnalyticsSnapshotSchema
);
