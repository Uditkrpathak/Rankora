import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { scanService } from './scan.service';
import { Scan } from '../../models/Scan';
import { redisClient } from '../../config/redis';
import {
  DEFAULT_GRID_SIZE,
  DEFAULT_RADIUS_KM,
  DEFAULT_SCAN_SHAPE,
  DEFAULT_SUNFLOWER_RADIUS_KM,
  FAILED_SCAN_REUSE_MS,
  MAX_RADIUS_KM,
  MIN_RADIUS_KM,
  PARTIAL_SCAN_REUSE_MS,
  RADIUS_STEP_KM,
  SCAN_STALE_AFTER_MS,
  STALLED_SCAN_AFTER_MS,
  SUNFLOWER_POINT_COUNT,
  SUNFLOWER_SCAN_CREDIT_COST,
  VALID_GRID_SIZES,
  GridGenerator,
} from './grid-generator';

export class ScanController {
  public async getScanConfig(_req: AuthenticatedRequest, res: Response): Promise<void> {
    res.status(200).json({
      success: true,
      data: {
        gridSizes: VALID_GRID_SIZES,
        defaultScanShape: DEFAULT_SCAN_SHAPE,
        defaultGridSize: DEFAULT_GRID_SIZE,
        minRadiusKm: MIN_RADIUS_KM,
        maxRadiusKm: MAX_RADIUS_KM,
        radiusStepKm: RADIUS_STEP_KM,
        defaultRadiusKm: DEFAULT_RADIUS_KM,
        defaultSunflowerRadiusKm: DEFAULT_SUNFLOWER_RADIUS_KM,
        staleAfterMs: SCAN_STALE_AFTER_MS,
        partialReuseMs: PARTIAL_SCAN_REUSE_MS,
        failedReuseMs: FAILED_SCAN_REUSE_MS,
        stalledAfterMs: STALLED_SCAN_AFTER_MS,
        maxRank: 20,
        notFoundRank: 21,
        top3Threshold: 3,
        top10Threshold: 10,
        pollingIntervalMs: 2500,
        maxTrackedKeywords: 100,
        scanCreditsByGridSize: Object.fromEntries(VALID_GRID_SIZES.map((size) => [size, GridGenerator.calculateCreditCost(size)])),
        scanShapes: {
          GRID: { defaultGridSize: DEFAULT_GRID_SIZE, defaultRadiusKm: DEFAULT_RADIUS_KM },
          SUNFLOWER: {
            pointCount: SUNFLOWER_POINT_COUNT,
            providerSearchCount: SUNFLOWER_POINT_COUNT,
            creditCost: SUNFLOWER_SCAN_CREDIT_COST,
            defaultRadiusKm: DEFAULT_SUNFLOWER_RADIUS_KM,
          },
        },
      },
    });
  }

