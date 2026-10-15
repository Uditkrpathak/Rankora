import { Request, Response } from 'express';
import { protectionService } from './protection.service';

export class ProtectionController {
  public async getStatus(req: Request, res: Response): Promise<void> {
    const { workspaceId, locationId } = req.params;
    try {
      const snapshot = await protectionService.getProtectionStatus(workspaceId, locationId);
      res.json({ success: true, data: snapshot });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({
        success: false,
        error: { message: err.message, code: err.code || 'PROTECTION_STATUS_FAILED' },
      });
    }
  }

  public async runCheck(req: Request, res: Response): Promise<void> {
    const { workspaceId, locationId } = req.params;
    try {
      const snapshot = await protectionService.checkProtection(workspaceId, locationId);
      res.json({ success: true, data: snapshot });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({
        success: false,
        error: { message: err.message, code: err.code || 'PROTECTION_CHECK_FAILED' },
      });
    }
  }

  public async resolveIncident(req: Request, res: Response): Promise<void> {
    const { workspaceId, locationId, incidentId } = req.params;
    try {
      const snapshot = await protectionService.resolveIncident(workspaceId, locationId, incidentId);
      res.json({ success: true, data: snapshot });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({
        success: false,
        error: { message: err.message, code: err.code || 'RESOLVE_INCIDENT_FAILED' },
      });
    }
  }
}

export const protectionController = new ProtectionController();
