import mongoose, { Schema, Document } from 'mongoose';

export interface OAuthStateDocument extends Document {
  token: string;
  workspaceId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  createdAt: Date;
  used: boolean;
  linkToLocationId?: string;
  connectionType?: 'gbp' | 'gsc';
}

const OAuthStateSchema = new Schema<OAuthStateDocument>(
  {
    token: { type: String, required: true, unique: true, index: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    linkToLocationId: { type: String, required: false },
    connectionType: { type: String, enum: ['gbp', 'gsc'], default: 'gbp' },
    createdAt: { type: Date, default: Date.now, expires: 600 }, // 10-minute TTL
    used: { type: Boolean, default: false },
  },
  { timestamps: false }
);

export const OAuthState = mongoose.model<OAuthStateDocument>('OAuthState', OAuthStateSchema);
