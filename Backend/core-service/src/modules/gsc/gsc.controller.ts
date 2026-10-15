import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { Location } from '../../models/Location';
import { redisClient } from '../../config/redis';
import { gscService } from './gsc.service';
import { enqueueGscSync } from '../../jobs/gsc.worker';

const SYNC_RATE_LIMIT_SECONDS = 15 * 60; // 15 minutes

export class GscController {
  /**
   * Lists verified sites from Google Search Console for the workspace's Google connection
   * GET /v1/workspaces/:id/gsc/sites
   */
  public async listSites(req: AuthenticatedRequest, res: Response): Promise<void> {
    const workspaceId = req.workspace!._id.toString();

    try {
      const sites = await gscService.getSitesForWorkspace(workspaceId);
      res.json({
        success: true,
        data: {
          sites,
        },
      });
    } catch (err: any) {
      if (err.message === 'GOOGLE_CONNECTION_REVOKED' || err.statusCode === 409) {
        res.status(409).json({
          success: false,
          error: {
            code: 'GOOGLE_CONNECTION_REVOKED',
            message: 'Google authorization is expired or revoked. Please reconnect Google Search Console.',
          },
        });
        return;
      }
      if (err.code === 'GSC_INSUFFICIENT_SCOPE' || err.statusCode === 403) {
        res.status(403).json({
          success: false,
          error: {
            code: 'GSC_INSUFFICIENT_SCOPE',
            message: 'Insufficient permissions for Search Console. Please reconnect with Search Console permissions.',
          },
        });
        return;
      }
      res.status(err.statusCode || 500).json({
        success: false,
        error: {
          code: err.code || 'GSC_SITES_FETCH_ERROR',
          message: err.message || 'Failed to fetch verified properties from Google Search Console.',
        },
      });
    }
  }

