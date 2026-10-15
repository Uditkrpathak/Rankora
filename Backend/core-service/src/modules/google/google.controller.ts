import { Response } from 'express';
import crypto from 'crypto';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { ENV } from '../../config/env';
import { OAuthState } from '../../models/OAuthState';
import { GoogleConnection } from '../../models/GoogleConnection';
import { Workspace } from '../../models/Workspace';
import { Location } from '../../models/Location';
import { AuditLog } from '../../models/AuditLog';
import { googleVaultService } from './google-vault.service';
import { gbpClientService } from './gbp-client.service';
import { gbpImportService } from './gbp-import.service';
import { enqueueSyncJob } from '../../jobs/sync.worker';

export class GoogleController {
  /**
   * Generates a single-use, server-validated OAuth authorization URL (§3)
   */
  public async getAuthUrl(req: AuthenticatedRequest, res: Response): Promise<void> {
    const workspaceId = req.workspace!._id;
    const userId = req.user!._id;

    const linkToLocationId = (req.query.linkToLocationId as string) || (req.body.linkToLocationId as string) || undefined;
    const rawConnectionType = (req.query.connectionType as string) || (req.body.connectionType as string) || 'gbp';
    const connectionType: 'gbp' | 'gsc' = rawConnectionType.toLowerCase() === 'gsc' ? 'gsc' : 'gbp';

    const token = crypto.randomBytes(32).toString('hex');
    await OAuthState.create({
      token,
      workspaceId,
      userId,
      linkToLocationId,
      connectionType,
      createdAt: new Date(),
      used: false,
    });

    const redirectUri = `${ENV.FRONTEND_URL}/locations/google/callback`;
    const scopes = connectionType === 'gsc'
      ? [
          'https://www.googleapis.com/auth/webmasters.readonly',
          'https://www.googleapis.com/auth/userinfo.email',
        ]
      : [
          'https://www.googleapis.com/auth/business.manage',
          'https://www.googleapis.com/auth/userinfo.email',
        ];

    const params = new URLSearchParams({
      client_id: ENV.GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state: token,
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    const isProd = ENV.NODE_ENV === 'production';
    res.cookie('oauth_state_bind', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
    });

    res.status(200).json({
      success: true,
      data: { authUrl },
    });
  }

  /**
   * Completes OAuth code exchange with replay-protection & token encryption
   */
  public async handleCallback(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { code, state } = req.body;
    const workspaceId = req.workspace!._id;
    const userId = req.user!._id;

    if (!code || !state) {
      res.status(400).json({
        success: false,
        error: { code: 'OAUTH_STATE_INVALID', message: 'Missing OAuth code or state parameter' },
      });
      return;
    }

    const cookieState = req.cookies?.['oauth_state_bind'];
    if (cookieState && cookieState !== state) {
      res.status(400).json({
        success: false,
        error: {
          code: 'OAUTH_LOGIN_CSRF_DETECTED',
          message: 'OAuth state was not initiated by this browser session',
        },
      });
      return;
    }
    res.clearCookie('oauth_state_bind');

    const stateRecord = await OAuthState.findOne({ token: state });
    const isStateExpired = stateRecord && Date.now() - stateRecord.createdAt.getTime() > 600_000;

    if (
      !stateRecord ||
      stateRecord.used ||
      isStateExpired ||
      stateRecord.workspaceId.toString() !== workspaceId.toString() ||
      stateRecord.userId.toString() !== userId.toString()
    ) {
      res.status(400).json({
        success: false,
        error: {
          code: 'OAUTH_STATE_INVALID',
          message: 'OAuth state is invalid, expired, or has already been used',
        },
      });
      return;
    }

    stateRecord.used = true;
    await stateRecord.save();

    const redirectUri = `${ENV.FRONTEND_URL}/locations/google/callback`;
    const tokenUrl = 'https://oauth2.googleapis.com/token';

    let tokenData: any;
    try {
      const tokenRes = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: ENV.GOOGLE_CLIENT_ID,
          client_secret: ENV.GOOGLE_CLIENT_SECRET,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }).toString(),
      });
      tokenData = await tokenRes.json();
    } catch {
      // Fallback
    }

    if (!tokenData?.refresh_token) {
      if (ENV.NODE_ENV !== 'production' && typeof code === 'string' && code.startsWith('mock_code_')) {
        tokenData = {
          access_token: 'mock_access_token_123',
          refresh_token: 'mock_refresh_token_123',
          expires_in: 3600,
        };
      } else {
        res.status(502).json({
          success: false,
          error: {
            code: 'GOOGLE_TOKEN_EXCHANGE_FAILED',
            message: tokenData?.error_description || 'Failed to exchange authorization code for refresh token',
          },
        });
        return;
      }
    }

    const refreshToken = tokenData.refresh_token;
    let email = 'connected-business@google.com';
    let accountId = '';

    try {
      const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const userinfo = await userinfoRes.json();
      if (userinfo.email) email = userinfo.email.toLowerCase();
      if (userinfo.id) accountId = userinfo.id;
    } catch (err) {
      console.warn('[Google Callback] Could not fetch user email', err);
    }

    // Encrypt refresh token
    const encryptedBundle = googleVaultService.encryptToken(refreshToken);

    const connectionType: 'gbp' | 'gsc' = stateRecord.connectionType || 'gbp';
    const grantedScopes = connectionType === 'gsc'
      ? ['https://www.googleapis.com/auth/webmasters.readonly']
      : ['https://www.googleapis.com/auth/business.manage'];

    const existingConn = await GoogleConnection.findOne({ workspaceId, googleEmail: email });
    const mergedScopes = Array.from(new Set([...(existingConn?.scopes || []), ...grantedScopes]));
    const mergedType = existingConn?.connectionType && existingConn.connectionType !== connectionType ? 'all' : connectionType;

    // Upsert connection for (workspaceId, googleEmail)
    const connection = await GoogleConnection.findOneAndUpdate(
      { workspaceId, googleEmail: email },
      {
        workspaceId,
        connectedByUserId: userId,
        googleEmail: email,
        googleAccountId: accountId || email,
        encryptedRefreshToken: encryptedBundle.encryptedRefreshToken,
        iv: encryptedBundle.iv,
        authTag: encryptedBundle.authTag,
        keyVersion: encryptedBundle.keyVersion,
        scopes: mergedScopes,
        connectionType: mergedType,
        status: 'CONNECTED',
        lastRefreshError: null,
        lastSyncedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    if (connectionType === 'gbp' || mergedType === 'all') {
      await Workspace.findByIdAndUpdate(workspaceId, { gbpConnectionStatus: 'connected' });
    }

    const targetLocationId = stateRecord.linkToLocationId || (req.body.linkToLocationId as string);
    if (targetLocationId) {
      if (connectionType === 'gsc') {
        await Location.findOneAndUpdate(
          { _id: targetLocationId, workspaceId },
          {
            gscConnectionStatus: 'connected',
          }
        );
      } else {
        await Location.findOneAndUpdate(
          { _id: targetLocationId, workspaceId },
          {
            googleConnectionId: connection._id.toString(),
            ownershipVerified: true,
            status: 'active',
          }
        );
      }
    }

    await AuditLog.create({
      workspaceId,
      actorUserId: userId,
      action: connectionType === 'gsc' ? 'GOOGLE_GSC_CONNECTED' : 'GOOGLE_GBP_CONNECTED',
      resourceType: 'GoogleConnection',
      resourceId: connection._id.toString(),
      metadata: { googleEmail: email, linkedLocationId: targetLocationId, connectionType },
    });

    res.status(200).json({
      success: true,
      data: {
        isConnected: true,
        connectionType,
        googleEmail: connection.googleEmail,
        status: connection.status,
        linkedLocationId: targetLocationId || null,
      },
    });
  }

  /**
   * Retrieves Google connection status for the active workspace
   */
  public async getStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    const workspaceId = req.workspace!._id;
    const connections = await GoogleConnection.find({ workspaceId });

    const activeConnections = connections.filter((c) => c.status === 'CONNECTED');

    if (activeConnections.length === 0) {
      res.status(200).json({
        success: true,
        data: {
          isConnected: false,
          status: connections[0]?.status || 'NOT_CONNECTED',
          lastRefreshError: connections[0]?.lastRefreshError || null,
          accounts: [],
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        isConnected: true,
        googleEmail: activeConnections[0].googleEmail,
        status: activeConnections[0].status,
        lastSyncedAt: activeConnections[0].lastSyncedAt,
        accounts: activeConnections.map((c) => ({
          _id: c._id,
          googleEmail: c.googleEmail,
          status: c.status,
          lastSyncedAt: c.lastSyncedAt,
        })),
      },
    });
  }

  /**
   * Lists all connected Google accounts for a workspace
   */
  public async getAccounts(req: AuthenticatedRequest, res: Response): Promise<void> {
    const workspaceId = req.workspace!._id;
    const connections = await GoogleConnection.find({ workspaceId, status: 'CONNECTED' });

    res.status(200).json({
      success: true,
      data: {
        accounts: connections.map((c) => ({
          _id: c._id,
          googleEmail: c.googleEmail,
          googleAccountId: c.googleAccountId,
          status: c.status,
          lastSyncedAt: c.lastSyncedAt,
        })),
      },
    });
  }

  /**
   * Disconnects GBP connection(s)
   */
  public async disconnect(req: AuthenticatedRequest, res: Response): Promise<void> {
    const workspaceId = req.workspace!._id;
    const userId = req.user!._id;
    const { email } = req.body || {};

    const query: any = { workspaceId };
    if (email) query.googleEmail = email.toLowerCase();

    const connections = await GoogleConnection.find(query);
    const primaryConnId = connections[0]?._id?.toString() || workspaceId.toString();

    for (const connection of connections) {
      try {
        const refreshToken = googleVaultService.decryptToken({
          encryptedRefreshToken: connection.encryptedRefreshToken,
          iv: connection.iv,
          authTag: connection.authTag,
          keyVersion: connection.keyVersion,
        });
        await gbpClientService.revokeToken(refreshToken);
      } catch (err) {
        console.warn('[GBP Disconnect Warning] Token decrypt/revoke failed during disconnect', err);
      }

      await GoogleConnection.deleteOne({ _id: connection._id });
    }

    const remaining = await GoogleConnection.countDocuments({ workspaceId, status: 'CONNECTED' });
    if (remaining === 0) {
      await Workspace.findByIdAndUpdate(workspaceId, { gbpConnectionStatus: 'disconnected' });
      await Location.updateMany(
        { workspaceId },
        {
          $set: {
            googleConnectionId: null,
            syncStatus: 'STANDALONE',
          },
        }
      );
    }

    await AuditLog.create({
      workspaceId,
      actorUserId: userId,
      action: 'GOOGLE_GBP_DISCONNECTED',
      resourceType: 'GoogleConnection',
      resourceId: primaryConnId,
      metadata: { disconnectedEmail: email || 'all' },
    });

    res.status(200).json({
      success: true,
      data: { isConnected: remaining > 0, remainingAccounts: remaining },
    });
  }

  /**
   * Lists discoverable GBP locations for import
   */
  public async getDiscoveredLocations(req: AuthenticatedRequest, res: Response): Promise<void> {
    const workspaceId = req.workspace!._id.toString();
    const locations = await gbpImportService.getDiscoveredLocations(workspaceId);

    res.status(200).json({
      success: true,
      data: { locations },
    });
  }

  /**
   * Imports a single chosen GBP location into the workspace
   */
  public async importLocation(req: AuthenticatedRequest, res: Response): Promise<void> {
    const workspaceId = req.workspace!._id.toString();
    const userId = req.user!._id.toString();
    const locationData = req.body;

    const imported = await gbpImportService.importLocation(workspaceId, userId, locationData);

    res.status(201).json({
      success: true,
      data: { location: imported },
    });
  }

  /**
   * Batch imports multiple GBP locations with per-item quota and duplicate checks
   */
  public async batchImport(req: AuthenticatedRequest, res: Response): Promise<void> {
    const workspaceId = req.workspace!._id.toString();
    const userId = req.user!._id.toString();
    const { locations } = req.body;

    if (!Array.isArray(locations) || locations.length === 0) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_LOCATIONS_PAYLOAD', message: 'locations array is required' },
      });
      return;
    }

    const result = await gbpImportService.batchImportLocations(workspaceId, userId, locations);

    res.status(200).json({
      success: true,
      data: result,
    });
  }

  /**
   * Triggers an on-demand sync for a connected location
   */
  public async syncLocation(req: AuthenticatedRequest, res: Response): Promise<void> {
    const workspaceId = req.workspace!._id.toString();
    const { locId } = req.params;

    const location = await Location.findOne({ _id: locId, workspaceId, deletedAt: null });
    if (!location) {
      res.status(404).json({ success: false, error: { code: 'LOCATION_NOT_FOUND', message: 'Location not found' } });
      return;
    }

    if (location.addedVia === 'places_search' && !location.ownershipVerified) {
      res.status(403).json({
        success: false,
        error: {
          code: 'GBP_OWNERSHIP_UNVERIFIED',
          message: 'This action requires verified ownership. Please connect this profile via Google OAuth to enable editing and replies.',
        },
      });
      return;
    }

    if (!location.googleConnectionId) {
      res.status(409).json({
        success: false,
        error: { code: 'LOCATION_NOT_CONNECTED', message: 'Location is not linked to a Google Business Profile' },
      });
      return;
    }

    const connection = await GoogleConnection.findOne({
      _id: location.googleConnectionId,
      workspaceId,
      status: 'CONNECTED',
    });
    if (!connection) {
      res.status(409).json({
        success: false,
        error: { code: 'GOOGLE_CONNECTION_INACTIVE', message: 'Google connection is inactive or revoked' },
      });
      return;
    }

    if (location.syncStatus === 'PENDING') {
      res.status(200).json({ success: true, data: { location, message: 'Sync already pending' } });
      return;
    }

    location.syncStatus = 'PENDING';
    location.syncError = null;
    await location.save();

    try {
      const jobId = await enqueueSyncJob({ workspaceId, locationId: locId, isManual: true });
      if (!jobId) {
        throw Object.assign(new Error('Google sync queue is unavailable. Confirm Redis is running and retry.'), { statusCode: 503, code: 'SYNC_QUEUE_UNAVAILABLE' });
      }
    } catch (error: any) {
      console.error('[syncLocation catch error]:', error);
      location.syncStatus = 'ERROR';
      location.syncError = error?.message || 'Could not queue Google sync.';
      await location.save();
      res.status(error?.statusCode || 503).json({
        success: false,
        error: { code: error?.code || 'SYNC_QUEUE_FAILED', message: location.syncError },
      });
      return;
    }

    res.status(202).json({
      success: true,
      data: { location, message: 'Google profile sync started.' },
    });
  }
}

export const googleController = new GoogleController();
