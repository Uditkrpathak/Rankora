import { RefreshToken } from '../../models/RefreshToken';
import { AuditLog } from '../../models/AuditLog';
import { tokenService } from './token.service';
import { hashToken } from '@localo/shared';

export interface SessionItem {
  familyId: string;
  userAgent?: string;
  ipAddress?: string;
  locationSummary?: string;
  lastUsedAt?: Date;
  createdAt: Date;
  isCurrent: boolean;
}

export class SessionService {
  /**
   * Lists all active sessions (token families) for a user
   */
  public async listSessions(userId: string, currentRefreshToken?: string): Promise<SessionItem[]> {
    const currentHash = currentRefreshToken ? hashToken(currentRefreshToken) : null;

    // Find all unrevoked, unexpired tokens for this user
    const tokens = await RefreshToken.find({
      userId,
      isRevoked: false,
      expiresAt: { $gt: new Date() }
    })
      .sort({ createdAt: -1 })
      .lean();

    // Group by familyId, picking the latest active token per family
    const familyMap = new Map<string, SessionItem>();

    for (const tok of tokens) {
      if (!familyMap.has(tok.familyId)) {
        familyMap.set(tok.familyId, {
          familyId: tok.familyId,
          userAgent: tok.userAgent,
          ipAddress: tok.ipAddress,
          locationSummary: tok.locationSummary,
          lastUsedAt: tok.lastUsedAt,
          createdAt: tok.createdAt,
          isCurrent: currentHash ? tok.tokenHash === currentHash : false
        });
      }
    }

    return Array.from(familyMap.values());
  }

  /**
   * Revokes a specific session family
   */
  public async revokeSession(familyId: string, userId: string, ip?: string): Promise<boolean> {
    const success = await tokenService.revokeFamily(familyId, userId);
    
    if (success) {
      await AuditLog.create({
        actorUserId: userId,
        action: 'SESSION_REVOKED',
        resourceType: 'Session',
        resourceId: familyId,
        ip
      });
    }

    return success;
  }

  /**
   * Revokes all active sessions for a user (forces global re-login)
   */
  public async revokeAllSessions(userId: string, ip?: string): Promise<void> {
    await tokenService.incrementSessionVersion(userId);

    await AuditLog.create({
      actorUserId: userId,
      action: 'ALL_SESSIONS_REVOKED',
      resourceType: 'User',
      resourceId: userId,
      ip
    });
  }
}

export const sessionService = new SessionService();