  /**
   * Connects a verified GSC siteUrl to a location and triggers the initial background sync
   * POST /v1/workspaces/:id/gsc/locations/:locId/connect
   */
  public async connectSite(req: AuthenticatedRequest, res: Response): Promise<void> {
    const workspaceId = req.workspace!._id.toString();
    const { locId } = req.params;
    const { siteUrl } = req.body || {};

    if (!siteUrl || typeof siteUrl !== 'string' || !siteUrl.trim()) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'siteUrl is required (e.g. sc-domain:example.com or https://example.com/).',
        },
      });
      return;
    }

    const trimmedSiteUrl = siteUrl.trim();

    const location = await Location.findOne({ _id: locId, workspaceId, deletedAt: null });
    if (!location) {
      res.status(404).json({
        success: false,
        error: {
          code: 'LOCATION_NOT_FOUND',
          message: 'Location not found in this workspace.',
        },
      });
      return;
    }

    location.gscSiteUrl = trimmedSiteUrl;
    location.gscConnectionStatus = 'connected';
    await location.save();

    // Trigger initial sync as a background job without blocking the request
    enqueueGscSync(location._id.toString(), workspaceId).catch((err) => {
      console.error(`[GSC Connect] Failed to trigger background sync for location ${locId}:`, err);
    });

    res.json({
      success: true,
      message: 'Google Search Console property connected. Initial data synchronization started in background.',
      data: {
        locationId: location._id,
        siteUrl: trimmedSiteUrl,
        gscConnectionStatus: 'connected',
      },
    });
  }

  /**
   * Retrieves daily clicks, impressions, and CTR performance
   * GET /v1/workspaces/:id/gsc/locations/:locId/performance?range=28d|90d
   */
  public async getPerformance(req: AuthenticatedRequest, res: Response): Promise<void> {
    const workspaceId = req.workspace!._id.toString();
    const { locId } = req.params;
    const range = req.query.range === '90d' ? '90d' : '28d';

    const location = await Location.findOne({ _id: locId, workspaceId, deletedAt: null });
    if (!location) {
      res.status(404).json({
        success: false,
        error: {
          code: 'LOCATION_NOT_FOUND',
          message: 'Location not found in this workspace.',
        },
      });
      return;
    }

    const performance = await gscService.getPerformanceHistory(locId, range);
    res.json({
      success: true,
      data: performance,
    });
  }

  /**
   * Retrieves high-opportunity queries (discovered and striking-distance)
   * GET /v1/workspaces/:id/gsc/locations/:locId/top-queries
   */
  public async getTopQueries(req: AuthenticatedRequest, res: Response): Promise<void> {
    const workspaceId = req.workspace!._id.toString();
    const { locId } = req.params;

    const location = await Location.findOne({ _id: locId, workspaceId, deletedAt: null });
    if (!location) {
      res.status(404).json({
        success: false,
        error: {
          code: 'LOCATION_NOT_FOUND',
          message: 'Location not found in this workspace.',
        },
      });
      return;
    }

    const opportunities = await gscService.getOpportunityQueriesForLocation(locId);
    res.json({
      success: true,
      data: opportunities,
    });
  }

  /**
   * Retrieves GSC metrics mapped to active tracked keywords
   * GET /v1/workspaces/:id/gsc/locations/:locId/keyword-metrics
   */
  public async getKeywordMetrics(req: AuthenticatedRequest, res: Response): Promise<void> {
    const workspaceId = req.workspace!._id.toString();
    const { locId } = req.params;

    const location = await Location.findOne({ _id: locId, workspaceId, deletedAt: null });
    if (!location) {
      res.status(404).json({
        success: false,
        error: {
          code: 'LOCATION_NOT_FOUND',
          message: 'Location not found in this workspace.',
        },
      });
      return;
    }

    const keywordMetrics = await gscService.getKeywordMetrics(locId);
    res.json({
      success: true,
      data: keywordMetrics,
    });
  }

  /**
   * Triggers a manual re-sync, rate-limited per location
   * POST /v1/workspaces/:id/gsc/locations/:locId/sync
   */
  public async manualSync(req: AuthenticatedRequest, res: Response): Promise<void> {
    const workspaceId = req.workspace!._id.toString();
    const { locId } = req.params;

    const location = await Location.findOne({ _id: locId, workspaceId, deletedAt: null });
    if (!location) {
      res.status(404).json({
        success: false,
        error: {
          code: 'LOCATION_NOT_FOUND',
          message: 'Location not found in this workspace.',
        },
      });
      return;
    }

    if (!location.gscSiteUrl || location.gscConnectionStatus !== 'connected') {
      res.status(400).json({
        success: false,
        error: {
          code: 'GSC_NOT_CONNECTED',
          message: 'Google Search Console is not connected for this location.',
        },
      });
      return;
    }

    // Rate-limiting check: at most once every 15 minutes per location
    const rateLimitKey = `gsc:rate_limit:${locId}`;
    let isRateLimited = false;

    if (redisClient && redisClient.status === 'ready') {
      const exists = await redisClient.get(rateLimitKey);
      if (exists) {
        isRateLimited = true;
      }
    } else if (location.gscLastSyncedAt) {
      const elapsedMs = Date.now() - new Date(location.gscLastSyncedAt).getTime();
      if (elapsedMs < SYNC_RATE_LIMIT_SECONDS * 1000) {
        isRateLimited = true;
      }
    }

    if (isRateLimited) {
      res.status(429).json({
        success: false,
        error: {
          code: 'GSC_SYNC_RATE_LIMITED',
          message: 'Search Console sync was run recently. Manual re-sync is limited to once every 15 minutes.',
        },
      });
      return;
    }

    // Set rate limit in Redis
    if (redisClient && redisClient.status === 'ready') {
      await redisClient.set(rateLimitKey, '1', 'EX', SYNC_RATE_LIMIT_SECONDS).catch(() => {});
    }

    // Queue sync in background
    await enqueueGscSync(locId, workspaceId, true);

    res.json({
      success: true,
      message: 'Google Search Console synchronization has been queued.',
      data: {
        locationId: location._id,
        gscSiteUrl: location.gscSiteUrl,
        lastSyncedAt: location.gscLastSyncedAt,
      },
    });
  }
}

export const gscController = new GscController();