  public async triggerLocationScan(req: AuthenticatedRequest, res: Response): Promise<void> {
    const workspaceId = req.params.id;
    const locationId = req.params.locId;
    const { keyword, scanShape, gridSize, radiusKm, center, centerLat, centerLng, centerSource, localization, idempotencyKey, force } = req.body;
    const resolvedCenter = centerLat !== undefined || centerLng !== undefined
      ? { lat: Number(centerLat), lng: Number(centerLng) }
      : center;

    if (!keyword || typeof keyword !== 'string' || !keyword.trim()) {
      res.status(400).json({ error: { code: 'INVALID_KEYWORD', message: 'Target keyword is required' } });
      return;
    }

    try {
      const scan = await scanService.triggerScan({
        workspaceId,
        locationId,
        keyword,
        scanShape,
        gridSize: gridSize === undefined ? undefined : Number(gridSize),
        radiusKm: radiusKm === undefined ? undefined : Number(radiusKm),
        center: resolvedCenter,
        centerSource,
        localization,
        idempotencyKey,
        force: force === true,
      });

      res.status(202).json({
        success: true,
        data: scan,
      });
    } catch (err: any) {
      let status = 400;
      let errorCode = 'SCAN_TRIGGER_FAILED';
      const msg: string = err?.message || 'Failed to trigger scan';

      if (err?.code) {
        errorCode = err.code;
      }
      if (err?.statusCode) {
        status = err.statusCode;
      }

      if (err?.code === 'QUEUE_OVERLOADED' || msg.includes('QUEUE_OVERLOADED')) {
        status = 503;
        errorCode = 'QUEUE_OVERLOADED';
      } else if (err?.code === 'WORKSPACE_QUEUE_OVERLOADED' || msg.includes('WORKSPACE_QUEUE_OVERLOADED')) {
        status = 503;
        errorCode = 'WORKSPACE_QUEUE_OVERLOADED';
      } else if (msg.includes('PROVIDER_CAPACITY_UNAVAILABLE') || err?.code === 'PROVIDER_CAPACITY_UNAVAILABLE' || status === 503) {
        status = 503;
        errorCode = 'PROVIDER_CAPACITY_UNAVAILABLE';
      } else if (msg.includes('RATE_LIMIT_EXCEEDED') || err?.code === 'RATE_LIMIT_EXCEEDED' || status === 429) {
        status = 429;
        errorCode = 'RATE_LIMIT_EXCEEDED';
      } else if (msg.includes('INSUFFICIENT_SCAN_CREDITS') || msg.toLowerCase().includes('insufficient scan credits')) {
        status = 402;
        errorCode = 'INSUFFICIENT_SCAN_CREDITS';
      } else if (msg.includes('MONTHLY_SPEND_CAP_EXCEEDED')) {
        status = 402;
        errorCode = 'MONTHLY_SPEND_CAP_EXCEEDED';
      }

      const retryAfter = err?.retryAfter || (status === 503 ? 60 : undefined);
      if (retryAfter) {
        res.set('Retry-After', String(retryAfter));
      }

      res.status(status).json({
        error: {
          code: errorCode,
          message: msg,
          retryAfter,
        },
        code: errorCode,
        message: msg,
        retryAfter,
      });
    }
  }

  public async getScan(req: AuthenticatedRequest, res: Response): Promise<void> {
    const workspaceId = req.params.id;
    const scanId = req.params.scanId;

    const scan = await scanService.getScanById(scanId, workspaceId);
    if (!scan) {
      res.status(404).json({ error: { code: 'SCAN_NOT_FOUND', message: 'Scan not found' } });
      return;
    }

    const scanObj = typeof (scan as any).toObject === 'function' ? (scan as any).toObject() : { ...scan };
    const legacy = Boolean(
      !scanObj.gridSpecVersion ||
      scanObj.gridSpecVersion < 2 ||
      (scanObj.gridSpec && scanObj.gridSpec.gridSpecVersion < 2)
    );

    res.json({
      success: true,
      data: { ...scanObj, legacy },
    });
  }

  public async listLocationScans(req: AuthenticatedRequest, res: Response): Promise<void> {
    const workspaceId = req.params.id;
    const locationId = req.params.locId;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

    const scans = await scanService.getLocationScans(locationId, workspaceId, limit);
    const formattedScans = scans.map((s: any) => {
      const scanObj = typeof s.toObject === 'function' ? s.toObject() : { ...s };
      const legacy = Boolean(
        !scanObj.gridSpecVersion ||
        scanObj.gridSpecVersion < 2 ||
        (scanObj.gridSpec && scanObj.gridSpec.gridSpecVersion < 2)
      );
      return { ...scanObj, legacy };
    });

    res.json({
      success: true,
      data: formattedScans,
    });
  }

