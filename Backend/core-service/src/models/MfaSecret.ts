import mongoose, { Document, Schema } from 'mongoose';
import { IMfaSecret } from '@localo/types';

export interface MfaSecretDocument extends Omit<IMfaSecret, '_id'>, Document {}

const MfaSecretSchema = new Schema<MfaSecretDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId as any,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    secretEncrypted: {
      type: String,
      required: true
    },
    backupCodes: [
      {
        codeHash: { type: String, required: true },
        isUsed: { type: Boolean, default: false },
        usedAt: Date
      }
    ]
  },
  {
    timestamps: true
  }
);

export const MfaSecret = mongoose.model<MfaSecretDocument>('MfaSecret', MfaSecretSchema);
