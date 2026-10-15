import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { JWTPayload, AuthTokens } from '@localo/types';
import { ENV } from '../../config/env';
import { redisClient } from '../../config/redis';
import { RefreshToken, RefreshTokenDocument } from '../../models/RefreshToken';
import { User } from '../../models/User';
import { AuditLog } from '../../models/AuditLog';
import { hashToken, generateSecureToken } from '@localo/shared';

export class TokenService {
  /**
   * Get the current active session version for a user (from Redis with DB fallback)
   */
  public async getSessionVersion(userId: string): Promise<number> {
    try {
      if (redisClient.status === 'ready') {
        const cached = await redisClient.get(`user:session_version:${userId}`);
        if (cached) return parseInt(cached, 10);
      }
    } catch (e) {
      // Fallback
    }

    const user = await User.findById(userId).select('sessionVersion').lean();
    const version = user?.sessionVersion || 1;
    
    try {
      if (redisClient.status === 'ready') {
        await redisClient.set(`user:session_version:${userId}`, version.toString(), 'EX', 86400);
      }
    } catch (e) {}

    return version;
  }

  /**
   * Increment session version, instantly invalidating all existing access tokens
   */
  public async incrementSessionVersion(userId: string, reason: string = 'MANUAL_LOGOUT'): Promise<number> {
    const user = await User.findByIdAndUpdate(
      userId,
      { $inc: { sessionVersion: 1 } },
      { new: true }
    );
    const newVersion = user?.sessionVersion || 1;

    try {
      if (redisClient.status === 'ready') {
        await redisClient.set(`user:session_version:${userId}`, newVersion.toString(), 'EX', 86400);
      }
    } catch (e) {}

    // Revoke all remaining unrevoked refresh tokens
    await RefreshToken.updateMany(
      { userId, isRevoked: false },
      { $set: { isRevoked: true, revokedAt: new Date(), revocationReason: reason } }
    );

    return newVersion;
  }

  /**
   * Sign a 15-minute access JWT with sub and sessionVersion
   */
  public generateAccessToken(userId: string, sessionVersion: number): string {
    const payload: JWTPayload = {
      sub: userId,
      sessionVersion,
      type: 'access'
    };
    return jwt.sign(payload, ENV.JWT_ACCESS_SECRET, { expiresIn: '15m' });
  }

  /**
   * Issue a full token bundle (Access Token + Rotating Refresh Token + Double-Submit CSRF Token)
   */
  public async issueTokenBundle(params: {
    userId: string;
    userAgent?: string;
    ipAddress?: string;
    existingFamilyId?: string;
    parentTokenId?: string;
  }): Promise<AuthTokens> {
    const sessionVersion = await this.getSessionVersion(params.userId);
    const accessToken = this.generateAccessToken(params.userId, sessionVersion);
    const csrfToken = generateSecureToken(16);

    // Generate Refresh Token
    const rawRefreshToken = `${uuidv4()}.${generateSecureToken(32)}`;
    const tokenHashValue = hashToken(rawRefreshToken);
    const tokenId = uuidv4();
    const familyId = params.existingFamilyId || uuidv4();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days TTL

    const ua = params.userAgent || 'Unknown Device';
    const ip = params.ipAddress || '0.0.0.0';

    await RefreshToken.create({
      tokenId,
      familyId,
      userId: params.userId,
      tokenHash: tokenHashValue,
      parentTokenId: params.parentTokenId,
      isRevoked: false,
      userAgent: ua.substring(0, 200),
      userAgentHash: hashToken(ua),
      ipAddress: ip,
      ipHash: hashToken(ip),
      expiresAt
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      csrfToken,
      expiresIn: 15 * 60 // 15 mins in seconds
    };
  }

  /**
   * Rotate a Refresh Token and detect replay attacks
   */
  public async rotateRefreshToken(
    rawToken: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<AuthTokens> {
    const tokenHashValue = hashToken(rawToken);
    const foundToken = await RefreshToken.findOne({ tokenHash: tokenHashValue });

    if (!foundToken) {
      throw new Error('INVALID_REFRESH_TOKEN');
    }

    // Reject refresh token if user is suspended or deleted
    const user = await User.findById(foundToken.userId);
    if (!user || user.status === 'DELETED') {
      throw new Error('USER_NOT_FOUND');
    }
    if (user.status === 'SUSPENDED') {
      throw new Error('ACCOUNT_SUSPENDED');
    }

    // 🚨 REPLAY ATTACK DETECTION
    if (foundToken.isRevoked) {
      if (foundToken.revocationReason === 'ROTATED') {
        console.warn(`🚨 [REPLAY DETECTED] Rotated token ${foundToken.tokenId} in family ${foundToken.familyId} was re-used! Revoking whole family.`);
        
        // 1. Invalidate every token belonging to this compromised family
        await RefreshToken.updateMany(
          { familyId: foundToken.familyId },
          {
            $set: {
              isRevoked: true,
              revokedAt: new Date(),
              revocationReason: 'REPLAY_DETECTED'
            }
          }
        );

        // 2. Increment global user session version so old access tokens are dead
        await this.incrementSessionVersion(foundToken.userId.toString(), 'REPLAY_DETECTED');

        // 3. Log P0 Security Audit
        await AuditLog.create({
          actorUserId: foundToken.userId.toString(),
          action: 'SECURITY_TOKEN_REPLAY_DETECTED',
          resourceType: 'RefreshTokenFamily',
          resourceId: foundToken.familyId,
          ip: ipAddress,
          userAgent,
          before: { tokenId: foundToken.tokenId, familyId: foundToken.familyId }
        });

        throw new Error('TOKEN_REPLAY_DETECTED');
      }

      // If already revoked (e.g. manual logout or previously revoked family)
      throw new Error('REVOKED_REFRESH_TOKEN');
    }

    // Check expiration
    if (foundToken.expiresAt < new Date()) {
      throw new Error('EXPIRED_REFRESH_TOKEN');
    }

    // Token is valid! Mark as rotated
    const nextTokenId = uuidv4();
    foundToken.isRevoked = true;
    foundToken.revokedAt = new Date();
    foundToken.revocationReason = 'ROTATED';
    foundToken.replacedByTokenId = nextTokenId;
    await foundToken.save();

    // Issue child token in same family
    return this.issueTokenBundle({
      userId: foundToken.userId.toString(),
      userAgent,
      ipAddress,
      existingFamilyId: foundToken.familyId,
      parentTokenId: foundToken.tokenId
    });
  }

  /**
   * Revoke a single session / token family
   */
  public async revokeFamily(familyId: string, userId: string): Promise<boolean> {
    const result = await RefreshToken.updateMany(
      { familyId, userId },
      { $set: { isRevoked: true, revokedAt: new Date(), revocationReason: 'MANUAL_LOGOUT' } }
    );
    return result.modifiedCount > 0;
  }
}

export const tokenService = new TokenService();
