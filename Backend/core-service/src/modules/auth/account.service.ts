import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import * as argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../../models/User';
import { Workspace } from '../../models/Workspace';
import { WorkspaceMember } from '../../models/WorkspaceMember';
import { RefreshToken } from '../../models/RefreshToken';
import { AuditLog } from '../../models/AuditLog';
import { ARGON2_CONFIG, COMMON_PASSWORDS, generateSecureToken, hashToken } from '@localo/shared';
import { enqueueEmail } from '../../jobs/email.queue';
import { redisClient } from '../../config/redis';
import { ENV } from '../../config/env';

function createAuthError(message: string, statusCode = 401): Error {
  const err: any = new Error(message);
  err.statusCode = statusCode;
  return err;
}

/**
 * Sniffs actual file bytes to detect image MIME type (anti-spoofing)
 */
export function detectImageMimeType(buffer: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | null {
  if (buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // GIF: GIF87a or GIF89a
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return 'image/gif';
  }

  // WebP: RIFF .... WEBP
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }

  return null;
}

/**
 * Strips EXIF / metadata from JPEG and PNG buffers to prevent metadata & GPS leakage
 */
export function stripExifMetadata(buffer: Buffer, mimeType: string): Buffer {
  if (mimeType === 'image/jpeg') {
    const chunks: Buffer[] = [];
    chunks.push(buffer.subarray(0, 2)); // SOI: FF D8
    let offset = 2;

    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];

      // SOS (Start of Scan) marker: 0xDA - remainder is image scan data
      if (marker === 0xda) {
        chunks.push(buffer.subarray(offset));
        break;
      }
      // Standalone markers
      if (marker === 0xd9) {
        chunks.push(buffer.subarray(offset, offset + 2));
        break;
      }

      if (offset + 4 > buffer.length) break;
      const length = buffer.readUInt16BE(offset + 2);

      // Skip APP1-APP15 (0xE1 - 0xEF) which hold EXIF/XMP metadata
      if (marker >= 0xe1 && marker <= 0xef) {
        offset += 2 + length;
      } else {
        chunks.push(buffer.subarray(offset, offset + 2 + length));
        offset += 2 + length;
      }
    }
    return Buffer.concat(chunks);
  }

  if (mimeType === 'image/png') {
    const chunks: Buffer[] = [];
    chunks.push(buffer.subarray(0, 8)); // PNG signature
    let offset = 8;

    while (offset < buffer.length - 4) {
      const length = buffer.readUInt32BE(offset);
      const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
      const totalChunkLength = 4 + 4 + length + 4; // length + type + data + crc

      if (['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME'].includes(type)) {
        offset += totalChunkLength;
      } else {
        chunks.push(buffer.subarray(offset, offset + totalChunkLength));
        offset += totalChunkLength;
      }
    }
    return Buffer.concat(chunks);
  }

  return buffer;
}

export class AccountService {
  /**
   * Updates basic profile info (name)
   */
  public async updateProfile(userId: string, input: { name?: string }, ip?: string) {
    if (input.name !== undefined) {
      const trimmed = input.name.trim();
      if (trimmed.length < 1 || trimmed.length > 100) {
        throw new Error('Name must be between 1 and 100 characters.');
      }
    }

    const user = await User.findById(userId);
    if (!user) throw new Error('USER_NOT_FOUND');

    if (input.name !== undefined) {
      user.name = input.name.trim();
    }

    await user.save();

    await AuditLog.create({
      actorUserId: userId,
      action: 'USER_PROFILE_UPDATED',
      resourceType: 'User',
      resourceId: userId,
      ip,
      after: { name: user.name }
    });

    return {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      status: user.status,
      avatarUrl: user.avatarUrl,
      isEmailVerified: user.isEmailVerified,
      mfaEnabled: user.mfaEnabled
    };
  }

