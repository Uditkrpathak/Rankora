import { User } from '../../models/User';
import { Workspace } from '../../models/Workspace';
import { WorkspaceMember } from '../../models/WorkspaceMember';
import { AuditLog } from '../../models/AuditLog';
import { hashToken, generateSecureToken } from '@localo/shared';
import { enqueueEmail } from '../../jobs/email.queue';
import { redisClient } from '../../config/redis';
import { ENV } from '../../config/env';

export interface ResendVerificationResult {
  sent: boolean;
  alreadyVerified?: boolean;
  rawToken?: string;
}

export class VerificationService {
  /**
   * Generates a 24-hour verification token and enqueues the email
   */
  public async createAndSendVerificationToken(userId: string, email: string, name: string): Promise<string> {
    const rawToken = generateSecureToken(32);
    const tokenHashValue = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await User.findByIdAndUpdate(userId, {
      emailVerificationTokenHash: tokenHashValue,
      emailVerificationExpiresAt: expiresAt
    });

    const verificationLink = `${ENV.FRONTEND_URL}/verify-email?token=${rawToken}`;

    try {
      await enqueueEmail({
        to: email,
        template: 'VERIFY_EMAIL',
        userId,
        data: {
          userName: name,
          verificationLink
        },
        idempotencyKey: `email:verify:${userId}:${tokenHashValue.substring(0, 16)}`
      });
    } catch (queueErr: any) {
      console.warn(`[VerificationService] Enqueue verification email failed for ${email}:`, queueErr?.message || queueErr);
    }

    return rawToken;
  }

  /**
   * Shared helper: Activates user, cleans token fields, starts 14-day workspace trial clock, and logs audit
   */
  private async activateUserAndStartTrial(user: any, auditAction: 'USER_EMAIL_VERIFIED' | 'DEV_VERIFY_BYPASS', ip?: string) {
    user.status = 'ACTIVE';
    user.isEmailVerified = true;
    user.emailVerificationTokenHash = undefined;
    user.emailVerificationExpiresAt = undefined;
    await user.save();

    // Start 14-day trial clock for user's owned workspaces
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const ownedMemberships = await WorkspaceMember.find({ userId: user._id, role: 'owner' }).select('workspaceId');
    const workspaceIds = ownedMemberships.map(m => m.workspaceId);

    if (workspaceIds.length > 0) {
      await Workspace.updateMany(
        { _id: { $in: workspaceIds }, trialEndsAt: { $exists: false } },
        { $set: { trialEndsAt, 'plan.periodEnd': trialEndsAt } }
      );
    }

    // Log activation in AuditLog
    await AuditLog.create({
      actorUserId: user._id.toString(),
      action: auditAction,
      resourceType: 'User',
      resourceId: user._id.toString(),
      ip,
      after: { status: 'ACTIVE', trialEndsAt }
    });

    return { success: true, user };
  }

  /**
   * Validates verification token, activates user, and STARTS the 14-day trial clock
   */
  public async verifyEmail(rawToken: string, ip?: string): Promise<{ success: boolean; user: any }> {
    const tokenHashValue = hashToken(rawToken);

    const user = await User.findOne({
      emailVerificationTokenHash: tokenHashValue,
      emailVerificationExpiresAt: { $gt: new Date() }
    });

    if (!user) {
      throw new Error('INVALID_OR_EXPIRED_TOKEN');
    }

    return this.activateUserAndStartTrial(user, 'USER_EMAIL_VERIFIED', ip);
  }

  /**
   * Developer-only instant verification bypass (Guarded by requireDevEnvironment middleware)
   */
  public async devBypassVerify(userId: string, ip?: string): Promise<{ success: boolean; user: any }> {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    return this.activateUserAndStartTrial(user, 'DEV_VERIFY_BYPASS', ip);
  }

  /**
   * Resends verification email (rate-limited to 3 per hour per email)
   */
  public async resendVerification(email: string): Promise<ResendVerificationResult> {
    const normalizedEmail = email.toLowerCase().trim();
    
    // Rate limit check
    const rateLimitKey = `rl:resend_verify:${normalizedEmail}`;
    try {
      if (redisClient.status === 'ready') {
        const count = await redisClient.incr(rateLimitKey);
        if (count === 1) {
          await redisClient.expire(rateLimitKey, 3600); // 1 hour
        }
        if (count > 3) {
          throw new Error('RATE_LIMIT_EXCEEDED');
        }
      }
    } catch (e: any) {
      if (e.message === 'RATE_LIMIT_EXCEEDED') throw e;
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user || user.isEmailVerified) {
      return { sent: true, alreadyVerified: Boolean(user?.isEmailVerified) }; // Return true to avoid account enumeration
    }

    const rawToken = await this.createAndSendVerificationToken(user._id.toString(), user.email, user.name);
    return { sent: true, rawToken };
  }
}

export const verificationService = new VerificationService();
