import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { locationService } from './location.service';
import { createLocationSchema, updateLocationSchema } from './location.schema';

export class LocationController {
  public async createLocation(req: AuthenticatedRequest, res: Response): Promise<void> {
    const workspaceId = req.workspace!._id.toString();
    const actorUserId = req.user!._id.toString();
    const ip = req.ip || req.socket.remoteAddress;

    const input = createLocationSchema.parse(req.body);
    const location = await locationService.createLocation(workspaceId, input, actorUserId, ip);

    res.status(201).json({
      success: true,
      data: location,
    });
  }

  public async listLocations(req: AuthenticatedRequest, res: Response): Promise<void> {
    const workspaceId = req.workspace!._id.toString();
    const page = parseInt((req.query.page as string) || '1', 10);
    const limit = Math.min(parseInt((req.query.limit as string) || '20', 10), 100);
    const search = req.query.search as string | undefined;

    const result = await locationService.listLocations(workspaceId, page, limit, search);

    res.status(200).json({
      success: true,
      data: result,
    });
  }

  public async getLocation(req: AuthenticatedRequest, res: Response): Promise<void> {
    const workspaceId = req.workspace!._id.toString();
    const { locId } = req.params;

    const location = await locationService.getLocation(locId, workspaceId);
    if (!location) {
      res.status(404).json({
        success: false,
        error: { code: 'LOCATION_NOT_FOUND', message: 'Location not found' },
      });
      return;
    }

    res.status(200).json({ success: true, data: location });
  }

  public async updateLocation(req: AuthenticatedRequest, res: Response): Promise<void> {
    const workspaceId = req.workspace!._id.toString();
    const actorUserId = req.user!._id.toString();
    const ip = req.ip || req.socket.remoteAddress;
    const { locId } = req.params;

    const patch = updateLocationSchema.parse(req.body);
    const location = await locationService.updateLocation(locId, workspaceId, patch, actorUserId, ip);

    if (!location) {
      res.status(404).json({
        success: false,
        error: { code: 'LOCATION_NOT_FOUND', message: 'Location not found' },
      });
      return;
    }

    res.status(200).json({ success: true, data: location });
  }

  public async deleteLocation(req: AuthenticatedRequest, res: Response): Promise<void> {
    const workspaceId = req.workspace!._id.toString();
    const actorUserId = req.user!._id.toString();
    const ip = req.ip || req.socket.remoteAddress;
    const { locId } = req.params;

    const deleted = await locationService.deleteLocation(locId, workspaceId, actorUserId, ip);

    if (!deleted) {
      res.status(404).json({
        success: false,
        error: { code: 'LOCATION_NOT_FOUND', message: 'Location not found' },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: { message: 'Location deleted successfully.' },
    });
  }

  public async getOverview(req: AuthenticatedRequest, res: Response): Promise<void> {
    const workspaceId = req.workspace!._id.toString();
    const page = parseInt((req.query.page as string) || '1', 10);
    const limit = Math.min(parseInt((req.query.limit as string) || '20', 10), 100);
    const search = req.query.search as string;
    const status = req.query.status as string;
    const googleAccountId = req.query.googleAccountId as string;
    const tag = req.query.tag as string;
    const sortBy = req.query.sortBy as string;

    const result = await locationService.getOverview(
      workspaceId,
      page,
      limit,
      search,
      status,
      googleAccountId,
      tag,
      sortBy
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  }

  public async toggleOptimization(req: AuthenticatedRequest, res: Response): Promise<void> {
    const workspaceId = req.workspace!._id.toString();
    const actorUserId = req.user!._id.toString();
    const ip = req.ip || req.socket.remoteAddress;
    const { locId } = req.params;
    const { enabled } = req.body;

    const location = await locationService.toggleOptimization(
      locId,
      workspaceId,
      Boolean(enabled),
      actorUserId,
      ip
    );

    res.status(200).json({
      success: true,
      data: location,
    });
  }

  public async togglePin(req: AuthenticatedRequest, res: Response): Promise<void> {
    const workspaceId = req.workspace!._id.toString();
    const actorUserId = req.user!._id.toString();
    const ip = req.ip || req.socket.remoteAddress;
    const { locId } = req.params;

    const location = await locationService.togglePin(locId, workspaceId, actorUserId, ip);

    res.status(200).json({
      success: true,
      data: location,
    });
  }

  public async getSingleLocationDashboard(req: AuthenticatedRequest, res: Response): Promise<void> {
    const workspaceId = req.workspace!._id.toString();
    const { locId } = req.params;

    const dashboard = await locationService.getSingleLocationDashboard(locId, workspaceId);

    res.status(200).json({
      success: true,
      data: dashboard,
    });
  }

  public async getWorkspaceDashboardMetrics(req: AuthenticatedRequest, res: Response): Promise<void> {
    const workspaceId = req.workspace!._id.toString();
    const timeframe = (req.query.timeframe as '7d' | '30d' | '90d') || '30d';

    const metrics = await locationService.getWorkspaceDashboardMetrics(workspaceId, timeframe);

    res.status(200).json({
      success: true,
      data: metrics,
    });
  }
}

export const locationController = new LocationController();
