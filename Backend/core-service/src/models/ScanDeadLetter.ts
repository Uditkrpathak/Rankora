import mongoose, { Schema, Document } from 'mongoose';

export interface IScanDeadLetter extends Document {
  jobId: string;
  queueName: string;
  payload: any;
  error: {
    message: string;
    stack?: string;
    code?: string;
  };
  attemptsMade: number;
  failedAt: Date;
  replayedAt?: Date;
  status: 'DEAD' | 'REPLAYED' | 'DISCARDED';
  createdAt: Date;
  updatedAt: Date;
}

const ScanDeadLetterSchema = new Schema<IScanDeadLetter>(
  {
    jobId: { type: String, required: true },
    queueName: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    error: {
      message: { type: String, required: true },
      stack: { type: String },
      code: { type: String },
    },
    attemptsMade: { type: Number, required: true, default: 3 },
    failedAt: { type: Date, default: Date.now },
    replayedAt: { type: Date },
    status: { type: String, enum: ['DEAD', 'REPLAYED', 'DISCARDED'], default: 'DEAD' },
  },
  {
    timestamps: true,
    collection: 'scan_dead_letters',
  }
);

ScanDeadLetterSchema.index({ failedAt: -1 });
ScanDeadLetterSchema.index(
  { failedAt: 1 },
  {
    expireAfterSeconds: 30 * 24 * 3600,
    partialFilterExpression: { status: { $in: ['REPLAYED', 'DISCARDED'] } },
  }
); // TTL: 30-day auto purge of resolved dead letters only (DEAD records never purged)
ScanDeadLetterSchema.index({ status: 1 });
ScanDeadLetterSchema.index({ jobId: 1 });

export const ScanDeadLetter =
  (mongoose.models && mongoose.models.ScanDeadLetter) ||
  mongoose.model<IScanDeadLetter>('ScanDeadLetter', ScanDeadLetterSchema);