  /**
   * Uploads and sanitizes avatar image
   */
  public async uploadAvatar(userId: string, file: Express.Multer.File, ip?: string) {
    if (!file || !file.buffer) {
      throw new Error('No avatar file provided.');
    }

    // 1. Max 5MB cap
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Avatar file size exceeds the 5MB limit.');
    }

    // 2. Byte sniffing (anti-spoofing)
    const detectedMime = detectImageMimeType(file.buffer);
    if (!detectedMime) {
      throw new Error('Invalid image file format. Only JPEG, PNG, WebP, and GIF images are permitted.');
    }

    // 3. Strip EXIF metadata
    const sanitizedBuffer = stripExifMetadata(file.buffer, detectedMime);

    // 4. File extension mapping
    const extMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif'
    };
    const ext = extMap[detectedMime] || 'jpg';
    const filename = `${uuidv4()}.${ext}`;

    // 5. Save file namespaced under /{userId}/avatar/{uuid}.{ext}
    const uploadsDir = path.resolve(process.cwd(), 'uploads', userId, 'avatar');
    fs.mkdirSync(uploadsDir, { recursive: true });
    const filePath = path.join(uploadsDir, filename);
    fs.writeFileSync(filePath, sanitizedBuffer);

    const avatarUrl = `/uploads/${userId}/avatar/${filename}`;

    const user = await User.findByIdAndUpdate(userId, { avatarUrl }, { new: true });
    if (!user) throw new Error('USER_NOT_FOUND');

    await AuditLog.create({
      actorUserId: userId,
      action: 'USER_AVATAR_UPDATED',
      resourceType: 'User',
      resourceId: userId,
      ip,
      after: { avatarUrl }
    });

    return { avatarUrl };
  }

  /**
   * Initiates email change with current password verification and dual alert emails
   */
  public async requestEmailChange(
    userId: string,
    newEmail: string,
    currentPassword: string,
    ip?: string,
    userAgent?: string
  ) {
    const user = await User.findById(userId);
    if (!user) throw new Error('USER_NOT_FOUND');

    if (!user.passwordHash) {
      throw new Error('OAuth-only accounts cannot change email via password. Please set a password first.');
    }

    // 1. Validate current password
    const isPasswordValid = await argon2.verify(user.passwordHash, currentPassword);
    if (!isPasswordValid) {
      throw createAuthError('INVALID_CREDENTIALS', 401);
    }

    const normalizedNewEmail = newEmail.toLowerCase().trim();
    if (normalizedNewEmail === user.email.toLowerCase().trim()) {
      throw new Error('The new email address cannot be the same as your current email.');
    }

    // 2. Anti-enumeration duplicate check: If taken, return generic success without creating token
    const existing = await User.findOne({ email: normalizedNewEmail });
    if (existing) {
      return {
        success: true,
        message: 'If the new email address is eligible, a confirmation link has been sent.'
      };
    }

    // 3. Generate 24h verification token
    const rawToken = generateSecureToken(32);
    const tokenHashValue = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    user.pendingEmail = normalizedNewEmail;
    user.emailChangeTokenHash = tokenHashValue;
    user.emailChangeExpiresAt = expiresAt;
    await user.save();

    // 4. Send verification link to NEW email
    const verificationLink = `${ENV.FRONTEND_URL}/verify-email?token=${rawToken}&type=email-change`;
    await enqueueEmail({
      to: normalizedNewEmail,
      template: 'VERIFY_EMAIL',
      userId,
      data: {
        userName: user.name,
        verificationLink
      },
      idempotencyKey: `email:change:${userId}:${tokenHashValue.substring(0, 16)}`
    });

    // 5. Send security alert to OLD email
    await enqueueEmail({
      to: user.email,
      template: 'SECURITY_ALERT',
      userId,
      data: {
        userName: user.name,
        action: 'Email Change Requested',
        details: `A request was made to change your Localo account email to ${normalizedNewEmail}. If you did not make this change, please reset your password immediately.`
      },
      idempotencyKey: `email:change-alert:${userId}:${Date.now()}`
    });

    await AuditLog.create({
      actorUserId: userId,
      action: 'EMAIL_CHANGE_REQUESTED',
      resourceType: 'User',
      resourceId: userId,
      ip,
      userAgent,
      after: { pendingEmail: normalizedNewEmail }
    });

    return {
      success: true,
      message: 'If the new email address is eligible, a confirmation link has been sent.',
      rawToken // returned for testing/development
    };
  }

  /**
   * Confirms email change and invalidates all active sessions (sessionVersion++)
   */
  public async confirmEmailChange(token: string, ip?: string) {
    const tokenHashValue = hashToken(token);

    const user = await User.findOne({
      emailChangeTokenHash: tokenHashValue,
      emailChangeExpiresAt: { $gt: new Date() }
    });

    if (!user || !user.pendingEmail) {
      throw new Error('INVALID_OR_EXPIRED_TOKEN');
    }

    // Double check email collision
    const existing = await User.findOne({ email: user.pendingEmail });
    if (existing && existing._id.toString() !== user._id.toString()) {
      throw new Error('EMAIL_ALREADY_EXISTS');
    }

    const oldEmail = user.email;
    const newEmail = user.pendingEmail;

    user.email = newEmail;
    user.pendingEmail = undefined;
    user.emailChangeTokenHash = undefined;
    user.emailChangeExpiresAt = undefined;
    // Invalidate all active sessions across all devices
    user.sessionVersion = (user.sessionVersion || 1) + 1;
    await user.save();

    // Revoke refresh tokens
    await RefreshToken.updateMany(
      { userId: user._id, isRevoked: false },
      {
        $set: {
          isRevoked: true,
          revokedAt: new Date(),
          revocationReason: 'PASSWORD_RESET'
        }
      }
    );

    // 24h cooldown in Redis for old email to prevent immediate re-registration races
    try {
      if (redisClient.status === 'ready') {
        await redisClient.set(`cooldown:email:${oldEmail}`, '1', 'EX', 24 * 60 * 60);
      }
    } catch {}

    await AuditLog.create({
      actorUserId: user._id.toString(),
      action: 'EMAIL_CHANGED',
      resourceType: 'User',
      resourceId: user._id.toString(),
      ip,
      before: { email: oldEmail },
      after: { email: newEmail }
    });

    return {
      success: true,
      message: 'Email address updated successfully. Please log in with your new email.'
    };
  }

  /**
   * In-session password change with Argon2id and security alert email
   */
  public async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    ip?: string,
    userAgent?: string
  ) {
    const user = await User.findById(userId);
    if (!user) throw new Error('USER_NOT_FOUND');

    if (!user.passwordHash) {
      throw new Error('OAuth-only accounts do not have a password configured.');
    }

    // 1. Verify current password
    const isCurrentValid = await argon2.verify(user.passwordHash, currentPassword);
    if (!isCurrentValid) {
      throw createAuthError('INVALID_CREDENTIALS', 401);
    }

    // 2. Validate new password strength
    if (newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters long.');
    }
    if (!/[A-Z]/.test(newPassword)) {
      throw new Error('Password must contain at least one uppercase letter.');
    }
    if (!/[a-z]/.test(newPassword)) {
      throw new Error('Password must contain at least one lowercase letter.');
    }
    if (!/[0-9]/.test(newPassword)) {
      throw new Error('Password must contain at least one number.');
    }
    if (!/[^A-Za-z0-9]/.test(newPassword)) {
      throw new Error('Password must contain at least one special character.');
    }
    if (COMMON_PASSWORDS.has(newPassword.toLowerCase())) {
      throw new Error('This password is too common. Please choose a stronger password.');
    }

    // 3. Hash with Argon2id
    const newHash = await argon2.hash(newPassword, {
      memoryCost: ARGON2_CONFIG.memoryCost,
      timeCost: ARGON2_CONFIG.timeCost,
      parallelism: ARGON2_CONFIG.parallelism,
      type: argon2.argon2id
    });

    user.passwordHash = newHash;
    user.argon2Version = ARGON2_CONFIG.version;
    user.mustChangePassword = false;
    // Note: in-session password change does NOT bump sessionVersion (keeps current session alive)
    await user.save();

    // 4. Send security alert email
    await enqueueEmail({
      to: user.email,
      template: 'SECURITY_ALERT',
      userId,
      data: {
        userName: user.name,
        action: 'Password Changed',
        details: 'Your Localo account password was changed from an active session.'
      },
      idempotencyKey: `email:pass-change:${userId}:${Date.now()}`
    });

    await AuditLog.create({
      actorUserId: userId,
      action: 'PASSWORD_CHANGED',
      resourceType: 'User',
      resourceId: userId,
      ip,
      userAgent
    });

    return {
      success: true,
      message: 'Password updated successfully.'
    };
  }

  /**
   * Requests account deletion with last-owner protection
   */
  public async requestAccountDeletion(
    userId: string,
    currentPassword: string,
    ip?: string,
    userAgent?: string
  ) {
    const user = await User.findById(userId);
    if (!user) throw new Error('USER_NOT_FOUND');

    // 1. Verify password if passwordHash exists
    if (user.passwordHash) {
      const isPasswordValid = await argon2.verify(user.passwordHash, currentPassword);
      if (!isPasswordValid) {
        throw createAuthError('INVALID_CREDENTIALS', 401);
      }
    }

    // 2. Last-owner protection check across all workspaces
    const ownedMemberships = await WorkspaceMember.find({ userId: user._id, role: 'owner' });
    const ownedWorkspaceIds = ownedMemberships.map((m) => m.workspaceId);

    if (ownedWorkspaceIds.length > 0) {
      const multiMemberWorkspaceIds: any[] = [];
      const soleWorkspaceIds: any[] = [];

      for (const wsId of ownedWorkspaceIds) {
        const otherMembersCount = await WorkspaceMember.countDocuments({
          workspaceId: wsId,
          userId: { $ne: user._id }
        });

        if (otherMembersCount > 0) {
          multiMemberWorkspaceIds.push(wsId);
        } else {
          soleWorkspaceIds.push(wsId);
        }
      }

      // If user is the sole owner of any multi-member workspace, block deletion
      if (multiMemberWorkspaceIds.length > 0) {
        const blockedWorkspaces = await Workspace.find({ _id: { $in: multiMemberWorkspaceIds } }).select('name');
        const names = blockedWorkspaces.map((w) => `"${w.name}"`).join(', ');
        throw new Error(`You're the only owner of ${names}. Transfer ownership or remove other members first.`);
      }

      // Single-member workspaces owned by this user enter PENDING_DELETION (30 days)
      if (soleWorkspaceIds.length > 0) {
        const deletionScheduledAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await Workspace.updateMany(
          { _id: { $in: soleWorkspaceIds } },
          {
            $set: {
              status: 'PENDING_DELETION',
              deletionScheduledAt
            }
          }
        );
      }
    }

    // 3. Mark user account as PENDING_DELETION (30 days)
    const deletionScheduledAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    user.status = 'PENDING_DELETION';
    user.deletionScheduledAt = deletionScheduledAt;
    await user.save();

    // 4. Send notification email
    await enqueueEmail({
      to: user.email,
      template: 'SECURITY_ALERT',
      userId,
      data: {
        userName: user.name,
        action: 'Account Deletion Scheduled',
        details: 'Your Localo account and single-member workspaces are scheduled for permanent deletion in 30 days.'
      },
      idempotencyKey: `email:account-delete:${userId}:${Date.now()}`
    });

    await AuditLog.create({
      actorUserId: userId,
      action: 'USER_DELETION_SCHEDULED',
      resourceType: 'User',
      resourceId: userId,
      ip,
      userAgent,
      after: { status: 'PENDING_DELETION', deletionScheduledAt }
    });

    return {
      success: true,
      message: 'Account deletion scheduled. Your data will be permanently removed in 30 days.',
      deletionScheduledAt
    };
  }
}

export const accountService = new AccountService();
