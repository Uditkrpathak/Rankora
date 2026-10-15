import crypto from 'crypto';
import { ENV } from '../../config/env';
import { GoogleConnection, GoogleConnectionDocument } from '../../models/GoogleConnection';

export interface EncryptedTokenBundle {
  encryptedRefreshToken: string;
  iv: string;
  authTag: string;
  keyVersion: number;
}

export class GoogleVaultService {
  private getKey(keyVersion: number = 1): Buffer {
    const rawKey = ENV.TOKEN_ENCRYPTION_KEY;
    if (rawKey.length === 64) {
      return Buffer.from(rawKey, 'hex');
    }
    return crypto.createHash('sha256').update(rawKey).digest();
  }

  /**
   * Encrypts a refresh token using AES-256-GCM with a fresh 12-byte IV per call (§0 #8)
   */
  public encryptToken(plainRefreshToken: string, keyVersion: number = 1): EncryptedTokenBundle {
    const key = this.getKey(keyVersion);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(plainRefreshToken, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return {
      encryptedRefreshToken: encrypted,
      iv: iv.toString('hex'),
      authTag,
      keyVersion,
    };
  }

  /**
   * Decrypts an encrypted refresh token using AES-256-GCM
   * Throws if the authTag or ciphertext has been tampered with
   */
  public decryptToken(encryptedBundle: {
    encryptedRefreshToken: string;
    iv: string;
    authTag: string;
    keyVersion?: number;
  }): string {
    const key = this.getKey(encryptedBundle.keyVersion || 1);
    const iv = Buffer.from(encryptedBundle.iv, 'hex');
    const authTag = Buffer.from(encryptedBundle.authTag, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedBundle.encryptedRefreshToken, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Retrieves and decrypts the refresh token for a workspace, enforcing workspace scoping (§10.2)
   */
  public async getDecryptedRefreshToken(workspaceId: string, googleEmail?: string): Promise<string> {
    const query: any = { workspaceId, status: { $ne: 'REVOKED' } };
    if (googleEmail) query.googleEmail = googleEmail;

    const connection = await GoogleConnection.findOne(query).sort({ updatedAt: -1 });

    if (!connection) {
      throw new Error('GOOGLE_CONNECTION_INACTIVE');
    }

    return this.decryptToken({
      encryptedRefreshToken: connection.encryptedRefreshToken,
      iv: connection.iv,
      authTag: connection.authTag,
      keyVersion: connection.keyVersion,
    });
  }

  /**
   * Fetches a fresh Google Access Token using the decrypted refresh token
   * Handles invalid_grant revocation detection (§0 #15)
   */
  public async getValidAccessToken(
    workspaceId: string,
    googleEmail?: string,
    requiredScope?: string
  ): Promise<string> {
    const query: any = { workspaceId };
    if (googleEmail) {
      query.googleEmail = googleEmail;
    }
    if (requiredScope) {
      query.scopes = requiredScope;
    }

    let connection = await GoogleConnection.findOne(query).sort({ updatedAt: -1 });
    if (!connection && requiredScope) {
      // Fallback to any connection for the workspace if specific scope match not found
      delete query.scopes;
      connection = await GoogleConnection.findOne(query).sort({ updatedAt: -1 });
    }

    if (!connection || connection.status === 'REVOKED') {
      const err: any = new Error('GOOGLE_CONNECTION_INACTIVE');
      err.statusCode = 409;
      throw err;
    }

    const refreshToken = this.decryptToken({
      encryptedRefreshToken: connection.encryptedRefreshToken,
      iv: connection.iv,
      authTag: connection.authTag,
      keyVersion: connection.keyVersion,
    });

    if (refreshToken.startsWith('mock_')) {
      if (ENV.NODE_ENV === 'production') {
        throw new Error('MOCK_TOKENS_FORBIDDEN_IN_PRODUCTION');
      }
      return `mock_access_token_${workspaceId}`;
    }

    try {
      const tokenUrl = 'https://oauth2.googleapis.com/token';
      const body = new URLSearchParams({
        client_id: ENV.GOOGLE_CLIENT_ID,
        client_secret: ENV.GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      });

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === 'invalid_grant') {
          connection.status = 'REVOKED';
          connection.lastRefreshError = data.error_description || 'invalid_grant: Token revoked by user';
          await connection.save();

          // Mark any locations linked to this workspace/GSC as needing re-authentication
          try {
            const { Location } = await import('../../models/Location');
            await Location.updateMany(
              { workspaceId, gscConnectionStatus: 'connected' },
              { $set: { gscConnectionStatus: 'needs_reauth' } }
            );
          } catch {
            // Non-blocking
          }

          const err: any = new Error('GOOGLE_CONNECTION_REVOKED');
          err.statusCode = 409;
          throw err;
        }

        throw new Error(data.error_description || data.error || 'Failed to refresh Google token');
      }

      return data.access_token;
    } catch (err: any) {
      if (err.message === 'GOOGLE_CONNECTION_REVOKED' || err.statusCode === 409) {
        throw err;
      }
      throw new Error(`GOOGLE_TOKEN_REFRESH_FAILED: ${err.message}`);
    }
  }
}

export const googleVaultService = new GoogleVaultService();
