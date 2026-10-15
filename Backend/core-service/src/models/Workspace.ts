import mongoose, { Document, Schema } from 'mongoose';
import { IWorkspace, WorkspaceStatus, WorkspacePlan, WorkspaceGbpConnectionStatus } from '@localo/types';

export interface WorkspaceDocument extends Omit<IWorkspace, '_id'>, Document {}

const WorkspaceSchema = new Schema<WorkspaceDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    ownerId: {
      type: Schema.Types.ObjectId as any,
      ref: 'User',
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'PENDING_DELETION', 'SUSPENDED'] as WorkspaceStatus[],
      default: 'ACTIVE',
      index: true
    },
    plan: {
      key: {
        type: String,
        enum: ['free_trial', 'free', 'starter', 'pro', 'agency'] as WorkspacePlan[],
        default: 'free_trial'
      },
      status: {
        type: String,
        enum: ['trialing', 'active', 'past_due', 'canceled'],
        default: 'trialing'
      },
      periodEnd: {
        type: Date,
        required: false
      }
    },
    gbpConnectionStatus: {
      type: String,
      enum: ['not_started', 'connected', 'skipped'] as WorkspaceGbpConnectionStatus[],
      default: 'not_started',
      index: true
    },
    trialEndsAt: {
      type: Date,
      required: false
    },
    deletionScheduledAt: {
      type: Date,
      required: false,
      index: true
    },
    branding: {
      logoUrl: String,
      primaryColor: String,
      domain: String,
      agencyName: String,
      category: String,
      targetCity: String,
      websiteUrl: String,
      phoneNumber: String,
      locationCount: String,
      primaryGoal: String
    },
    limits: {
      locations: { type: Number, default: 30 },
      activeProfilesLimit: { type: Number, default: 30 },
      optimizationSlots: { type: Number, default: 15 },
      seats: { type: Number, default: 1 },
      scanCredits: { type: Number, default: 50 },
      aiCredits: { type: Number, default: 20 }
    },
    spendLimits: {
      monthlyUsdCap: { type: Number, default: 50.0 },
      currentMonthSpendUsd: { type: Number, default: 0.0 },
      billingCycleStart: { type: Date, default: () => new Date() },
      alertThresholdPercent: { type: Number, default: 80 },
      alertSent: { type: Boolean, default: false }
    },
    settings: {
      requireMfaForAdmins: { type: Boolean, default: false }
    }
  },
  {
    timestamps: true
  }
);

export const DEFAULT_PLAN_SPEND_CAPS: Record<string, number> = {
  free_trial: 10.0,
  free: 10.0,
  starter: 50.0,
  pro: 200.0,
  agency: 1000.0,
};

export async function resetWorkspaceBillingCycleIfExpired(workspaceId: mongoose.Types.ObjectId | string): Promise<boolean> {
  const ws = await Workspace.findById(workspaceId);
  if (!ws) return false;

  const cycleStart = ws.spendLimits?.billingCycleStart ? new Date(ws.spendLimits.billingCycleStart) : new Date(ws.createdAt);
  const now = new Date();

  // Check if at least 1 calendar month has elapsed since billingCycleStart
  const oneMonthAfter = new Date(cycleStart);
  oneMonthAfter.setMonth(oneMonthAfter.getMonth() + 1);

  if (now >= oneMonthAfter) {
    await Workspace.findByIdAndUpdate(workspaceId, {
      $set: {
        'spendLimits.currentMonthSpendUsd': 0.0,
        'spendLimits.billingCycleStart': now,
        'spendLimits.alertSent': false,
      },
    });
    return true;
  }
  return false;
}

export const Workspace = mongoose.model<WorkspaceDocument>('Workspace', WorkspaceSchema);
