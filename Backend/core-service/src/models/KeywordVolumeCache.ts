import mongoose, { Schema, Document } from 'mongoose';

export interface KeywordVolumeCacheDocument extends Document {
  normalizedKeyword: string;
  locale: string;
  volume: number;
  band: string;
  hasLocalPack: boolean;
  createdAt: Date;
}

const KeywordVolumeCacheSchema = new Schema<KeywordVolumeCacheDocument>({
  normalizedKeyword: { type: String, required: true },
  locale: { type: String, default: 'en-US' },
  volume: { type: Number, required: true },
  band: { type: String, required: true },
  hasLocalPack: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 }, // 30-day TTL index
});

KeywordVolumeCacheSchema.index({ normalizedKeyword: 1, locale: 1 }, { unique: true });

export const KeywordVolumeCache = mongoose.model<KeywordVolumeCacheDocument>(
  'KeywordVolumeCache',
  KeywordVolumeCacheSchema
);
