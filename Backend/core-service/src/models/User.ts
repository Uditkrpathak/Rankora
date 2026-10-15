import mongoose, { Document, Schema } from 'mongoose';
import { IUser, UserStatus } from '@localo/types';
import { ARGON2_CONFIG } from '@localo/shared';

export type SystemRole = 'USER' | 'ADMIN';

export interface UserDocument extends Omit<IUser, '_id'>, Document {
  systemRole?: SystemRole;
  emailNormalized?: string;
  emailVerifiedAt?: Date;
  phone?: string;
  phoneVerifiedAt?: Date;
  trialEndsAt?: Date;
  riskReasons?: string[];
  signupIp?: string;
  hasClaimedTrial?: boolean;
  twoFactor?: any;
  tokenVersion?: number;
  riskScore?: number;
  lastLoginAt?: Date;
  forcePasswordChange?: boolean;
}

const TwoFactorSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    secretEncrypted: { type: String, required: false },
    tempSecretEncrypted: { type: String, required: false },
    recoveryCodesHashed: [{ type: String }],
    recoveryCodesEncrypted: [{ type: String }], // legacy compatibility
    forceSetupOnLogin: { type: Boolean, default: false },
    lastUsedTimestep: { type: Number, required: false },
    verifiedAt: { type: Date, required: false }
  },
  { _id: false }
);

const UserSchema = new Schema<UserDocument>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    emailNormalized: {
      type: String,
      required: true,
      default: function (this: any) {
        return this.email ? this.email.toLowerCase().trim() : undefined;
      },
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    passwordHash: {
      type: String,
      required: false
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    platformRole: {
      type: String,
      enum: ['SUPER_ADMIN', 'ADMIN', 'USER'],
      default: 'USER',
      index: true
    },
    mustChangePassword: {
      type: Boolean,
      default: false,
      index: true
    },
    planName: {
      type: String,
      enum: ['Trial', 'Starter', 'Pro Growth', 'Agency Scale'],
      default: 'Trial',
      index: true
    },
    planStartedAt: {
      type: Date,
      default: Date.now
    },
    planExpiresAt: {
      type: Date,
      required: false
    },
    assignedByUserId: {
      type: String,
      required: false
    },
    createdByUserId: {
      type: String,
      required: false
    },
    limitOverrides: {
      keywordScanLimit: { type: Number, default: null },
      scanCreditsPerMonth: { type: Number, default: null },
      locationLimit: { type: Number, default: null },
      chatbotQuotaPerMonth: { type: Number, default: null },
      teamSeatLimit: { type: Number, default: null }
    },
    usage: {
      keywordsScannedThisMonth: { type: Number, default: 0 },
      scanCreditsUsed: { type: Number, default: 0 },
      chatbotUsed: { type: Number, default: 0 },
      locationsCount: { type: Number, default: 0 },
      usageResetAt: { type: Date, default: Date.now }
    },
    permissions: {
      canScan: { type: Boolean, default: true },
      canUseChatbot: { type: Boolean, default: true },
      canUseGeoGrid: { type: Boolean, default: true },
      canUseCompetitorMatrix: { type: Boolean, default: true },
      canExportPdf: { type: Boolean, default: true },
      canInviteTeam: { type: Boolean, default: true },
      canUseApi: { type: Boolean, default: false }
    },
    systemRole: {
      type: String,
      enum: ['USER', 'ADMIN'] as SystemRole[],
      default: 'USER',
      index: true
    },
    status: {
      type: String,
      enum: ['PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'BANNED', 'DELETED', 'PENDING_DELETION', 'PENDING_REVIEW'] as UserStatus[],
      default: 'ACTIVE',
      index: true
    },
    emailVerifiedAt: {
      type: Date,
      required: false,
      index: true
    },
    emailVerificationTokenHash: {
      type: String,
      required: false,
      index: true
    },
    emailVerificationExpiresAt: {
      type: Date,
      required: false
    },
    passwordResetTokenHash: {
      type: String,
      required: false,
      index: true
    },
    passwordResetExpiresAt: {
      type: Date,
      required: false
    },
    pendingEmail: {
      type: String,
      required: false,
      lowercase: true,
      trim: true
    },
    emailChangeTokenHash: {
      type: String,
      required: false,
      index: true
    },
    emailChangeExpiresAt: {
      type: Date,
      required: false
    },
    deletionScheduledAt: {
      type: Date,
      required: false,
      index: true
    },
    googleSub: {
      type: String,
      required: false,
      unique: true,
      sparse: true
    },
    avatarUrl: {
      type: String,
      required: false
    },
    twoFactor: {
      type: TwoFactorSchema,
      default: () => ({ enabled: false })
    },
    forcePasswordChange: {
      type: Boolean,
      default: false
    },
    tokenVersion: {
      type: Number,
      default: 1,
      index: true
    },
    riskScore: {
      type: Number,
      default: 0,
      index: true
    },
    riskReasons: [{
      type: String
    }],
    lastLoginAt: {
      type: Date,
      required: false
    },
    signupIp: {
      type: String,
      required: false
    },
    mfaEnabled: {
      type: Boolean,
      default: false
    },
    argon2Version: {
      type: Number,
      default: ARGON2_CONFIG.version
    },
    emailSuppressed: {
      type: Boolean,
      default: false,
      index: true
    },
    sessionVersion: {
      type: Number,
      default: 1
    },
    hasClaimedTrial: {
      type: Boolean,
      default: false,
      index: true
    },
    trialEndsAt: {
      type: Date,
      required: false,
      index: true
    },
    phone: {
      type: String,
      required: false,
      trim: true
    },
    phoneVerifiedAt: {
      type: Date,
      required: false,
      index: true
    }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        delete ret.passwordHash;
        delete ret.emailVerificationTokenHash;
        delete ret.passwordResetTokenHash;
        delete ret.emailChangeTokenHash;
        if (ret.twoFactor) {
          delete ret.twoFactor.secretEncrypted;
          delete ret.twoFactor.tempSecretEncrypted;
          delete ret.twoFactor.recoveryCodesHashed;
          delete ret.twoFactor.recoveryCodesEncrypted;
        }
        return ret;
      }
    },
    toObject: { virtuals: true }
  }
);

// Virtual: isEmailVerified derived dynamically from emailVerifiedAt (single source of truth)
UserSchema.virtual('isEmailVerified')
  .get(function (this: UserDocument) {
    return Boolean(this.emailVerifiedAt);
  })
  .set(function (this: UserDocument, val: boolean) {
    if (val && !this.emailVerifiedAt) {
      this.emailVerifiedAt = new Date();
    } else if (!val) {
      this.emailVerifiedAt = undefined;
    }
  });

// Virtual: isPhoneVerified derived dynamically from phoneVerifiedAt
UserSchema.virtual('isPhoneVerified')
  .get(function (this: UserDocument) {
    return Boolean(this.phoneVerifiedAt);
  })
  .set(function (this: UserDocument, val: boolean) {
    if (val && !this.phoneVerifiedAt) {
      this.phoneVerifiedAt = new Date();
    } else if (!val) {
      this.phoneVerifiedAt = undefined;
    }
  });

// Pre-validate hook: automatically set emailNormalized if missing
UserSchema.pre('validate', function (next) {
  if (this.email && !this.emailNormalized) {
    this.emailNormalized = this.email.toLowerCase().trim();
  }
  next();
});

export const User = mongoose.model<UserDocument>('User', UserSchema);

