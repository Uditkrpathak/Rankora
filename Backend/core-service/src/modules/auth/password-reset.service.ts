import * as argon2 from 'argon2';
import { User } from '../../models/User';
import { AuditLog } from '../../models/AuditLog';
import { tokenService } from './token.service';
import { hashToken, generateSecureToken, ARGON2_CONFIG } from '@localo/shared';
import { enqueueEmail } from '../../jobs/email.queue';
import { ENV } from '../../config/env';

export class PasswordResetService {
  /**
   * Request password reset link (Always returns success to prevent email enumeration)
   */
  public async requestPasswordReset(email: string, ip?: string, userAgent?: string): Promise<boolean> {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      // Return true without doing anything (anti-enumeration)
      return true;
    }

    const rawToken = generateSecureToken(32);
    const tokenHashValue = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    user.passwordResetTokenHash = tokenHashValue;
    user.passwordResetExpiresAt = expiresAt;
    await user.save();

    const resetLink = `${ENV.FRONTEND_URL}/reset-password?token=${rawToken}`;

    await enqueueEmail({
      to: user.email,
      template: 'PASSWORD_RESET',
      userId: user._id.toString(),
      data: {
        userName: user.name,
        resetLink
      },
      idempotencyKey: `email:reset:${user._id}:${tokenHashValue.substring(0, 16)}`
    });

    return true;
  }

  /**
   * Complete password reset: Updates password, revokes all token families, increments session version
   */
  public async resetPassword(rawToken: string, newPassword: string, ip?: string, userAgent?: string): Promise<boolean> {
    const tokenHashValue = hashToken(rawToken);

    const user = await User.findOne({
      passwordResetTokenHash: tokenHashValue,
      passwordResetExpiresAt: { $gt: new Date() }
    });

    if (!user) {
      throw new Error('INVALID_OR_EXPIRED_TOKEN');
    }

    // Hash new password
    const newHash = await argon2.hash(newPassword, {
      memoryCost: ARGON2_CONFIG.memoryCost,
      timeCost: ARGON2_CONFIG.timeCost,
      parallelism: ARGON2_CONFIG.parallelism,
      type: argon2.argon2id
    });

    user.passwordHash = newHash;
    user.argon2Version = ARGON2_CONFIG.version;
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpiresAt = undefined;
    await user.save();

    // 🔒 Security: Invalidate all existing sessions and refresh tokens globally
    await tokenService.incrementSessionVersion(user._id.toString());

    // Write AuditLog
    await AuditLog.create({
      actorUserId: user._id.toString(),
      action: 'PASSWORD_RESET_SUCCESSFUL',
      resourceType: 'User',
      resourceId: user._id.toString(),
      ip,
      userAgent
    });

    // Enqueue security alert email
    await enqueueEmail({
      to: user.email,
      template: 'SECURITY_ALERT',
      userId: user._id.toString(),
      data: {
        userName: user.name,
        action: 'Password Changed',
        details: 'Your account password was successfully reset.'
      },
      idempotencyKey: `email:sec_alert:pwd_${user._id}_${Date.now()}`
    });

    return true;
  }
}

export const passwordResetService = new PasswordResetService();