  /**
   * Server-Sent Events (SSE) stream for real-time scan progress
   */
  public async streamScanEvents(req: AuthenticatedRequest, res: Response): Promise<void> {
    const workspaceId = req.params.id;
    const scanId = req.params.scanId;

    const scan = await scanService.getScanById(scanId, workspaceId);
    if (!scan) {
      res.status(404).json({ error: { code: 'SCAN_NOT_FOUND', message: 'Scan not found' } });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const formatPayload = (doc: any) => ({
      scanId: doc._id,
      status: doc.status,
      scanShape: doc.scanShape || 'GRID',
      totalPoints: doc.pointCount ?? (doc.gridSize ? doc.gridSize * doc.gridSize : 9),
      completedPoints: doc.gridPoints?.length || 0,
      metrics: doc.metrics,
      gridPoints: doc.gridPoints || [],
    });

    const initialPayload = formatPayload(scan);
    res.write(`event: progress\ndata: ${JSON.stringify(initialPayload)}\n\n`);

    if (scan.status === 'COMPLETED' || scan.status === 'PARTIAL' || scan.status === 'FAILED') {
      res.write(`event: complete\ndata: ${JSON.stringify(initialPayload)}\n\n`);
      res.end();
      return;
    }

    let isClosed = false;
    let subscriber: any = null;

    const cleanup = async () => {
      if (isClosed) return;
      isClosed = true;
      if (interval) clearInterval(interval);
      if (subscriber) {
        try {
          await subscriber.unsubscribe(`scan:progress:${scanId}`);
          await subscriber.quit();
        } catch (_) {}
        subscriber = null;
      }
    };

    req.on('close', () => {
      cleanup().catch(() => {});
    });

    // Subscribe to Redis PubSub if Redis is available
    if (redisClient && redisClient.status === 'ready') {
      try {
        subscriber = redisClient.duplicate();
        await subscriber.connect();
        await subscriber.subscribe(`scan:progress:${scanId}`);
        subscriber.on('message', (_channel: string, message: string) => {
          if (isClosed) return;
          try {
            const data = JSON.parse(message);
            res.write(`event: progress\ndata: ${message}\n\n`);
            if (data.status === 'COMPLETED' || data.status === 'PARTIAL' || data.status === 'FAILED') {
              res.write(`event: complete\ndata: ${message}\n\n`);
              cleanup().then(() => res.end()).catch(() => res.end());
            }
          } catch (_) {}
        });
      } catch (redisErr) {
        subscriber = null;
      }
    }

    // Safety fallback interval (every 2s) to ensure progress updates even if pub/sub misses or Redis is off
    const interval = setInterval(async () => {
      if (isClosed) {
        clearInterval(interval);
        return;
      }

      try {
        const latest = await Scan.findOne({ _id: scanId, workspaceId });
        if (!latest) {
          clearInterval(interval);
          res.write(`event: error\ndata: ${JSON.stringify({ message: 'Scan missing' })}\n\n`);
          res.end();
          return;
        }

        const payload = formatPayload(latest);
        res.write(`event: progress\ndata: ${JSON.stringify(payload)}\n\n`);

        if (latest.status === 'COMPLETED' || latest.status === 'PARTIAL' || latest.status === 'FAILED') {
          clearInterval(interval);
          res.write(`event: complete\ndata: ${JSON.stringify(payload)}\n\n`);
          cleanup().then(() => res.end()).catch(() => res.end());
        }
      } catch (err: any) {
        cleanup().then(() => res.end()).catch(() => res.end());
      }
    }, 2000);
  }

  public async getLocationScanHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    const workspaceId = req.params.id;
    const locationId = req.params.locId;
    const keyword = req.query.keyword as string | undefined;

    const scans = await scanService.getLocationScanHistory(locationId, workspaceId, keyword);
    res.json({
      success: true,
      data: scans,
    });
  }

  public async shareScan(req: AuthenticatedRequest, res: Response): Promise<void> {
    const workspaceId = req.params.id;
    const scanId = req.params.scanId;
    const { branding, isPublic } = req.body;

    try {
      const scan = await scanService.shareScan(scanId, workspaceId, branding, isPublic !== false);
      res.json({
        success: true,
        data: {
          scanId: scan._id,
          shareToken: scan.shareToken,
          isPublicShareable: scan.isPublicShareable,
          agencyBranding: scan.agencyBranding,
          shareUrl: `${req.protocol}://${req.get('host')}/reports/${scan.shareToken}`,
        },
      });
    } catch (err: any) {
      res.status(400).json({ error: { code: 'SHARE_FAILED', message: err.message } });
    }
  }

  public async getPublicScan(req: any, res: Response): Promise<void> {
    const shareToken = req.params.shareToken;

    if (!shareToken || typeof shareToken !== 'string') {
      res.status(400).json({ error: { code: 'INVALID_TOKEN', message: 'Share token is required' } });
      return;
    }

    const report = await scanService.getPublicScanByToken(shareToken);
    if (!report) {
      res.status(404).json({ error: { code: 'REPORT_NOT_FOUND', message: 'Report not found or sharing has been disabled' } });
      return;
    }

    res.json({
      success: true,
      data: report,
    });
  }
}

export const scanController = new ScanController();
