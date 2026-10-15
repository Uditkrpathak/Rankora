import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { MfaSecret } from '../../models/MfaSecret';
import { User } from '../../models/User';
import { AuditLog } from '../../models/AuditLog';
import { tokenService } from './token.service';
import { redisClient, cacheStore } from '../../config/redis';
import { ENV } from '../../config/env';
import { hashToken, generateAlphanumericCode } from '@localo/shared';

// AES-256-GCM encryption helpers
function encryptSecret(secret: string): string {
  const iv = crypto.randomBytes(12);
  const key = Buffer.from(ENV.KMS_ENCRYPTION_KEY.padEnd(32).slice(0, 32));
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(secret, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decryptSecret(encryptedPayload: string): string {
  const [ivHex, authTagHex, encryptedHex] = encryptedPayload.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const key = Buffer.from(ENV.KMS_ENCRYPTION_KEY.padEnd(32).slice(0, 32));
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export class MfaService {
  /**
   * Enroll in TOTP MFA: generates secret and QR code
   */
  public async enroll(userId: string, email: string): Promise<{ qrCodeDataUrl: string; secret: string }> {
    const rawSecret = authenticator.generateSecret();
    const serviceName = 'Localo Local SEO';
    const otpauth = authenticator.keyuri(email, serviceName, rawSecret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauth);

    // Store encrypted candidate secret (10 min TTL)
    const encrypted = encryptSecret(rawSecret);
    await cacheStore.set(`mfa_enroll:${userId}`, encrypted, 600);

    return { qrCodeDataUrl, secret: rawSecret };
  }

  /**
   * Verify TOTP code and finalize enrollment with 10 backup codes
   */
  public async verifyAndActivate(userId: string, code: string): Promise<{ backupCodes: string[] }> {
    const encryptedSecret = await cacheStore.get(`mfa_enroll:${userId}`);

    if (!encryptedSecret) {
      throw new Error('MFA_ENROLLMENT_EXPIRED');
    }

    const rawSecret = decryptSecret(encryptedSecret);
    const isValid = authenticator.check(code, rawSecret);

    if (!isValid) {
      throw new Error('INVALID_MFA_CODE');
    }

    // Generate 10 single-use backup codes
    const plainBackupCodes: string[] = [];
    const hashedBackupCodes: Array<{ codeHash: string; isUsed: boolean }> = [];

    for (let i = 0; i < 10; i++) {
      const plain = `${generateAlphanumericCode(4)}-${generateAlphanumericCode(4)}`;
      plainBackupCodes.push(plain);
      hashedBackupCodes.push({
        codeHash: hashToken(plain),
        isUsed: false
      });
    }

    // Save MfaSecret in database
    await MfaSecret.findOneAndUpdate(
      { userId },
      {
        secretEncrypted: encryptedSecret,
        backupCodes: hashedBackupCodes
      },
      { upsert: true, new: true }
    );

    // Update User record
    await User.findByIdAndUpdate(userId, { mfaEnabled: true });

    // Clean up Redis enrollment
    try {
      if (redisClient.status === 'ready') {
        await redisClient.del(`mfa_enroll:${userId}`);
      }
    } catch (e) {}

    // Audit Log
    await AuditLog.create({
      actorUserId: userId,
      action: 'MFA_ENABLED',
      resourceType: 'User',
      resourceId: userId
    });

    return { backupCodes: plainBackupCodes };
  }

  /**
   * Verify challenge during two-step login
   */
  public async verifyChallenge(
    mfaChallengeToken: string,
    code: string,
    ip?: string,
    userAgent?: string
  ): Promise<{ user: any; tokens: any }> {
    const userId = await cacheStore.get(`mfa_challenge:${mfaChallengeToken}`);

    if (!userId) {
      throw new Error('INVALID_OR_EXPIRED_MFA_CHALLENGE');
    }

    const mfaDoc = await MfaSecret.findOne({ userId });
    if (!mfaDoc) {
      throw new Error('MFA_NOT_CONFIGURED');
    }

    const rawSecret = decryptSecret(mfaDoc.secretEncrypted);
    let isCodeValid = authenticator.check(code, rawSecret);
    let usedBackupCode = false;

    // If TOTP check failed, check if code matches an unused backup code
    if (!isCodeValid) {
      const codeHash = hashToken(code.trim());
      const backupEntry = mfaDoc.backupCodes.find((b) => b.codeHash === codeHash && !b.isUsed);
      if (backupEntry) {
        backupEntry.isUsed = true;
        backupEntry.usedAt = new Date();
        await mfaDoc.save();
        isCodeValid = true;
        usedBackupCode = true;
      }
    }

    if (!isCodeValid) {
      throw new Error('INVALID_MFA_CODE');
    }

    // Clean up challenge token
    await cacheStore.del(`mfa_challenge:${mfaChallengeToken}`);

    const user = await User.findById(userId);
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    // Issue Token Bundle
    const tokens = await tokenService.issueTokenBundle({
      userId: user._id.toString(),
      userAgent,
      ipAddress: ip
    });

    await AuditLog.create({
      actorUserId: user._id.toString(),
      action: usedBackupCode ? 'MFA_LOGIN_BACKUP_CODE_USED' : 'MFA_LOGIN_SUCCESS',
      resourceType: 'User',
      resourceId: user._id.toString(),
      ip,
      userAgent
    });

    return { user, tokens };
  }

  /**
   * Disable MFA
   */
  public async disable(userId: string): Promise<void> {
    await MfaSecret.deleteOne({ userId });
    await User.findByIdAndUpdate(userId, { mfaEnabled: false });

    await AuditLog.create({
      actorUserId: userId,
      action: 'MFA_DISABLED',
      resourceType: 'User',
      resourceId: userId
    });
  }
}

export const mfaService = new MfaService();
